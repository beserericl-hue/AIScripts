/**
 * CR-040 follow-on (2026-05-27) — POST /api/imports/:importId/redetect
 * integration tests.
 *
 * The Re-run detectors button on the Review surface posts here. The
 * controller:
 *   1. Validates the import + submission exist and the caller owns
 *      the submission's institution.
 *   2. Confirms aiS3Key is set (the ai-service can pull the DOCX).
 *   3. POSTs /ai/import/redetect to the ai-service with HMAC signing.
 *   4. Persists the response into SelfStudyImport.aiCVs / aiEvidenceDocs
 *      / aiIntroductionHints.
 *   5. Merges the new cvs[] / evidenceDocs[] into Submission.aiReviewState
 *      via aiReviewMerge — existing approvals / edits / discards survive.
 *   6. Returns counts + tocDiagnostics + a human-readable message.
 *
 * These tests run against an in-memory MongoMemoryServer + supertest, with
 * global.fetch stubbed to simulate the ai-service. They cover:
 *   - Owner-institution gating (PC at A blocked from redetecting B's import)
 *   - 404 on missing import / missing submission
 *   - 409 on missing aiS3Key
 *   - 502 when the ai-service fails or returns ok:false
 *   - Happy path persists aiCVs + aiEvidenceDocs
 *   - Happy path runs the aiReviewMerge so cvs land in aiReviewState
 *   - tocDiagnostics is surfaced verbatim in the response
 *   - The message text mentions TOC recovery when tocAdded > 0
 *   - Re-detect twice is idempotent (no duplicate CVs after second call)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

// --- Test fixtures ----------------------------------------------------

async function seedSubmission(userId: any, institutionId?: any) {
  return Submission.create({
    submissionId: `REDETECT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    institutionName: 'Test U',
    institutionId: institutionId ?? new mongoose.Types.ObjectId(),
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'draft',
  } as any);
}

async function seedImport(submissionId: any, userId: any, opts: { s3Key?: string | null } = {}) {
  const fields: any = {
    submissionId,
    originalFilename: 'stevenson-redetect.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: 'completed',
    aiStatus: 'parsed',
    aiProgramLevel: 'bachelors',
    aiBuckets: {} as any,
    aiTags: [],
    aiErrors: [],
    aiCVs: [],
    aiEvidenceDocs: [],
    aiIntroductionHints: {},
    extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
    mappedSections: [],
    unmappedContent: [],
  };
  if (opts.s3Key !== null) {
    fields.aiS3Key = opts.s3Key ?? `imports/${submissionId}/source.docx`;
  }
  return SelfStudyImport.create(fields);
}

/**
 * Build a Stevenson-shaped /ai/import/redetect response — pattern
 * detector found 2 CVs, TOC pass recovered 3 more, total = 5.
 */
function buildAIResponse(opts: { tocAdded?: { cvs?: number; papers?: number; syllabi?: number } } = {}) {
  const tocAdded = opts.tocAdded ?? { cvs: 3, papers: 0, syllabi: 0 };
  const cvs = [
    {
      sectionId: 'cv-pattern:1',
      facultyName: 'John Rosicky',
      snippet: 'John Rosicky 1051 Omar Dr...',
      htmlSnippet: '<p>John Rosicky</p>',
      byteOffsetStart: 100,
      routing: { source: 'matcher' },
      sectionMarkerCount: 3,
    },
    {
      sectionId: 'cv-pattern:2',
      facultyName: 'Carol A. Dietrich',
      snippet: 'Carol A. Dietrich 5766 Kinsmen Courage Court...',
      htmlSnippet: '<p>Carol A. Dietrich</p>',
      byteOffsetStart: 200,
      routing: { source: 'matcher' },
      sectionMarkerCount: 3,
    },
    {
      sectionId: 'cv-toc:300:thomas-k-swisher',
      facultyName: 'Thomas K. Swisher, J.D., Ph.D.',
      snippet: 'Thomas K. Swisher 11886 Simpson Road...',
      htmlSnippet: '<p>Thomas K. Swisher, J.D., Ph.D.</p>',
      byteOffsetStart: 300,
      routing: { source: 'toc' },
      sectionMarkerCount: 0,
    },
    {
      sectionId: 'cv-toc:400:lauri-a-weiner',
      facultyName: 'LAURI A. WEINER, HS-BCP',
      snippet: 'LAURI A. WEINER 7905 Winterset Avenue...',
      htmlSnippet: '<p>LAURI A. WEINER, HS-BCP</p>',
      byteOffsetStart: 400,
      routing: { source: 'toc' },
      sectionMarkerCount: 0,
    },
    {
      sectionId: 'cv-toc:500:mary-beth-olson',
      facultyName: 'Mary Beth Olson, M.A.',
      snippet: 'Mary Beth Olson 250 Faculty Drive...',
      htmlSnippet: '<p>Mary Beth Olson, M.A.</p>',
      byteOffsetStart: 500,
      routing: { source: 'toc' },
      sectionMarkerCount: 0,
    },
  ];
  const evidenceDocs = [
    {
      sectionId: 'syllabus-pattern:1',
      docSubKind: 'syllabus',
      title: 'CHS 220 Spring 2019',
      summary: 'Course Syllabus — Introduction to Human Services.',
      byteOffsetStart: 600,
      pageCountEstimate: 5,
      imageCount: 0,
      courseCode: 'CHS 220',
      points: null,
      s3Key: null,
      s3Bucket: null,
      fileSize: null,
      sha256: null,
    },
  ];
  return {
    ok: true,
    cvs,
    evidenceDocs,
    introductionHints: {},
    counts: { cvs: cvs.length, papers: 0, syllabi: 1, introHints: 0 },
    tocDiagnostics: {
      tocEntriesFound: 8,
      tocAnchoredDetections: 6,
      tocAdded,
    },
  };
}

/**
 * Patch global.fetch so requests to ai-service paths return controlled
 * payloads. Returns a thin record of how many times the redetect path
 * was hit + with what payload — handy for asserting the controller
 * actually called the ai-service.
 */
function stubAIService(responseFor: (path: string, body: any) => Response | Promise<Response>) {
  const calls: Array<{ url: string; body: any }> = [];
  global.fetch = vi.fn(async (url: any, init: any) => {
    const u = String(url);
    let parsed: any = null;
    try {
      parsed = init?.body ? JSON.parse(init.body) : null;
    } catch {
      parsed = null;
    }
    calls.push({ url: u, body: parsed });
    return responseFor(u, parsed);
  }) as any;
  return calls;
}

// --- Tests -------------------------------------------------------------

describe('POST /api/imports/:importId/redetect', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 404 for a missing import', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/imports/${fakeId}/redetect`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/import not found/i);
  });

  it('returns 409 when the import has no aiS3Key', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id, { s3Key: null });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/redetect`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('no-s3-key');
    expect(res.body.detail).toMatch(/no S3 key/i);
  });

  it('returns 502 when the ai-service responds with ok:false', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    const token = signTokenFor(user as any);
    stubAIService(() => new Response(
      JSON.stringify({ ok: false, error: 'pipeline-broke' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    const res = await request(app)
      .post(`/api/imports/${imp._id}/redetect`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('ai-service-bad-shape');
  });

  it('returns 502 when the ai-service fetch itself fails', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    const token = signTokenFor(user as any);
    global.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as any;
    const res = await request(app)
      .post(`/api/imports/${imp._id}/redetect`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('ai-service-failed');
  });

  it('blocks a program_coordinator from redetecting a cross-institution import', async () => {
    const instA = new mongoose.Types.ObjectId();
    const instB = new mongoose.Types.ObjectId();
    const { user: userA } = await createUser({
      role: 'program_coordinator',
      institutionId: instA.toString(),
    });
    const subB = await seedSubmission(userA._id, instB);
    const imp = await seedImport(subB._id, userA._id);
    const token = signTokenFor(userA as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/redetect`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
  });

  describe('happy path', () => {
    it('persists aiCVs + aiEvidenceDocs from the ai-service response', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id);
      const token = signTokenFor(user as any);
      const aiResp = buildAIResponse();
      stubAIService(() => new Response(JSON.stringify(aiResp), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const res = await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const reloaded = await SelfStudyImport.findById(imp._id).lean();
      expect(reloaded?.aiCVs).toHaveLength(5);
      const names = (reloaded?.aiCVs as any[]).map((c) => c.facultyName);
      expect(names).toContain('Thomas K. Swisher, J.D., Ph.D.');
      expect(names).toContain('LAURI A. WEINER, HS-BCP');
      expect(names).toContain('Mary Beth Olson, M.A.');
      expect(reloaded?.aiEvidenceDocs).toHaveLength(1);
      expect((reloaded?.aiEvidenceDocs as any[])[0].docSubKind).toBe('syllabus');
    });

    it('runs the ai-service call with the import + submission + s3 key payload', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id, { s3Key: 'imports/test/source.docx' });
      const token = signTokenFor(user as any);
      const calls = stubAIService(() => new Response(
        JSON.stringify(buildAIResponse()),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      const redetectCall = calls.find((c) => c.url.endsWith('/ai/import/redetect'));
      expect(redetectCall).toBeDefined();
      expect(redetectCall!.body.s3Key).toBe('imports/test/source.docx');
      expect(redetectCall!.body.importId).toBe(String(imp._id));
      expect(redetectCall!.body.submissionId).toBe(String(sub._id));
    });

    it('merges the new CVs into Submission.aiReviewState so the Review surface picks them up', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id);
      const token = signTokenFor(user as any);
      stubAIService(() => new Response(
        JSON.stringify(buildAIResponse()),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      const reloadedSub: any = await Submission.findById(sub._id).lean();
      const reviewCvs = reloadedSub?.aiReviewState?.cvs || [];
      expect(reviewCvs).toHaveLength(5);
      const names = reviewCvs.map((c: any) => c.facultyName);
      expect(names).toContain('Thomas K. Swisher, J.D., Ph.D.');
      expect(names).toContain('LAURI A. WEINER, HS-BCP');
    });

    it('returns counts + tocDiagnostics verbatim from the ai-service', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id);
      const token = signTokenFor(user as any);
      stubAIService(() => new Response(
        JSON.stringify(buildAIResponse()),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      const res = await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.body.counts).toEqual({ cvs: 5, papers: 0, syllabi: 1, introHints: 0 });
      expect(res.body.tocDiagnostics).toMatchObject({
        tocEntriesFound: 8,
        tocAnchoredDetections: 6,
        tocAdded: { cvs: 3, papers: 0, syllabi: 0 },
      });
    });

    it('includes "TOC pass recovered N" blurb when the TOC contributed', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id);
      const token = signTokenFor(user as any);
      stubAIService(() => new Response(
        JSON.stringify(buildAIResponse({ tocAdded: { cvs: 3, papers: 0, syllabi: 0 } })),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      const res = await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.body.message).toMatch(/Re-detect complete/);
      expect(res.body.message).toMatch(/TOC pass recovered 3 CV/);
    });

    it('does NOT include the TOC blurb when tocAdded is all zero', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id);
      const token = signTokenFor(user as any);
      stubAIService(() => new Response(
        JSON.stringify(buildAIResponse({ tocAdded: { cvs: 0, papers: 0, syllabi: 0 } })),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      const res = await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.body.message).toMatch(/Re-detect complete/);
      expect(res.body.message).not.toMatch(/TOC pass recovered/);
    });

    it('is idempotent — re-detecting twice does NOT duplicate CVs in aiReviewState', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id);
      const token = signTokenFor(user as any);
      stubAIService(() => new Response(
        JSON.stringify(buildAIResponse()),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      // First call.
      const r1 = await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(r1.status).toBe(200);

      // Second call — same response, but aiReviewMerge's dedupe-by-sectionId
      // must NOT add the same CVs again.
      const r2 = await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(r2.status).toBe(200);

      const reloadedSub: any = await Submission.findById(sub._id).lean();
      const reviewCvs = reloadedSub?.aiReviewState?.cvs || [];
      expect(reviewCvs).toHaveLength(5); // not 10
      // And the SelfStudyImport.aiCVs reflects the latest snapshot (5).
      const reloadedImp: any = await SelfStudyImport.findById(imp._id).lean();
      expect(reloadedImp?.aiCVs).toHaveLength(5);
    });
  });

  describe('TOC source labelling', () => {
    it('preserves routing.source on CVs so the UI can distinguish pattern vs TOC', async () => {
      const { user } = await createUser();
      const sub = await seedSubmission(user._id);
      const imp = await seedImport(sub._id, user._id);
      const token = signTokenFor(user as any);
      stubAIService(() => new Response(
        JSON.stringify(buildAIResponse()),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      await request(app)
        .post(`/api/imports/${imp._id}/redetect`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      const reloaded: any = await SelfStudyImport.findById(imp._id).lean();
      const tocCvs = (reloaded?.aiCVs || []).filter(
        (c: any) => c.routing?.source === 'toc'
      );
      expect(tocCvs).toHaveLength(3);
      const tocNames = tocCvs.map((c: any) => c.facultyName);
      expect(tocNames).toEqual(
        expect.arrayContaining([
          'Thomas K. Swisher, J.D., Ph.D.',
          'LAURI A. WEINER, HS-BCP',
          'Mary Beth Olson, M.A.',
        ])
      );
    });
  });
});

/**
 * P1 follow-on — coverage for receiveAICallback's error / edge paths.
 *
 * The existing ai-import.test.ts covers the happy parsed-with-content
 * case plus a 401 on missing signature. This file covers the paths
 * that surfaced bugs during the CR-043 sweep:
 *
 *   - CR-037 empty-bucket guard rewrites parsed → failed
 *   - CR-037 fix: empty buckets + non-empty cvs / evidenceDocs / intros
 *     are NOT rewritten
 *   - CR-037 string-vs-object error coercion (the [object Object] bug)
 *   - CR-043 merge populates Submission.aiReviewState on first parse
 *   - CR-043 race fix: aiStatus only flips parsed after aiReviewState
 *     is committed (covered indirectly here by asserting both writes
 *     succeed on a single callback)
 *   - 404 when the import was deleted before the callback arrived
 *   - HMAC time-skew rejection (signature from a different secret)
 *   - Replay safety: re-sending the same callback doesn't double-merge
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser } from '../helpers/factories';

const TEST_HMAC_SECRET = 'test-hmac-secret-must-be-non-empty';

function signRequest(body: object, secret: string = TEST_HMAC_SECRET): { ts: string; signature: string } {
  const ts = Math.floor(Date.now() / 1000).toString();
  const raw = JSON.stringify(body);
  const digest = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  return { ts, signature: `t=${ts},v1=${digest}` };
}

async function setupImport() {
  const { user } = await createUser();
  const submission = await Submission.create({
    submissionId: `CB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionName: 'Test U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: user._id,
    type: 'initial',
    status: 'draft',
  } as any);
  const imp = await SelfStudyImport.create({
    submissionId: submission._id,
    originalFilename: 'cb-test.docx',
    fileType: 'docx',
    uploadedBy: user._id,
    status: 'processing',
    aiStatus: 'parsing',
    aiS3Key: `imports/${submission._id}/source.docx`,
    aiProgramLevel: 'bachelors',
    extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
    mappedSections: [],
    unmappedContent: [],
  } as any);
  return { user, submission, imp };
}

describe('receiveAICallback — edge + error paths', () => {
  beforeEach(() => {
    process.env.NODE_SERVICE_HMAC_SECRET = TEST_HMAC_SECRET;
  });

  it('CR-037: empty-buckets parsed callback is rewritten to failed', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {},
      tags: [],
      placeholderSections: [],
      matrices: [],
      errors: [],
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiStatus).toBe('failed');
    // The CR-037 error string is a plain string (post-fix; was an
    // object that Mongoose stringified to '[object Object]').
    expect(reloaded?.aiErrors?.[0]).toContain('zero items');
    expect(reloaded?.aiErrors?.[0]).not.toContain('[object Object]');
  });

  it('CR-037: empty buckets + non-empty cvs is NOT rewritten to failed', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {},
      tags: [],
      matrices: [],
      cvs: [{ sectionId: 'cv-1', facultyName: 'Dr X' }],
      evidenceDocs: [],
      introductions: {},
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiStatus).toBe('parsed');
    expect((reloaded as any)?.aiCVs?.length).toBe(1);
  });

  it('CR-037: empty buckets + non-empty evidenceDocs is NOT rewritten', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {},
      tags: [],
      matrices: [],
      cvs: [],
      evidenceDocs: [{ sectionId: 'ed-1', docSubKind: 'paper', title: 'Sample paper' }],
      introductions: {},
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiStatus).toBe('parsed');
    expect((reloaded as any)?.aiEvidenceDocs?.length).toBe(1);
  });

  it('CR-037: empty buckets + non-empty introductions is NOT rewritten', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {},
      tags: [],
      matrices: [],
      cvs: [],
      evidenceDocs: [],
      introductions: {
        document: {
          scope: 'document',
          items: [{ sectionId: 'intro-1', snippet: 'Mission statement' }],
        },
      },
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiStatus).toBe('parsed');
  });

  it('CR-043: merge writes Submission.aiReviewState on first parsed callback', async () => {
    const { submission, imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a',
          narratives: [{ sectionId: 'sec-1', heading: 'h', snippet: 's', wordCount: 1, confidence: 0.9 }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [],
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloadedSub: any = await Submission.findById(submission._id);
    expect(reloadedSub.aiReviewState).toBeDefined();
    expect(reloadedSub.aiReviewState.buckets['1.a'].narratives.length).toBe(1);
    // CR-043 race fix invariant: aiStatus AND aiReviewState committed
    // before the response returns (poller can never see status=parsed
    // before the merge ran).
    const reloadedImp = await SelfStudyImport.findById(imp._id);
    expect(reloadedImp?.aiStatus).toBe('parsed');
  });

  it('returns 404 when the import was deleted before callback arrived', async () => {
    const ghostId = new mongoose.Types.ObjectId();
    const body = { status: 'parsed', buckets: {}, tags: [], placeholderSections: [], matrices: [] };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${ghostId}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(404);
  });

  it('rejects callbacks signed with the wrong secret', async () => {
    const { imp } = await setupImport();
    const body = { status: 'parsed', buckets: {}, tags: [], placeholderSections: [], matrices: [] };
    const { signature } = signRequest(body, 'wrong-secret-xx');
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(401);
  });

  it('handles status=failed from ai-service (different from CR-037 rewrite)', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'failed',
      buckets: {},
      tags: [], placeholderSections: [], matrices: [],
      errors: ['mammoth: cannot extract HTML from corrupted docx'],
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiStatus).toBe('failed');
    expect(reloaded?.aiErrors?.[0]).toContain('mammoth');
  });

  it('replay safety: second identical callback does NOT double-merge into aiReviewState', async () => {
    const { submission, imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a',
          narratives: [{ sectionId: 'sec-replay', heading: 'h', snippet: 's', wordCount: 1, confidence: 0.9 }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [],
    };
    const { signature } = signRequest(body);
    await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    // Resign — HMAC timestamp changes — and replay.
    const { signature: sig2 } = signRequest(body);
    await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', sig2)
      .send(body);
    const reloadedSub: any = await Submission.findById(submission._id);
    const narr = reloadedSub.aiReviewState?.buckets?.['1.a']?.narratives || [];
    // The same sectionId should not be added twice — the merge service
    // dedupes by sectionId on a fresh (non-reimport) merge.
    expect(narr.filter((n: any) => n.sectionId === 'sec-replay').length).toBe(1);
  });

  it('persists coverageReport when present', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a',
          narratives: [{ sectionId: 'sec-cov', heading: 'h', snippet: 's', wordCount: 1, confidence: 0.9 }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [],
      coverageReport: {
        totalSections: 100,
        sectionsToBuckets: 80,
        coveragePercent: 80.0,
        bytesTotal: 50000,
        bytesAssigned: 40000,
        coveragePercentBytes: 80.0,
        skipBreakdown: {},
        boundaryWarnings: [],
        missingFragments: [],
      },
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded: any = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiCoverageReport?.totalSections).toBe(100);
    expect(reloaded?.aiCoverageReport?.coveragePercent).toBe(80.0);
  });

  it('persists introductionHints when present', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a',
          narratives: [{ sectionId: 'sec-hint', heading: 'h', snippet: 's', wordCount: 1, confidence: 0.9 }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [],
      introductionHints: {
        'sec-a': 'introduction:document',
        'sec-b': 'introduction:standard-3',
      },
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded: any = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiIntroductionHints?.['sec-a']).toBe('introduction:document');
    expect(reloaded?.aiIntroductionHints?.['sec-b']).toBe('introduction:standard-3');
  });

  it('handles standaloneCv flag', async () => {
    const { imp } = await setupImport();
    const body = {
      status: 'parsed',
      buckets: {},
      tags: [], placeholderSections: [], matrices: [],
      cvs: [{ sectionId: 'cv-only', facultyName: 'Dr Solo' }],
      standaloneCv: true,
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    const reloaded: any = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiStandaloneCv).toBe(true);
  });

  it('survives merge failure — the callback still completes 200', async () => {
    // The merge code is best-effort and wrapped in try/catch. If the
    // merge throws for any reason (e.g. submission deleted), the
    // callback still returns 200 with the per-import write intact.
    const { submission, imp } = await setupImport();
    // Delete the submission so the merge's findById returns null and
    // the merge block short-circuits (or the helper throws — either
    // way, the response should be 200).
    await Submission.findByIdAndDelete(submission._id);

    const body = {
      status: 'parsed',
      buckets: { '1.a': { standardCode: '1', specCode: 'a', narratives: [{ sectionId: 's-x', heading: 'h', snippet: 's', wordCount: 1, confidence: 0.9 }], evidenceText: [], evidenceFiles: [], matrixCells: [] } },
      tags: [], placeholderSections: [], matrices: [],
    };
    const { signature } = signRequest(body);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/ai-callback`)
      .set('X-Service-Signature', signature)
      .send(body);
    expect(res.status).toBe(200);
    // The import record has the per-import fields written even though
    // the merge couldn't fire.
    const reloaded: any = await SelfStudyImport.findById(imp._id);
    expect(reloaded?.aiStatus).toBe('parsed');
    expect(reloaded?.aiBuckets?.['1.a']).toBeDefined();
  });
});

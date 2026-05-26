/**
 * P1 — Legacy Import Document path tests.
 *
 * The Self-Study Editor toolbar carries a "Legacy"-badged Import Document
 * entry that opens a separate per-section paste-and-tag panel. This is
 * the pre-AI-wizard import flow (still in production for coordinators
 * who want fine-grained manual control). It has been COMPLETELY untested
 * — no unit tests, no integration tests, no E2E coverage.
 *
 * The legacy controller (importController.ts, 3269 lines) exposes:
 *   - POST   /api/imports/upload                — multipart upload + parse
 *   - GET    /api/imports/check/:submissionId   — "resuming" check
 *   - GET    /api/imports/:importId             — fetch the import record
 *   - GET    /api/imports/:importId/sections    — extracted sections list
 *   - POST   /api/imports/:importId/map         — map a section to (std, spec)
 *   - POST   /api/imports/:importId/apply       — write to Submission.narratives
 *   - GET    /api/imports/:importId/unmapped    — what didn't get mapped
 *   - PUT    /api/imports/:importId/unmapped/:sectionId — accept/decline AI suggestion
 *   - DELETE /api/imports/:importId/discard     — kill the in-progress import
 *
 * We seed an import directly (skipping the file upload + parse stage,
 * since that's covered by gridfsService tests and we'd need a real .docx)
 * and exercise the map → apply → submission-narratives writeback pipeline.
 *
 * Bugs this should catch:
 *   - mapSection regressions (it mutates importRecord.mappedSections in place)
 *   - applyMappings race or null-deref against missing extractedContent.sections
 *   - submission.narratives Map not marked-modified after write
 *   - discardImport leaving stale records
 *   - checkExistingImport ignoring the in-progress status whitelist
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

// ----------------------------------------------------------- shared helpers

async function seedSubmission(userId: any, institutionId?: any) {
  return Submission.create({
    submissionId: `LEGACY-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    institutionName: 'Test U',
    institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'draft',
  });
}

async function seedImport(
  submissionId: any,
  userId: any,
  opts: {
    status?: string;
    sections?: Array<{ id: string; title: string; sectionType?: string; content: string }>;
    mappedSections?: any[];
    unmappedContent?: any[];
  } = {}
) {
  // ExtractedSection requires pageNumber + startPosition + endPosition; the
  // legacy uploader populates these from the docx layout. For unit tests
  // we just supply 1/0/N where N is the content length so the schema is
  // satisfied.
  const sections = (opts.sections ?? []).map((s, i) => ({
    id: s.id,
    title: s.title,
    sectionType: (s.sectionType ?? 'narrative') as any,
    content: s.content,
    confidence: 0,
    pageNumber: 1,
    startPosition: i * 1000,
    endPosition: i * 1000 + (s.content?.length ?? 1),
  }));
  return SelfStudyImport.create({
    submissionId,
    originalFilename: 'legacy.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: opts.status ?? 'awaiting_selection',
    extractedContent: {
      rawText: '',
      pageCount: 1,
      metadata: {},
      sections,
    },
    mappedSections: opts.mappedSections ?? [],
    unmappedContent: opts.unmappedContent ?? [],
  } as any);
}

// ----------------------------------------------------------------- tests

describe('Legacy import — POST /api/imports/:importId/map', () => {
  it('returns 404 when the import does not exist', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/imports/${ghostId}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        extractedSectionId: 'sec-1',
        standardCode: '1',
        specCode: 'a',
        fieldType: 'narrative',
      });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Import not found/i);
  });

  it('appends a mapping to mappedSections with mappedBy=manual + a mappedByUserId', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'Mission narrative', content: 'body' }],
    });

    const res = await request(app)
      .post(`/api/imports/${imp._id}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        extractedSectionId: 'sec-1',
        standardCode: '1',
        specCode: 'a',
        fieldType: 'narrative',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded!.mappedSections.length).toBe(1);
    const m = reloaded!.mappedSections[0];
    expect(m.extractedSectionId).toBe('sec-1');
    expect(m.standardCode).toBe('1');
    expect(m.specCode).toBe('a');
    expect(m.fieldType).toBe('narrative');
    expect(m.mappedBy).toBe('manual');
    expect(m.mappedByUserId).toBeDefined();
  });

  it('re-mapping the same extractedSectionId replaces the existing mapping (no duplicates)', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'A', content: 'body' }],
      mappedSections: [
        {
          extractedSectionId: 'sec-1',
          standardCode: '1',
          specCode: 'a',
          fieldType: 'narrative',
          mappedBy: 'manual',
          mappedByUserId: user._id,
          mappedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/imports/${imp._id}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        extractedSectionId: 'sec-1',
        standardCode: '2',
        specCode: 'b',
        fieldType: 'narrative',
      });
    expect(res.status).toBe(200);

    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded!.mappedSections.length).toBe(1);
    expect(reloaded!.mappedSections[0].standardCode).toBe('2');
    expect(reloaded!.mappedSections[0].specCode).toBe('b');
  });

  it('removes the section from unmappedContent when it gets mapped', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'A', content: 'body' }],
      unmappedContent: [
        { extractedSectionId: 'sec-1', reason: 'low confidence' },
        { extractedSectionId: 'sec-2', reason: 'low confidence' },
      ],
    });

    await request(app)
      .post(`/api/imports/${imp._id}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        extractedSectionId: 'sec-1',
        standardCode: '1',
        specCode: 'a',
        fieldType: 'narrative',
      });

    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded!.unmappedContent.length).toBe(1);
    expect(reloaded!.unmappedContent[0].extractedSectionId).toBe('sec-2');
  });

  it('defaults fieldType to "narrative" when not provided', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'A', content: 'body' }],
    });

    await request(app)
      .post(`/api/imports/${imp._id}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        extractedSectionId: 'sec-1',
        standardCode: '1',
        specCode: 'a',
        // fieldType intentionally omitted
      });
    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded!.mappedSections[0].fieldType).toBe('narrative');
  });
});

describe('Legacy import — POST /api/imports/:importId/apply', () => {
  it('returns 404 when the import does not exist', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/imports/${ghostId}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('writes a single mapped section into Submission.narratives.{std}.{spec}.content', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [
        { id: 'sec-1', title: 'Mission narrative', content: 'Mission text body.' },
      ],
      mappedSections: [
        {
          extractedSectionId: 'sec-1',
          standardCode: '1',
          specCode: 'a',
          fieldType: 'narrative',
          mappedBy: 'manual',
          mappedByUserId: user._id,
          mappedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/imports/${imp._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.appliedCount).toBe(1);

    const updated = await Submission.findById(submission._id);
    const flat: any = JSON.parse(JSON.stringify(updated!.toJSON({ flattenMaps: true } as any)));
    expect(flat.narratives?.['1']?.['a']?.content).toBe('Mission text body.');
  });

  it('appends content when the (std, spec) already has narrative content', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    // Pre-seed narrative content under 1.a
    submission.set('narratives.1.a', {
      content: 'Existing narrative.',
      lastModified: new Date(),
      isComplete: false,
      linkedDocuments: [],
      supportingEvidenceText: '',
    });
    submission.markModified('narratives');
    await submission.save();

    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'Mission', content: 'New body.' }],
      mappedSections: [
        {
          extractedSectionId: 'sec-1',
          standardCode: '1',
          specCode: 'a',
          fieldType: 'narrative',
          mappedBy: 'manual',
          mappedByUserId: user._id,
          mappedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/imports/${imp._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);

    const updated = await Submission.findById(submission._id);
    const flat = JSON.parse(JSON.stringify(updated!.toJSON({ flattenMaps: true } as any)));
    expect(flat.narratives['1']['a'].content).toMatch(/Existing narrative\.[\s\S]*New body\./);
  });

  it('appends the import _id to Submission.imports[] only once (idempotent)', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'A', content: 'X' }],
      mappedSections: [
        {
          extractedSectionId: 'sec-1',
          standardCode: '1',
          specCode: 'a',
          fieldType: 'narrative',
          mappedBy: 'manual',
          mappedByUserId: user._id,
          mappedAt: new Date(),
        },
      ],
    });

    // Apply twice.
    await request(app).post(`/api/imports/${imp._id}/apply`).set('Authorization', `Bearer ${token}`).send({});
    await request(app).post(`/api/imports/${imp._id}/apply`).set('Authorization', `Bearer ${token}`).send({});

    const updated = await Submission.findById(submission._id);
    const matches = (updated!.imports ?? []).filter(
      (id) => id.toString() === (imp._id as any).toString()
    );
    expect(matches.length).toBe(1);
  });

  it('silently skips mappings whose extractedSectionId no longer exists in extractedContent.sections', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'A', content: 'X' }],
      mappedSections: [
        // Real section
        {
          extractedSectionId: 'sec-1',
          standardCode: '1',
          specCode: 'a',
          fieldType: 'narrative',
          mappedBy: 'manual',
          mappedByUserId: user._id,
          mappedAt: new Date(),
        },
        // Ghost — extractedSectionId not in sections list
        {
          extractedSectionId: 'sec-ghost',
          standardCode: '2',
          specCode: 'b',
          fieldType: 'narrative',
          mappedBy: 'manual',
          mappedByUserId: user._id,
          mappedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/imports/${imp._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    // appliedCount counts only the real mapping; the ghost is silently skipped.
    expect(res.body.appliedCount).toBe(1);
  });

  it('non-narrative fieldType mappings are NOT written to Submission.narratives', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, {
      sections: [{ id: 'sec-1', title: 'A', content: 'X' }],
      mappedSections: [
        {
          extractedSectionId: 'sec-1',
          standardCode: '1',
          specCode: 'a',
          fieldType: 'evidence', // not narrative
          mappedBy: 'manual',
          mappedByUserId: user._id,
          mappedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/imports/${imp._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.appliedCount).toBe(0);

    const updated = await Submission.findById(submission._id);
    const flat = JSON.parse(JSON.stringify(updated!.toJSON({ flattenMaps: true } as any)));
    // No 1.a narrative because the only mapping was non-narrative.
    expect(flat.narratives?.['1']?.['a']).toBeUndefined();
  });
});

describe('Legacy import — GET /api/imports/check/:submissionId', () => {
  it('returns hasExistingImport=false when no in-progress imports are present', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);

    const res = await request(app)
      .get(`/api/imports/check/${submission._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.hasExistingImport).toBe(false);
  });

  it('returns hasExistingImport=true with the most recent in-progress import', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    // Older import + newer import; both in-progress. The legacy status
    // enum is ('pending'|'processing'|'awaiting_selection'|'completed'|'failed');
    // we use the two that the controller's whitelist actually matches.
    await seedImport(submission._id, user._id, { status: 'processing' });
    await new Promise((r) => setTimeout(r, 5));
    const newest = await seedImport(submission._id, user._id, { status: 'awaiting_selection' });

    const res = await request(app)
      .get(`/api/imports/check/${submission._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.hasExistingImport).toBe(true);
    expect(res.body.import.id.toString()).toBe(newest._id.toString());
  });

  it('ignores completed imports (status outside the in-progress whitelist)', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    await seedImport(submission._id, user._id, { status: 'completed' });
    await seedImport(submission._id, user._id, { status: 'failed' });

    const res = await request(app)
      .get(`/api/imports/check/${submission._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.hasExistingImport).toBe(false);
  });
});

describe('Legacy import — DELETE /api/imports/:importId/discard', () => {
  it('returns 404 when the import does not exist', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/imports/${ghostId}/discard`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('deletes the import record from the DB', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission._id, user._id, { status: 'awaiting_selection' });

    const res = await request(app)
      .delete(`/api/imports/${imp._id}/discard`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stillThere = await SelfStudyImport.findById(imp._id);
    expect(stillThere).toBeNull();
  });
});

describe('Legacy import — GET /api/imports/:importId/sections', () => {
  it('returns 404 when the import does not exist', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/imports/${ghostId}/sections`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns the extractedContent.sections array', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    // getExtractedSections gates on status === 'completed' — only then
    // is the parse done and the extracted sections ready to render.
    const imp = await seedImport(submission._id, user._id, {
      status: 'completed',
      sections: [
        { id: 'sec-1', title: 'Mission', content: 'Mission body' },
        { id: 'sec-2', title: 'Governance', content: 'Governance body' },
      ],
    });
    const res = await request(app)
      .get(`/api/imports/${imp._id}/sections`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const sections = Array.isArray(res.body) ? res.body : res.body.sections;
    expect(sections.length).toBe(2);
    expect(sections.map((s: any) => s.id || s._id).sort()).toEqual(['sec-1', 'sec-2']);
  });
});

describe('Legacy import — auth gating', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/imports/${ghostId}/map`)
      .send({
        extractedSectionId: 'sec-1',
        standardCode: '1',
        specCode: 'a',
        fieldType: 'narrative',
      });
    expect(res.status).toBe(401);
  });
});

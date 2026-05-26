/**
 * CR-041 Phase 2 follow-on — edit-routing for batch Apply.
 *
 * The wizard's merged Review surface lets coordinators edit narrative
 * snippets across the entire batch (CR-032 inline edits). Each edited
 * item carries `editedAt` + `sourceImportId` (the child file it came
 * from). On Apply, the client groups edits by sourceImportId and
 * passes `editsByChild` in the request body; the server routes each
 * edit back to its source child's aiBuckets BEFORE applyAIImportCore
 * runs, so the per-child Submission write picks up the edited text.
 *
 * Without this routing, edits made on the merged view silently revert
 * to the matcher's original snippet — coordinator confusion + lost
 * work.
 *
 * Pins:
 *   1. editsByChild routes the right edit to the right child.
 *   2. originalSnippet is preserved on first edit (revert path).
 *   3. wordCount is recomputed from the edited snippet.
 *   4. editsByChild={} is a no-op (existing batch Apply works unchanged).
 *   5. An edit referencing a sectionId that doesn't exist in the child
 *      is silently skipped (no throw, no crash).
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { ImportBatch } from '../../src/models/ImportBatch';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedBatch(userId: any, submissionId: any) {
  const batch = await ImportBatch.create({
    submissionId,
    createdBy: userId,
    fileCount: 2,
    completedCount: 2,
    status: 'completed',
    holdForReview: true,
  } as any);
  return batch;
}

async function seedChild(
  submissionId: any,
  userId: any,
  batchId: any,
  position: number,
  buckets: Record<string, any>
) {
  return SelfStudyImport.create({
    submissionId,
    batchId,
    batchPosition: position,
    originalFilename: `child-${position}.docx`,
    fileType: 'docx',
    uploadedBy: userId,
    status: 'completed',
    aiStatus: 'parsed',
    aiJobId: `job-${position}`,
    aiProgramLevel: 'bachelors',
    aiBuckets: buckets,
    aiTags: [],
    aiPlaceholderSections: [],
    aiMatrices: [],
  } as any);
}

function makeBucket(std: string, spec: string, items: Array<{
  sectionId: string;
  snippet: string;
}>) {
  return {
    standardCode: std,
    specCode: spec,
    standardTitle: 'T',
    specPrompt: 'p',
    narratives: items.map((i) => ({
      sectionId: i.sectionId,
      heading: 'h',
      snippet: i.snippet,
      confidence: 0.9,
      wordCount: i.snippet.split(/\s+/).length,
      rationale: 'r',
    })),
    evidenceText: [],
    evidenceFiles: [],
    matrixCells: [],
    coverageScore: null,
    coverageCovered: null,
    coverageGaps: [],
    coverageStrengths: [],
  };
}

async function seedSubmission(userId: any) {
  return Submission.create({
    submissionId: `EDIT-${Date.now().toString(36)}`,
    institutionName: 'T U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'in_progress',
  });
}

describe('POST /api/imports/batch/:batchId/apply — edit routing (CR-041 follow-on)', () => {
  it('routes edits to the right child and applies them before per-child Submission write', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const batch = await seedBatch(user._id, submission._id);
    const childA = await seedChild(submission._id, user._id, batch._id, 1, {
      '1.a': makeBucket('1', 'a', [
        { sectionId: 'secA-1', snippet: 'Original A1' },
      ]),
    });
    const childB = await seedChild(submission._id, user._id, batch._id, 2, {
      '2.a': makeBucket('2', 'a', [
        { sectionId: 'secB-1', snippet: 'Original B1' },
      ]),
    });

    const res = await request(app)
      .post(`/api/imports/batch/${batch._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        editsByChild: {
          [String(childA._id)]: {
            'secA-1': { snippet: 'Edited A1 by coordinator', kind: 'narrative' },
          },
          [String(childB._id)]: {
            'secB-1': { snippet: 'Edited B1 by coordinator', kind: 'narrative' },
          },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const childAReloaded = await SelfStudyImport.findById(childA._id);
    const childBReloaded = await SelfStudyImport.findById(childB._id);
    // Edited snippet replaced; originalSnippet preserved on first edit.
    expect((childAReloaded!.aiBuckets as any)['1.a'].narratives[0].snippet).toBe(
      'Edited A1 by coordinator'
    );
    expect((childAReloaded!.aiBuckets as any)['1.a'].narratives[0].originalSnippet).toBe(
      'Original A1'
    );
    expect((childAReloaded!.aiBuckets as any)['1.a'].narratives[0].editedAt).toBeDefined();
    expect((childBReloaded!.aiBuckets as any)['2.a'].narratives[0].snippet).toBe(
      'Edited B1 by coordinator'
    );

    // Submission narratives reflect the edited content (not the matcher original).
    const updated = await Submission.findById(submission._id);
    const flat: any = JSON.parse(JSON.stringify(updated!.toJSON({ flattenMaps: true } as any)));
    expect(flat.narratives['1']['a'].content).toContain('Edited A1 by coordinator');
    expect(flat.narratives['2']['a'].content).toContain('Edited B1 by coordinator');
  });

  it('recomputes wordCount from the edited snippet', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const batch = await seedBatch(user._id, submission._id);
    const child = await seedChild(submission._id, user._id, batch._id, 1, {
      '1.a': makeBucket('1', 'a', [
        { sectionId: 'sec-1', snippet: 'Short' },
      ]),
    });

    const longEdit = 'one two three four five six seven eight nine ten';
    await request(app)
      .post(`/api/imports/batch/${batch._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        editsByChild: {
          [String(child._id)]: {
            'sec-1': { snippet: longEdit, kind: 'narrative' },
          },
        },
      });

    const reloaded = await SelfStudyImport.findById(child._id);
    expect((reloaded!.aiBuckets as any)['1.a'].narratives[0].wordCount).toBe(10);
  });

  it('editsByChild={} is a no-op (existing batch Apply works unchanged)', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const batch = await seedBatch(user._id, submission._id);
    const child = await seedChild(submission._id, user._id, batch._id, 1, {
      '1.a': makeBucket('1', 'a', [
        { sectionId: 'sec-1', snippet: 'Unchanged content' },
      ]),
    });

    const res = await request(app)
      .post(`/api/imports/batch/${batch._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({ editsByChild: {} });
    expect(res.status).toBe(200);

    const reloaded = await SelfStudyImport.findById(child._id);
    expect((reloaded!.aiBuckets as any)['1.a'].narratives[0].snippet).toBe(
      'Unchanged content'
    );
    expect((reloaded!.aiBuckets as any)['1.a'].narratives[0].originalSnippet).toBeUndefined();
  });

  it('handles missing editsByChild (legacy callers / no edits)', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const batch = await seedBatch(user._id, submission._id);
    await seedChild(submission._id, user._id, batch._id, 1, {
      '1.a': makeBucket('1', 'a', [
        { sectionId: 'sec-1', snippet: 'No-edits-path' },
      ]),
    });

    // Send an empty body — the legacy batch Apply pattern.
    const res = await request(app)
      .post(`/api/imports/batch/${batch._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('an edit pointing at a non-existent sectionId is silently skipped', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const batch = await seedBatch(user._id, submission._id);
    const child = await seedChild(submission._id, user._id, batch._id, 1, {
      '1.a': makeBucket('1', 'a', [
        { sectionId: 'real-sec', snippet: 'real content' },
      ]),
    });

    const res = await request(app)
      .post(`/api/imports/batch/${batch._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        editsByChild: {
          [String(child._id)]: {
            'ghost-sec': { snippet: 'never applied', kind: 'narrative' },
          },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const reloaded = await SelfStudyImport.findById(child._id);
    // Existing item unchanged.
    expect((reloaded!.aiBuckets as any)['1.a'].narratives[0].snippet).toBe('real content');
    expect((reloaded!.aiBuckets as any)['1.a'].narratives[0].editedAt).toBeUndefined();
  });
});

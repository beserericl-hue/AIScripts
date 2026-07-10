/**
 * DATA ISOLATION — POST /review/save-state must NEVER accept review content
 * that originated from an import belonging to a DIFFERENT submission (which
 * would bleed one institution's parsed document onto another). Regression for
 * the KSU→MCC cross-submission leak.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function sub(institutionId: mongoose.Types.ObjectId, submitterId: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `ISO-${Date.now().toString(36)}-${_c}`,
    institutionId,
    institutionName: `Inst ${_c}`,
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId,
    type: 'initial',
    status: 'in_progress',
  })) as any;
}
async function importFor(submissionId: mongoose.Types.ObjectId) {
  return SelfStudyImport.create({
    submissionId,
    originalFilename: 'doc.docx',
    fileType: 'docx',
    uploadedBy: new mongoose.Types.ObjectId(),
    extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
  });
}
const bucketsWithOrigin = (importId: string) => ({
  '1.a': {
    standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
    narratives: [{
      sectionId: 'x1', heading: 'h', snippet: 's', htmlSnippet: '<p>s</p>',
      wordCount: 1, confidence: 0.9, acceptState: 'pending', rationale: '',
      sourceImportId: importId,
    }],
    evidenceText: [], evidenceFiles: [], matrixCells: [],
  },
});

describe('save-state data isolation', () => {
  it('BLOCKS content whose import belongs to another submission (409)', async () => {
    const instA = new mongoose.Types.ObjectId();
    const instB = new mongoose.Types.ObjectId();
    const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: instA });
    const mine = await sub(instA, pc._id);          // the PC's submission
    const other = await sub(instB, new mongoose.Types.ObjectId()); // a different institution
    const foreignImport = await importFor(other._id); // import belongs to `other`

    const res = await request(app)
      .post(`/api/submissions/${mine._id}/review/save-state`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ buckets: bucketsWithOrigin(String(foreignImport._id)) });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CROSS_SUBMISSION_CONTENT_BLOCKED');

    // And nothing was written.
    const fresh: any = await Submission.findById(mine._id).lean();
    expect(fresh.aiReviewState?.buckets?.['1.a']).toBeUndefined();
  });

  it('ALLOWS content whose import belongs to this submission (200)', async () => {
    const instA = new mongoose.Types.ObjectId();
    const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: instA });
    const mine = await sub(instA, pc._id);
    const ownImport = await importFor(mine._id);

    const res = await request(app)
      .post(`/api/submissions/${mine._id}/review/save-state`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ buckets: bucketsWithOrigin(String(ownImport._id)) });

    expect(res.status).toBe(200);
    const fresh: any = await Submission.findById(mine._id).lean();
    expect(fresh.aiReviewState.buckets['1.a'].narratives[0].sectionId).toBe('x1');
    // Owner is stamped for auditability.
    expect(String(fresh.aiReviewState.ownerSubmissionId)).toBe(String(mine._id));
  });
});

/**
 * CR-047 — Integration tests for getWorkflowSummary
 *
 * GET /api/submissions/:id/workflow-summary
 *
 * Covers:
 *   - Count correctness: seed a submission with a known aiReviewState
 *     (cvs / evidenceDocs syllabus+paper / introductions / buckets),
 *     SelfStudyImport records, standardsStatus, narratives,
 *     CurriculumMatrix rows and SupportingEvidence files — then assert
 *     each rolled-up count in the response.
 *   - Auth: owner-PC 200, cross-institution PC 403, unauthenticated 401,
 *     missing submission 404, admin 200.
 *
 * The endpoint is a pure read derived from persisted data — no schema
 * change (CR-047 acceptance criteria).
 */

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { CurriculumMatrix } from '../../src/models/CurriculumMatrix';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { getAllStandards } from '../../src/data/standards';
import { createUser, signTokenFor } from '../helpers/factories';

// --- Helpers --------------------------------------------------------------

let _subCounter = 0;

interface SeedOptions {
  submitterId?: mongoose.Types.ObjectId;
  institutionId?: mongoose.Types.ObjectId;
  aiReviewState?: any;
  standardsStatus?: any;
  narratives?: any;
}

async function seedSubmission(overrides: SeedOptions = {}) {
  _subCounter += 1;
  const doc: any = await Submission.create({
    submissionId: `WF-${Date.now().toString(36)}-${_subCounter}`,
    institutionName: 'Test U',
    institutionId: overrides.institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: 'draft',
    aiReviewState: overrides.aiReviewState,
    standardsStatus: overrides.standardsStatus,
    narratives: overrides.narratives,
  });
  return doc;
}

/**
 * A review state with known counts:
 *   cvs           = 2
 *   syllabi       = 3   (evidenceDocs docSubKind === 'syllabus')
 *   papers        = 1   (evidenceDocs docSubKind === 'paper')
 *   introductions = 2   (introductions.<scope>.items length, summed)
 *   bySpec        = [ {1.a, count 1}, {2.c, count 3} ]   (3.b is empty → excluded)
 *   specItems     = 4
 */
function makeReviewState() {
  return {
    cvs: [
      { sectionId: 'cv-1', personName: 'Jane Doe' },
      { sectionId: 'cv-2', personName: 'John Roe' },
    ],
    evidenceDocs: [
      { sectionId: 'ed-1', docSubKind: 'syllabus' },
      { sectionId: 'ed-2', docSubKind: 'syllabus' },
      { sectionId: 'ed-3', docSubKind: 'syllabus' },
      { sectionId: 'ed-4', docSubKind: 'paper' },
    ],
    introductions: {
      document: { items: [{ sectionId: 'in-1' }, { sectionId: 'in-2' }] },
    },
    buckets: {
      '1.a': {
        standardCode: '1',
        specCode: 'a',
        narratives: [{ sectionId: 'n-1' }],
        evidenceText: [],
        evidenceFiles: [],
      },
      '2.c': {
        standardCode: '2',
        specCode: 'c',
        narratives: [{ sectionId: 'n-2' }, { sectionId: 'n-3' }],
        evidenceText: [{ sectionId: 'et-1' }],
        evidenceFiles: [],
      },
      '3.b': {
        standardCode: '3',
        specCode: 'b',
        narratives: [],
        evidenceText: [],
        evidenceFiles: [],
      },
    },
    tags: [],
    placeholderSections: [],
    approvedIds: [],
    discardedIds: [],
    itemSources: {},
    mergeLog: [],
    lastUpdatedAt: new Date(),
  };
}

function computeSpecsTotal(): number {
  let total = 0;
  for (const s of getAllStandards()) total += (s.specifications || []).length;
  return total;
}

// --- Tests ----------------------------------------------------------------

describe('GET /api/submissions/:id/workflow-summary — auth', () => {
  it('returns 401 without auth', async () => {
    const sub = await seedSubmission();
    const res = await request(app).get(`/api/submissions/${sub._id}/workflow-summary`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a missing submission', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/submissions/${ghostId}/workflow-summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 for a PC from a different institution', async () => {
    const ownerInst = new mongoose.Types.ObjectId();
    const otherInst = new mongoose.Types.ObjectId();
    const { user: owner } = await createUser({
      role: 'program_coordinator',
      institutionId: ownerInst.toString(),
    });
    const sub = await seedSubmission({
      submitterId: owner._id as any,
      institutionId: ownerInst,
    });
    const { user: intruder } = await createUser({
      role: 'program_coordinator',
      institutionId: otherInst.toString(),
    });
    const token = signTokenFor(intruder as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/workflow-summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin to read any submission', async () => {
    const sub = await seedSubmission({ institutionId: new mongoose.Types.ObjectId() });
    const { user: admin } = await createUser({ role: 'admin' });
    const token = signTokenFor(admin as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/workflow-summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/submissions/:id/workflow-summary — count correctness', () => {
  it('rolls up draft / self-study / submit counts from persisted data', async () => {
    const inst = new mongoose.Types.ObjectId();
    const { user } = await createUser({
      role: 'program_coordinator',
      institutionId: inst.toString(),
    });

    // standardsStatus keys are `${standardCode}_${specCode}` (Mongoose
    // Map keys cannot contain dots).
    const standardsStatus = {
      '1_a': { status: 'in_progress', validationStatus: 'pass', completionPercentage: 100 },
      '2_c': { status: 'validated', completionPercentage: 100 },
      '3_b': { status: 'in_progress', validationStatus: 'fail', completionPercentage: 50 },
    };
    const narratives = {
      '1': {
        a: { content: '<p>Real narrative text here.</p>' },
        b: { content: '<p></p>' }, // empty after stripping tags
      },
      '2': {
        c: { content: 'Plain committed text' },
      },
    };

    const sub = await seedSubmission({
      submitterId: user._id as any,
      institutionId: inst,
      aiReviewState: makeReviewState(),
      standardsStatus,
      narratives,
    });

    // IMPORT — two import records, one with an aiS3Key (the parsed file).
    await SelfStudyImport.create({
      submissionId: sub._id,
      originalFilename: 'older-attempt.docx',
      fileType: 'docx',
      uploadedBy: user._id,
      aiStatus: 'failed',
    });
    await SelfStudyImport.create({
      submissionId: sub._id,
      originalFilename: '2024 CSHSE Self-Study Stevenson University.docx',
      fileType: 'docx',
      uploadedBy: user._id,
      aiStatus: 'finished',
      aiS3Key: 's3://bucket/parsed-key',
    });

    // SELF-STUDY — matrix rows + evidence files.
    await CurriculumMatrix.create({
      submissionId: sub._id,
      name: 'HS Courses',
      lastModifiedBy: user._id,
      rawContent: [
        { id: 'r-0', content: '<tr><td>row 0</td></tr>', addedBy: user._id } as any,
        { id: 'r-1', content: '<tr><td>row 1</td></tr>', addedBy: user._id } as any,
        { id: 'r-2', content: '<tr><td>row 2</td></tr>', addedBy: user._id } as any,
      ],
    });
    const urlEvidence = {
      evidenceType: 'url' as const,
      url: { href: 'https://example.edu/evidence', title: 'Evidence', addedBy: user._id },
    };
    await SupportingEvidence.create({
      institutionId: inst,
      submissionId: sub._id,
      uploadedBy: user._id,
      ...urlEvidence,
    });
    await SupportingEvidence.create({
      institutionId: inst,
      submissionId: sub._id,
      uploadedBy: user._id,
      ...urlEvidence,
    });
    await SupportingEvidence.create({
      institutionId: inst,
      submissionId: sub._id,
      uploadedBy: user._id,
      ...urlEvidence,
      isDeleted: true, // soft-deleted → excluded
    });

    const token = signTokenFor(user as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/workflow-summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // IMPORT
    expect(res.body.import).not.toBeNull();
    expect(res.body.import.filename).toBe('2024 CSHSE Self-Study Stevenson University.docx');
    expect(res.body.import.aiStatus).toBe('finished');
    expect(res.body.import.fileCount).toBe(1); // only the one with aiS3Key

    // DRAFTS
    expect(res.body.drafts.cvs).toBe(2);
    expect(res.body.drafts.syllabi).toBe(3);
    expect(res.body.drafts.papers).toBe(1);
    expect(res.body.drafts.introductions).toBe(2);
    expect(res.body.drafts.specItems).toBe(4);
    expect(res.body.drafts.bySpec).toHaveLength(2);
    expect(res.body.drafts.bySpec).toEqual(
      expect.arrayContaining([
        { std: '1', spec: 'a', count: 1 },
        { std: '2', spec: 'c', count: 3 },
      ])
    );
    // 3.b had zero items → excluded
    expect(res.body.drafts.bySpec.find((r: any) => r.std === '3')).toBeUndefined();

    // SELF-STUDY
    expect(res.body.selfStudy.specsTotal).toBe(computeSpecsTotal());
    expect(res.body.selfStudy.specsValidated).toBe(2); // 1.a pass + 2.c validated
    expect(res.body.selfStudy.narrativesWritten).toBe(2); // 1.a + 2.c (1.b empty)
    expect(res.body.selfStudy.matrixRows).toBe(3);
    expect(res.body.selfStudy.evidenceFiles).toBe(2); // soft-deleted excluded

    // SUBMIT
    expect(res.body.submit.validated).toBe(2);
    expect(res.body.submit.total).toBe(computeSpecsTotal());
    expect(res.body.submit.ready).toBe(false); // not all specs validated
  });

  it('returns zeroed drafts + null import for a fresh submission', async () => {
    const inst = new mongoose.Types.ObjectId();
    const { user } = await createUser({
      role: 'program_coordinator',
      institutionId: inst.toString(),
    });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      institutionId: inst,
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/workflow-summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.import).toBeNull();
    expect(res.body.drafts).toEqual({
      cvs: 0,
      syllabi: 0,
      papers: 0,
      introductions: 0,
      specItems: 0,
      bySpec: [],
    });
    expect(res.body.selfStudy.specsValidated).toBe(0);
    expect(res.body.selfStudy.narrativesWritten).toBe(0);
    expect(res.body.selfStudy.matrixRows).toBe(0);
    expect(res.body.selfStudy.evidenceFiles).toBe(0);
    expect(res.body.submit.ready).toBe(false);
  });
});

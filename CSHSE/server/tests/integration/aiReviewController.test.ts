/**
 * CR-043 — Integration tests for aiReviewController.ts
 *
 * Section 2 of test-plan-cr043-cr044-regression-2026-05-25.md.
 *
 * Covers:
 *   - GET    /api/submissions/:id/review                — getReviewState
 *   - POST   /api/submissions/:id/review/approve        — approveItem
 *   - POST   /api/submissions/:id/review/discard        — discardItem
 *   - POST   /api/submissions/:id/review/clear-item     — clearItem
 *   - POST   /api/submissions/:id/review/apply          — applyReviewState
 *   - GET    /api/submissions/:id/matrix-state          — getMatrixState
 *   - POST   /api/submissions/:id/matrix-state          — setMatrixRowEdit
 *   - AC#10  cross-PC isolation (depends on _loadOwnedSubmission fix)
 */

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

// --- Helpers --------------------------------------------------------------

let _subCounter = 0;

interface SubmissionOverrides {
  submitterId?: mongoose.Types.ObjectId;
  institutionId?: mongoose.Types.ObjectId;
  status?: string;
  aiReviewState?: any;
  aiMatrixState?: any;
}

async function seedSubmission(overrides: SubmissionOverrides = {}) {
  _subCounter += 1;
  const doc: any = await Submission.create({
    submissionId: `REV-${Date.now().toString(36)}-${_subCounter}`,
    institutionName: 'Test U',
    institutionId: overrides.institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'draft',
    aiReviewState: overrides.aiReviewState,
    aiMatrixState: overrides.aiMatrixState,
  });
  return doc;
}

function makeReviewState(overrides: any = {}) {
  return {
    buckets: overrides.buckets ?? {
      '1.a': {
        standardCode: '1',
        specCode: 'a',
        standardTitle: '',
        specPrompt: '',
        narratives: [{ sectionId: 'sec-1', heading: 'h', snippet: 'approved snippet', wordCount: 2, confidence: 0.9, sourceImportId: 'imp-A', sourceFilename: 'file-A.docx' }],
        evidenceText: [],
        evidenceFiles: [],
        matrixCells: [],
      },
    },
    tags: overrides.tags ?? [],
    cvs: overrides.cvs ?? [],
    evidenceDocs: overrides.evidenceDocs ?? [],
    introductions: overrides.introductions ?? {},
    placeholderSections: overrides.placeholderSections ?? [],
    approvedIds: overrides.approvedIds ?? [],
    discardedIds: overrides.discardedIds ?? [],
    itemSources: overrides.itemSources ?? {
      'sec-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
    },
    mergeLog: overrides.mergeLog ?? [],
    lastUpdatedAt: new Date(),
  };
}

// --- GET /review ----------------------------------------------------------

describe('GET /api/submissions/:id/review', () => {
  it('returns 401 without auth', async () => {
    const sub = await seedSubmission();
    const res = await request(app).get(`/api/submissions/${sub._id}/review`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for missing submission', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/submissions/${ghostId}/review`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns the persisted aiReviewState when populated', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({ approvedIds: ['sec-1'] }),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.submissionId).toBe(String(sub._id));
    expect(res.body.aiReviewState).toBeDefined();
    expect(res.body.aiReviewState.approvedIds).toEqual(['sec-1']);
    expect(res.body.aiReviewState.buckets['1.a'].narratives.length).toBe(1);
  });

  it('returns null state for a fresh submission', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id as any });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.aiReviewState).toBeNull();
  });

  it('returns aiMatrixState alongside aiReviewState', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiMatrixState: {
        matrices: [{ slug: 'm1' }],
        matrixRowEdits: {},
        lastUpdatedAt: new Date(),
      },
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.aiMatrixState).toBeDefined();
    expect(res.body.aiMatrixState.matrices[0].slug).toBe('m1');
  });
});

// --- approveItem ---------------------------------------------------------

describe('POST /api/submissions/:id/review/approve', () => {
  it('AC#8: approving an item adds it to approvedIds', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1', approved: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.approvedIds).toContain('sec-1');
  });

  it('AC#8: approving removes a prior discard', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({ discardedIds: ['sec-1'] }),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1', approved: true });
    expect(res.status).toBe(200);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.discardedIds).not.toContain('sec-1');
    expect(reloaded.aiReviewState.approvedIds).toContain('sec-1');
  });

  it('approving an already-approved item is idempotent', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({ approvedIds: ['sec-1'] }),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1', approved: true });
    expect(res.status).toBe(200);
    expect(res.body.approvedIds.filter((id: string) => id === 'sec-1').length).toBe(1);
  });

  it('unapproving (approved=false) removes the item from approvedIds', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({ approvedIds: ['sec-1'] }),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1', approved: false });
    expect(res.status).toBe(200);
    expect(res.body.approvedIds).not.toContain('sec-1');
  });

  it('returns 400 without sectionId', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approved: true });
    expect(res.status).toBe(400);
  });

  it('returns 409 when aiReviewState is empty', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id as any });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1', approved: true });
    expect(res.status).toBe(409);
  });
});

// --- discardItem ---------------------------------------------------------

describe('POST /api/submissions/:id/review/discard', () => {
  it('discarding an item adds it to discardedIds', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/discard`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1', discarded: true });
    expect(res.status).toBe(200);
    expect(res.body.discardedIds).toContain('sec-1');
  });

  it('discarding removes a prior approval', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({ approvedIds: ['sec-1'] }),
    });
    const token = signTokenFor(user as any);
    await request(app)
      .post(`/api/submissions/${sub._id}/review/discard`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1', discarded: true });
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.approvedIds).not.toContain('sec-1');
    expect(reloaded.aiReviewState.discardedIds).toContain('sec-1');
  });

  it('returns 400 without sectionId', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/discard`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// --- clearItem -----------------------------------------------------------

describe('POST /api/submissions/:id/review/clear-item', () => {
  it('hard-removes an item from all buckets', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/clear-item`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1' });
    expect(res.status).toBe(200);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.buckets['1.a'].narratives).toEqual([]);
  });

  it('removes item from approvedIds and discardedIds', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({
        approvedIds: ['sec-1'],
        discardedIds: ['sec-1'],
      }),
    });
    const token = signTokenFor(user as any);
    await request(app)
      .post(`/api/submissions/${sub._id}/review/clear-item`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1' });
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.approvedIds).not.toContain('sec-1');
    expect(reloaded.aiReviewState.discardedIds).not.toContain('sec-1');
  });

  it('removes item from itemSources', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({
        itemSources: {
          'sec-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
          'sec-2': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
        },
      }),
    });
    const token = signTokenFor(user as any);
    await request(app)
      .post(`/api/submissions/${sub._id}/review/clear-item`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1' });
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.itemSources?.['sec-1']).toBeUndefined();
    expect(reloaded.aiReviewState.itemSources?.['sec-2']).toBeDefined();
  });

  it('removes item from tags/cvs/evidenceDocs/intros', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({
        tags: [{ tagId: 't1', sectionId: 'sec-1' }],
        cvs: [{ sectionId: 'sec-1' }],
        evidenceDocs: [{ sectionId: 'sec-1' }],
        introductions: { document: { items: [{ sectionId: 'sec-1' }] } },
      }),
    });
    const token = signTokenFor(user as any);
    await request(app)
      .post(`/api/submissions/${sub._id}/review/clear-item`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'sec-1' });
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.tags).toEqual([]);
    expect(reloaded.aiReviewState.cvs).toEqual([]);
    expect(reloaded.aiReviewState.evidenceDocs).toEqual([]);
    expect(reloaded.aiReviewState.introductions.document.items).toEqual([]);
  });
});

// --- applyReviewState ----------------------------------------------------

describe('POST /api/submissions/:id/review/apply', () => {
  async function seedSubmissionWithApprovedItem() {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState({ approvedIds: ['sec-1'] }),
    });
    return { user, sub };
  }

  it('AC#6: applies approved items to Submission.narratives', async () => {
    const { user, sub } = await seedSubmissionWithApprovedItem();
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.appliedCounts.narratives).toBe(1);
    const reloaded: any = await Submission.findById(sub._id);
    const stdMap = reloaded.narratives.get('1');
    expect(stdMap).toBeDefined();
    const spec = stdMap.get('a');
    expect(spec.content).toContain('approved snippet');
  });

  it('AC#6: approved items are DROPPED from aiReviewState after apply', async () => {
    const { user, sub } = await seedSubmissionWithApprovedItem();
    const token = signTokenFor(user as any);
    await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.approvedIds).toEqual([]);
    expect(reloaded.aiReviewState.buckets['1.a'].narratives).toEqual([]);
  });

  it('AC#6: un-approved items REMAIN in aiReviewState', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const state = makeReviewState({
      buckets: {
        '1.a': {
          standardCode: '1',
          specCode: 'a',
          narratives: [
            { sectionId: 'sec-1', heading: 'h', snippet: 'approved', wordCount: 1, confidence: 0.9 },
            { sectionId: 'sec-2', heading: 'h', snippet: 'unapproved', wordCount: 1, confidence: 0.9 },
          ],
          evidenceText: [],
          evidenceFiles: [],
          matrixCells: [],
        },
      },
      approvedIds: ['sec-1'],
      itemSources: {
        'sec-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
        'sec-2': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
      },
    });
    const sub = await seedSubmission({ submitterId: user._id as any, aiReviewState: state });
    const token = signTokenFor(user as any);
    await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    const reloaded: any = await Submission.findById(sub._id);
    const remaining = reloaded.aiReviewState.buckets['1.a'].narratives;
    expect(remaining.length).toBe(1);
    expect(remaining[0].sectionId).toBe('sec-2');
  });

  it('returns 400 when nothing is approved', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 409 when aiReviewState is empty', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id as any });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('AC#6: aggregates approved evidence files into supportingEvidenceFiles[]', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const state = makeReviewState({
      buckets: {
        '1.a': {
          standardCode: '1',
          specCode: 'a',
          narratives: [],
          evidenceText: [],
          evidenceFiles: [{ sectionId: 'ef-1', heading: 'doc-1' }],
          matrixCells: [],
        },
      },
      approvedIds: ['ef-1'],
      itemSources: {
        'ef-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
      },
    });
    const sub = await seedSubmission({ submitterId: user._id as any, aiReviewState: state });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('AC#6: writes per-spec introduction blobs from approved intros', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const state = makeReviewState({
      buckets: {},
      introductions: {
        'standard-1': {
          scope: 'standard',
          items: [{ sectionId: 'intro-1', snippet: 'intro for standard 1', htmlSnippet: '<p>intro</p>' }],
        },
      },
      approvedIds: ['intro-1'],
      itemSources: {
        'intro-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
      },
    });
    const sub = await seedSubmission({ submitterId: user._id as any, aiReviewState: state });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.introductions['standard-1'].items).toEqual([]);
  });

  it('AC#6: approved CVs are dropped from review state after apply', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const state = makeReviewState({
      buckets: {},
      cvs: [{ sectionId: 'cv-1', facultyName: 'Dr A' }],
      approvedIds: ['cv-1'],
      itemSources: {
        'cv-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
      },
    });
    const sub = await seedSubmission({ submitterId: user._id as any, aiReviewState: state });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.cvs).toEqual([]);
  });

  it('AC#6: approved evidenceDocs are dropped from review state after apply', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const state = makeReviewState({
      buckets: {},
      evidenceDocs: [{ sectionId: 'ed-1', kind: 'syllabus' }],
      approvedIds: ['ed-1'],
      itemSources: {
        'ed-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A', importedAt: new Date() },
      },
    });
    const sub = await seedSubmission({ submitterId: user._id as any, aiReviewState: state });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiReviewState.evidenceDocs).toEqual([]);
  });
});

// --- matrix-state --------------------------------------------------------

describe('matrix-state routes', () => {
  it('AC#9: GET returns persisted aiMatrixState', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiMatrixState: {
        matrices: [{ slug: 'curr-mat-1', rows: [] }],
        matrixRowEdits: { 'curr-mat-1|row-1': { note: 'edited' } },
        lastUpdatedAt: new Date(),
      },
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.aiMatrixState.matrices[0].slug).toBe('curr-mat-1');
    expect(res.body.aiMatrixState.matrixRowEdits['curr-mat-1|row-1']).toEqual({ note: 'edited' });
  });

  it('AC#9: POST with edit persists the row edit', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id as any });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${token}`)
      .send({ matrixSlug: 'm1', rowAnchor: 'row-a', edit: { note: 'new' } });
    expect(res.status).toBe(200);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiMatrixState.matrixRowEdits['m1|row-a']).toEqual({ note: 'new' });
  });

  it('AC#9: POST with edit=null removes the row edit', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id as any,
      aiMatrixState: {
        matrices: [],
        matrixRowEdits: {
          'm1|row-a': { note: 'will be removed' },
          'm1|row-b': { note: 'stays' },
        },
        lastUpdatedAt: new Date(),
      },
    });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${token}`)
      .send({ matrixSlug: 'm1', rowAnchor: 'row-a', edit: null });
    expect(res.status).toBe(200);
    const reloaded: any = await Submission.findById(sub._id);
    expect(reloaded.aiMatrixState.matrixRowEdits?.['m1|row-a']).toBeUndefined();
    expect(reloaded.aiMatrixState.matrixRowEdits?.['m1|row-b']).toEqual({ note: 'stays' });
  });

  it('returns 400 without matrixSlug+rowAnchor', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id as any });
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${token}`)
      .send({ edit: { note: 'new' } });
    expect(res.status).toBe(400);
  });
});

// --- Cross-PC isolation (AC#10) ------------------------------------------

describe('cross-PC isolation (AC#10)', () => {
  it('AC#10: a different program_coordinator at a different institution cannot read another PC\'s review state', async () => {
    const instA = new mongoose.Types.ObjectId();
    const instB = new mongoose.Types.ObjectId();
    const { user: pcA } = await createUser({
      email: `pc-a-${Date.now()}@a.edu`,
      role: 'program_coordinator',
      institutionId: instA.toString(),
    });
    const { user: pcB } = await createUser({
      email: `pc-b-${Date.now()}@b.edu`,
      role: 'program_coordinator',
      institutionId: instB.toString(),
    });
    const sub = await seedSubmission({
      submitterId: pcA._id as any,
      institutionId: instA,
      aiReviewState: makeReviewState(),
    });
    const tokenB = signTokenFor(pcB as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it('AC#10: the owning PC can read their own review state', async () => {
    const { user: pcA } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: pcA._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(pcA as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('AC#10: an admin can read any submission\'s review state', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: pcA } = await createUser({
      email: `pc-${Date.now()}@a.edu`,
      role: 'program_coordinator',
    });
    const sub = await seedSubmission({
      submitterId: pcA._id as any,
      aiReviewState: makeReviewState(),
    });
    const token = signTokenFor(admin as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('AC#10: a PC at the same institution can also access their colleague\'s submission', async () => {
    const inst = new mongoose.Types.ObjectId();
    const { user: pcA } = await createUser({
      email: `pc-a-${Date.now()}@a.edu`,
      role: 'program_coordinator',
      institutionId: inst.toString(),
    });
    const { user: pcB } = await createUser({
      email: `pc-b-${Date.now()}@a.edu`,
      role: 'program_coordinator',
      institutionId: inst.toString(),
    });
    const sub = await seedSubmission({
      submitterId: pcA._id as any,
      institutionId: inst,
      aiReviewState: makeReviewState(),
    });
    const tokenB = signTokenFor(pcB as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
  });
});

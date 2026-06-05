/**
 * POST /api/submissions/:id/review/save-state — autosave review-rail content.
 *
 * Backs the Review surface autosave so every change (change-kind, reassign,
 * inline edit, move-to-introduction, etc.) is persisted to the DB, not just
 * held in the browser until Apply. Pins:
 *   1. Provided content fields replace those in aiReviewState and survive GET.
 *   2. approvedIds / discardedIds / itemSources are NOT clobbered.
 *   3. Empty body is rejected.
 *   4. Owner-only.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seed(pcId: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `SAV-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Save U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pcId,
    type: 'initial',
    status: 'in_progress',
    aiReviewState: {
      buckets: {
        '2.a': {
          standardCode: '2', specCode: 'a', standardTitle: '', specPrompt: '',
          narratives: [{ sectionId: 'n1', heading: 'h', snippet: 'original', htmlSnippet: '<p>original</p>', wordCount: 1, confidence: 0.9, acceptState: 'pending', rationale: '' }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
        },
      },
      tags: [],
      cvs: [],
      evidenceDocs: [],
      introductions: {},
      placeholderSections: [],
      approvedIds: ['n1'],
      discardedIds: ['d1'],
      itemSources: { n1: { importId: 'imp', sourceFilename: 'f.docx' } },
      mergeLog: [],
      lastUpdatedAt: new Date(),
    },
  })) as any;
}

describe('POST /review/save-state', () => {
  it('persists changed buckets and survives a GET; approvals/itemSources untouched', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);

    // Simulate a change-kind: move n1 from narratives → evidenceText.
    const newBuckets = {
      '2.a': {
        standardCode: '2', specCode: 'a', standardTitle: '', specPrompt: '',
        narratives: [],
        evidenceText: [{ sectionId: 'n1', heading: 'h', snippet: 'EDITED CONTENT', htmlSnippet: '<p>EDITED CONTENT</p>', wordCount: 2, confidence: 0.9, acceptState: 'pending', rationale: '' }],
        evidenceFiles: [], matrixCells: [],
      },
    };
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/save-state`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ buckets: newBuckets });
    expect(res.status).toBe(200);

    const reload = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    const state = reload.body.aiReviewState;
    expect(state.buckets['2.a'].narratives).toHaveLength(0);
    expect(state.buckets['2.a'].evidenceText[0].snippet).toBe('EDITED CONTENT');
    // Dedicated fields preserved.
    expect(state.approvedIds).toEqual(['n1']);
    expect(state.discardedIds).toEqual(['d1']);
    expect(state.itemSources.n1).toBeTruthy();
  });

  it('rejects an empty body', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/save-state`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('a different PC cannot autosave someone else\'s review state', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: other } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/save-state`)
      .set('Authorization', `Bearer ${signTokenFor(other as any)}`)
      .send({ tags: [] });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});

/**
 * POST /api/submissions/:id/review/route-evidence — persist a CV/Syllabi/Paper
 * Standard+Substandard assignment onto aiReviewState.
 *
 * Regression guard for the reported bug: the assignment dropdowns only mutated
 * the browser store, so the routing was lost on reload / Re-run detectors. This
 * endpoint persists it server-side. Pins:
 *   1. Routing lands on the CV in aiReviewState.cvs (resolvedStd/Spec + routing).
 *   2. It survives a fresh GET /review (i.e. a reload).
 *   3. Works for evidenceDocs (syllabi/papers) too.
 *   4. Empty std/spec clears the assignment back to Unassigned.
 *   5. Only the owning PC can write it (cross-PC isolation).
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmissionFor(pcId: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `RTE-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Route U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: pcId,
    type: 'initial',
    status: 'in_progress',
    aiReviewState: {
      buckets: {},
      tags: [],
      cvs: [
        { sectionId: 'cv-1', facultyName: 'Dr. Alice', snippet: 'PhD', routing: { source: 'matcher' } },
      ],
      evidenceDocs: [
        { sectionId: 'syl-1', docSubKind: 'syllabus', title: 'CHS 105', snippet: 'syllabus' },
      ],
      introductions: {},
      placeholderSections: [],
      approvedIds: [],
      discardedIds: [],
      itemSources: {},
      mergeLog: [],
      lastUpdatedAt: new Date(),
    },
  })) as any;
}

describe('POST /review/route-evidence — persist evidence assignment', () => {
  it('persists a CV assignment and it survives a reload (GET /review)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmissionFor(pc._id);

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/route-evidence`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sectionId: 'cv-1', std: '6', spec: 'a' });
    expect(res.status).toBe(200);
    expect(res.body.resolvedStd).toBe('6');
    expect(res.body.resolvedSpec).toBe('a');

    // Persisted on the document.
    const fresh: any = await Submission.findById(sub._id);
    const cv = fresh.aiReviewState.cvs.find((c: any) => c.sectionId === 'cv-1');
    expect(cv.resolvedStd).toBe('6');
    expect(cv.resolvedSpec).toBe('a');
    expect(cv.routing.std).toBe('6');
    expect(cv.routing.spec).toBe('a');
    expect(cv.routing.source).toBe('coordinator');

    // Survives a reload — the rail refetch returns the saved routing.
    const reload = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(reload.status).toBe(200);
    const reloadedCv = reload.body.aiReviewState.cvs.find((c: any) => c.sectionId === 'cv-1');
    expect(reloadedCv.resolvedStd).toBe('6');
    expect(reloadedCv.resolvedSpec).toBe('a');
  });

  it('persists an evidence-doc (syllabus) assignment', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmissionFor(pc._id);

    await request(app)
      .post(`/api/submissions/${sub._id}/review/route-evidence`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sectionId: 'syl-1', std: '11', spec: 'b' })
      .expect(200);

    const fresh: any = await Submission.findById(sub._id);
    const doc = fresh.aiReviewState.evidenceDocs.find((e: any) => e.sectionId === 'syl-1');
    expect(doc.resolvedStd).toBe('11');
    expect(doc.resolvedSpec).toBe('b');
    expect(doc.routing.std).toBe('11');
  });

  it('clears the assignment back to Unassigned when std/spec are empty', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmissionFor(pc._id);

    await request(app)
      .post(`/api/submissions/${sub._id}/review/route-evidence`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sectionId: 'cv-1', std: '6', spec: 'a' })
      .expect(200);
    await request(app)
      .post(`/api/submissions/${sub._id}/review/route-evidence`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sectionId: 'cv-1', std: '', spec: '' })
      .expect(200);

    const fresh: any = await Submission.findById(sub._id);
    const cv = fresh.aiReviewState.cvs.find((c: any) => c.sectionId === 'cv-1');
    expect(cv.resolvedStd).toBeFalsy();
    expect(cv.resolvedSpec).toBeFalsy();
  });

  it('404s for an unknown sectionId', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmissionFor(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/route-evidence`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sectionId: 'nope', std: '6', spec: 'a' });
    expect(res.status).toBe(404);
  });

  it('a different PC cannot route evidence on someone else\'s submission', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: otherPc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmissionFor(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/route-evidence`)
      .set('Authorization', `Bearer ${signTokenFor(otherPc as any)}`)
      .send({ sectionId: 'cv-1', std: '6', spec: 'a' });
    expect(res.status).toBeGreaterThanOrEqual(403);

    const fresh: any = await Submission.findById(sub._id);
    const cv = fresh.aiReviewState.cvs.find((c: any) => c.sectionId === 'cv-1');
    expect(cv.resolvedStd).toBeFalsy();
  });
});

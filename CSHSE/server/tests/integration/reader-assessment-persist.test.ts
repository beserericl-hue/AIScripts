/**
 * Regression: a reader scoring multiple specs under the SAME standard via
 * per-spec /assessment calls must persist EVERY spec. A Mongoose cast-on-push
 * bug previously kept only the first spec per standard (compliance set on a
 * throwaway object, not the stored subdoc), so the review never became
 * submittable. Found via the live production E2E.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Review } from '../../src/models/Review';
import { createUser, signTokenFor } from '../helpers/factories';

describe('reader assessment persistence (cast-on-push regression)', () => {
  it('persists every spec scored under the same standard', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const token = signTokenFor(reader as any);
    const review = await Review.create({
      submissionId: new mongoose.Types.ObjectId(),
      reviewerId: reader._id,
      reviewerNumber: 1,
      totalReviewers: 2,
      institutionName: 'X',
      programName: 'Y',
      programLevel: 'bachelors',
      status: 'assigned',
    });

    for (const spec of ['a', 'b', 'c', 'd']) {
      const r = await request(app)
        .patch(`/api/reviews/${review._id}/assessment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ standardCode: '1', specCode: spec, compliance: 'compliant', comments: `c-${spec}` });
      expect(r.status).toBe(200);
    }

    const fresh = await Review.findById(review._id).lean();
    const std1 = (fresh!.assessments as any[]).find((a) => a.standardCode === '1');
    const codes = std1.specifications
      .map((s: any) => `${s.specCode}:${s.compliance}`)
      .sort();
    // Every spec must be present AND compliant (the bug left b/c/d at null).
    expect(codes).toEqual(['a:compliant', 'b:compliant', 'c:compliant', 'd:compliant']);
  });
});

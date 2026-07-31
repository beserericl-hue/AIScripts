/**
 * POST /api/submissions/:id/review/reconcile-spec-level — prune EMPTY spec rows
 * that don't exist at the submission's degree level.
 *
 * Reported bug: AACC (associate) showed baccalaureate-only spec rows (12.g/12.h,
 * 13.d–f, 16.d–f, 19.f–h) as phantom EMPTY entries — the parse seeded buckets
 * from the baccalaureate catalog. Nicole: "there is no 12g or 12h in the
 * self-study." Pins:
 *   1. Empty out-of-level buckets are removed.
 *   2. In-level buckets (even empty) are kept.
 *   3. An out-of-level bucket that HOLDS content is never dropped — reported.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

function bucket(std: string, spec: string, withContent = false) {
  return {
    standardCode: std,
    specCode: spec,
    standardTitle: 'Professional Practice',
    specPrompt: '',
    narratives: withContent
      ? [{ sectionId: `${std}.${spec}:n1`, heading: 'x', snippet: 'real content' }]
      : [],
    evidenceText: [],
    evidenceFiles: [],
  };
}

let _c = 0;
async function seed(pcId: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `RSL-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Anne Arundel Community College',
    programName: 'Self-Study',
    programLevel: 'associate',
    submitterId: pcId,
    type: 'initial',
    status: 'in_progress',
    aiReviewState: {
      buckets: {
        '12.a': bucket('12', 'a', true),
        '12.f': bucket('12', 'f', false), // in-level, empty — must stay
        '12.g': bucket('12', 'g', false), // bacc-only, empty — prune
        '12.h': bucket('12', 'h', false), // bacc-only, empty — prune
        '13.d': bucket('13', 'd', true),  // bacc-only BUT has content — keep + report
        '18.g': bucket('18', 'g', false), // associate Std 18 HAS a–h — must stay
      },
      tags: [], cvs: [], evidenceDocs: [], introductions: {},
      placeholderSections: [], approvedIds: [], discardedIds: [],
      itemSources: {}, mergeLog: [], lastUpdatedAt: new Date(),
    },
  })) as any;
}

describe('POST /review/reconcile-spec-level', () => {
  it('removes empty out-of-level specs, keeps in-level + content', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/reconcile-spec-level`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.level).toBe('associate');
    expect(res.body.removed.sort()).toEqual(['12.g', '12.h']);
    expect(res.body.keptWithContent).toEqual(['13.d']);

    const fresh: any = await Submission.findById(sub._id);
    const keys = Object.keys(fresh.aiReviewState.buckets).sort();
    expect(keys).toEqual(['12.a', '12.f', '13.d', '18.g']); // g/h gone; 18.g (valid associate) stays
  });

  it('is idempotent — a second run removes nothing', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const url = `/api/submissions/${sub._id}/review/reconcile-spec-level`;
    const auth = `Bearer ${signTokenFor(pc as any)}`;
    await request(app).post(url).set('Authorization', auth).send({}).expect(200);
    const second = await request(app).post(url).set('Authorization', auth).send({}).expect(200);
    expect(second.body.removedCount).toBe(0);
  });
});

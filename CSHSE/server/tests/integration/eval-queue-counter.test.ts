/**
 * Background AI-eval queue counter — the "X/Y reviewed" badge must never go
 * BACKWARDS as more standards are approved while the worker is still draining.
 *
 * Reported bug: approving Standard 5, then 6, then 7 in the Review panel made the
 * badge read "6/71" then drop to "3/72" — the high-water-mark total forgot the
 * specs the worker had already evaluated, so done = total - remaining collapsed.
 *
 * These tests drive enqueueSpecsForEval (Approve/Approve-all's enqueue) and the
 * worker's $pull directly, asserting the progress arithmetic that /eval-progress
 * serves (done = total - remaining) is MONOTONIC in `done` and GROWS `total`.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Submission } from '../../src/models/Submission';
import { enqueueSpecsForEval } from '../../src/controllers/aiReviewController';

let _c = 0;
async function seedSubmission() {
  _c += 1;
  return (await Submission.create({
    submissionId: `EVQ-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Queue U',
    programName: 'HS',
    programLevel: 'associate',
    submitterId: new mongoose.Types.ObjectId(),
    type: 'initial',
    status: 'in_progress',
  })) as any;
}

/** The exact math /eval-progress serves the client badge. */
async function progress(id: any) {
  const s: any = await Submission.findById(id).select('aiEvalQueue aiEvalQueueTotal');
  const remaining = (s?.aiEvalQueue || []).length;
  const total = s?.aiEvalQueueTotal || 0;
  return { total, remaining, done: Math.max(0, total - remaining) };
}

/** Simulate the worker draining `n` specs (its atomic $pull of a batch). */
async function drain(id: any, n: number) {
  const s: any = await Submission.findById(id).select('aiEvalQueue');
  const batch = (s.aiEvalQueue || []).slice(0, n);
  await Submission.updateOne({ _id: id }, { $pull: { aiEvalQueue: { $in: batch } } });
}

describe('AI-eval queue counter (approve-all progress badge)', () => {
  beforeEach(async () => { await Submission.deleteMany({}); });

  it('done never goes backwards when a 2nd standard is approved mid-drain', async () => {
    const sub = await seedSubmission();

    // Approve Standard 5 → 4 specs queued.
    await enqueueSpecsForEval(sub._id, ['5.a', '5.b', '5.c', '5.d']);
    let p = await progress(sub._id);
    expect(p).toMatchObject({ total: 4, remaining: 4, done: 0 });

    // Worker evaluates 2 of them.
    await drain(sub._id, 2);
    p = await progress(sub._id);
    expect(p).toMatchObject({ total: 4, remaining: 2, done: 2 }); // "2/4"

    // Approve Standard 6 (4 more) WHILE 2 of Std 5 are still queued.
    await enqueueSpecsForEval(sub._id, ['6.a', '6.b', '6.c', '6.d']);
    p = await progress(sub._id);
    // BUG (old): total clamped to queue-len 6 → done = 6 - 6 = 0 (went 2 → 0).
    // FIXED: total grows to 8 (cumulative), done HOLDS at 2.
    expect(p.total).toBe(8);
    expect(p.remaining).toBe(6);
    expect(p.done).toBe(2);

    // Approve Standard 7 (5 more).
    await enqueueSpecsForEval(sub._id, ['7.a', '7.b', '7.c', '7.d', '7.e']);
    p = await progress(sub._id);
    expect(p.total).toBe(13);   // 4 + 4 + 5
    expect(p.remaining).toBe(11);
    expect(p.done).toBe(2);     // still ≥ the 2 already evaluated — never backwards

    // Worker finishes everything.
    await drain(sub._id, 11);
    p = await progress(sub._id);
    expect(p).toMatchObject({ total: 13, remaining: 0, done: 13 }); // "13/13"
  });

  it('re-approving already-queued specs does not inflate the total', async () => {
    const sub = await seedSubmission();
    await enqueueSpecsForEval(sub._id, ['5.a', '5.b']);
    await enqueueSpecsForEval(sub._id, ['5.a', '5.b']); // same specs again
    const p = await progress(sub._id);
    expect(p).toMatchObject({ total: 2, remaining: 2, done: 0 });
  });

  it('a fully-drained queue starts a fresh run at 0/N, not a stale total', async () => {
    const sub = await seedSubmission();
    await enqueueSpecsForEval(sub._id, ['1.a', '1.b', '1.c']);
    await drain(sub._id, 3); // fully drained → done stamped, total=3
    let p = await progress(sub._id);
    expect(p).toMatchObject({ total: 3, remaining: 0, done: 3 });

    // A brand-new approve after completion restarts the run.
    await enqueueSpecsForEval(sub._id, ['9.a', '9.b']);
    p = await progress(sub._id);
    expect(p).toMatchObject({ total: 2, remaining: 2, done: 0 });
  });
});

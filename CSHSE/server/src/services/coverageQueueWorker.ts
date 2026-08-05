/**
 * Background coverage-recompute queue worker (2026-08-05).
 *
 * "Check coverage" / "Recheck coverage" (Review surface) enqueues the filled
 * spec keys onto Submission.coverageQueue; this worker drains them in small
 * batches by calling the (evidence-aware) coverage reviewer — so a full re-check
 * of every spec never blocks one HTTP request past the edge timeout, and a
 * deploy/restart resumes from the persisted queue. Mirrors evalQueueWorker.
 */
import { Submission } from '../models/Submission';
import { assessCoverageForKeys } from '../controllers/aiReviewController';

const TICK_MS = 4000;
const BATCH = 5; // specs assessed per tick (one reviewCoverage call)

let _ticking = false;
let _timer: ReturnType<typeof setInterval> | null = null;

export async function processCoverageQueueTick(): Promise<void> {
  if (_ticking) return;
  _ticking = true;
  try {
    const sub: any = await Submission.findOne({
      coverageQueue: { $exists: true, $not: { $size: 0 } },
    }).select('_id coverageQueue');
    if (!sub) return;
    const queue: string[] = Array.isArray(sub.coverageQueue) ? sub.coverageQueue : [];
    if (queue.length === 0) return;
    const batch = queue.slice(0, BATCH);

    try {
      await assessCoverageForKeys(String(sub._id), batch);
    } catch (e) {
      console.warn('[coverageQueueWorker] batch failed (non-fatal):', e);
    }

    // Remove the processed batch even if a spec failed, so the queue drains.
    await Submission.updateOne(
      { _id: sub._id },
      { $pull: { coverageQueue: { $in: batch } } }
    );
    const after: any = await Submission.findById(sub._id).select('coverageQueue');
    if (after && (after.coverageQueue || []).length === 0) {
      await Submission.updateOne(
        { _id: sub._id },
        { $set: { coverageQueueDoneAt: new Date() } }
      );
    }
  } catch (err) {
    console.warn('[coverageQueueWorker] tick failed (non-fatal):', err);
  } finally {
    _ticking = false;
  }
}

export function startCoverageQueueWorker(): void {
  if (_timer) return;
  _timer = setInterval(() => {
    void processCoverageQueueTick();
  }, TICK_MS);
  if (typeof _timer.unref === 'function') _timer.unref();
  console.log(`[coverageQueueWorker] started (${TICK_MS}ms tick, batch ${BATCH})`);
}

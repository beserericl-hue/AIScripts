/**
 * Background AI-evaluation queue worker (2026-06-09).
 *
 * "Validate all" (Self-Study editor) and "Approve all" (review/draft) enqueue
 * every spec-with-content onto Submission.aiEvalQueue (an array of "std.spec"
 * keys). This worker drains the queue in small batches by calling the cshse-ai
 * evaluator (ValidationService.validateSection) — so the UI never blocks on a
 * long synchronous run, and a deploy/restart simply resumes from the persisted
 * queue.
 *
 * State is mutated atomically ($pull / $set) so it never clobbers the
 * submission writes validateSection itself makes (standardsStatus).
 */
import { Submission } from '../models/Submission';
import { ValidationService } from './validationService';

const TICK_MS = 4000;
const BATCH = 3;            // specs evaluated per tick (matches the old CONCURRENCY)
const PER_CALL_MS = 30_000; // hard cap per spec eval

let _ticking = false;
let _timer: ReturnType<typeof setInterval> | null = null;

export async function processEvalQueueTick(): Promise<void> {
  if (_ticking) return;
  _ticking = true;
  try {
    // One submission with a non-empty queue per tick (fair across submissions).
    const sub: any = await Submission.findOne({
      aiEvalQueue: { $exists: true, $not: { $size: 0 } },
    }).select('_id aiEvalQueue narratives');
    if (!sub) return;

    const queue: string[] = Array.isArray(sub.aiEvalQueue) ? sub.aiEvalQueue : [];
    if (queue.length === 0) return;
    const batch = queue.slice(0, BATCH);

    const svc = new ValidationService();
    const getContent = (std: string, spec: string): string => {
      const stdMap = sub.narratives?.get?.(std);
      const entry = stdMap?.get?.(spec);
      return entry?.content || '';
    };

    await Promise.allSettled(
      batch.map((key) => {
        const dot = key.indexOf('.');
        const std = key.slice(0, dot);
        const spec = key.slice(dot + 1);
        return Promise.race([
          svc.validateSection({
            submissionId: String(sub._id),
            standardCode: std,
            specCode: spec,
            narrativeText: getContent(std, spec),
            validationType: 'manual_save',
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('eval-timeout')), PER_CALL_MS)),
        ]);
      })
    );

    // Atomically remove the processed batch (won't clobber validateSection's
    // own standardsStatus writes on this submission).
    await Submission.updateOne(
      { _id: sub._id },
      { $pull: { aiEvalQueue: { $in: batch } } }
    );
    // If that drained the queue, stamp completion.
    const after: any = await Submission.findById(sub._id).select('aiEvalQueue');
    if (after && (after.aiEvalQueue || []).length === 0) {
      await Submission.updateOne(
        { _id: sub._id },
        { $set: { aiEvalQueueDoneAt: new Date() } }
      );
    }
  } catch (err) {
    console.warn('[evalQueueWorker] tick failed (non-fatal):', err);
  } finally {
    _ticking = false;
  }
}

export function startEvalQueueWorker(): void {
  if (_timer) return;
  _timer = setInterval(() => {
    void processEvalQueueTick();
  }, TICK_MS);
  // Don't keep the process alive solely for this timer.
  if (typeof _timer.unref === 'function') _timer.unref();
  console.log(`[evalQueueWorker] started (${TICK_MS}ms tick, batch ${BATCH})`);
}

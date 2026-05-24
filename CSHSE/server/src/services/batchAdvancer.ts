/**
 * CR-041 US-3 — Serial processing engine for ImportBatch.
 *
 * Walks the children of an in-flight batch through the ai-service one
 * at a time. On each child completion (success or failure), the
 * ai-callback handler (see aiImportController.receiveAICallback) calls
 * ``advanceBatch(batchId)`` here to find the next pending child and
 * kick it off via the same /start-ai code path the single-file flow
 * uses.
 *
 * Why serial and not parallel: the spec calls it out explicitly —
 * Anthropic / OpenAI rate limits + cleaner per-file failure isolation.
 *
 * Failure semantics: a per-file failure DOES NOT block the rest. We
 * bump batch.failedCount, leave the failed child alone, and advance
 * to the next pending child. The batch transitions to
 * ``partial_failure`` when terminal if any failed.
 */
import mongoose from 'mongoose';

import { ImportBatch } from '../models/ImportBatch';
import { SelfStudyImport } from '../models/SelfStudyImport';

// We re-call the same /start-ai code path the single-file flow uses
// rather than duplicating the postToAIService logic. Use a runtime
// require() here (instead of a top-of-file static import) to break the
// circular dep with aiImportController. esbuild with `bundle: false`
// preserves `await import()` as literal ESM specifiers that Node's
// CJS resolver can't load — so we use require() explicitly.
function _startChild(importId: string, programLevel?: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { startAIImportForBatch } = require('../controllers/aiImportController');
  return startAIImportForBatch(importId, programLevel);
}

/**
 * Find the next ``pending`` child in batch order and start it.
 * Returns the importId that was started, or null when no pending
 * children remain.
 */
export async function startNextChild(
  batchId: string | mongoose.Types.ObjectId
): Promise<string | null> {
  const next = await SelfStudyImport.findOne({
    batchId,
    $or: [{ aiStatus: { $exists: false } }, { aiStatus: 'pending' }, { aiStatus: 'idle' }]
  })
    .sort({ batchPosition: 1 })
    .lean();
  if (!next) return null;
  const importId = String(next._id);
  try {
    await _startChild(importId);
  } catch (err: any) {
    console.error(
      `[batchAdvancer] start failed for child ${importId} in batch ${batchId}:`,
      err
    );
    // Mark the child failed so the advancer can move past it.
    await SelfStudyImport.findByIdAndUpdate(importId, {
      $set: {
        aiStatus: 'failed',
        aiErrors: [
          {
            stage: 'start',
            severity: 'error',
            message: `batch start failed: ${err?.message || String(err)}`
          }
        ],
        aiCompletedAt: new Date()
      }
    });
    await ImportBatch.findByIdAndUpdate(batchId, { $inc: { failedCount: 1 } });
    // Don't recurse blindly — the advanceBatch caller drives the next
    // attempt after the failure callback.
  }
  return importId;
}

/**
 * Called by the per-import terminal callback handler. Bumps the
 * batch's completed/failed counts based on the child's terminal
 * status, decides whether to start the next pending child, and
 * flips the batch into completed / partial_failure when all done.
 */
export async function advanceBatch(
  batchId: string | mongoose.Types.ObjectId,
  finishedChildStatus: 'parsed' | 'failed' | 'canceled'
): Promise<void> {
  const incField =
    finishedChildStatus === 'parsed' ? 'completedCount' : 'failedCount';
  const batch = await ImportBatch.findByIdAndUpdate(
    batchId,
    { $inc: { [incField]: 1 } },
    { new: true }
  );
  if (!batch) return;

  const done = (batch.completedCount ?? 0) + (batch.failedCount ?? 0);
  if (done >= (batch.fileCount ?? 0)) {
    // Terminal: every child has a final state.
    const nextStatus = (batch.failedCount ?? 0) > 0 ? 'partial_failure' : 'completed';
    const patch: any = { status: nextStatus };
    if (!batch.reviewUnlockedAt) patch.reviewUnlockedAt = new Date();
    await ImportBatch.findByIdAndUpdate(batchId, { $set: patch });
    return;
  }

  // Holds for review off: unlock the gate after the first child completes
  // so the Review screen opens immediately.
  if (
    !batch.holdForReview &&
    !batch.reviewUnlockedAt &&
    (batch.completedCount ?? 0) >= 1
  ) {
    await ImportBatch.findByIdAndUpdate(batchId, {
      $set: { reviewUnlockedAt: new Date() }
    });
  }

  // Kick off the next pending child.
  await startNextChild(batchId);
}

/**
 * POST /api/imports/batch/:batchId/start handler implementation.
 *
 * Validates the batch is in ``pending``, flips it to ``processing``,
 * and starts the first child. The advancer carries the rest via the
 * existing webhook callbacks.
 */
export async function startBatch(
  batchId: string | mongoose.Types.ObjectId,
  callerUserId: string
): Promise<{ ok: true; startedImportId: string | null } | { ok: false; reason: string }> {
  const batch = await ImportBatch.findById(batchId);
  if (!batch) return { ok: false, reason: 'Batch not found' };
  if (String(batch.createdBy) !== String(callerUserId)) {
    return { ok: false, reason: 'Only the batch creator can start the batch' };
  }
  if (batch.status === 'processing') {
    // Idempotent: re-calling start while already running is fine; the
    // advancer takes care of the queue.
    return { ok: true, startedImportId: null };
  }
  if (batch.status !== 'pending') {
    return { ok: false, reason: `Batch status is ${batch.status}` };
  }
  batch.status = 'processing';
  await batch.save();
  const startedImportId = await startNextChild(batchId);
  return { ok: true, startedImportId };
}

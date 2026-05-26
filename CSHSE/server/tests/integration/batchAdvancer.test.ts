/**
 * P1 follow-on — coverage for CR-041 batch-import internals.
 *
 * The serial-processing engine (batchAdvancer.ts) drives the
 * `ImportBatch` lifecycle: tracks per-child completion, starts the
 * next pending child after each callback, and transitions the batch
 * to `completed` / `partial_failure` when all done. Critical
 * coordinator-facing flows depend on this code; none of it had unit
 * coverage before.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { ImportBatch } from '../../src/models/ImportBatch';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { advanceBatch, startNextChild, startBatch } from '../../src/services/batchAdvancer';
// Use spyOn on the imported module rather than vi.mock — the vitest
// config has isolate=false, so vi.mock leaks across test files and
// breaks the unmocked controller tests that run before/after.
import * as aiImportController from '../../src/controllers/aiImportController';

const _mockStart = vi.fn();

// Valid aiStatus values per the SelfStudyImport enum. 'pending' is NOT
// a valid aiStatus — fresh batch children land with aiStatus
// undefined, and the batchAdvancer's pending-child query uses
// `aiStatus: { $exists: false }` for them. Tests use the literal
// 'pending' as a fixture-only marker that we convert to undefined.
async function setupBatch(opts: {
  childCount: number;
  holdForReview?: boolean;
  childStatuses?: ('pending' | 'parsed' | 'failed' | 'idle')[];
}) {
  const submitterId = new mongoose.Types.ObjectId();
  const sub = await Submission.create({
    submissionId: `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionName: 'Test U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId,
    type: 'initial',
    status: 'draft',
  } as any);
  const batch = await ImportBatch.create({
    submissionId: sub._id,
    createdBy: submitterId,
    fileCount: opts.childCount,
    holdForReview: opts.holdForReview ?? true,
    status: 'pending',
    completedCount: 0,
    failedCount: 0,
  });
  const children: any[] = [];
  for (let i = 0; i < opts.childCount; i++) {
    const child = await SelfStudyImport.create({
      submissionId: sub._id,
      originalFilename: `child-${i + 1}.docx`,
      fileType: 'docx',
      uploadedBy: submitterId,
      status: 'processing',
      aiStatus: ((opts.childStatuses?.[i] === 'pending' || !opts.childStatuses?.[i])
        ? undefined
        : opts.childStatuses[i]) as any,
      aiS3Key: `imports/${sub._id}/child-${i + 1}.docx`,
      aiProgramLevel: 'bachelors',
      batchId: batch._id,
      batchPosition: i + 1,
      batchHoldForReview: batch.holdForReview,
      extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
      mappedSections: [],
      unmappedContent: [],
    } as any);
    children.push(child);
  }
  return { sub, batch, children, submitterId };
}

describe('advanceBatch', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _mockStart.mockReset();
    _mockStart.mockImplementation(async () => {});
    spy = vi.spyOn(aiImportController, 'startAIImportForBatch')
      .mockImplementation((...args: any[]) => _mockStart(...args));
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('bumps completedCount on a parsed child and starts the next pending', async () => {
    const { batch, children } = await setupBatch({ childCount: 3 });
    // Simulate child 0 completing successfully.
    await advanceBatch(batch._id, 'parsed');
    const reloaded = await ImportBatch.findById(batch._id);
    expect(reloaded?.completedCount).toBe(1);
    expect(reloaded?.failedCount).toBe(0);
    // Next pending child should have been started.
    expect(_mockStart).toHaveBeenCalledTimes(1);
  });

  it('bumps failedCount on a failed child and continues to the next', async () => {
    const { batch } = await setupBatch({ childCount: 3 });
    await advanceBatch(batch._id, 'failed');
    const reloaded = await ImportBatch.findById(batch._id);
    expect(reloaded?.failedCount).toBe(1);
    expect(reloaded?.completedCount).toBe(0);
    expect(_mockStart).toHaveBeenCalledTimes(1);
  });

  it('transitions to completed when every child has parsed', async () => {
    const { batch, children } = await setupBatch({
      childCount: 2,
      childStatuses: ['parsed', 'parsed'],
    });
    // Bump completedCount to childCount via two advanceBatch calls.
    await advanceBatch(batch._id, 'parsed');
    await advanceBatch(batch._id, 'parsed');
    const reloaded = await ImportBatch.findById(batch._id);
    expect(reloaded?.status).toBe('completed');
    expect(reloaded?.reviewUnlockedAt).toBeDefined();
  });

  it('transitions to partial_failure when at least one child failed', async () => {
    const { batch } = await setupBatch({
      childCount: 3,
      childStatuses: ['parsed', 'failed', 'parsed'],
    });
    await advanceBatch(batch._id, 'parsed');
    await advanceBatch(batch._id, 'failed');
    await advanceBatch(batch._id, 'parsed');
    const reloaded = await ImportBatch.findById(batch._id);
    expect(reloaded?.status).toBe('partial_failure');
    expect(reloaded?.failedCount).toBe(1);
    expect(reloaded?.completedCount).toBe(2);
  });

  it('unlocks Review on first parsed child when holdForReview=false', async () => {
    const { batch } = await setupBatch({ childCount: 3, holdForReview: false });
    await advanceBatch(batch._id, 'parsed');
    const reloaded = await ImportBatch.findById(batch._id);
    expect(reloaded?.reviewUnlockedAt).toBeDefined();
  });

  it('does NOT unlock Review on first parsed when holdForReview=true', async () => {
    const { batch } = await setupBatch({ childCount: 3, holdForReview: true });
    await advanceBatch(batch._id, 'parsed');
    const reloaded = await ImportBatch.findById(batch._id);
    // reviewUnlockedAt stays unset until the batch completes.
    expect(reloaded?.reviewUnlockedAt).toBeFalsy();
  });

  it('is a no-op when the batch does not exist', async () => {
    const ghostId = new mongoose.Types.ObjectId();
    // Doesn't throw; just returns silently.
    await expect(advanceBatch(ghostId, 'parsed')).resolves.toBeUndefined();
  });

  it('counts canceled the same as failed', async () => {
    const { batch } = await setupBatch({ childCount: 2 });
    await advanceBatch(batch._id, 'canceled');
    const reloaded = await ImportBatch.findById(batch._id);
    expect(reloaded?.failedCount).toBe(1);
  });
});

describe('startNextChild', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _mockStart.mockReset();
    _mockStart.mockImplementation(async () => {});
    spy = vi.spyOn(aiImportController, 'startAIImportForBatch')
      .mockImplementation((...args: any[]) => _mockStart(...args));
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('starts the lowest batchPosition pending child', async () => {
    const { batch, children } = await setupBatch({
      childCount: 3,
      childStatuses: ['parsed', 'pending', 'pending'],
    });
    const started = await startNextChild(batch._id);
    // The next pending child is at batchPosition=2 → children[1].
    expect(started).toBe(String(children[1]._id));
    expect(_mockStart).toHaveBeenCalledTimes(1);
  });

  it('returns null when no pending children remain', async () => {
    const { batch } = await setupBatch({
      childCount: 2,
      childStatuses: ['parsed', 'failed'],
    });
    const started = await startNextChild(batch._id);
    expect(started).toBeNull();
    expect(_mockStart).not.toHaveBeenCalled();
  });

  it('on start failure: marks the child failed (with a string aiError) and bumps batch.failedCount', async () => {
    const { batch, children } = await setupBatch({ childCount: 2 });
    _mockStart.mockImplementation(async () => {
      throw new Error('ai-service unreachable');
    });
    const started = await startNextChild(batch._id);
    expect(started).toBe(String(children[0]._id));
    const reloadedChild = await SelfStudyImport.findById(children[0]._id);
    expect(reloadedChild?.aiStatus).toBe('failed');
    // CR-041 batch error-shape fix: aiErrors[0] is a plain string,
    // not an object. Mongoose's string[] coercion would otherwise
    // render '[object Object]' to the coordinator.
    expect(reloadedChild?.aiErrors?.length).toBe(1);
    expect(reloadedChild?.aiErrors?.[0]).toContain('batch start failed');
    expect(reloadedChild?.aiErrors?.[0]).toContain('ai-service unreachable');
    expect(reloadedChild?.aiErrors?.[0]).not.toContain('[object Object]');
    const reloadedBatch = await ImportBatch.findById(batch._id);
    expect(reloadedBatch?.failedCount).toBe(1);
  });
});

describe('startBatch', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _mockStart.mockReset();
    _mockStart.mockImplementation(async () => {});
    spy = vi.spyOn(aiImportController, 'startAIImportForBatch')
      .mockImplementation((...args: any[]) => _mockStart(...args));
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('rejects when the batch does not exist', async () => {
    const ghostId = new mongoose.Types.ObjectId();
    const res = await startBatch(ghostId, String(new mongoose.Types.ObjectId()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not found/i);
  });

  it('rejects when the caller is not the batch creator', async () => {
    const { batch } = await setupBatch({ childCount: 2 });
    const otherUser = String(new mongoose.Types.ObjectId());
    const res = await startBatch(batch._id, otherUser);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/only the batch creator/i);
  });

  it('is idempotent on a batch already processing', async () => {
    const { batch, submitterId } = await setupBatch({ childCount: 2 });
    batch.status = 'processing';
    await batch.save();
    const res = await startBatch(batch._id, String(submitterId));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.startedImportId).toBeNull();
  });

  it('rejects when the batch is in a terminal state', async () => {
    const { batch, submitterId } = await setupBatch({ childCount: 2 });
    batch.status = 'completed';
    await batch.save();
    const res = await startBatch(batch._id, String(submitterId));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/completed/i);
  });

  it('flips a pending batch to processing and starts the first child', async () => {
    const { batch, children, submitterId } = await setupBatch({ childCount: 3 });
    const res = await startBatch(batch._id, String(submitterId));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.startedImportId).toBe(String(children[0]._id));
    const reloaded = await ImportBatch.findById(batch._id);
    expect(reloaded?.status).toBe('processing');
    expect(_mockStart).toHaveBeenCalledTimes(1);
  });
});

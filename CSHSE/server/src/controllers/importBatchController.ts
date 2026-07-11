/**
 * CR-041 — Multi-file batched import controller.
 *
 * Endpoints (see CR-041 user stories US-2, US-3, US-7, US-8, US-9):
 *   POST /api/imports/batch                       — US-2 create batch
 *   POST /api/imports/batch/:batchId/file         — US-2 add file (multipart)
 *   POST /api/imports/batch/:batchId/start        — US-3 kick off serial run
 *   GET  /api/imports/batch/:batchId              — US-2/US-4 snapshot
 *   POST /api/imports/batch/:batchId/cancel       — US-7 cancel pending children
 *   POST /api/imports/batch/:batchId/apply        — US-8 merged Apply
 *
 * Auth: every endpoint requires the user to be the batch creator. Same
 * scoping pattern as the existing per-import routes.
 */
import { Request, Response } from 'express';
import mongoose from 'mongoose';

import { ImportBatch } from '../models/ImportBatch';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { Submission } from '../models/Submission';
import { recordVersion } from '../services/documentVersionService';
import { startBatch } from '../services/batchAdvancer';
import { applyAIImportCore } from './aiImportController';
import { requireSubmissionAccess, requireCanImport } from '../services/submissionAccessGuard';

interface AuthenticatedRequest extends Request {
  user?: { id: string; name?: string; role?: string };
}

/** POST /api/imports/batch — US-2 create a batch. */
export async function createImportBatch(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { submissionId, holdForReview } = req.body || {};
    if (!submissionId) {
      res.status(400).json({ error: 'submissionId is required' });
      return;
    }
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    // SECURITY + import-ownership: only someone who can access this submission
    // may batch-import into it, and a non-impersonating superuser must
    // impersonate a PC first.
    if (!requireCanImport(req as any, res)) return;
    if (!(await requireSubmissionAccess(req as any, res, submission))) return;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authenticated user required' });
      return;
    }
    const batch = await ImportBatch.create({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      createdBy: new mongoose.Types.ObjectId(userId),
      fileCount: 0,
      holdForReview: holdForReview === false ? false : true,
      status: 'pending'
    });
    res.status(201).json({
      batchId: String(batch._id),
      submissionId: String(batch.submissionId),
      fileCount: batch.fileCount,
      holdForReview: batch.holdForReview,
      status: batch.status
    });
  } catch (err: any) {
    console.error('createImportBatch error:', err);
    res.status(500).json({ error: err?.message || 'failed to create batch' });
  }
}

/**
 * POST /api/imports/batch/:batchId/file — US-2 attach a file. Multipart
 * upload; creates one SelfStudyImport child stamped with batchId +
 * batchPosition + preserved S3 version via the existing recordVersion
 * helper.
 */
export async function addFileToBatch(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { batchId } = req.params;
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ error: 'file is required (multipart field "file")' });
      return;
    }
    const batch = await ImportBatch.findById(batchId);
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }
    if (String(batch.createdBy) !== String(req.user?.id)) {
      res.status(403).json({ error: 'Only the batch creator can add files' });
      return;
    }
    if (batch.status === 'canceled') {
      res.status(409).json({ error: 'Batch is canceled; create a new batch' });
      return;
    }
    // CR-041 US-9 — adding files to a completed batch re-opens it so the
    // advancer picks up the new children. The merged Review re-gates if
    // holdForReview is on. Idempotent: if multiple files are added
    // they all queue and one /start is enough.
    let reopened = false;
    if (batch.status === 'completed') {
      batch.status = 'processing';
      batch.appliedAt = undefined as any;  // re-arm the apply gate
      await batch.save();
      reopened = true;
    }
    // Hard cap per US-9 — 25 files per batch.
    if (batch.fileCount >= 25) {
      res.status(400).json({ error: 'Batch is at the 25-file cap' });
      return;
    }
    const extension = (file.originalname.toLowerCase().split('.').pop() || '') as
      | 'pdf'
      | 'docx'
      | 'pptx';
    if (!['pdf', 'docx', 'pptx'].includes(extension)) {
      res.status(400).json({ error: 'Unsupported file type' });
      return;
    }

    // Increment batch.fileCount + assign next position atomically.
    const updated = await ImportBatch.findByIdAndUpdate(
      batch._id,
      { $inc: { fileCount: 1 } },
      { new: true }
    );
    const batchPosition = updated?.fileCount ?? batch.fileCount + 1;

    const importRecord = await SelfStudyImport.create({
      submissionId: batch.submissionId,
      originalFilename: file.originalname,
      fileType: extension,
      uploadedBy: new mongoose.Types.ObjectId(req.user?.id),
      status: 'pending',
      batchId: batch._id,
      batchPosition,
      batchHoldForReview: batch.holdForReview
    });

    // Preserve uploaded bytes in S3 + stamp the import's aiS3Key.
    try {
      const docVersion = await recordVersion({
        ownerType: 'submission',
        ownerId: batch.submissionId,
        kind: 'original_import',
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        uploadedBy: new mongoose.Types.ObjectId(req.user?.id),
        uploadedByName: req.user?.name || 'unknown',
        metadata: { importId: importRecord._id as mongoose.Types.ObjectId }
      });
      await SelfStudyImport.findByIdAndUpdate(importRecord._id, {
        $set: {
          aiS3Key: docVersion.s3Key,
          aiDocumentVersionId: docVersion._id
        }
      });
    } catch (versionErr) {
      console.warn('[ImportBatch] recordVersion non-fatal:', versionErr);
    }

    // If we reopened the batch, kick the advancer so the new child
    // starts processing without an extra /start round-trip.
    if (reopened) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { startNextChild } = require('../services/batchAdvancer');
        await startNextChild(batch._id as any);
      } catch (advErr) {
        console.warn('[ImportBatch] reopen-start non-fatal:', advErr);
      }
    }

    res.status(201).json({
      importId: String(importRecord._id),
      batchId: String(batch._id),
      batchPosition,
      originalFilename: file.originalname,
      fileType: extension,
      reopened
    });
  } catch (err: any) {
    console.error('addFileToBatch error:', err);
    res.status(500).json({ error: err?.message || 'failed to add file' });
  }
}

/**
 * GET /api/imports/batch/:batchId — US-2/US-4 snapshot.
 *
 * Returns the batch plus per-child status / counts so the Parse step UI
 * can render one row per child without N additional fetches.
 */
export async function getImportBatch(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { batchId } = req.params;
    const batch = await ImportBatch.findById(batchId);
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }
    if (String(batch.createdBy) !== String(req.user?.id)) {
      res.status(403).json({ error: 'Only the batch creator can read the batch' });
      return;
    }
    const children = await SelfStudyImport.find({ batchId: batch._id })
      .sort({ batchPosition: 1 })
      .lean();
    res.json({
      batchId: String(batch._id),
      submissionId: String(batch.submissionId),
      status: batch.status,
      fileCount: batch.fileCount,
      holdForReview: batch.holdForReview,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      reviewUnlockedAt: batch.reviewUnlockedAt ?? null,
      appliedAt: batch.appliedAt ?? null,
      children: children.map((c: any) => ({
        importId: String(c._id),
        batchPosition: c.batchPosition,
        originalFilename: c.originalFilename,
        status: c.aiStatus || c.status || 'pending',
        stages: c.aiStages || [],
        errors: c.aiErrors || [],
        appliedCounts: c.aiAppliedCounts || null
      }))
    });
  } catch (err: any) {
    console.error('getImportBatch error:', err);
    res.status(500).json({ error: err?.message || 'failed to get batch' });
  }
}

/**
 * POST /api/imports/batch/:batchId/start — US-3 kick off serial run.
 */
export async function startImportBatch(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { batchId } = req.params;
    const result = await startBatch(batchId, req.user?.id || '');
    if (result.ok === false) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({
      batchId,
      startedImportId: result.startedImportId,
      status: 'processing'
    });
  } catch (err: any) {
    console.error('startImportBatch error:', err);
    res.status(500).json({ error: err?.message || 'failed to start batch' });
  }
}

/**
 * POST /api/imports/batch/:batchId/apply — US-8 merged Apply.
 *
 * Wraps every child's Submission + SelfStudyImport writes in ONE outer
 * Mongo session/transaction (when `MONGO_SUPPORTS_TRANSACTIONS=true`),
 * via the extracted `applyAIImportCore` helper. If any child fails,
 * the whole transaction aborts and the wizard reports `ok: false` with
 * per-child detail. Idempotency is per-child: replays of the same
 * batch with the same batch-scoped idempotency key short-circuit each
 * child via `aiLastIdempotencyKey` regardless of the outer session.
 */
export async function applyImportBatch(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { batchId } = req.params;
    const batch = await ImportBatch.findById(batchId);
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }
    if (String(batch.createdBy) !== String(req.user?.id)) {
      res.status(403).json({ error: 'Only the batch creator can apply' });
      return;
    }
    if (batch.appliedAt) {
      res.json({
        batchId,
        appliedAt: batch.appliedAt,
        message: 'Batch already applied'
      });
      return;
    }
    const children = await SelfStudyImport.find({ batchId: batch._id }).sort({
      batchPosition: 1
    });

    type ChildResult = {
      importId: string;
      ok: boolean;
      counts?: any;
      error?: string;
    };
    const results: ChildResult[] = [];

    const useTransaction = process.env.MONGO_SUPPORTS_TRANSACTIONS === 'true';
    const session = useTransaction ? await mongoose.startSession() : null;
    if (session) session.startTransaction();

    try {
      // CR-041 Phase 2 follow-on — edit-routing for batch mode. The
      // wizard ships coordinator-edited snippets per (sourceImportId,
      // sectionId) under body.editsByChild. Apply them to each child's
      // in-memory aiBuckets BEFORE applyAIImportCore so the per-child
      // narratives write picks up the edited text rather than the
      // matcher's original. editedAt + originalSnippet are stamped so
      // the audit trail survives.
      const editsByChild: Record<string, Record<string, {
        snippet: string;
        kind: 'narrative' | 'evidenceText' | 'tag';
      }>> = (req.body && (req.body as any).editsByChild) || {};

      for (const child of children) {
        const importIdStr = String(child._id);
        const childEdits = editsByChild[importIdStr];
        if (childEdits && Object.keys(childEdits).length > 0) {
          const buckets = (child.aiBuckets as any) || {};
          for (const bucket of Object.values<any>(buckets)) {
            const apply = (list: any[]) => {
              for (const it of list) {
                const edit = childEdits[it.sectionId];
                if (edit && (edit.kind === 'narrative' || edit.kind === 'evidenceText')) {
                  if (it.snippet !== edit.snippet) {
                    if (it.originalSnippet === undefined) it.originalSnippet = it.snippet;
                    it.snippet = edit.snippet;
                    it.editedAt = Date.now();
                    it.wordCount = (edit.snippet || '').trim().split(/\s+/).filter(Boolean).length;
                  }
                }
              }
            };
            apply(bucket.narratives || []);
            apply(bucket.evidenceText || []);
          }
          // Tag-fullText edits route the same way (matcher stamped the
          // tag with sourceImportId; we update fullText in place).
          for (const t of (child.aiTags as any[]) || []) {
            const edit = childEdits[t.sectionId];
            if (edit && edit.kind === 'tag') {
              if (t.fullText !== edit.snippet) {
                if (t.originalSnippet === undefined) t.originalSnippet = t.fullText;
                t.fullText = edit.snippet;
                t.editedAt = Date.now();
              }
            }
          }
          child.markModified('aiBuckets');
          child.markModified('aiTags');
        }

        // CR-041 Phase 2 follow-on — reconstruct the apply payload
        // from each child's aiBuckets server-side. The single-import
        // apply gets its narratives/evidenceText/evidenceFiles payload
        // from the client (the wizard's store builds it from buckets);
        // batch mode short-circuits that path so the server has to
        // rebuild from the persisted aiBuckets. Without this rebuild
        // the per-child Submission writes were no-ops and coordinators
        // saw "applied" but their data wasn't on the Submission.
        const childBuckets: any = (child.aiBuckets as any) || {};
        const narrativesPayload: Record<string, Record<string, { content: string }>> = {};
        const evidenceTextPayload: Record<string, Record<string, { text: string }>> = {};
        const evidenceFilesPayload: Array<{ std: string; spec: string; sectionId: string; heading: string; snippet: string }> = [];
        const childHasEdits = childEdits && Object.keys(childEdits).length > 0;
        void childHasEdits; // edits already mutated child.aiBuckets above

        for (const [, bucket] of Object.entries<any>(childBuckets)) {
          if (!bucket?.standardCode || !bucket?.specCode) continue;
          const std = String(bucket.standardCode);
          const spec = String(bucket.specCode);
          const narrText = (bucket.narratives || [])
            .map((n: any) => n.snippet || '')
            .filter((s: string) => s.trim().length > 0)
            .join('\n\n');
          if (narrText) {
            narrativesPayload[std] = narrativesPayload[std] || {};
            narrativesPayload[std][spec] = { content: narrText };
          }
          const evText = (bucket.evidenceText || [])
            .map((e: any) => e.snippet || '')
            .filter((s: string) => s.trim().length > 0)
            .join('\n\n');
          if (evText) {
            evidenceTextPayload[std] = evidenceTextPayload[std] || {};
            evidenceTextPayload[std][spec] = { text: evText };
          }
          for (const f of bucket.evidenceFiles || []) {
            evidenceFilesPayload.push({
              std,
              spec,
              sectionId: f.sectionId,
              heading: f.heading || '',
              snippet: f.snippet || ''
            });
          }
        }

        const idempotencyKey = `batch-${batchId}-child-${importIdStr}`;
        const result = await applyAIImportCore({
          importRecord: child,
          payload: {
            ...(req.body || {}),
            // Server-rebuilt payload from aiBuckets. The client may also
            // send narratives in req.body for the single-import path;
            // batch mode prefers our server rebuild so per-child writes
            // pick up edits applied above.
            narratives: narrativesPayload,
            supportingEvidenceText: evidenceTextPayload,
            evidenceFiles: evidenceFilesPayload,
            // Pass through tags/matrices/cvs/evidenceDocs/introductions from
            // the persisted child record so the apply path sees the full
            // shape.
            tags: child.aiTags || [],
            matrices: child.aiMatrices || [],
            cvs: child.aiCVs || [],
            evidenceDocs: child.aiEvidenceDocs || [],
            introductions: child.aiIntroductions || {},
            idempotencyKey
          },
          userId: req.user?.id,
          session,
          // Pass externalSession=true so the core doesn't pre-flush
          // aiStatus='applying' outside our outer transaction.
          externalSession: !!session
        });
        if (result.ok === false) {
          results.push({
            importId: importIdStr,
            ok: false,
            error: result.error
          });
          // Hard-stop: abort the outer transaction so no child commits
          // partially. The remaining children stay pending.
          throw new Error(`child ${importIdStr} apply failed: ${result.error}`);
        }
        results.push({
          importId: importIdStr,
          ok: true,
          counts: result.appliedCounts
        });
      }

      batch.appliedAt = new Date();
      batch.status = 'completed';
      await batch.save(session ? { session } : {});
      if (session) await session.commitTransaction();
      res.json({
        batchId,
        ok: true,
        results,
        appliedAt: batch.appliedAt
      });
    } catch (innerErr: any) {
      if (session) {
        try {
          await session.abortTransaction();
        } catch {
          // ignore
        }
      }
      res.status(500).json({
        batchId,
        ok: false,
        results,
        error: innerErr?.message || String(innerErr)
      });
    } finally {
      if (session) await session.endSession();
    }
  } catch (err: any) {
    console.error('applyImportBatch error:', err);
    res.status(500).json({ error: err?.message || 'failed to apply batch' });
  }
}

/**
 * POST /api/imports/batch/:batchId/file/:importId/remove — US-7
 * detach a child from the batch (mark canceled + null out batchId).
 * Decrements parent fileCount + recomputes terminal status.
 */
export async function removeFileFromBatch(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { batchId, importId } = req.params;
    const batch = await ImportBatch.findById(batchId);
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }
    if (String(batch.createdBy) !== String(req.user?.id)) {
      res.status(403).json({ error: 'Only the batch creator can remove files' });
      return;
    }
    const child = await SelfStudyImport.findById(importId);
    if (!child || String(child.batchId || '') !== String(batchId)) {
      res.status(404).json({ error: 'Child not found in this batch' });
      return;
    }
    (child as any).aiStatus = 'canceled';
    (child as any).batchId = undefined;
    await child.save();
    await ImportBatch.findByIdAndUpdate(batchId, { $inc: { fileCount: -1 } });
    res.json({ batchId, importId, removed: true });
  } catch (err: any) {
    console.error('removeFileFromBatch error:', err);
    res.status(500).json({ error: err?.message || 'failed to remove file' });
  }
}

/**
 * POST /api/imports/batch/:batchId/cancel — US-7 cancel pending children.
 */
export async function cancelImportBatch(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { batchId } = req.params;
    const batch = await ImportBatch.findById(batchId);
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }
    if (String(batch.createdBy) !== String(req.user?.id)) {
      res.status(403).json({ error: 'Only the batch creator can cancel' });
      return;
    }
    batch.status = 'canceled';
    await batch.save();
    res.json({ batchId: String(batch._id), status: batch.status });
  } catch (err: any) {
    console.error('cancelImportBatch error:', err);
    res.status(500).json({ error: err?.message || 'failed to cancel batch' });
  }
}

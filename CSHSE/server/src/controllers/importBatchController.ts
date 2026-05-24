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
    if (batch.status === 'canceled' || batch.status === 'completed') {
      // US-9 allows re-opening completed batches; this controller does the
      // simple "still-open" path. Reopening is a separate code path.
      if (batch.status === 'canceled') {
        res.status(409).json({ error: 'Batch is canceled; create a new batch' });
        return;
      }
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

    res.status(201).json({
      importId: String(importRecord._id),
      batchId: String(batch._id),
      batchPosition,
      originalFilename: file.originalname,
      fileType: extension
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

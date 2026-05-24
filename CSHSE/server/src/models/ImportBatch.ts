/**
 * CR-041 US-2 — ImportBatch model.
 *
 * One ImportBatch = N SelfStudyImport children sharing a batchId. The
 * coordinator drops N files; the server creates a batch + one child per
 * file; the batchAdvancer service walks the children serially through
 * the existing ai-service pipeline (US-3); merged Review across all
 * children opens once they all finish (or earlier if holdForReview is
 * off, US-5).
 *
 * Per-child SelfStudyImport docs carry a back-pointer (`batchId`) and
 * a `batchPosition` (1-indexed slot in the batch). Both fields are
 * optional on SelfStudyImport so the legacy single-file path keeps
 * working unchanged.
 */
import mongoose, { Document, Schema } from 'mongoose';

export type ImportBatchStatus =
  | 'pending'
  | 'processing'
  | 'partial_failure'
  | 'completed'
  | 'canceled';

export interface IImportBatch extends Document {
  submissionId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  fileCount: number;
  holdForReview: boolean;
  status: ImportBatchStatus;
  completedCount: number;
  failedCount: number;
  // CR-041 US-5 — flipped when (holdForReview && all done) OR
  // (!holdForReview && first done). Powers the wizard's Review-gate.
  reviewUnlockedAt?: Date;
  // CR-041 US-8 — stamped when the merged Apply transaction commits.
  appliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ImportBatchSchema = new Schema<IImportBatch>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fileCount: { type: Number, default: 0 },
    holdForReview: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'partial_failure', 'completed', 'canceled'],
      default: 'pending'
    },
    completedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    reviewUnlockedAt: { type: Date },
    appliedAt: { type: Date }
  },
  { timestamps: true }
);

export const ImportBatch = mongoose.model<IImportBatch>(
  'ImportBatch',
  ImportBatchSchema
);

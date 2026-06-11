import mongoose, { Schema, Document } from 'mongoose';

/**
 * A reader's (or lead reader's) editable Reader Report for a submission — the
 * official per-standard compliance checklist. Pre-populated from the AI draft
 * (readerReportGenerator), then the reader overrides the mark + comment per
 * standard and writes an overall recommendation. One per (submission, reviewer).
 */
export interface IReaderReportRow {
  standardCode: string;
  mark: 'compliant' | 'noncompliant' | '';
  comment: string;
}

export interface IReaderReport extends Document {
  submissionId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  rows: IReaderReportRow[];
  recommendation: string;
  updatedAt: Date;
  createdAt: Date;
}

const ReaderReportRowSchema = new Schema<IReaderReportRow>({
  standardCode: { type: String, required: true },
  mark: { type: String, enum: ['compliant', 'noncompliant', ''], default: '' },
  comment: { type: String, default: '' },
}, { _id: false });

const ReaderReportSchema = new Schema<IReaderReport>({
  submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rows: { type: [ReaderReportRowSchema], default: [] },
  recommendation: { type: String, default: '' },
}, { timestamps: true });

ReaderReportSchema.index({ submissionId: 1, reviewerId: 1 }, { unique: true });

export const ReaderReport = mongoose.model<IReaderReport>('ReaderReport', ReaderReportSchema);

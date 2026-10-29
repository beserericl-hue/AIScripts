import mongoose, { Schema, Document } from 'mongoose';

/**
 * A reader's (or lead reader's) editable Reader Report for a submission — the
 * official per-standard compliance checklist. Pre-populated from the AI draft
 * (readerReportGenerator), then the reader overrides the mark + comment per
 * standard and writes an overall recommendation. One per (submission, reviewer).
 */
export interface IReaderReportRow {
  standardCode: string;
  // The specification within the standard (e.g. "a"), so the checklist is
  // stored per-specification — matching the official reader-report template.
  // Empty/absent for legacy standard-level rows.
  specCode?: string;
  mark: 'compliant' | 'noncompliant' | '';
  comment: string;
  // Lead-reader OVERRIDE layer. The lead reader reviews a reader's report and
  // may override any spec's decision; the override is stored HERE (on the
  // reader's own row) so the reader's original `mark`/`comment` is preserved for
  // provenance. The board/PC-facing report uses `leadMark || mark` (lead wins).
  leadMark?: 'compliant' | 'noncompliant' | '';
  leadComment?: string;
  overriddenBy?: string;   // lead reviewer's display name
  overriddenAt?: Date | null;
  // The spec's numbered PARTS as printed on the form (4.a: 1. Measurable
  // student learning outcomes, 2. Assessment plan, …). Only parts the reader
  // marked differently are stored; an absent part takes the spec's mark.
  parts?: IReaderReportPartMark[];
  leadParts?: IReaderReportPartMark[];
}

export interface IReaderReportPartMark {
  n: number;
  mark: 'compliant' | 'noncompliant' | '';
}

export interface IReaderReport extends Document {
  submissionId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  rows: IReaderReportRow[];
  recommendation: string;
  // The reader's acceptance vote on the submission (the poll the lead reader
  // tallies across all readers). '' = not yet voted.
  acceptanceVote?: 'accept' | 'conditional' | 'deny' | 'hold' | '';
  // When the reader marks the report COMPLETE it becomes visible to the lead
  // reader (and admin). Null/absent = still a draft, private to the reviewer.
  completedAt?: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

const PartMarkSchema = new Schema<IReaderReportPartMark>({
  n: { type: Number, required: true },
  mark: { type: String, enum: ['compliant', 'noncompliant', ''], default: '' },
}, { _id: false });

const ReaderReportRowSchema = new Schema<IReaderReportRow>({
  standardCode: { type: String, required: true },
  specCode: { type: String, default: '' },
  mark: { type: String, enum: ['compliant', 'noncompliant', ''], default: '' },
  comment: { type: String, default: '' },
  leadMark: { type: String, enum: ['compliant', 'noncompliant', ''], default: undefined },
  leadComment: { type: String, default: undefined },
  overriddenBy: { type: String, default: undefined },
  overriddenAt: { type: Date, default: undefined },
  parts: { type: [PartMarkSchema], default: undefined },
  leadParts: { type: [PartMarkSchema], default: undefined },
}, { _id: false });

const ReaderReportSchema = new Schema<IReaderReport>({
  submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rows: { type: [ReaderReportRowSchema], default: [] },
  recommendation: { type: String, default: '' },
  acceptanceVote: { type: String, enum: ['accept', 'conditional', 'deny', 'hold', ''], default: '' },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

ReaderReportSchema.index({ submissionId: 1, reviewerId: 1 }, { unique: true });

export const ReaderReport = mongoose.model<IReaderReport>('ReaderReport', ReaderReportSchema);

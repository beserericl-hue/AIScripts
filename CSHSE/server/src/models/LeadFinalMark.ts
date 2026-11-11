import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// Lead reader's Final compliance decision per (submission, std, spec).
//
// Lauri CR (Nov 2026): the 0-3 numeric rating is gone — readers mark each
// specification Compliant / Non-compliant on their Reader Report
// (ReaderReport.rows[].mark), and the lead reader's compilation records a
// single authoritative Final mark per spec, in the same vocabulary.
//
// Stored in the pre-existing `leadfinalscores` collection (same unique index)
// so old CR-009 documents — which carry a numeric `score` and no `finalMark` —
// remain readable. Reads ignore any document without a `finalMark` (the old
// numeric values are intentionally dropped from use); re-setting a spec
// overwrites the doc and unsets the legacy `score`.
// ---------------------------------------------------------------------------

export type FinalMark = 'compliant' | 'noncompliant';
export const FINAL_MARKS: FinalMark[] = ['compliant', 'noncompliant'];

/** Accepts 'compliant' | 'noncompliant' | 'non_compliant' | 'non-compliant'; null otherwise. */
export function normalizeFinalMark(v: unknown): FinalMark | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (s === 'compliant') return 'compliant';
  if (s === 'noncompliant') return 'noncompliant';
  return null;
}

export interface ILeadFinalMark extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode: string;
  /** Absent only on legacy (numeric-score) documents, which reads ignore. */
  finalMark?: FinalMark;
  setById: mongoose.Types.ObjectId;
  setByName: string;
  setByRole: 'lead_reader' | 'admin' | 'superuser';
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadFinalMarkSchema = new Schema<ILeadFinalMark>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    standardCode: { type: String, required: true },
    specCode: { type: String, required: true },
    finalMark: { type: String, enum: FINAL_MARKS },
    setById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    setByName: { type: String, required: true },
    setByRole: { type: String, enum: ['lead_reader', 'admin', 'superuser'], required: true },
    note: { type: String }
  },
  { timestamps: true, collection: 'leadfinalscores' }
);

LeadFinalMarkSchema.index(
  { submissionId: 1, standardCode: 1, specCode: 1 },
  { unique: true, name: 'idx_unique_lead_final' }
);

export const LeadFinalMark = mongoose.model<ILeadFinalMark>('LeadFinalMark', LeadFinalMarkSchema);

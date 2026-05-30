import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// CR-009 / Sprint 5.1 — lead-reader Final score per (submission, std, spec).
//
// The Sprint 3 reader client writes individual reader 0-3 Scores (`Score`
// model). The lead reader's compilation view aggregates those side-by-side
// and lets them stamp a single authoritative Final score per spec.
//
// We keep this in its own collection (not on Submission or
// LeadReaderCompilation) because:
//   - It's a per-(std, spec) write — Mongoose Map subdoc updates have a
//     dotted-key trap (memory) which we'd inherit if we put it on Submission.
//   - The legacy LeadReaderCompilation aggregator uses the compliant /
//     non_compliant / not_applicable triplet (Review.assessments); mixing
//     0-3 Final scores into its compiledAssessments array would mean
//     migrating that schema. CR-009 has shipped pressure now; the legacy
//     compilation flow can be retired when board decisions land.
//   - A dedicated collection keeps reads + audits simple.
// ---------------------------------------------------------------------------

export interface ILeadFinalScore extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode: string;
  score: number; // 0, 1, 2, 3
  setById: mongoose.Types.ObjectId;
  setByName: string;
  setByRole: 'lead_reader' | 'admin' | 'superuser';
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadFinalScoreSchema = new Schema<ILeadFinalScore>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    standardCode: { type: String, required: true },
    specCode: { type: String, required: true },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
      validate: {
        validator: Number.isInteger,
        message: 'Final score must be an integer (0, 1, 2, or 3)'
      }
    },
    setById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    setByName: { type: String, required: true },
    setByRole: { type: String, enum: ['lead_reader', 'admin', 'superuser'], required: true },
    note: { type: String }
  },
  { timestamps: true }
);

LeadFinalScoreSchema.index(
  { submissionId: 1, standardCode: 1, specCode: 1 },
  { unique: true, name: 'idx_unique_lead_final' }
);

export const LeadFinalScore = mongoose.model<ILeadFinalScore>('LeadFinalScore', LeadFinalScoreSchema);

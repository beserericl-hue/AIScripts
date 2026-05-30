import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// CR-012 / Sprint 6.1 — partial-compliance checklist item.
//
// Auto-populated when the lead reader sets a Final score of 0 or 1 on the
// Compilation tab (CR-009). The visit team marks each item `verified` (with
// an optional note) during the in-person site visit.
//
// Inclusion reason per CR:
//   - finalScore === 1 → 'partial' (Partial — always included)
//   - finalScore === 0 → 'non_compliant' (Non-compliant — major remediation)
//   - "follow-up" (any reader 0/1 but final 2/3) is a lead-reader manual
//     add; not auto-populated. Defer to Sprint 6.2 follow-on.
//
// Lifecycle:
//   - setFinalScore(0|1) → upsert with inclusion-reason matching the score
//   - setFinalScore(2|3) → remove the auto-populated row (verified rows
//     are preserved — the visit team's note shouldn't be silently lost)
//   - clearFinalScore     → remove unverified rows only
// ---------------------------------------------------------------------------

export type ChecklistInclusionReason = 'partial' | 'non_compliant' | 'follow_up' | 'manual';

export interface ISiteVisitChecklistItem extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode: string;
  inclusionReason: ChecklistInclusionReason;
  finalScoreAtInclusion: number; // 0 | 1 | (2/3 only when manual)
  verified: boolean;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedByName?: string;
  verifiedAt?: Date;
  verificationNote?: string;
  // Snapshot of the lead reader who flipped the final score (so the visit
  // team can ping them with a question without re-querying the audit log).
  addedByName?: string;
  source: 'auto' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

const SiteVisitChecklistItemSchema = new Schema<ISiteVisitChecklistItem>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    standardCode: { type: String, required: true },
    specCode: { type: String, required: true },
    inclusionReason: {
      type: String,
      enum: ['partial', 'non_compliant', 'follow_up', 'manual'],
      required: true
    },
    finalScoreAtInclusion: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
      validate: { validator: Number.isInteger, message: 'finalScoreAtInclusion must be an integer 0-3' }
    },
    verified: { type: Boolean, default: false, index: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedByName: String,
    verifiedAt: Date,
    verificationNote: String,
    addedByName: String,
    source: { type: String, enum: ['auto', 'manual'], default: 'auto', index: true }
  },
  { timestamps: true }
);

SiteVisitChecklistItemSchema.index(
  { submissionId: 1, standardCode: 1, specCode: 1 },
  { unique: true, name: 'idx_unique_checklist' }
);

export const SiteVisitChecklistItem = mongoose.model<ISiteVisitChecklistItem>(
  'SiteVisitChecklistItem',
  SiteVisitChecklistItemSchema
);

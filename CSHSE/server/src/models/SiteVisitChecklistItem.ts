import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// CR-012 / Sprint 6.1 — site-visit checklist item.
//
// Auto-populated when the lead reader sets a Final mark of Non-compliant on
// the Compilation tab (CR-009; Lauri CR Nov 2026 replaced the 0-3 score with
// Compliant / Non-compliant). The visit team marks each item `verified`
// (with an optional note) during the in-person site visit.
//
// Inclusion reason:
//   - lead Final = Non-compliant → 'non_compliant' (auto)
//   - 'follow_up' / 'manual'     → lead-reader manual add
//   - 'partial'                  → LEGACY only (old Final score of 1); never
//                                  written any more, kept so old docs load.
//
// Lifecycle:
//   - set Final = Non-compliant → upsert the auto row
//   - set Final = Compliant     → remove the auto row unless verified (the
//                                 visit team's note shouldn't be silently lost)
//   - clear Final               → remove unverified auto rows only
// ---------------------------------------------------------------------------

export type ChecklistInclusionReason = 'partial' | 'non_compliant' | 'follow_up' | 'manual';

export interface ISiteVisitChecklistItem extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode: string;
  inclusionReason: ChecklistInclusionReason;
  // The lead reader's Final mark when the row was (re)included. Absent on
  // manual adds and on legacy rows (which carried a numeric
  // `finalScoreAtInclusion` — no longer in the schema, ignored on read).
  finalMarkAtInclusion?: 'compliant' | 'noncompliant';
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
    finalMarkAtInclusion: { type: String, enum: ['compliant', 'noncompliant'] },
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

import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// CR-019 / Sprint 8.1 — Joint Venture grouping (revived 2026-05-30).
//
// A Joint Venture is a cosmetic / organizational layer above institutions.
// Two or more institutions co-deliver a single accreditable program (e.g.
// a regional consortium). The JV does NOT change RBAC — each member
// institution still has its own PC, readers, and submissions. The JV is
// for dashboard grouping + admin admin + rolled-up reporting.
//
// Invariants:
//   - name is unique
//   - institutionIds.length >= 2 (enforced at the controller layer too, because
//     Mongoose `validate` runs after $push)
//   - an institution can belong to AT MOST ONE active JV (enforced by
//     controller — see `_canAddInstitution`)
//   - removing a member that drops the count below 2 → auto-archive
// ---------------------------------------------------------------------------

export interface IJointVenture extends Document {
  name: string;
  description?: string;
  institutionIds: mongoose.Types.ObjectId[];
  archived: boolean;
  archivedAt?: Date;
  archivedReason?: string;
  createdBy: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const JointVentureSchema = new Schema<IJointVenture>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    institutionIds: [
      { type: Schema.Types.ObjectId, ref: 'Institution', required: true }
    ],
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archivedReason: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true }
  },
  { timestamps: true }
);

JointVentureSchema.index({ institutionIds: 1 });

export const JointVenture = mongoose.model<IJointVenture>('JointVenture', JointVentureSchema);

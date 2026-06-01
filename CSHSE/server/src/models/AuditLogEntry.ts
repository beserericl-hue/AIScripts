import mongoose, { Schema, Document } from 'mongoose';

export type AuditAction =
  | 'submission.submit_standard'
  | 'submission.revert_standard'
  | 'submission.final_submit'
  | 'submission.final_submit_override'  // CR-008 / S10.3 — PC forced submit past unresolved preflight errors (reason mandatory)
  | 'submission.unlock'
  | 'submission.send_back'
  | 'submission.lock'
  | 'submission.reader_lock'
  | 'submission.reader_unlock'
  | 'submission.sent_back_cleared'  // CR-006 S2A.1 — PC re-submits after send-back
  | 'submission.spec_marked_na'    // CR-050 — PC marks spec not applicable
  | 'submission.spec_na_cleared'   // CR-050 — PC restores spec from N/A
  | 'reader.assigned'
  | 'reader.removed'
  | 'reader.assignment_change_requested'  // CR-022 / S13c — lead reader asks an admin to change a locked assignment
  | 'comment.relayed'
  | 'comment.unrelayed'
  | 'compilation.final_set'        // CR-009 / S5.1 — lead reader stamps final 0-3 score per spec
  | 'compilation.final_cleared'    // CR-009 / S5.1 — lead reader retracts a final score
  | 'compilation.finalized'        // CR-056 — lead reader sends the review to the board (→ review_complete)
  | 'checklist.item_verified'      // CR-012 / S6.1 — visit team verifies a partial-compliance item
  | 'checklist.item_unverified'    // CR-012 / S6.1 — visit team un-verifies
  | 'itinerary.updated'            // CR-013 / S6.2 — agenda replaced (lead/PC co-edit)
  | 'board.decision_recorded'      // CR-053 / S7.1 — board accept/table/deny/suspend/revoke
  | 'submission.reaccreditation_spun_up' // CR-053 / S12.1 — auto-created next-cycle reaccreditation self-study
  | 'jv.created'                   // CR-019 / S8.1 — joint venture created
  | 'jv.updated'                   // CR-019 / S8.1 — joint venture name/description edited
  | 'jv.member_added'              // CR-019 / S8.1 — institution added to a JV
  | 'jv.member_removed'            // CR-019 / S8.1 — institution removed from a JV
  | 'jv.archived'                  // CR-019 / S8.1 — JV archived (manual or auto on <2 members)
  | 'account.locked'
  | 'account.unlocked';

export type AuditTargetType =
  | 'submission'
  | 'standard'
  | 'reader'
  | 'comment'
  | 'user';

export interface IAuditLogEntry extends Document {
  action: AuditAction;
  actorId: mongoose.Types.ObjectId;
  actorRole: string;
  actorName: string;
  targetType: AuditTargetType;
  targetId: string;
  submissionId?: mongoose.Types.ObjectId;
  payload?: Record<string, unknown>;
  reason?: string;
  timestamp: Date;
}

const AuditLogEntrySchema = new Schema<IAuditLogEntry>(
  {
    action: { type: String, required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, required: true },
    actorName: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true, index: true },
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', index: true },
    payload: { type: Schema.Types.Mixed },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { capped: false }
);

// Append-only enforcement — block updates + deletes at the model layer.
// Defence-in-depth: the controller should also never call these, but if
// some future code path tries to `.save()` an existing entry or .deleteOne(),
// we reject it here.
AuditLogEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('AuditLogEntry is append-only — updates are not permitted'));
  }
  next();
});

AuditLogEntrySchema.pre('deleteOne', { document: true, query: false }, function (next) {
  next(new Error('AuditLogEntry is append-only — deletes are not permitted'));
});

AuditLogEntrySchema.pre('findOneAndUpdate', function (next) {
  next(new Error('AuditLogEntry is append-only — updates are not permitted'));
});

AuditLogEntrySchema.pre('findOneAndDelete', function (next) {
  next(new Error('AuditLogEntry is append-only — deletes are not permitted'));
});

AuditLogEntrySchema.pre('updateOne', function (next) {
  next(new Error('AuditLogEntry is append-only — updates are not permitted'));
});

export const AuditLogEntry = mongoose.model<IAuditLogEntry>(
  'AuditLogEntry',
  AuditLogEntrySchema
);

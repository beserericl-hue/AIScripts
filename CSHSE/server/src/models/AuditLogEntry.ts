import mongoose, { Schema, Document } from 'mongoose';

export type AuditAction =
  | 'submission.submit_standard'
  | 'submission.revert_standard'
  | 'submission.final_submit'
  | 'submission.unlock'
  | 'submission.send_back'
  | 'submission.lock'
  | 'submission.reader_lock'
  | 'submission.reader_unlock'
  | 'reader.assigned'
  | 'reader.removed'
  | 'comment.relayed'
  | 'comment.unrelayed'
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

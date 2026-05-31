import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// In-app notification (the notification pass — CR-010 DM + CR-053 cycle).
//
// Each row is one notification delivered to one recipient. The matching
// email (if any) is fired fire-and-forget by `notificationService` — this
// model is only the in-app inbox half.
//
// `dedupeKey` makes a notification idempotent: a unique-per-recipient sparse
// index means re-running an idempotent producer (e.g. the cycle-reminder
// scan) never double-delivers. DM notifications leave it unset.
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'dm.new_message'           // CR-010 — new direct message in a thread
  | 'board.cycle_reminder'     // CR-053 — accreditation expiring within window
  | 'board.reconsider_reminder' // CR-053 — tabled decision reconsider date near
  | 'reaccreditation.opened'   // CR-053 / S12.1 — a new reaccreditation self-study was auto-created
  | 'comment.relayed'          // CR-010 / S12.2 — a reader comment was relayed to the PC
  | 'board.decision'           // CR-010 / S12.2 — the board recorded a decision on the PC's submission
  | 'reader.assignment'        // CR-010 / S12.2 — a reader was assigned to a submission
  | 'reader.assignment_change_requested'; // CR-022 / S13c — a lead reader asked an admin to change a locked assignment

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  submissionId?: mongoose.Types.ObjectId;
  dedupeKey?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 2000 },
    link: { type: String, maxlength: 500 },
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission' },
    dedupeKey: { type: String, maxlength: 200 },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date }
  },
  { timestamps: true }
);

// Inbox query: a recipient's newest-first list, with an unread filter.
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

// Idempotency: at most one notification per (recipient, dedupeKey). Sparse via
// partial filter so the many DM notifications (no dedupeKey) aren't constrained.
NotificationSchema.index(
  { recipientId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $exists: true } } }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

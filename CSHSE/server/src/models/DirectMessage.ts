import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// CR-010 / Sprint 5.4 — Portal direct messaging.
//
// Conversations are scoped to ONE submission and have an explicit
// participant list. A PC is NEVER a participant (server-side enforced).
// Threads carry a subject + lastMessageAt for inbox sorting; individual
// messages are append-only per-thread.
// ---------------------------------------------------------------------------

export type DmParticipantRole = 'reader' | 'lead_reader' | 'admin';

export interface IDirectMessageThread extends Document {
  submissionId: mongoose.Types.ObjectId;
  subject: string;
  participantIds: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdByName: string;
  createdByRole: DmParticipantRole;
  lastMessageAt: Date;
  // Optional spec context (when started from the Compilation tab).
  contextStandardCode?: string;
  contextSpecCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DirectMessageThreadSchema = new Schema<IDirectMessageThread>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    subject: { type: String, required: true, maxlength: 200 },
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, enum: ['reader', 'lead_reader', 'admin'], required: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    contextStandardCode: String,
    contextSpecCode: String
  },
  { timestamps: true }
);

DirectMessageThreadSchema.index({ submissionId: 1, lastMessageAt: -1 });
DirectMessageThreadSchema.index({ participantIds: 1, lastMessageAt: -1 });

export const DirectMessageThread = mongoose.model<IDirectMessageThread>(
  'DirectMessageThread',
  DirectMessageThreadSchema
);

export interface IDirectMessage extends Document {
  threadId: mongoose.Types.ObjectId;
  submissionId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: DmParticipantRole;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const DirectMessageSchema = new Schema<IDirectMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'DirectMessageThread', required: true, index: true },
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ['reader', 'lead_reader', 'admin'], required: true },
    content: { type: String, required: true, maxlength: 8192 }
  },
  { timestamps: true }
);

DirectMessageSchema.index({ threadId: 1, createdAt: 1 });

export const DirectMessage = mongoose.model<IDirectMessage>('DirectMessage', DirectMessageSchema);

import mongoose, { Document, Schema } from 'mongoose';

// Reply interface
export interface ICommentReply {
  _id?: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorRole: 'reader' | 'lead_reader' | 'program_coordinator';
  content: string;
  // CR-004 — replies inherit the parent comment's relay state. A reply by
  // a reader is only PC-visible once the parent is relayed; the PC's own
  // replies are always visible to the PC themselves.
  relayed?: boolean;
  relayedText?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Comment interface
export interface IComment extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode?: string;

  // Text selection info
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;

  // Comment content
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorRole: 'reader' | 'lead_reader';
  content: string;

  // Replies (from any role including program coordinator)
  replies: ICommentReply[];

  // Status
  isResolved: boolean;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;

  // CR-004 — identity-redacted relay state.
  // `relayed === true` is the gate: only relayed comments cross the reader
  // tier into the PC tier. `relayedText` is the optional sanitized text
  // Julia edits (the PC sees relayedText if present, else the original
  // content). `pcLabel` is an opt-in pseudonym ("Reader A") the PC sees
  // in place of the reader's name; absent = fully stripped attribution.
  // `originalReaderId` is the canonical author and is NEVER serialized
  // to a PC viewer (server-side enforcement, not just UI-hiding).
  // `boardEscalated` flags a comment the board needs to vote on.
  relayed: boolean;
  relayedText?: string;
  pcLabel?: string;
  originalReaderId?: mongoose.Types.ObjectId;
  relayedAt?: Date;
  relayedBy?: mongoose.Types.ObjectId;
  boardEscalated: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const CommentReplySchema = new Schema<ICommentReply>({
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorRole: {
    type: String,
    enum: ['reader', 'lead_reader', 'program_coordinator'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  // CR-004 — replies inherit parent relay state; explicit fields allow
  // future per-reply override (e.g. PC reply not relayed back to readers).
  relayed: { type: Boolean, default: false },
  relayedText: { type: String, default: undefined }
}, {
  timestamps: true
});

const CommentSchema = new Schema<IComment>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    index: true
  },
  standardCode: {
    type: String,
    required: true,
    index: true
  },
  specCode: {
    type: String,
    default: null
  },

  // Text selection
  selectedText: {
    type: String,
    required: true
  },
  selectionStart: {
    type: Number,
    required: true
  },
  selectionEnd: {
    type: Number,
    required: true
  },

  // Author info
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorRole: {
    type: String,
    enum: ['reader', 'lead_reader'],
    required: true
  },
  content: {
    type: String,
    required: true
  },

  // Replies
  replies: [CommentReplySchema],

  // Resolution status
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },

  // CR-004 — relay state
  relayed: { type: Boolean, default: false, index: true },
  relayedText: { type: String, default: undefined },
  pcLabel: { type: String, default: undefined },
  originalReaderId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
  relayedAt: { type: Date, default: undefined },
  relayedBy: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
  boardEscalated: { type: Boolean, default: false, index: true }
}, {
  timestamps: true
});

// Compound index for efficient querying
CommentSchema.index({ submissionId: 1, standardCode: 1, specCode: 1 });
CommentSchema.index({ submissionId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);

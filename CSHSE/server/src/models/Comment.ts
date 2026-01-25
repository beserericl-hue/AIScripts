import mongoose, { Document, Schema } from 'mongoose';

// Reply interface
export interface ICommentReply {
  _id?: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorRole: 'reader' | 'lead_reader' | 'program_coordinator';
  content: string;
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
  }
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
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
CommentSchema.index({ submissionId: 1, standardCode: 1, specCode: 1 });
CommentSchema.index({ submissionId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);

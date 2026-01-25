import mongoose, { Schema, Document } from 'mongoose';

export type AssignmentType = 'reader' | 'lead_reader';
export type AssignmentStatus = 'active' | 'completed' | 'removed';

export interface IAssignment extends Document {
  submissionId: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  institutionName: string;

  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  assignmentType: AssignmentType;

  assignedBy: mongoose.Types.ObjectId;
  assignedByName: string;
  assignedByRole: string;

  status: AssignmentStatus;

  // For readers - who is the lead reader
  leadReaderId?: mongoose.Types.ObjectId;
  leadReaderName?: string;

  // Tracking
  acceptedAt?: Date;
  completedAt?: Date;
  removedAt?: Date;
  removedBy?: mongoose.Types.ObjectId;
  removalReason?: string;

  // Review progress
  reviewProgress?: {
    totalStandards: number;
    completedStandards: number;
    lastActivityAt?: Date;
  };

  // Notification tracking
  notificationSent: boolean;
  notificationSentAt?: Date;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  institutionId: {
    type: Schema.Types.ObjectId,
    ref: 'Institution',
    required: true
  },
  institutionName: {
    type: String,
    required: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  assignmentType: {
    type: String,
    enum: ['reader', 'lead_reader'],
    required: true
  },

  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedByName: {
    type: String,
    required: true
  },
  assignedByRole: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['active', 'completed', 'removed'],
    default: 'active'
  },

  leadReaderId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  leadReaderName: String,

  acceptedAt: Date,
  completedAt: Date,
  removedAt: Date,
  removedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  removalReason: String,

  reviewProgress: {
    totalStandards: { type: Number, default: 21 },
    completedStandards: { type: Number, default: 0 },
    lastActivityAt: Date
  },

  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: Date,

  notes: String
}, {
  timestamps: true
});

// Indexes
AssignmentSchema.index({ submissionId: 1 });
AssignmentSchema.index({ institutionId: 1 });
AssignmentSchema.index({ userId: 1 });
AssignmentSchema.index({ assignmentType: 1 });
AssignmentSchema.index({ status: 1 });
AssignmentSchema.index({ leadReaderId: 1 });

// Compound index for unique assignment
AssignmentSchema.index(
  { submissionId: 1, userId: 1, assignmentType: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);

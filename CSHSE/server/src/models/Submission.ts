import mongoose, { Schema, Document } from 'mongoose';

export type SubmissionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'readers_assigned'
  | 'review_complete'
  | 'compliant'
  | 'non_compliant';

export type StandardStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'submitted'
  | 'validated';

export type ValidationStatus = 'pending' | 'pass' | 'fail';

export interface IDocumentRef {
  _id: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  type: 'file' | 'url';
  url?: string;
}

export interface INarrativeContent {
  content: string;
  lastModified: Date;
  isComplete: boolean;
  linkedDocuments: string[];
}

export interface IStandardStatusInfo {
  status: StandardStatus;
  completionPercentage: number;
  validationStatus?: ValidationStatus;
  lastModified: Date;
  submittedAt?: Date;
  validatedAt?: Date;
}

export interface ISelfStudyProgress {
  totalSections: number;
  completedSections: number;
  validatedSections: number;
  passedSections: number;
  failedSections: number;
  lastActivity: Date;
}

export interface IDecision {
  outcome: 'approve' | 'deny' | 'conditional';
  decidedBy: mongoose.Types.ObjectId;
  decidedAt: Date;
  comments: string;
}

export interface IReaderLock {
  isLocked: boolean;
  lockedBy?: mongoose.Types.ObjectId;
  lockedByName?: string;
  lockedByRole?: 'reader' | 'lead_reader';
  lockedAt?: Date;
  lockReason?: 'reader_review' | 'lead_reader_review' | 'sent_back_for_correction';
  sentBackAt?: Date;
  sentBackReason?: string;
}

export interface ISubmission extends Document {
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  submitterId: mongoose.Types.ObjectId;
  type: 'initial' | 'reaccreditation' | 'extension';
  status: SubmissionStatus;
  narratives: Record<string, Record<string, INarrativeContent>>;
  documents: IDocumentRef[];
  decision?: IDecision;
  assignedReaders: mongoose.Types.ObjectId[];
  leadReader?: mongoose.Types.ObjectId;
  submittedAt?: Date;

  // Self-study specific extensions
  selfStudyProgress: ISelfStudyProgress;
  standardsStatus: Record<string, IStandardStatusInfo>;
  imports: mongoose.Types.ObjectId[];
  curriculumMatrices: mongoose.Types.ObjectId[];

  // Reader lock
  readerLock: IReaderLock;

  createdAt: Date;
  updatedAt: Date;
}

const DocumentRefSchema = new Schema<IDocumentRef>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  type: { type: String, enum: ['file', 'url'], required: true },
  url: String
});

const NarrativeContentSchema = new Schema<INarrativeContent>({
  content: { type: String, default: '' },
  lastModified: { type: Date, default: Date.now },
  isComplete: { type: Boolean, default: false },
  linkedDocuments: [{ type: String }]
}, { _id: false });

const StandardStatusInfoSchema = new Schema<IStandardStatusInfo>({
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'complete', 'submitted', 'validated'],
    default: 'not_started'
  },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  validationStatus: {
    type: String,
    enum: ['pending', 'pass', 'fail']
  },
  lastModified: { type: Date, default: Date.now },
  submittedAt: Date,
  validatedAt: Date
}, { _id: false });

const SelfStudyProgressSchema = new Schema<ISelfStudyProgress>({
  totalSections: { type: Number, default: 0 },
  completedSections: { type: Number, default: 0 },
  validatedSections: { type: Number, default: 0 },
  passedSections: { type: Number, default: 0 },
  failedSections: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now }
}, { _id: false });

const DecisionSchema = new Schema<IDecision>({
  outcome: {
    type: String,
    enum: ['approve', 'deny', 'conditional'],
    required: true
  },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  decidedAt: { type: Date, required: true },
  comments: { type: String, default: '' }
}, { _id: false });

const ReaderLockSchema = new Schema<IReaderLock>({
  isLocked: { type: Boolean, default: false },
  lockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lockedByName: { type: String },
  lockedByRole: { type: String, enum: ['reader', 'lead_reader'] },
  lockedAt: { type: Date },
  lockReason: {
    type: String,
    enum: ['reader_review', 'lead_reader_review', 'sent_back_for_correction']
  },
  sentBackAt: { type: Date },
  sentBackReason: { type: String }
}, { _id: false });

const SubmissionSchema = new Schema<ISubmission>({
  submissionId: {
    type: String,
    required: true,
    unique: true
  },
  institutionName: { type: String, required: true },
  programName: { type: String, required: true },
  programLevel: {
    type: String,
    enum: ['associate', 'bachelors', 'masters'],
    required: true
  },
  submitterId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['initial', 'reaccreditation', 'extension'],
    required: true
  },
  status: {
    type: String,
    enum: [
      'draft',
      'in_progress',
      'submitted',
      'under_review',
      'readers_assigned',
      'review_complete',
      'compliant',
      'non_compliant'
    ],
    default: 'draft'
  },
  narratives: {
    type: Map,
    of: {
      type: Map,
      of: NarrativeContentSchema
    },
    default: {}
  },
  documents: [DocumentRefSchema],
  decision: DecisionSchema,
  assignedReaders: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  leadReader: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  submittedAt: Date,

  // Self-study specific extensions
  selfStudyProgress: {
    type: SelfStudyProgressSchema,
    default: {
      totalSections: 0,
      completedSections: 0,
      validatedSections: 0,
      passedSections: 0,
      failedSections: 0,
      lastActivity: new Date()
    }
  },
  standardsStatus: {
    type: Map,
    of: StandardStatusInfoSchema,
    default: {}
  },
  imports: [{
    type: Schema.Types.ObjectId,
    ref: 'SelfStudyImport'
  }],
  curriculumMatrices: [{
    type: Schema.Types.ObjectId,
    ref: 'CurriculumMatrix'
  }],

  // Reader lock for preventing program coordinator edits during review
  readerLock: {
    type: ReaderLockSchema,
    default: {
      isLocked: false
    }
  }
}, {
  timestamps: true
});

// Indexes
SubmissionSchema.index({ submissionId: 1 });
SubmissionSchema.index({ submitterId: 1 });
SubmissionSchema.index({ status: 1 });
SubmissionSchema.index({ programLevel: 1 });
SubmissionSchema.index({ assignedReaders: 1 });
SubmissionSchema.index({ leadReader: 1 });

// Generate submission ID before save
SubmissionSchema.pre('save', async function(next) {
  if (this.isNew && !this.submissionId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Submission').countDocuments({
      submissionId: new RegExp(`^${year}-`)
    });
    this.submissionId = `${year}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Method to update standard status
SubmissionSchema.methods.updateStandardStatus = function(
  standardCode: string,
  status: Partial<IStandardStatusInfo>
) {
  const currentStatus = this.standardsStatus.get(standardCode) || {
    status: 'not_started',
    completionPercentage: 0,
    lastModified: new Date()
  };

  this.standardsStatus.set(standardCode, {
    ...currentStatus,
    ...status,
    lastModified: new Date()
  });

  // Update overall progress
  this.selfStudyProgress.lastActivity = new Date();
};

// Method to calculate progress
SubmissionSchema.methods.recalculateProgress = function() {
  const statusMap = this.standardsStatus as Map<string, IStandardStatusInfo>;
  let completed = 0;
  let validated = 0;
  let passed = 0;
  let failed = 0;
  const total = statusMap.size;

  statusMap.forEach((status) => {
    if (status.status === 'complete' || status.status === 'submitted' || status.status === 'validated') {
      completed++;
    }
    if (status.validationStatus) {
      validated++;
      if (status.validationStatus === 'pass') passed++;
      if (status.validationStatus === 'fail') failed++;
    }
  });

  this.selfStudyProgress = {
    totalSections: total,
    completedSections: completed,
    validatedSections: validated,
    passedSections: passed,
    failedSections: failed,
    lastActivity: new Date()
  };
};

export const Submission = mongoose.model<ISubmission>('Submission', SubmissionSchema);

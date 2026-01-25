import mongoose, { Schema, Document } from 'mongoose';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'not_applicable' | null;
export type RecommendationType =
  | 'accreditation_no_conditions'
  | 'conditional_accreditation'
  | 'deny_accreditation'
  | 'hold_decision';

export interface ISpecificationAssessment {
  specCode: string;
  compliance: ComplianceStatus;
  comments: string;
  reviewedAt?: Date;
  flagged?: boolean;
  flagReason?: string;
}

export interface IStandardAssessment {
  standardCode: string;
  specifications: ISpecificationAssessment[];
  overallComments?: string;
  isComplete: boolean;
  completedAt?: Date;
}

export interface IFinalAssessment {
  isComplete: boolean;
  recommendation?: RecommendationType;
  conditionDetails?: string;
  denyExplanation?: string;
  holdExplanation?: string;
  programStrengths: string;
  programWeaknesses: string;
  additionalComments: string;
  signature?: string;
  signedAt?: Date;
}

export interface IReaderProgress {
  totalSpecifications: number;
  reviewedSpecifications: number;
  compliantCount: number;
  nonCompliantCount: number;
  notApplicableCount: number;
  lastActivity: Date;
}

export interface IReview extends Document {
  submissionId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  reviewerNumber: number; // e.g., "1 of 10"
  totalReviewers: number;

  status: 'assigned' | 'in_progress' | 'complete' | 'submitted';

  // Header information
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  reviewDate: Date;

  // Assessments by standard
  assessments: IStandardAssessment[];

  // Final assessment
  finalAssessment: IFinalAssessment;

  // Progress tracking
  progress: IReaderProgress;

  // Bookmarks and flags
  bookmarkedItems: string[]; // Array of "standardCode.specCode"

  // Auto-save tracking
  lastAutoSave?: Date;
  draftVersion: number;

  // Timestamps
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  submittedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const SpecificationAssessmentSchema = new Schema<ISpecificationAssessment>({
  specCode: { type: String, required: true },
  compliance: {
    type: String,
    enum: ['compliant', 'non_compliant', 'not_applicable', null],
    default: null
  },
  comments: { type: String, default: '' },
  reviewedAt: Date,
  flagged: { type: Boolean, default: false },
  flagReason: String
}, { _id: false });

const StandardAssessmentSchema = new Schema<IStandardAssessment>({
  standardCode: { type: String, required: true },
  specifications: [SpecificationAssessmentSchema],
  overallComments: String,
  isComplete: { type: Boolean, default: false },
  completedAt: Date
}, { _id: false });

const FinalAssessmentSchema = new Schema<IFinalAssessment>({
  isComplete: { type: Boolean, default: false },
  recommendation: {
    type: String,
    enum: [
      'accreditation_no_conditions',
      'conditional_accreditation',
      'deny_accreditation',
      'hold_decision'
    ]
  },
  conditionDetails: String,
  denyExplanation: String,
  holdExplanation: String,
  programStrengths: { type: String, default: '' },
  programWeaknesses: { type: String, default: '' },
  additionalComments: { type: String, default: '' },
  signature: String,
  signedAt: Date
}, { _id: false });

const ReaderProgressSchema = new Schema<IReaderProgress>({
  totalSpecifications: { type: Number, default: 0 },
  reviewedSpecifications: { type: Number, default: 0 },
  compliantCount: { type: Number, default: 0 },
  nonCompliantCount: { type: Number, default: 0 },
  notApplicableCount: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now }
}, { _id: false });

const ReviewSchema = new Schema<IReview>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  reviewerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerNumber: { type: Number, required: true },
  totalReviewers: { type: Number, required: true },

  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'complete', 'submitted'],
    default: 'assigned'
  },

  institutionName: { type: String, required: true },
  programName: { type: String, required: true },
  programLevel: {
    type: String,
    enum: ['associate', 'bachelors', 'masters'],
    required: true
  },
  reviewDate: { type: Date, default: Date.now },

  assessments: [StandardAssessmentSchema],

  finalAssessment: {
    type: FinalAssessmentSchema,
    default: {
      isComplete: false,
      programStrengths: '',
      programWeaknesses: '',
      additionalComments: ''
    }
  },

  progress: {
    type: ReaderProgressSchema,
    default: {
      totalSpecifications: 0,
      reviewedSpecifications: 0,
      compliantCount: 0,
      nonCompliantCount: 0,
      notApplicableCount: 0,
      lastActivity: new Date()
    }
  },

  bookmarkedItems: [{ type: String }],

  lastAutoSave: Date,
  draftVersion: { type: Number, default: 1 },

  assignedAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
  submittedAt: Date
}, {
  timestamps: true
});

// Indexes
ReviewSchema.index({ submissionId: 1 });
ReviewSchema.index({ reviewerId: 1 });
ReviewSchema.index({ submissionId: 1, reviewerId: 1 }, { unique: true });
ReviewSchema.index({ status: 1 });

// Calculate progress before saving
ReviewSchema.pre('save', function(next) {
  if (this.isModified('assessments')) {
    let total = 0;
    let reviewed = 0;
    let compliant = 0;
    let nonCompliant = 0;
    let notApplicable = 0;

    for (const assessment of this.assessments) {
      for (const spec of assessment.specifications) {
        total++;
        if (spec.compliance !== null) {
          reviewed++;
          if (spec.compliance === 'compliant') compliant++;
          else if (spec.compliance === 'non_compliant') nonCompliant++;
          else if (spec.compliance === 'not_applicable') notApplicable++;
        }
      }
    }

    this.progress = {
      totalSpecifications: total,
      reviewedSpecifications: reviewed,
      compliantCount: compliant,
      nonCompliantCount: nonCompliant,
      notApplicableCount: notApplicable,
      lastActivity: new Date()
    };

    // Update status based on progress
    if (reviewed > 0 && this.status === 'assigned') {
      this.status = 'in_progress';
      this.startedAt = new Date();
    }
  }

  next();
});

// Method to get completion percentage
ReviewSchema.methods.getCompletionPercentage = function(): number {
  if (this.progress.totalSpecifications === 0) return 0;
  return Math.round((this.progress.reviewedSpecifications / this.progress.totalSpecifications) * 100);
};

// Method to check if ready for final submission
ReviewSchema.methods.isReadyForSubmission = function(): { ready: boolean; missingItems: string[] } {
  const missingItems: string[] = [];

  // Check if all specifications reviewed
  for (const assessment of this.assessments) {
    for (const spec of assessment.specifications) {
      if (spec.compliance === null) {
        missingItems.push(`Standard ${assessment.standardCode}, Specification ${spec.specCode}`);
      }
    }
  }

  // Check final assessment
  if (!this.finalAssessment.recommendation) {
    missingItems.push('Final recommendation');
  }

  if (!this.finalAssessment.programStrengths?.trim()) {
    missingItems.push('Program strengths');
  }

  if (!this.finalAssessment.programWeaknesses?.trim()) {
    missingItems.push('Program weaknesses');
  }

  return {
    ready: missingItems.length === 0,
    missingItems
  };
};

// Static method to get all reviews for a submission
ReviewSchema.statics.getReviewsForSubmission = async function(
  submissionId: mongoose.Types.ObjectId
) {
  return this.find({ submissionId })
    .populate('reviewerId', 'firstName lastName email')
    .sort({ reviewerNumber: 1 });
};

export const Review = mongoose.model<IReview>('Review', ReviewSchema);

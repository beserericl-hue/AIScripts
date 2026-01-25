import mongoose, { Schema, Document } from 'mongoose';
import { ComplianceStatus, RecommendationType } from './Review';

export interface IReaderComplianceVote {
  reviewerId: mongoose.Types.ObjectId;
  reviewerName: string;
  compliance: ComplianceStatus;
  comments: string;
}

export interface ISpecificationCompilation {
  specCode: string;
  readerVotes: IReaderComplianceVote[];
  consensusCompliance?: ComplianceStatus;
  hasDisagreement: boolean;
  compiledComments: string;
  leadReaderNotes?: string;
  finalDetermination?: ComplianceStatus;
  determinedAt?: Date;
}

export interface IStandardCompilation {
  standardCode: string;
  specifications: ISpecificationCompilation[];
  overallNotes?: string;
  isComplete: boolean;
}

export interface IReaderRecommendation {
  reviewerId: mongoose.Types.ObjectId;
  reviewerName: string;
  recommendation: RecommendationType;
  details?: string;
  strengths: string;
  weaknesses: string;
}

export interface IFinalCompilation {
  isComplete: boolean;
  finalRecommendation?: RecommendationType;
  conditionDetails?: string;
  finalStrengths: string;
  finalWeaknesses: string;
  leadReaderSummary: string;
  complianceStatistics: {
    totalSpecifications: number;
    compliantCount: number;
    nonCompliantCount: number;
    notApplicableCount: number;
    complianceRate: number;
  };
  signature?: string;
  signedAt?: Date;
}

export interface ICommentThread {
  threadId: string;
  standardCode: string;
  specCode?: string;
  participants: mongoose.Types.ObjectId[];
  messages: {
    senderId: mongoose.Types.ObjectId;
    senderName: string;
    message: string;
    sentAt: Date;
  }[];
  isResolved: boolean;
  createdAt: Date;
}

export interface ILeadReaderCompilation extends Document {
  submissionId: mongoose.Types.ObjectId;
  leadReaderId: mongoose.Types.ObjectId;

  status: 'in_progress' | 'complete' | 'submitted' | 'approved';

  // Submission info
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';

  // Reader reviews referenced
  reviews: mongoose.Types.ObjectId[];
  totalReaders: number;
  completedReviews: number;

  // Compiled assessments
  compiledAssessments: IStandardCompilation[];

  // Reader recommendations summary
  readerRecommendations: IReaderRecommendation[];

  // Final compilation
  finalCompilation: IFinalCompilation;

  // Communication threads
  commentThreads: ICommentThread[];

  // Tracking
  lastActivity: Date;
  startedAt?: Date;
  completedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const ReaderComplianceVoteSchema = new Schema<IReaderComplianceVote>({
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerName: { type: String, required: true },
  compliance: {
    type: String,
    enum: ['compliant', 'non_compliant', 'not_applicable', null]
  },
  comments: { type: String, default: '' }
}, { _id: false });

const SpecificationCompilationSchema = new Schema<ISpecificationCompilation>({
  specCode: { type: String, required: true },
  readerVotes: [ReaderComplianceVoteSchema],
  consensusCompliance: {
    type: String,
    enum: ['compliant', 'non_compliant', 'not_applicable', null]
  },
  hasDisagreement: { type: Boolean, default: false },
  compiledComments: { type: String, default: '' },
  leadReaderNotes: String,
  finalDetermination: {
    type: String,
    enum: ['compliant', 'non_compliant', 'not_applicable', null]
  },
  determinedAt: Date
}, { _id: false });

const StandardCompilationSchema = new Schema<IStandardCompilation>({
  standardCode: { type: String, required: true },
  specifications: [SpecificationCompilationSchema],
  overallNotes: String,
  isComplete: { type: Boolean, default: false }
}, { _id: false });

const ReaderRecommendationSchema = new Schema<IReaderRecommendation>({
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerName: { type: String, required: true },
  recommendation: {
    type: String,
    enum: [
      'accreditation_no_conditions',
      'conditional_accreditation',
      'deny_accreditation',
      'hold_decision'
    ]
  },
  details: String,
  strengths: { type: String, default: '' },
  weaknesses: { type: String, default: '' }
}, { _id: false });

const FinalCompilationSchema = new Schema<IFinalCompilation>({
  isComplete: { type: Boolean, default: false },
  finalRecommendation: {
    type: String,
    enum: [
      'accreditation_no_conditions',
      'conditional_accreditation',
      'deny_accreditation',
      'hold_decision'
    ]
  },
  conditionDetails: String,
  finalStrengths: { type: String, default: '' },
  finalWeaknesses: { type: String, default: '' },
  leadReaderSummary: { type: String, default: '' },
  complianceStatistics: {
    totalSpecifications: { type: Number, default: 0 },
    compliantCount: { type: Number, default: 0 },
    nonCompliantCount: { type: Number, default: 0 },
    notApplicableCount: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 0 }
  },
  signature: String,
  signedAt: Date
}, { _id: false });

const CommentThreadSchema = new Schema<ICommentThread>({
  threadId: { type: String, required: true },
  standardCode: { type: String, required: true },
  specCode: String,
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  messages: [{
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    sentAt: { type: Date, default: Date.now }
  }],
  isResolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const LeadReaderCompilationSchema = new Schema<ILeadReaderCompilation>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    unique: true
  },
  leadReaderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  status: {
    type: String,
    enum: ['in_progress', 'complete', 'submitted', 'approved'],
    default: 'in_progress'
  },

  institutionName: { type: String, required: true },
  programName: { type: String, required: true },
  programLevel: {
    type: String,
    enum: ['associate', 'bachelors', 'masters'],
    required: true
  },

  reviews: [{ type: Schema.Types.ObjectId, ref: 'Review' }],
  totalReaders: { type: Number, default: 0 },
  completedReviews: { type: Number, default: 0 },

  compiledAssessments: [StandardCompilationSchema],
  readerRecommendations: [ReaderRecommendationSchema],

  finalCompilation: {
    type: FinalCompilationSchema,
    default: {
      isComplete: false,
      finalStrengths: '',
      finalWeaknesses: '',
      leadReaderSummary: '',
      complianceStatistics: {
        totalSpecifications: 0,
        compliantCount: 0,
        nonCompliantCount: 0,
        notApplicableCount: 0,
        complianceRate: 0
      }
    }
  },

  commentThreads: [CommentThreadSchema],

  lastActivity: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
  submittedAt: Date,
  approvedAt: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Indexes
LeadReaderCompilationSchema.index({ submissionId: 1 });
LeadReaderCompilationSchema.index({ leadReaderId: 1 });
LeadReaderCompilationSchema.index({ status: 1 });

// Method to aggregate reader votes into compilation
LeadReaderCompilationSchema.methods.aggregateReaderVotes = async function() {
  const Review = mongoose.model('Review');
  const reviews = await Review.find({ _id: { $in: this.reviews }, status: 'submitted' })
    .populate('reviewerId', 'firstName lastName');

  // Build a map of all assessments
  const compilationMap = new Map<string, Map<string, ISpecificationCompilation>>();

  for (const review of reviews) {
    for (const assessment of review.assessments) {
      if (!compilationMap.has(assessment.standardCode)) {
        compilationMap.set(assessment.standardCode, new Map());
      }
      const standardMap = compilationMap.get(assessment.standardCode)!;

      for (const spec of assessment.specifications) {
        if (!standardMap.has(spec.specCode)) {
          standardMap.set(spec.specCode, {
            specCode: spec.specCode,
            readerVotes: [],
            hasDisagreement: false,
            compiledComments: ''
          });
        }

        const compilation = standardMap.get(spec.specCode)!;
        const reviewer = review.reviewerId as any;

        compilation.readerVotes.push({
          reviewerId: review.reviewerId,
          reviewerName: `${reviewer.firstName} ${reviewer.lastName}`,
          compliance: spec.compliance,
          comments: spec.comments
        });
      }
    }
  }

  // Calculate consensus and disagreements
  this.compiledAssessments = [];

  for (const [standardCode, specMap] of compilationMap) {
    const specifications: ISpecificationCompilation[] = [];

    for (const [_specCode, compilation] of specMap) {
      // Count votes
      const votes = compilation.readerVotes.filter(v => v.compliance !== null);
      const compliantVotes = votes.filter(v => v.compliance === 'compliant').length;
      const nonCompliantVotes = votes.filter(v => v.compliance === 'non_compliant').length;
      const naVotes = votes.filter(v => v.compliance === 'not_applicable').length;

      // Determine consensus (majority)
      const maxVotes = Math.max(compliantVotes, nonCompliantVotes, naVotes);
      if (maxVotes > 0) {
        if (compliantVotes === maxVotes) {
          compilation.consensusCompliance = 'compliant';
        } else if (nonCompliantVotes === maxVotes) {
          compilation.consensusCompliance = 'non_compliant';
        } else {
          compilation.consensusCompliance = 'not_applicable';
        }
      }

      // Check for disagreement
      const uniqueVotes = new Set(votes.map(v => v.compliance));
      compilation.hasDisagreement = uniqueVotes.size > 1;

      // Compile comments
      compilation.compiledComments = compilation.readerVotes
        .filter(v => v.comments?.trim())
        .map(v => `[${v.reviewerName}]: ${v.comments}`)
        .join('\n\n');

      specifications.push(compilation);
    }

    this.compiledAssessments.push({
      standardCode,
      specifications,
      isComplete: false
    });
  }

  // Aggregate recommendations
  this.readerRecommendations = reviews
    .filter(r => r.finalAssessment?.recommendation)
    .map(r => {
      const reviewer = r.reviewerId as any;
      return {
        reviewerId: r.reviewerId,
        reviewerName: `${reviewer.firstName} ${reviewer.lastName}`,
        recommendation: r.finalAssessment.recommendation!,
        details: r.finalAssessment.conditionDetails || r.finalAssessment.denyExplanation || r.finalAssessment.holdExplanation,
        strengths: r.finalAssessment.programStrengths,
        weaknesses: r.finalAssessment.programWeaknesses
      };
    });

  this.completedReviews = reviews.length;
  this.lastActivity = new Date();

  return this;
};

// Method to calculate compliance statistics
LeadReaderCompilationSchema.methods.calculateStatistics = function() {
  let total = 0;
  let compliant = 0;
  let nonCompliant = 0;
  let notApplicable = 0;

  for (const assessment of this.compiledAssessments) {
    for (const spec of assessment.specifications) {
      total++;
      const determination = spec.finalDetermination || spec.consensusCompliance;
      if (determination === 'compliant') compliant++;
      else if (determination === 'non_compliant') nonCompliant++;
      else if (determination === 'not_applicable') notApplicable++;
    }
  }

  this.finalCompilation.complianceStatistics = {
    totalSpecifications: total,
    compliantCount: compliant,
    nonCompliantCount: nonCompliant,
    notApplicableCount: notApplicable,
    complianceRate: total > 0 ? Math.round((compliant / (total - notApplicable)) * 100) : 0
  };

  return this.finalCompilation.complianceStatistics;
};

// Method to get items with disagreement
LeadReaderCompilationSchema.methods.getDisagreements = function() {
  const disagreements: { standardCode: string; specCode: string; votes: IReaderComplianceVote[] }[] = [];

  for (const assessment of this.compiledAssessments) {
    for (const spec of assessment.specifications) {
      if (spec.hasDisagreement) {
        disagreements.push({
          standardCode: assessment.standardCode,
          specCode: spec.specCode,
          votes: spec.readerVotes
        });
      }
    }
  }

  return disagreements;
};

export const LeadReaderCompilation = mongoose.model<ILeadReaderCompilation>(
  'LeadReaderCompilation',
  LeadReaderCompilationSchema
);

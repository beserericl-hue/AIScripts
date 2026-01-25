import mongoose, { Schema, Document } from 'mongoose';

export interface IValidationResultData {
  status: 'pass' | 'fail' | 'warning' | 'pending';
  score?: number;
  feedback?: string;
  suggestions?: string[];
  missingElements?: string[];
  processingTimeMs?: number;
}

export interface IValidationResult extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode: string;
  validationType: 'auto_save' | 'manual_save' | 'submit';
  validatedAt: Date;
  n8nWorkflowId?: string;
  n8nExecutionId?: string;
  result: IValidationResultData;
  previousValidationId?: mongoose.Types.ObjectId;
  attemptNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const ValidationResultDataSchema = new Schema<IValidationResultData>({
  status: {
    type: String,
    enum: ['pass', 'fail', 'warning', 'pending'],
    required: true,
    default: 'pending'
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  feedback: String,
  suggestions: [{ type: String }],
  missingElements: [{ type: String }],
  processingTimeMs: Number
}, { _id: false });

const ValidationResultSchema = new Schema<IValidationResult>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  standardCode: { type: String, required: true },
  specCode: { type: String, required: true },
  validationType: {
    type: String,
    enum: ['auto_save', 'manual_save', 'submit'],
    required: true
  },
  validatedAt: { type: Date, default: Date.now },
  n8nWorkflowId: String,
  n8nExecutionId: String,
  result: {
    type: ValidationResultDataSchema,
    required: true,
    default: { status: 'pending' }
  },
  previousValidationId: {
    type: Schema.Types.ObjectId,
    ref: 'ValidationResult'
  },
  attemptNumber: { type: Number, default: 1 }
}, {
  timestamps: true
});

// Indexes for efficient queries
ValidationResultSchema.index({ submissionId: 1 });
ValidationResultSchema.index({ submissionId: 1, standardCode: 1 });
ValidationResultSchema.index({ submissionId: 1, standardCode: 1, specCode: 1 });
ValidationResultSchema.index({ 'result.status': 1 });
ValidationResultSchema.index({ n8nExecutionId: 1 });
ValidationResultSchema.index({ validationType: 1 });

// Compound index for finding latest validation per section
ValidationResultSchema.index(
  { submissionId: 1, standardCode: 1, specCode: 1, validatedAt: -1 }
);

// Static method to get the latest validation for a section
ValidationResultSchema.statics.getLatestValidation = async function(
  submissionId: mongoose.Types.ObjectId,
  standardCode: string,
  specCode: string
) {
  return this.findOne({
    submissionId,
    standardCode,
    specCode
  }).sort({ validatedAt: -1 });
};

// Static method to get all failed sections for a submission
ValidationResultSchema.statics.getFailedSections = async function(
  submissionId: mongoose.Types.ObjectId,
  standardCodes?: string[]
) {
  const query: any = {
    submissionId,
    'result.status': 'fail'
  };

  if (standardCodes && standardCodes.length > 0) {
    query.standardCode = { $in: standardCodes };
  }

  // Get the latest validation for each section that failed
  const pipeline = [
    { $match: query },
    { $sort: { validatedAt: -1 } },
    {
      $group: {
        _id: { standardCode: '$standardCode', specCode: '$specCode' },
        latestValidation: { $first: '$$ROOT' }
      }
    },
    { $match: { 'latestValidation.result.status': 'fail' } },
    { $replaceRoot: { newRoot: '$latestValidation' } }
  ];

  return this.aggregate(pipeline);
};

export const ValidationResult = mongoose.model<IValidationResult>('ValidationResult', ValidationResultSchema);

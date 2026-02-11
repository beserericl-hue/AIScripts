import mongoose, { Schema, Document } from 'mongoose';

export interface IScore extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode: string;
  reviewerId: mongoose.Types.ObjectId;
  reviewerName: string;
  reviewerRole: 'reader' | 'lead_reader';
  score: number; // 0, 1, 2, 3
  createdAt: Date;
  updatedAt: Date;
}

const ScoreSchema = new Schema<IScore>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    index: true
  },
  standardCode: { type: String, required: true },
  specCode: { type: String, required: true },
  reviewerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerName: { type: String, required: true },
  reviewerRole: {
    type: String,
    enum: ['reader', 'lead_reader'],
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 3,
    validate: {
      validator: Number.isInteger,
      message: 'Score must be an integer (0, 1, 2, or 3)'
    }
  }
}, {
  timestamps: true
});

// Each reviewer can have only one score per submission+standard+spec
ScoreSchema.index(
  { submissionId: 1, standardCode: 1, specCode: 1, reviewerId: 1 },
  { unique: true, name: 'idx_unique_score' }
);

// For querying all scores for a submission
ScoreSchema.index(
  { submissionId: 1, standardCode: 1, specCode: 1 },
  { name: 'idx_submission_standard_spec' }
);

export const Score = mongoose.model<IScore>('Score', ScoreSchema);

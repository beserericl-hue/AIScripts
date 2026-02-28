import mongoose, { Schema, Document } from 'mongoose';

export interface IHelpDocument extends Document {
  fileName: string;
  fileSize: number;
  source: 'handbook' | 'user_guide' | 'reference';
  title: string;
  status: 'processing' | 'loaded' | 'error';
  error?: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  completedAt?: Date;
}

const HelpDocumentSchema = new Schema<IHelpDocument>({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  source: { type: String, enum: ['handbook', 'user_guide', 'reference'], default: 'handbook' },
  title: { type: String, required: true },
  status: { type: String, enum: ['processing', 'loaded', 'error'], default: 'processing' },
  error: { type: String },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

export const HelpDocument = mongoose.model<IHelpDocument>('HelpDocument', HelpDocumentSchema);

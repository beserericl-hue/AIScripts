import mongoose, { Schema, Document } from 'mongoose';

export type SpecStatus = 'active' | 'archived' | 'draft';

export interface ISpec extends Document {
  name: string;
  version: string;
  description?: string;
  documentUrl?: string;
  documentKey?: string;
  documentFileId?: mongoose.Types.ObjectId; // Reference to uploaded file in File collection
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
  status: SpecStatus;
  standardsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SpecSchema = new Schema<ISpec>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  documentUrl: String,
  documentKey: String,
  documentFileId: {
    type: Schema.Types.ObjectId,
    ref: 'File'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'draft'],
    default: 'active'
  },
  standardsCount: {
    type: Number,
    default: 21
  }
}, {
  timestamps: true
});

// Indexes
SpecSchema.index({ name: 1, version: 1 }, { unique: true });
SpecSchema.index({ status: 1 });
SpecSchema.index({ uploadedAt: -1 });

export const Spec = mongoose.model<ISpec>('Spec', SpecSchema);

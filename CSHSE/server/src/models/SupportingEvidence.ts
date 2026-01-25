import mongoose, { Schema, Document } from 'mongoose';

export interface IFileInfo {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
}

export interface IUrlInfo {
  href: string;
  title: string;
  description?: string;
  addedAt: Date;
  addedBy: mongoose.Types.ObjectId;
  lastVerified?: Date;
  isAccessible?: boolean;
}

export interface IImageMetadata {
  sourceType: 'fax' | 'letter' | 'certificate' | 'other';
  dateOnDocument?: Date;
  description: string;
  ocrText?: string;
}

export interface ISupportingEvidence extends Document {
  submissionId: mongoose.Types.ObjectId;
  standardCode: string;
  specCode?: string;
  evidenceType: 'document' | 'url' | 'image';
  file?: IFileInfo;
  url?: IUrlInfo;
  imageMetadata?: IImageMetadata;
  linkedNarratives: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FileInfoSchema = new Schema<IFileInfo>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storagePath: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

const UrlInfoSchema = new Schema<IUrlInfo>({
  href: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastVerified: Date,
  isAccessible: { type: Boolean, default: true }
}, { _id: false });

const ImageMetadataSchema = new Schema<IImageMetadata>({
  sourceType: {
    type: String,
    enum: ['fax', 'letter', 'certificate', 'other'],
    required: true
  },
  dateOnDocument: Date,
  description: { type: String, required: true },
  ocrText: String
}, { _id: false });

const SupportingEvidenceSchema = new Schema<ISupportingEvidence>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  standardCode: { type: String, required: true },
  specCode: String,
  evidenceType: {
    type: String,
    enum: ['document', 'url', 'image'],
    required: true
  },
  file: FileInfoSchema,
  url: UrlInfoSchema,
  imageMetadata: ImageMetadataSchema,
  linkedNarratives: [{ type: String }],
  tags: [{ type: String }]
}, {
  timestamps: true
});

// Indexes for efficient queries
SupportingEvidenceSchema.index({ submissionId: 1 });
SupportingEvidenceSchema.index({ submissionId: 1, standardCode: 1 });
SupportingEvidenceSchema.index({ submissionId: 1, standardCode: 1, specCode: 1 });
SupportingEvidenceSchema.index({ evidenceType: 1 });
SupportingEvidenceSchema.index({ tags: 1 });

// Validation to ensure at least one of file, url, or imageMetadata is present based on evidenceType
SupportingEvidenceSchema.pre('save', function(next) {
  if (this.evidenceType === 'document' && !this.file) {
    next(new Error('File information is required for document evidence type'));
  } else if (this.evidenceType === 'url' && !this.url) {
    next(new Error('URL information is required for url evidence type'));
  } else if (this.evidenceType === 'image' && !this.file) {
    next(new Error('File information is required for image evidence type'));
  } else {
    next();
  }
});

export const SupportingEvidence = mongoose.model<ISupportingEvidence>('SupportingEvidence', SupportingEvidenceSchema);

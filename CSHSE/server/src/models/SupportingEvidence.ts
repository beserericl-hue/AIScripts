import mongoose, { Schema, Document } from 'mongoose';

/**
 * File data — supports both legacy base64-in-MongoDB and S3 storage.
 * New uploads use S3; existing base64 records continue to work.
 */
export interface IFileData {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  // Legacy: base64 encoded binary data in MongoDB (optional for S3 uploads)
  data?: string;
  encoding?: 'base64';
  // S3 storage fields
  s3Key?: string;         // Full S3 object key (e.g., "64abc123/64abc123-1/report.pdf")
  s3Bucket?: string;      // Bucket name for reference
  storageType: 'base64' | 's3';  // Where the file lives
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
}

/**
 * URL evidence information
 */
export interface IUrlInfo {
  href: string;
  title: string;
  description?: string;
  addedAt: Date;
  addedBy: mongoose.Types.ObjectId;
  lastVerified?: Date;
  isAccessible?: boolean;
}

/**
 * Image-specific metadata (for scanned documents, faxes, etc.)
 */
export interface IImageMetadata {
  sourceType: 'fax' | 'letter' | 'certificate' | 'screenshot' | 'photo' | 'other';
  dateOnDocument?: Date;
  description: string;
  ocrText?: string;
}

/**
 * Main evidence document interface
 */
export interface ISupportingEvidence extends Document {
  // Access control fields - ALL THREE ARE REQUIRED FOR SECURITY
  // These ensure that only authorized users can access the files:
  // - Program coordinators can only see their own institution's evidence
  // - Readers/lead readers can only see evidence for submissions they're assigned to
  institutionId: mongoose.Types.ObjectId;
  submissionId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;

  // Standard/specification this evidence supports
  standardCode?: string;
  specCode?: string;

  // Evidence type and data
  evidenceType: 'document' | 'url' | 'image';

  // File storage (base64 encoded for documents and images)
  file?: IFileData;

  // URL evidence
  url?: IUrlInfo;

  // Image-specific metadata
  imageMetadata?: IImageMetadata;

  // Metadata
  metadata?: {
    description?: string;
    notes?: string;
  };

  // Linking to narrative sections
  linkedNarratives: string[];
  tags: string[];

  // Versioning
  versionId?: string;       // e.g., "64abc123-1"
  versionNumber: number;    // Sequence: 1, 2, 3...
  isCurrentVersion: boolean;
  previousVersionId?: mongoose.Types.ObjectId;  // Points to the older version
  replacedById?: mongoose.Types.ObjectId;       // Points to the newer version (set on the old doc)

  // Top-level description for easy querying
  description?: string;

  // Cached plain-text extraction of the file — so the coverage reviewer can read
  // an assigned File-Library file's content without re-extracting it every run.
  extractedText?: string;

  // Soft delete support
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * File data schema — supports base64 (legacy) and S3 storage
 */
const FileDataSchema = new Schema<IFileData>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  // Legacy base64 fields (optional for S3 uploads)
  data: { type: String },
  encoding: { type: String, enum: ['base64'], default: 'base64' },
  // S3 fields
  s3Key: { type: String },
  s3Bucket: { type: String },
  storageType: { type: String, enum: ['base64', 's3'], default: 'base64' },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

/**
 * URL info schema
 */
const UrlInfoSchema = new Schema<IUrlInfo>({
  href: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastVerified: Date,
  isAccessible: { type: Boolean, default: true }
}, { _id: false });

/**
 * Image metadata schema
 */
const ImageMetadataSchema = new Schema<IImageMetadata>({
  sourceType: {
    type: String,
    enum: ['fax', 'letter', 'certificate', 'screenshot', 'photo', 'other'],
    required: true
  },
  dateOnDocument: Date,
  description: { type: String, required: true },
  ocrText: String
}, { _id: false });

/**
 * Main supporting evidence schema
 */
const SupportingEvidenceSchema = new Schema<ISupportingEvidence>({
  // Access control fields - all required for security
  institutionId: {
    type: Schema.Types.ObjectId,
    ref: 'Institution',
    required: true,
    index: true
  },
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    index: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Standard/spec linking
  standardCode: { type: String },
  specCode: String,

  // Evidence type
  evidenceType: {
    type: String,
    enum: ['document', 'url', 'image'],
    required: true
  },

  // File data (stored as base64)
  file: FileDataSchema,

  // URL data
  url: UrlInfoSchema,

  // Image metadata
  imageMetadata: ImageMetadataSchema,

  // Additional metadata
  metadata: {
    description: String,
    notes: String
  },

  // Linking
  linkedNarratives: [{ type: String }],
  tags: [{ type: String }],

  // Versioning
  versionId: { type: String },
  versionNumber: { type: Number, default: 1 },
  isCurrentVersion: { type: Boolean, default: true, index: true },
  previousVersionId: { type: Schema.Types.ObjectId, ref: 'SupportingEvidence' },
  replacedById: { type: Schema.Types.ObjectId, ref: 'SupportingEvidence' },

  // Top-level description
  description: { type: String },

  // Cached file text extraction (for the AI coverage reviewer).
  extractedText: { type: String },

  // Soft delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

/**
 * Compound indexes for access control and efficient queries
 * These indexes support the security requirement:
 * "only the college/university (by ID) program coordinators for that college (by ID)
 * and assigned readers and lead reader can see those files"
 */

// Primary access control index - used for all evidence lookups
SupportingEvidenceSchema.index(
  { institutionId: 1, submissionId: 1, isDeleted: 1 },
  { name: 'idx_access_control' }
);

// Index for listing evidence by submission and standard
SupportingEvidenceSchema.index(
  { submissionId: 1, standardCode: 1, specCode: 1, isDeleted: 1 },
  { name: 'idx_submission_standard' }
);

// Index for user's uploaded evidence
SupportingEvidenceSchema.index(
  { uploadedBy: 1, institutionId: 1, isDeleted: 1 },
  { name: 'idx_uploader' }
);

// Index for evidence type filtering
SupportingEvidenceSchema.index(
  { submissionId: 1, evidenceType: 1, isDeleted: 1 },
  { name: 'idx_evidence_type' }
);

// Index for tag searches
SupportingEvidenceSchema.index({ tags: 1 }, { name: 'idx_tags' });

// Index for version lookups (find existing versions of same file)
SupportingEvidenceSchema.index(
  { institutionId: 1, standardCode: 1, specCode: 1, 'file.originalName': 1, isCurrentVersion: 1, isDeleted: 1 },
  { name: 'idx_file_versioning' }
);

/**
 * Pre-save validation
 */
SupportingEvidenceSchema.pre('save', function(next) {
  // Ensure file metadata exists for document/image types
  // (file.data is optional for S3 uploads — check file object exists with s3Key or data)
  if ((this.evidenceType === 'document' || this.evidenceType === 'image') && !this.file) {
    next(new Error('File metadata is required for document/image evidence types'));
    return;
  }
  if (this.evidenceType === 'url' && !this.url) {
    next(new Error('URL information is required for url evidence type'));
    return;
  }

  // Ensure institutionId and submissionId are set
  if (!this.institutionId || !this.submissionId) {
    next(new Error('institutionId and submissionId are required for access control'));
    return;
  }

  next();
});

export const SupportingEvidence = mongoose.model<ISupportingEvidence>('SupportingEvidence', SupportingEvidenceSchema);

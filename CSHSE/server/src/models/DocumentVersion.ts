import mongoose, { Schema, Document } from 'mongoose';

export type DocumentOwnerType = 'institution' | 'submission' | 'review';
export type DocumentKind =
  | 'original_import'   // raw DOCX/PDF the coordinator uploaded
  | 'parsed_html'       // HTML produced by the parser
  | 'reader_report'     // DOCX generated from CSHSE reader-report template
  | 'matrix_template'   // curriculum matrix DOCX template
  | 'spec_document';    // CSHSE specification PDF (Standards by program level)

export interface IDocumentVersion extends Document {
  // Logical document id — multiple versions share this so "version 3 of
  // submission X's original import" is grouped with versions 1 and 2.
  documentId: mongoose.Types.ObjectId;

  version: number;
  s3Key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;

  ownerType: DocumentOwnerType;
  ownerId: mongoose.Types.ObjectId;
  kind: DocumentKind;

  uploadedBy: mongoose.Types.ObjectId;
  uploadedByName: string;

  supersedes?: mongoose.Types.ObjectId;   // previous DocumentVersion._id
  supersededBy?: mongoose.Types.ObjectId; // next DocumentVersion._id (set on later upload)

  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

  metadata?: {
    importId?: mongoose.Types.ObjectId;
    reviewId?: mongoose.Types.ObjectId;
    notes?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const DocumentVersionSchema = new Schema<IDocumentVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, required: true },

    version: { type: Number, required: true, min: 1 },
    s3Key: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    sha256: { type: String, required: true, length: 64 },

    ownerType: {
      type: String,
      required: true,
      enum: ['institution', 'submission', 'review'],
    },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    kind: {
      type: String,
      required: true,
      enum: [
        'original_import',
        'parsed_html',
        'reader_report',
        'matrix_template',
        'spec_document',
      ],
    },

    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedByName: { type: String, required: true },

    supersedes: { type: Schema.Types.ObjectId, ref: 'DocumentVersion' },
    supersededBy: { type: Schema.Types.ObjectId, ref: 'DocumentVersion' },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    metadata: {
      importId: { type: Schema.Types.ObjectId, ref: 'SelfStudyImport' },
      reviewId: { type: Schema.Types.ObjectId, ref: 'Review' },
      notes: { type: String },
    },
  },
  { timestamps: true }
);

// Listing all versions for an owner + kind, newest first.
DocumentVersionSchema.index({ ownerType: 1, ownerId: 1, kind: 1, version: -1 });

// Monotonic version per logical document line.
DocumentVersionSchema.index({ documentId: 1, version: 1 }, { unique: true });

// Dedup lookup: same content → same sha256 → reuse existing version.
DocumentVersionSchema.index({ sha256: 1 });

// Quick filter on soft-delete state.
DocumentVersionSchema.index({ isDeleted: 1 });

export const DocumentVersion = mongoose.model<IDocumentVersion>(
  'DocumentVersion',
  DocumentVersionSchema
);

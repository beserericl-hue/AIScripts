import mongoose, { Document, Schema } from 'mongoose';

export type FileAccessScope = 'global' | 'institution';
export type FileCategory = 'spec_document' | 'self_study_import' | 'evidence' | 'other';

export interface IFile extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  data: Buffer; // Binary file data stored in MongoDB

  // Access control
  accessScope: FileAccessScope;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedByRole: string;
  institutionId?: mongoose.Types.ObjectId; // For institution-scoped files

  // Categorization
  category: FileCategory;
  relatedEntityId?: mongoose.Types.ObjectId; // e.g., specId, submissionId
  relatedEntityType?: string; // e.g., 'Spec', 'Submission'

  // Metadata
  description?: string;
  tags?: string[];

  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IFile>(
  {
    filename: {
      type: String,
      required: true,
      index: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    data: {
      type: Buffer,
      required: true
    },

    // Access control
    accessScope: {
      type: String,
      enum: ['global', 'institution'],
      required: true,
      index: true
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    uploadedByRole: {
      type: String,
      required: true
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      index: true
    },

    // Categorization
    category: {
      type: String,
      enum: ['spec_document', 'self_study_import', 'evidence', 'other'],
      required: true,
      index: true
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      index: true
    },
    relatedEntityType: {
      type: String
    },

    // Metadata
    description: String,
    tags: [String]
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
fileSchema.index({ accessScope: 1, category: 1 });
fileSchema.index({ institutionId: 1, category: 1 });
fileSchema.index({ uploadedBy: 1, category: 1 });
fileSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });

// Method to check if a user can access this file
fileSchema.methods.canAccess = function(
  userId: string,
  userRole: string,
  userInstitutionId?: string,
  isSuperuser?: boolean
): boolean {
  // Superuser and admin can access all files
  if (isSuperuser || userRole === 'admin') {
    return true;
  }

  // Global files can be accessed by anyone
  if (this.accessScope === 'global') {
    return true;
  }

  // Institution-scoped files
  if (this.accessScope === 'institution') {
    // User must belong to the same institution
    if (this.institutionId && userInstitutionId) {
      return this.institutionId.toString() === userInstitutionId;
    }
    // Lead readers and readers assigned to the institution can access
    // This would need to be checked at the controller level with assignment data
  }

  // Owner can always access their own files
  if (this.uploadedBy.toString() === userId) {
    return true;
  }

  return false;
};

export const File = mongoose.model<IFile>('File', fileSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IExtractedSection {
  id: string;
  pageNumber: number;
  startPosition: number;
  endPosition: number;
  sectionType: 'narrative' | 'table' | 'matrix' | 'syllabus' | 'cv' | 'form' | 'unknown';
  content: string;
  confidence: number;
  suggestedStandard?: string;
  suggestedMapping?: string;
}

export interface IMappedSection {
  extractedSectionId: string;
  standardCode: string;
  specCode: string;
  fieldType: 'narrative' | 'evidence' | 'matrix' | 'table';
  mappedBy: 'auto' | 'manual';
  mappedByUserId?: mongoose.Types.ObjectId;
  mappedAt: Date;
}

export interface IUnmappedContent {
  extractedSectionId: string;
  reason: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  action?: 'assigned' | 'discarded' | 'pending';
}

export interface ISelfStudyImport extends Document {
  submissionId: mongoose.Types.ObjectId;
  originalFilename: string;
  fileType: 'pdf' | 'docx' | 'pptx';
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  error?: string;
  // N8N Document Matcher integration
  n8nExecutionId?: string;
  n8nJobId?: string;
  n8nSentAt?: Date;  // When document was sent to n8n webhook
  n8nTotalSections?: number;
  n8nReceivedSections?: number;
  specName?: string;
  extractedContent: {
    rawText: string;
    pageCount: number;
    metadata: {
      title?: string;
      author?: string;
      createdDate?: Date;
    };
    sections: IExtractedSection[];
  };
  mappedSections: IMappedSection[];
  unmappedContent: IUnmappedContent[];
}

const ExtractedSectionSchema = new Schema<IExtractedSection>({
  id: { type: String, required: true },
  pageNumber: { type: Number, required: true },
  startPosition: { type: Number, required: true },
  endPosition: { type: Number, required: true },
  sectionType: {
    type: String,
    enum: ['narrative', 'table', 'matrix', 'syllabus', 'cv', 'form', 'unknown'],
    default: 'unknown'
  },
  content: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 1, default: 0 },
  suggestedStandard: String,
  suggestedMapping: String
}, { _id: false });

const MappedSectionSchema = new Schema<IMappedSection>({
  extractedSectionId: { type: String, required: true },
  standardCode: { type: String, required: true },
  specCode: { type: String, required: true },
  fieldType: {
    type: String,
    enum: ['narrative', 'evidence', 'matrix', 'table'],
    required: true
  },
  mappedBy: {
    type: String,
    enum: ['auto', 'manual'],
    required: true
  },
  mappedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  mappedAt: { type: Date, default: Date.now }
}, { _id: false });

const UnmappedContentSchema = new Schema<IUnmappedContent>({
  extractedSectionId: { type: String, required: true },
  reason: { type: String, required: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  action: {
    type: String,
    enum: ['assigned', 'discarded', 'pending'],
    default: 'pending'
  }
}, { _id: false });

const SelfStudyImportSchema = new Schema<ISelfStudyImport>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  originalFilename: { type: String, required: true },
  fileType: {
    type: String,
    enum: ['pdf', 'docx', 'pptx'],
    required: true
  },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingStartedAt: Date,
  processingCompletedAt: Date,
  error: String,
  // N8N Document Matcher integration
  n8nExecutionId: String,
  n8nJobId: String,
  n8nSentAt: Date,  // When document was sent to n8n webhook
  n8nTotalSections: { type: Number, default: 0 },
  n8nReceivedSections: { type: Number, default: 0 },
  specName: String,
  extractedContent: {
    rawText: { type: String, default: '' },
    pageCount: { type: Number, default: 0 },
    metadata: {
      title: String,
      author: String,
      createdDate: Date
    },
    sections: [ExtractedSectionSchema]
  },
  mappedSections: [MappedSectionSchema],
  unmappedContent: [UnmappedContentSchema]
}, {
  timestamps: true
});

// Index for efficient queries
SelfStudyImportSchema.index({ submissionId: 1 });
SelfStudyImportSchema.index({ status: 1 });
SelfStudyImportSchema.index({ uploadedBy: 1 });

export const SelfStudyImport = mongoose.model<ISelfStudyImport>('SelfStudyImport', SelfStudyImportSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IExtractedSection {
  id: string;
  pageNumber: number;
  startPosition: number;
  endPosition: number;
  sectionType: 'narrative' | 'table' | 'matrix' | 'syllabus' | 'cv' | 'form' | 'unknown' | 'general' | 'intro' | 'supporting_evidence';
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
  // AI-suggested match info (for review by user)
  suggestedStandardCode?: string;
  suggestedSpecCode?: string;
  suggestedConfidence?: number;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  action?: 'assigned' | 'discarded' | 'pending';
}

export interface IParsingProgress {
  step: 'extracting_text' | 'extracting_toc' | 'creating_sections' | 'preparing_ai' | 'sending_to_ai' | 'section_selection';
  stepDescription: string;
  tocEntriesFound?: number;
  tocTitles?: string[];  // First few TOC entry titles for display
  sectionsCreated?: number;
  sectionTitles?: string[];  // First few section titles for display
  currentSectionIndex?: number;  // Which section is being sent to AI
}

/**
 * Detected section for user selection before AI processing
 */
export interface IDetectedSection {
  id: string;
  level: 1 | 2 | 3;
  headerType: 'roman' | 'letter' | 'number' | 'standard' | 'appendix' | 'heading';
  headerText: string;
  previewText: string;
  fullContent: string;
  htmlContent: string;
  startPosition: number;
  endPosition: number;
  isAppendix: boolean;
  isSelected: boolean;
  parentId?: string;
  children?: IDetectedSection[];
}

/**
 * Appendix information for supporting documentation
 */
export interface IAppendixInfo {
  htmlPath?: string;      // Path to HTML file in temp folder
  imagesPath?: string;    // Path to images folder
  htmlContent?: string;   // Raw HTML content
  extractedAt?: Date;
}

export interface ISelfStudyImport extends Document {
  submissionId: mongoose.Types.ObjectId;
  originalFilename: string;
  fileType: 'pdf' | 'docx' | 'pptx';
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'awaiting_selection' | 'completed' | 'failed';
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  error?: string;
  // Parsing progress (for real-time UI feedback)
  parsingProgress?: IParsingProgress;
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
  // Part 6: Detected sections for user selection before AI processing
  detectedSections?: IDetectedSection[];
  appendix?: IAppendixInfo;
}

const ExtractedSectionSchema = new Schema<IExtractedSection>({
  id: { type: String, required: true },
  pageNumber: { type: Number, required: true },
  startPosition: { type: Number, required: true },
  endPosition: { type: Number, required: true },
  sectionType: {
    type: String,
    enum: ['narrative', 'table', 'matrix', 'syllabus', 'cv', 'form', 'unknown', 'general', 'intro', 'supporting_evidence'],
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
  // AI-suggested match info (for review by user)
  suggestedStandardCode: String,
  suggestedSpecCode: String,
  suggestedConfidence: Number,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  action: {
    type: String,
    enum: ['assigned', 'discarded', 'pending'],
    default: 'pending'
  }
}, { _id: false });

// Schema for detected sections (Part 6: user selection before AI processing)
const DetectedSectionSchema = new Schema<IDetectedSection>({
  id: { type: String, required: true },
  level: { type: Number, enum: [1, 2, 3], required: true },
  headerType: {
    type: String,
    enum: ['roman', 'letter', 'number', 'standard', 'appendix', 'heading'],
    required: true
  },
  headerText: { type: String, required: true },
  previewText: { type: String, default: '' },
  fullContent: { type: String, default: '' },
  htmlContent: { type: String, default: '' },
  startPosition: { type: Number, default: 0 },
  endPosition: { type: Number, default: 0 },
  isAppendix: { type: Boolean, default: false },
  isSelected: { type: Boolean, default: true },
  parentId: String,
  children: { type: [Schema.Types.Mixed], default: [] }  // Recursive reference
}, { _id: false });

// Schema for appendix info
const AppendixInfoSchema = new Schema<IAppendixInfo>({
  htmlPath: String,
  imagesPath: String,
  htmlContent: String,
  extractedAt: Date
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
    enum: ['pending', 'processing', 'awaiting_selection', 'completed', 'failed'],
    default: 'pending'
  },
  processingStartedAt: Date,
  processingCompletedAt: Date,
  error: String,
  // Parsing progress (for real-time UI feedback)
  parsingProgress: {
    step: {
      type: String,
      enum: ['extracting_text', 'extracting_toc', 'creating_sections', 'preparing_ai', 'sending_to_ai', 'section_selection']
    },
    stepDescription: String,
    tocEntriesFound: Number,
    tocTitles: [String],
    sectionsCreated: Number,
    sectionTitles: [String],
    currentSectionIndex: Number
  },
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
  unmappedContent: [UnmappedContentSchema],
  // Part 6: Detected sections for user selection before AI processing
  detectedSections: [DetectedSectionSchema],
  appendix: AppendixInfoSchema
}, {
  timestamps: true
});

// Index for efficient queries
SelfStudyImportSchema.index({ submissionId: 1 });
SelfStudyImportSchema.index({ status: 1 });
SelfStudyImportSchema.index({ uploadedBy: 1 });

export const SelfStudyImport = mongoose.model<ISelfStudyImport>('SelfStudyImport', SelfStudyImportSchema);

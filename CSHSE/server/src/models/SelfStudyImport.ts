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
  step: 'extracting_text' | 'extracting_toc' | 'creating_sections' | 'preparing_ai' | 'sending_to_ai' | 'section_selection' | 'storing_content';
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
  // Manual tagging metadata
  standardCode?: string;
  specCode?: string;
  appliedDirectly?: boolean;
  isMatrix?: boolean;
  // Text position offsets for placeholder re-insertion on resume
  textStartOffset?: number;
  textLength?: number;
  // Exact HTML removed by insertHtmlMarker (may differ from htmlContent due to
  // table boundary expansion). Used by restoreMarker for accurate restoration.
  removedHtml?: string;
  // HTML context around the marker insertion point (for fuzzy repair matching)
  htmlContextBefore?: string;
  htmlContextAfter?: string;
  wasTableExpanded?: boolean;
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

/**
 * AI Import Wizard — Sprint 1
 *
 * The AI wizard adds a parallel set of fields onto the existing
 * SelfStudyImport record (rather than spawning a sibling collection)
 * so a single import can flow through either the legacy n8n path or
 * the AI path without losing identity. The `aiStatus` field is the
 * source of truth for the wizard's state machine (UI spec §5); the
 * existing `status` field stays in place for legacy compatibility.
 */
export interface IAIBucketItem {
  sectionId: string;
  heading: string;
  snippet: string;
  // Original `<table>` HTML for table-derived items; renderer falls back to
  // the plain-text snippet when null/empty.
  htmlSnippet?: string | null;
  wordCount: number;
  confidence: number;
  acceptState: string;
  rationale: string;
  // CR-031 — monotonic document-order index from the Python splitter.
  // Lower number = earlier in the source document. Used by the wizard's
  // nearestPlacedNeighbor helper to figure out which placed item sits just
  // above an unplaced fragment. Optional so legacy records remain valid.
  byteOffsetStart?: number;
}

export interface IAIBucket {
  standardCode: string;
  specCode: string;
  standardTitle: string;
  specPrompt: string;
  narratives: IAIBucketItem[];
  evidenceText: IAIBucketItem[];
  evidenceFiles: IAIBucketItem[];
  matrixCells: any[];
  coverageScore: number | null;
  coverageCovered: boolean | null;
  coverageGaps: string[];
  coverageStrengths: string[];
}

export interface IAITag {
  tagId: string;
  sectionId: string;
  summary: string;
  fullText: string;
  htmlSnippet?: string | null;
  suggestedStd: string | null;
  suggestedSpec: string | null;
  confidence: number;
  sourceHeading: string;
  acceptState: string;
  rationale: string;
  // CR-031 — same monotonic document-order index as IAIBucketItem.
  byteOffsetStart?: number;
}

export interface IAIPlaceholderSection {
  paragraphIndex: number;
  heading: string;
  standardHint: string | null;
  specHint: string | null;
}

export interface IAIStageProgress {
  name: string;
  state: 'queued' | 'running' | 'done' | 'skipped' | 'n/a' | 'failed';
  detail?: string;
  etaSeconds?: number | null;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IAIFormatVerdict {
  format: 'template' | 'self_study';
  confidence: number;
  signals: Record<string, any>;
  reasoning: string;
}

export type AIImportStatus =
  | 'idle'
  | 'queued'
  | 'parsing'
  | 'parsed'
  | 'applying'
  | 'applied'
  | 'finished'
  | 'canceled'
  | 'failed';

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

  // ---------- AI Import Wizard fields (Sprint 1) ----------
  aiStatus?: AIImportStatus;
  aiJobId?: string;
  aiS3Key?: string;
  aiDocumentVersionId?: string;
  aiProgramLevel?: 'associate' | 'bachelors' | 'masters';
  aiForceFormat?: 'template' | 'self_study' | null;
  aiIsReimport?: boolean;
  aiQueuePosition?: number | null;
  aiQueueDepth?: number | null;
  aiEtaSeconds?: number | null;
  aiFormat?: IAIFormatVerdict | null;
  aiStages?: IAIStageProgress[];
  aiBuckets?: Record<string, IAIBucket>;  // keyed "std.spec"; stored as Mixed for flexibility
  aiTags?: IAITag[];
  aiPlaceholderSections?: IAIPlaceholderSection[];
  aiMatrices?: any[];
  // CR-039 — Introduction buckets keyed by 'document' or 'standard-{N}'.
  // Stored as Mixed because the bucket items are the same shape as
  // aiBuckets[].narratives, with one new wrapping field (scope).
  aiIntroductions?: Record<string, any>;
  // CR-040 Phase 1 — appendix paper + syllabus extractions. Detection +
  // S3 upload + .docx generation land in Phase 2/3; the field is here so
  // apply-time payloads have somewhere to land without schema churn.
  aiEvidenceDocs?: any[];
  // CR-033 Phase 1 — faculty CV extractions. Detector lives in
  // ai-service/app/splitter/cv_detector.py (Phase 2). Phase 1 lands the
  // store / apply pass-through only.
  aiCVs?: any[];
  // CR-039 Phase 2b — section_id → routing_hint map from
  // introduction_detector. Persisted on the import so a hard refresh
  // post-parse re-derives the wizard's Introduction-bucket seed.
  aiIntroductionHints?: Record<string, string>;
  aiErrors?: string[];
  aiStartedAt?: Date;
  aiCompletedAt?: Date;
  aiAppliedAt?: Date;
  aiAppliedCounts?: {
    narratives: number;
    evidenceText: number;
    evidenceFiles: number;
    matrixCells: number;
    tags: number;
    placeholders: number;
  };
  /**
   * Last idempotency key successfully processed by apply-ai. A retry
   * with the same key returns the cached `aiAppliedCounts` instead of
   * re-applying. See UI spec §11.5.
   */
  aiLastIdempotencyKey?: string;
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
      htmlStoredInGridFS?: boolean;  // True if HTML is stored in GridFS (large files)
      htmlSize?: number;             // Size of HTML content in characters
    };
    sections: IExtractedSection[];
  };
  mappedSections: IMappedSection[];
  unmappedContent: IUnmappedContent[];
  // Part 6: Detected sections for user selection before AI processing
  detectedSections?: IDetectedSection[];
  appendix?: IAppendixInfo;
}

// ---------- AI Import Wizard sub-schemas (Sprint 1) ----------

const AIBucketItemSchema = new Schema<IAIBucketItem>({
  sectionId: { type: String, required: true },
  heading: { type: String, default: '' },
  snippet: { type: String, default: '' },
  htmlSnippet: { type: String, default: null },
  wordCount: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  acceptState: { type: String, default: 'review_unknown' },
  rationale: { type: String, default: '' },
  byteOffsetStart: { type: Number, default: 0 }
}, { _id: false });

const AIBucketSchema = new Schema<IAIBucket>({
  standardCode: { type: String, required: true },
  specCode: { type: String, required: true },
  standardTitle: { type: String, default: '' },
  specPrompt: { type: String, default: '' },
  narratives: { type: [AIBucketItemSchema], default: [] },
  evidenceText: { type: [AIBucketItemSchema], default: [] },
  evidenceFiles: { type: [AIBucketItemSchema], default: [] },
  matrixCells: [{ type: Schema.Types.Mixed }],
  coverageScore: { type: Number, default: null },
  coverageCovered: { type: Boolean, default: null },
  coverageGaps: { type: [String], default: [] },
  coverageStrengths: { type: [String], default: [] }
}, { _id: false });

const AITagSchema = new Schema<IAITag>({
  tagId: { type: String, required: true },
  sectionId: { type: String, required: true },
  summary: { type: String, default: '' },
  fullText: { type: String, default: '' },
  htmlSnippet: { type: String, default: null },
  suggestedStd: { type: String, default: null },
  suggestedSpec: { type: String, default: null },
  confidence: { type: Number, default: 0 },
  sourceHeading: { type: String, default: '' },
  acceptState: { type: String, default: 'review_unknown' },
  rationale: { type: String, default: '' },
  byteOffsetStart: { type: Number, default: 0 }
}, { _id: false });

const AIPlaceholderSchema = new Schema<IAIPlaceholderSection>({
  paragraphIndex: { type: Number, required: true },
  heading: { type: String, required: true },
  standardHint: { type: String, default: null },
  specHint: { type: String, default: null }
}, { _id: false });

const AIStageSchema = new Schema<IAIStageProgress>({
  name: { type: String, required: true },
  state: {
    type: String,
    enum: ['queued', 'running', 'done', 'skipped', 'n/a', 'failed'],
    required: true
  },
  detail: { type: String, default: '' },
  etaSeconds: { type: Number, default: null },
  startedAt: Date,
  completedAt: Date
}, { _id: false });

const AIFormatVerdictSchema = new Schema<IAIFormatVerdict>({
  format: { type: String, enum: ['template', 'self_study'], required: true },
  confidence: { type: Number, required: true },
  signals: { type: Schema.Types.Mixed, default: {} },
  reasoning: { type: String, default: '' }
}, { _id: false });

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
  children: { type: [Schema.Types.Mixed], default: [] },  // Recursive reference
  // Manual tagging metadata
  standardCode: String,
  specCode: String,
  appliedDirectly: { type: Boolean, default: false },
  isMatrix: { type: Boolean, default: false },
  // Text position offsets for placeholder re-insertion on resume
  textStartOffset: Number,
  textLength: Number,
  // Exact HTML removed by insertHtmlMarker (includes table expansion).
  // Used by repair for direct matching — most reliable repair data.
  removedHtml: String,
  // HTML context around the marker insertion point (for fuzzy repair matching)
  htmlContextBefore: String,
  htmlContextAfter: String,
  wasTableExpanded: Boolean
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
      enum: ['extracting_text', 'extracting_toc', 'creating_sections', 'preparing_ai', 'sending_to_ai', 'section_selection', 'storing_content']
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
      createdDate: Date,
      htmlStoredInGridFS: { type: Boolean, default: false },
      htmlSize: Number
    },
    sections: [ExtractedSectionSchema]
  },
  mappedSections: [MappedSectionSchema],
  unmappedContent: [UnmappedContentSchema],
  // Part 6: Detected sections for user selection before AI processing
  detectedSections: [DetectedSectionSchema],
  appendix: AppendixInfoSchema,

  // ---------- AI Import Wizard (Sprint 1) ----------
  aiStatus: {
    type: String,
    enum: ['idle', 'queued', 'parsing', 'parsed', 'applying', 'applied', 'finished', 'canceled', 'failed'],
    default: undefined
  },
  aiJobId: String,
  aiS3Key: String,
  aiDocumentVersionId: String,
  aiProgramLevel: {
    type: String,
    enum: ['associate', 'bachelors', 'masters']
  },
  aiForceFormat: {
    type: String,
    enum: ['template', 'self_study', null],
    default: null
  },
  aiIsReimport: { type: Boolean, default: false },
  aiQueuePosition: { type: Number, default: null },
  aiQueueDepth: { type: Number, default: null },
  aiEtaSeconds: { type: Number, default: null },
  aiFormat: { type: AIFormatVerdictSchema, default: null },
  aiStages: { type: [AIStageSchema], default: [] },
  // Buckets are validated upstream by cshse-ai (Pydantic models on the
  // service side); store as Mixed here so Mongoose's strict cast doesn't
  // fight Map<string, IAIBucket> insertion patterns. Shape is documented
  // by IAIBucket above.
  aiBuckets: { type: Schema.Types.Mixed, default: undefined },
  aiTags: { type: [AITagSchema], default: [] },
  aiPlaceholderSections: { type: [AIPlaceholderSchema], default: [] },
  aiMatrices: [{ type: Schema.Types.Mixed }],
  // CR-039
  aiIntroductions: { type: Schema.Types.Mixed, default: undefined },
  // CR-040 Phase 1 — Mixed[] matches the aiMatrices pattern (TS won't
  // accept `[Schema.Types.Mixed]` with a default; use the inline object
  // form `[{ type: Schema.Types.Mixed }]` instead).
  aiEvidenceDocs: [{ type: Schema.Types.Mixed }],
  // CR-033 Phase 1 — same Mixed[] pattern.
  aiCVs: [{ type: Schema.Types.Mixed }],
  // CR-039 Phase 2b — section_id → routing_hint map from
  // introduction_detector.
  aiIntroductionHints: { type: Schema.Types.Mixed, default: undefined },
  aiErrors: { type: [String], default: [] },
  aiStartedAt: Date,
  aiCompletedAt: Date,
  aiAppliedAt: Date,
  aiAppliedCounts: {
    narratives: { type: Number, default: 0 },
    evidenceText: { type: Number, default: 0 },
    evidenceFiles: { type: Number, default: 0 },
    matrixCells: { type: Number, default: 0 },
    tags: { type: Number, default: 0 },
    placeholders: { type: Number, default: 0 }
  },
  aiLastIdempotencyKey: String
}, {
  timestamps: true
});

// Index for efficient queries
SelfStudyImportSchema.index({ submissionId: 1 });
SelfStudyImportSchema.index({ status: 1 });
SelfStudyImportSchema.index({ uploadedBy: 1 });

export const SelfStudyImport = mongoose.model<ISelfStudyImport>('SelfStudyImport', SelfStudyImportSchema);

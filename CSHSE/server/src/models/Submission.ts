import mongoose, { Schema, Document } from 'mongoose';

export type SubmissionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'readers_assigned'
  | 'review_complete'
  | 'compliant'
  | 'non_compliant';

export type StandardStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'submitted'
  | 'validated';

export type ValidationStatus = 'pending' | 'pass' | 'fail';

export interface IDocumentRef {
  _id: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  type: 'file' | 'url';
  url?: string;
}

export interface INarrativeContent {
  content: string;
  lastModified: Date;
  isComplete: boolean;
  linkedDocuments: string[];
  supportingEvidenceText?: string; // Rich text content moved from imports or manually added
}

export interface IStandardStatusInfo {
  status: StandardStatus;
  completionPercentage: number;
  validationStatus?: ValidationStatus;
  verdict?: 'pass' | 'needs_improvement' | 'fail';
  lastModified: Date;
  submittedAt?: Date;
  validatedAt?: Date;
  // CR-050 — per-spec "not applicable / intentionally excluded" state. The
  // PC sets this with a reason; submit-readiness treats `excluded === true`
  // as equivalent to `validationStatus === 'pass'` for the submit gate.
  // Absent (undefined / false) means "not excluded" — no migration needed.
  excluded?: boolean;
  excludedReason?: string;
  excludedAt?: Date;
  excludedBy?: mongoose.Types.ObjectId;
}

export interface ISelfStudyProgress {
  totalSections: number;
  completedSections: number;
  validatedSections: number;
  passedSections: number;
  failedSections: number;
  lastActivity: Date;
}

// CR-053 / Sprint 7.1 — Board decisions. The board reviews the lead-
// reader's compilation + reader scores + site-visit verification and
// stamps one of these outcomes. The legacy 3-outcome enum
// (approve / deny / conditional) is preserved for back-compat with
// pre-Sprint-7 records; new decisions use one of the five values
// below.
export type BoardDecisionOutcome =
  | 'accept'    // Full accreditation
  | 'table'     // Defer the decision to a future board meeting
  | 'deny'      // Deny accreditation
  | 'suspend'   // Suspend an existing accreditation
  | 'revoke'    // Revoke an existing accreditation
  | 'approve'   // legacy alias for 'accept' — kept for old records only
  | 'conditional'; // legacy

export interface IDecision {
  outcome: BoardDecisionOutcome;
  decidedBy: mongoose.Types.ObjectId;
  decidedByName?: string; // CR-053 — snapshot of the deciding admin name.
  decidedAt: Date;
  comments: string;
  // CR-053 — for `table`, the date the board plans to revisit.
  reconsiderAt?: Date;
  // CR-053 — for `accept`, the effective date of accreditation + the
  // cycle expiry (typically `effectiveAt + 7y` for CSHSE).
  effectiveAt?: Date;
  expiresAt?: Date;
}

/**
 * CR-043 — per-item provenance stamped at merge time so a reimport can
 * locate "the EXACT same source artifact" and replace only matching
 * items. Without these stamps, reimport degrades to add-everything
 * (the pre-CR-043 behavior was wipe-everything; both are wrong).
 */
export interface IAIItemSource {
  importId: string;            // SelfStudyImport._id that produced this item
  sourceFilename: string;      // original DOCX filename
  sourceContentHash: string;   // SHA-256 of the original DOCX bytes
  importedAt: Date;
}

export interface IAIReviewState {
  // Mirrors the per-import shapes the wizard's snapshot already carries.
  // Stored as Mixed in Mongoose so the schema evolves without migration
  // (matches the existing SelfStudyImport.aiBuckets pattern).
  buckets: Record<string, any>;
  tags: any[];
  cvs: any[];
  evidenceDocs: any[];
  introductions: Record<string, any>;
  placeholderSections: any[];
  // CR-040 Phase 3b — coverage stays attached at the review-state level
  // since it's a property of the (merged) parse output, not any one
  // import. Updated on each merge.
  coverageReport?: any;
  // Per-item approval/discard. Identity is the content-hash-derived
  // stable key (see IAIItemSource.sourceContentHash + sectionId) so
  // reimport-replace doesn't silently re-approve a drifted item.
  approvedIds: string[];
  discardedIds: string[];
  itemSources: Record<string, IAIItemSource>;  // keyed by item.sectionId
  // CR-043 merge audit log — every receiveAICallback merge appends one
  // entry capturing per-kind kept/replaced/added counts so support can
  // explain "why is my CV gone" with specifics.
  mergeLog: Array<{
    importId: string;
    importedAt: Date;
    reimport: boolean;
    counts: Record<string, { kept: number; replaced: number; added: number }>;
  }>;
  lastUpdatedAt: Date;
}

export interface IAIMatrixState {
  matrices: any[];
  matrixRowEdits: Record<string, any>;  // CR-026 row controls
  lastUpdatedAt: Date;
}

export interface IReaderLock {
  isLocked: boolean;
  lockedBy?: mongoose.Types.ObjectId;
  lockedByName?: string;
  lockedByRole?: 'reader' | 'lead_reader';
  lockedAt?: Date;
  lockReason?: 'reader_review' | 'lead_reader_review' | 'sent_back_for_correction' | 'submission_complete';
  sentBackAt?: Date;
  sentBackReason?: string;
}

export interface ISubmission extends Document {
  submissionId: string;
  institutionId?: mongoose.Types.ObjectId;
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  submitterId: mongoose.Types.ObjectId;
  type: 'initial' | 'reaccreditation' | 'extension';
  // CR-053 / S12.1 — when this submission was auto-spun-up as the next
  // accreditation cycle, this points back to the prior cycle's submission.
  // Used as the idempotency key for the reaccreditation auto-spin-up scan
  // (one reaccreditation per prior cycle).
  reaccreditationOf?: mongoose.Types.ObjectId;
  status: SubmissionStatus;
  narratives: Map<string, Map<string, INarrativeContent>>;
  documents: IDocumentRef[];
  decision?: IDecision;
  assignedReaders: mongoose.Types.ObjectId[];
  leadReader?: mongoose.Types.ObjectId;
  submittedAt?: Date;

  // Self-study specific extensions
  selfStudyProgress: ISelfStudyProgress;
  standardsStatus: Map<string, IStandardStatusInfo>;
  imports: mongoose.Types.ObjectId[];
  curriculumMatrices: mongoose.Types.ObjectId[];
  // CR-039 — Standard-level + document-level Introductions written by the
  // wizard's apply step. Kept as opaque HTML strings (same shape as
  // narratives' content) so the existing TipTap editor surface can render
  // them as soon as a per-Standard intro UI lands. Both fields are
  // optional; absent == no introductions captured for this submission.
  documentIntroduction?: string;
  standardIntroductions?: Map<string, string>;

  // CR-043 — submission-scoped persisted Review state. Survives wizard
  // close, browser refresh, multi-author multi-file imports. Replaces
  // the prior wizard-Zustand-scoped state which got wiped on every new
  // import. Items here are pre-Apply; once approved they flow into
  // narratives + curriculumMatrices and leave aiReviewState.
  aiReviewState?: IAIReviewState;
  // CR-043 — submission-scoped pre-Apply matrix state. Separate from
  // the post-Apply curriculumMatrices array.
  aiMatrixState?: IAIMatrixState;
  // 2026-06-09 — background AI-evaluation queue. "Validate all" / "Approve all"
  // enqueue every spec-with-content here as "std.spec" keys; a background worker
  // drains it in small batches (calls cshse-ai) so the UI never blocks. Total +
  // timestamps drive a progress indicator.
  aiEvalQueue?: string[];
  aiEvalQueueTotal?: number;
  aiEvalQueueStartedAt?: Date;
  aiEvalQueueDoneAt?: Date;

  // Background coverage-recompute queue (drained by coverageQueueWorker so a full
  // "Recheck coverage" never blocks one request past the edge timeout).
  coverageQueue?: string[];
  coverageQueueTotal?: number;
  coverageQueueStartedAt?: Date;
  coverageQueueDoneAt?: Date;

  // Reader lock
  readerLock: IReaderLock;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  recalculateProgress(): void;
}

const DocumentRefSchema = new Schema<IDocumentRef>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  type: { type: String, enum: ['file', 'url'], required: true },
  url: String
});

const NarrativeContentSchema = new Schema<INarrativeContent>({
  content: { type: String, default: '' },
  lastModified: { type: Date, default: Date.now },
  isComplete: { type: Boolean, default: false },
  linkedDocuments: [{ type: String }],
  supportingEvidenceText: { type: String, default: '' }
}, { _id: false });

const StandardStatusInfoSchema = new Schema<IStandardStatusInfo>({
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'complete', 'submitted', 'validated'],
    default: 'not_started'
  },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  verdict: { type: String, default: undefined },
  validationStatus: {
    type: String,
    enum: ['pending', 'pass', 'fail']
  },
  lastModified: { type: Date, default: Date.now },
  submittedAt: Date,
  validatedAt: Date,
  // CR-050 — N/A flag + provenance
  excluded: { type: Boolean, default: undefined },
  excludedReason: { type: String, default: undefined },
  excludedAt: { type: Date, default: undefined },
  excludedBy: { type: Schema.Types.ObjectId, ref: 'User', default: undefined }
}, { _id: false });

const SelfStudyProgressSchema = new Schema<ISelfStudyProgress>({
  totalSections: { type: Number, default: 0 },
  completedSections: { type: Number, default: 0 },
  validatedSections: { type: Number, default: 0 },
  passedSections: { type: Number, default: 0 },
  failedSections: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now }
}, { _id: false });

const DecisionSchema = new Schema<IDecision>({
  outcome: {
    type: String,
    // CR-053 / Sprint 7.1 — five board-decision outcomes + two legacy
    // values kept for back-compat with pre-Sprint-7 records.
    enum: ['accept', 'table', 'deny', 'suspend', 'revoke', 'approve', 'conditional'],
    required: true
  },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  decidedByName: { type: String, default: undefined },
  decidedAt: { type: Date, required: true },
  comments: { type: String, default: '' },
  reconsiderAt: { type: Date, default: undefined },
  effectiveAt: { type: Date, default: undefined },
  expiresAt: { type: Date, default: undefined }
}, { _id: false });

const ReaderLockSchema = new Schema<IReaderLock>({
  isLocked: { type: Boolean, default: false },
  lockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lockedByName: { type: String },
  lockedByRole: { type: String, enum: ['reader', 'lead_reader'] },
  lockedAt: { type: Date },
  lockReason: {
    type: String,
    enum: ['reader_review', 'lead_reader_review', 'sent_back_for_correction', 'submission_complete']
  },
  sentBackAt: { type: Date },
  sentBackReason: { type: String }
}, { _id: false });

const SubmissionSchema = new Schema<ISubmission>({
  submissionId: {
    type: String,
    required: true,
    unique: true
  },
  institutionId: {
    type: Schema.Types.ObjectId,
    ref: 'Institution'
  },
  institutionName: { type: String, required: true },
  programName: { type: String, required: true },
  programLevel: {
    type: String,
    enum: ['associate', 'bachelors', 'masters'],
    required: true
  },
  submitterId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['initial', 'reaccreditation', 'extension'],
    required: true
  },
  // CR-053 / S12.1 — link from an auto-spun-up reaccreditation back to the
  // prior cycle's submission. Indexed for the idempotency lookup.
  reaccreditationOf: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    default: undefined,
    index: true
  },
  status: {
    type: String,
    enum: [
      'draft',
      'in_progress',
      'submitted',
      'under_review',
      'readers_assigned',
      'review_complete',
      'compliant',
      'non_compliant'
    ],
    default: 'draft'
  },
  narratives: {
    type: Map,
    of: {
      type: Map,
      of: NarrativeContentSchema
    },
    default: {}
  },
  // CR-039 — Introduction storage. Both fields are optional + default
  // empty so prior submissions remain valid. documentIntroduction is one
  // HTML blob; standardIntroductions is keyed by standardCode -> HTML.
  documentIntroduction: { type: String, default: undefined },
  standardIntroductions: {
    type: Map,
    of: String,
    default: undefined
  },
  // CR-043 — submission-scoped persisted Review state. Stored as Mixed
  // so the wire shape can evolve without migrations (mirrors the
  // existing SelfStudyImport.aiBuckets pattern). Empty/missing on a
  // fresh submission; populated by receiveAICallback's merge on every
  // parse-complete.
  aiReviewState: { type: Schema.Types.Mixed, default: undefined },
  aiMatrixState: { type: Schema.Types.Mixed, default: undefined },
  // Background AI-evaluation queue (see interface).
  aiEvalQueue: { type: [String], default: undefined },
  aiEvalQueueTotal: { type: Number, default: undefined },
  aiEvalQueueStartedAt: { type: Date, default: undefined },
  aiEvalQueueDoneAt: { type: Date, default: undefined },
  // Background coverage-recompute queue (see interface).
  coverageQueue: { type: [String], default: undefined },
  coverageQueueTotal: { type: Number, default: undefined },
  coverageQueueStartedAt: { type: Date, default: undefined },
  coverageQueueDoneAt: { type: Date, default: undefined },
  documents: [DocumentRefSchema],
  decision: DecisionSchema,
  assignedReaders: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  leadReader: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  submittedAt: Date,

  // Self-study specific extensions
  selfStudyProgress: {
    type: SelfStudyProgressSchema,
    default: {
      totalSections: 0,
      completedSections: 0,
      validatedSections: 0,
      passedSections: 0,
      failedSections: 0,
      lastActivity: new Date()
    }
  },
  standardsStatus: {
    type: Map,
    of: StandardStatusInfoSchema,
    default: {}
  },
  imports: [{
    type: Schema.Types.ObjectId,
    ref: 'SelfStudyImport'
  }],
  curriculumMatrices: [{
    type: Schema.Types.ObjectId,
    ref: 'CurriculumMatrix'
  }],

  // Reader lock for preventing program coordinator edits during review
  readerLock: {
    type: ReaderLockSchema,
    default: {
      isLocked: false
    }
  }
}, {
  timestamps: true
});

// Indexes
SubmissionSchema.index({ submissionId: 1 });
SubmissionSchema.index({ submitterId: 1 });
SubmissionSchema.index({ status: 1 });
SubmissionSchema.index({ programLevel: 1 });
SubmissionSchema.index({ assignedReaders: 1 });
SubmissionSchema.index({ leadReader: 1 });

// Generate submission ID before save
SubmissionSchema.pre('save', async function(next) {
  if (this.isNew && !this.submissionId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Submission').countDocuments({
      submissionId: new RegExp(`^${year}-`)
    });
    this.submissionId = `${year}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// NOTE: updateStandardStatus() was removed — Mongoose 8 Map.set() does not persist
// subdocument fields. Use atomic Submission.updateOne({ $set: { ... } }) instead.

// Method to calculate progress
SubmissionSchema.methods.recalculateProgress = function() {
  const statusMap = this.standardsStatus as Map<string, IStandardStatusInfo>;
  let completed = 0;
  let validated = 0;
  let passed = 0;
  let failed = 0;
  const total = statusMap.size;

  statusMap.forEach((status) => {
    if (status.status === 'complete' || status.status === 'submitted' || status.status === 'validated') {
      completed++;
    }
    if (status.validationStatus) {
      validated++;
      if (status.validationStatus === 'pass') passed++;
      if (status.validationStatus === 'fail') failed++;
    }
  });

  this.selfStudyProgress = {
    totalSections: total,
    completedSections: completed,
    validatedSections: validated,
    passedSections: passed,
    failedSections: failed,
    lastActivity: new Date()
  };
};

export const Submission = mongoose.model<ISubmission>('Submission', SubmissionSchema);

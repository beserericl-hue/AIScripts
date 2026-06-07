/**
 * AI Import Wizard — client store.
 *
 * Implements the state contract from UI spec §9. Server state is the
 * source of truth for everything persistent; this store is a per-tab
 * cache that survives a tab close via Zustand's persist middleware
 * (only the resumable fields — see `partialize` below — are persisted;
 * the heavy `buckets` / `tags` payload is rehydrated from
 * `/api/imports/:importId` on tab open).
 *
 * Transport: opens an SSE EventSource on `/ai-events` as the primary
 * channel for status / queue-position / stage progress (UI spec §6.2).
 * Falls back to 2-second polling on `/ai-status` after three
 * consecutive reconnect failures.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

// Serializes Review save-state POSTs so a later write can't be overtaken by an
// earlier in-flight one (see saveReviewStateToServer). Module-level: the store
// is a singleton, so one shared chain is correct.
let _reviewSaveQueue: Promise<boolean> = Promise.resolve(true);

// ---------------------------------------------------------------- types

export type WizardStep = 'upload' | 'parse' | 'review' | 'matrix' | 'apply' | 'tags';

export type WizardStatus =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'parsing'
  | 'parsed'
  | 'applying'
  | 'applied'
  | 'finished'
  | 'canceled'
  | 'failed';

export type ProgramLevel = 'associate' | 'bachelors' | 'masters';

export type SectionKind = 'text' | 'evidenceText' | 'file' | 'matrix' | 'tag' | 'discard';

export type FormatVerdict = {
  format: 'template' | 'self_study';
  confidence: number;
  signals: Record<string, number | boolean>;
  reasoning: string;
};

export type Recommendation = {
  sectionId: string;
  heading: string;
  snippet: string;
  htmlSnippet?: string | null;
  primaryStandard: string | null;
  primarySpec: string | null;
  primaryConfidence: number;
  sectionType: 'narrative_response' | 'supporting_evidence' | 'curriculum_matrix' | 'context' | 'unknown';
  acceptState: 'auto_accept' | 'review_letter_disagrees' | 'review_low_confidence' | 'review_unknown';
  rationale: string;
  alternates: Array<{ standardCode: string; specCode: string; confidence: number }>;
  docLetter: string | null;
  docStandardHint: string | null;
  wordCount: number;
};

// CR-041 US-6 — provenance fields stamped during merge so the wizard
// can show "from <filename>" chips on every item card. Optional on
// every item shape so single-file imports stay backward-compatible.
export type ItemProvenance = {
  sourceImportId?: string;
  sourceFilename?: string;
};

export type BucketItem = {
  sectionId: string;
  heading: string;
  snippet: string;
  sourceImportId?: string;
  sourceFilename?: string;
  // Original `<table>` HTML for table-derived items; ItemCard renders this
  // verbatim when present instead of the get_text()-flattened snippet.
  htmlSnippet?: string | null;
  wordCount: number;
  confidence: number;
  acceptState: string;
  rationale: string;
  // CR-031 — monotonic document-order index. Lower = earlier in source.
  // Used by nearestPlacedNeighbor.ts to compute "which placed item sits
  // just above an unplaced fragment" for the Review-Unplaced UX.
  byteOffsetStart?: number;
  // CR-032 — coordinator inline edit. originalSnippet preserves the AI's
  // text before the first edit so "Revert to AI original" works.
  // editedAt is the timestamp of the most recent edit; presence drives
  // the "edited" badge on the card. Both undefined for never-edited
  // items (the AI's snippet is canonical).
  originalSnippet?: string;
  editedAt?: number;
};

export type SpecBucket = {
  standardCode: string;
  specCode: string;
  standardTitle: string;
  specPrompt: string;
  narratives: BucketItem[];
  evidenceText: BucketItem[];
  evidenceFiles: BucketItem[];
  matrixCells: any[];
  coverageScore: number | null;
  coverageCovered: boolean | null;
  coverageGaps: string[];
  coverageStrengths: string[];
};

// CR-039 — Standard-level (and document-level) introduction bucket. Lives
// alongside SpecBucket but is keyed by 'document' or `standard-{N}` rather
// than `{std}.{spec}`. The wizard's left rail surfaces these as siblings
// to the standard rows so coordinators can move intro material out of
// misplaced specs without losing it to Unplaced.
export type IntroductionBucket = {
  scope: 'document' | 'standard';
  standardCode: string | null;     // null for document-level
  items: BucketItem[];
};

// CR-033 Phase 1 — faculty CV extracted from the self-study document.
// Routing precedence: matrix-row → spec → matcher → unplaced. Phase 2
// brings the ai-service `cv_detector.py` + the standalone-CV upload
// path; this Phase 1 lands the data shape so apply() and the renderer
// can be wired against a stable contract today.
export type CVRoutingSource = 'matrix' | 'heading' | 'matcher' | 'unplaced';
export type CVItem = {
  sectionId: string;
  facultyName: string;
  htmlSnippet?: string | null;
  snippet: string;
  byteOffsetStart?: number;
  sourceImportId?: string;
  sourceFilename?: string;
  routing: {
    source: CVRoutingSource;
    matrixRowAnchor?: string;
  };
  resolvedStd?: string;
  resolvedSpec?: string;
  // Populated post-Phase-2 (.docx generation + GridFS upload).
  fileId?: string;
  fileName?: string;
};

// CR-040 Phase 1 — appendix paper / syllabus extracted as a standalone
// file. The wizard renders these as compact cards with a "View file"
// button rather than a wall of body text. Detection + .docx generation +
// S3 upload live in later phases; this Phase 1 lands the data shape so
// follow-on work doesn't require schema churn.
export type EvidenceDocSubKind = 'paper' | 'syllabus';
export type EvidenceDocItem = {
  sectionId: string;
  docSubKind: EvidenceDocSubKind;
  title: string;
  sourceImportId?: string;
  sourceFilename?: string;
  author?: string;
  date?: string;
  courseCode?: string;
  subject?: string;
  points?: number;
  pageCountEstimate: number;
  imageCount: number;
  summary: string;
  byteOffsetStart?: number;
  s3Key?: string;            // populated post-Phase-2 (docx + S3 upload)
  s3SignedUrl?: string;      // server refreshes on demand
  fileSize?: number;
  resolvedStd?: string;
  resolvedSpec?: string;
  // Routing the server consumes at Apply time. aiImportController stamps
  // SupportingEvidence.standardCode/specCode from `routing.std` / `routing.spec`
  // (line ~1508). The detector leaves this unset; the coordinator fills it in
  // via the Evidence-Docs rail dropdowns (updateEvidenceDocRouting).
  routing?: { std?: string; spec?: string; source?: string };
  // CR-040 Phase 2c — populated at Apply time when the server packages
  // the evidenceDoc as a SupportingEvidence record. The "View file"
  // button uses `fileId` to hit
  // GET /api/submissions/:submissionId/evidence/:fileId/download.
  fileId?: string;
  fileName?: string;
};

export type Tag = {
  tagId: string;
  sectionId: string;
  summary: string;
  fullText: string;
  sourceImportId?: string;
  sourceFilename?: string;
  htmlSnippet?: string | null;
  suggestedStd: string | null;
  suggestedSpec: string | null;
  confidence: number;
  sourceHeading: string;
  acceptState: string;
  rationale: string;
  // CR-031 — monotonic document-order index from the Python splitter.
  byteOffsetStart?: number;
  // CR-032 — coordinator inline edit, mirrored from BucketItem.
  originalSnippet?: string;
  editedAt?: number;
};

export type PlaceholderSection = {
  paragraphIndex: number;
  heading: string;
  standardHint: string | null;
  specHint: string | null;
};

export type MatrixCell = {
  std: string;
  spec: string | null;
  specPrompt: string;
  rowAnchor: string;       // e.g. "matrix-hsr-row-11-a" — DOM id on the <tr>
  columnIndex: number;
  columnHeader: string;
  codeRaw: string;
  contentTypes: string[];  // ["I","T","K","S"] subset
  depth: string | null;    // "L"|"M"|"H"
  confidence: number;
};

export type MatrixData = {
  matrixId: string;        // "matrix-hsr" | "matrix-non-hsr"
  name: string;            // "Matrix for Human Services Courses"
  anchorName: string;      // "MatrixHSR" | "Matrix2"
  programLevel: string;
  // Full `<table>...</table>` HTML with per-row id="matrix-{slug}-row-{std}-{spec}"
  // baked in by the Python wire_format module.
  htmlSnippet: string;
  columnHeaders: string[];
  rowsMatched: number;
  rowsTotal: number;
  columnCount: number;
  cells: MatrixCell[];
};

export type StageProgress = {
  name: string;
  state: 'queued' | 'running' | 'done' | 'skipped' | 'n/a' | 'failed';
  detail?: string;
  etaSeconds?: number | null;
  startedAt?: string;
  completedAt?: string;
};

export type AIStatusSnapshot = {
  status: WizardStatus;
  queuePosition?: number | null;
  queueDepth?: number | null;
  etaSeconds?: number | null;
  format?: FormatVerdict | null;
  stages?: StageProgress[];
  buckets?: Record<string, SpecBucket> | null;
  tags?: Tag[] | null;
  matrices?: MatrixData[] | null;
  placeholderSections?: PlaceholderSection[] | null;
  errors?: string[];
  // CR-033 / CR-040 / CR-039 Phase 2b/c — detector outputs from
  // ai-service surfaced via /ai-status + SSE so the wizard's Zustand
  // store can rehydrate them on poll without an extra fetch.
  cvs?: CVItem[] | null;
  evidenceDocs?: EvidenceDocItem[] | null;
  introductionHints?: Record<string, string> | null;
  // CR-033 Phase 2c part 2 — true when the upload is standalone CV(s)
  // with no Standards/Specs structure. Wizard renders a one-card Review.
  standaloneCv?: boolean;
  // CR-040 Phase 3b — post-parse coverage report (byte-level census,
  // boundary warnings, missing fragments). Shape mirrors
  // CoverageReport.to_dict() on the ai-service side.
  coverageReport?: AICoverageReport | null;
  // CR-041 US-4 — batch context (multi-file). Null when this snapshot
  // is for a legacy single-file import.
  batch?: ChildSnapshotBatch | null;
};

// CR-041 — multi-file batched import wire shapes (GET /api/imports/batch/:id).
export type ChildSnapshotEntry = {
  importId: string;
  batchPosition: number;
  originalFilename: string;
  status: WizardStatus;
  stages: StageProgress[];
  errors: string[];
  appliedCounts?: any;
};
export type ChildSnapshotBatch = {
  batchId: string;
  submissionId: string;
  status: 'pending' | 'processing' | 'partial_failure' | 'completed' | 'canceled';
  fileCount: number;
  holdForReview: boolean;
  completedCount: number;
  failedCount: number;
  reviewUnlockedAt: string | null;
  appliedAt: string | null;
  children: ChildSnapshotEntry[];
};

// CR-040 Phase 3b — wire shape for the coverage report. Fields stay
// optional so older imports (pre-Phase-3b) still parse cleanly.
export type AIMissingFragment = {
  sectionId: string;
  heading: string;
  snippet: string;
  wordCount: number;
  byteOffsetStart: number;
  splitterTier: string;
  why: string;
};
export type AIBoundaryWarning = {
  sectionId: string;
  kind: 'header_check' | 'sentence_edge' | 'orphan_paragraph' | string;
  detail: string;
};
export type AICoverageReport = {
  totalSections?: number;
  sectionsToBuckets?: number;
  sectionsToTags?: number;
  sectionsToIntroductions?: number;
  sectionsToCVs?: number;
  sectionsToEvidenceDocs?: number;
  sectionsToMatrices?: number;
  coveragePercent?: number;
  bytesTotal?: number;
  bytesAssigned?: number;
  coveragePercentBytes?: number;
  skipBreakdown?: Record<string, number>;
  boundaryWarnings?: AIBoundaryWarning[];
  missingFragments?: AIMissingFragment[];
};

// ---------------------------------------------------------------- state

interface AIImportState {
  // Identity
  importId: string | null;
  submissionId: string | null;
  jobId: string | null;
  step: WizardStep;
  status: WizardStatus;

  // Per-step inputs
  uploadFile: File | null;
  uploadProgress: number;
  programLevel: ProgramLevel;
  isReimport: boolean;
  forceFormat: 'template' | 'self_study' | null;

  // Queue + SSE transport state
  queuePosition: number | null;
  queueDepth: number | null;
  etaSeconds: number | null;
  eventsTransport: 'sse' | 'polling';
  eventsReconnectAttempt: number;

  // From Parse stage
  format: FormatVerdict | null;
  pipelineStages: StageProgress[];

  // From Review stage
  buckets: Record<string, SpecBucket>;
  tags: Tag[];
  placeholderSections: PlaceholderSection[];
  matrices: MatrixData[];
  selectedSpecKey: string | null;
  selectedSectionId: string | null;
  // When set, the matrices view scrolls to and highlights this row id
  // (e.g. "matrix-hsr-row-11-a"). Cleared after the scroll completes.
  selectedMatrixRowAnchor: string | null;

  // CR-026 per-row controls: coordinator-applied edits to matrix rows.
  // Local state — applied to the wire-format matrices at apply() time so
  // the server-side persistence in applyAIImport sees the corrected layout.
  // Keyed by `${matrixSlug}|${rowAnchor}` so the same row in two matrices
  // can be edited independently.
  matrixRowEdits: Record<
    string,
    | { kind: 'retag'; newStd: string; newSpec: string }
    | { kind: 'remove' }
  >;

  // From Apply stage
  mergeMode: 'merge' | 'replace' | 'per_spec';
  perSpecResolution: Record<string, 'keep' | 'take' | 'merge'>;
  applyError: string | null;
  appliedCounts: {
    narratives: number;
    evidenceText: number;
    evidenceFiles: number;
    matrixCells: number;
    tags: number;
    placeholders?: number;
  } | null;

  // True after the coordinator has made any local edit to buckets/tags/
  // matrices (Reassign, kind-flip, matrix row Keep/Remove, etc). When set,
  // _applySnapshot keeps local state instead of replaying the server's
  // original AI placement — so a hard refresh doesn't wipe the edits.
  // Cleared on startOver/reset, on a successful Apply, and at the start
  // of a new upload.
  dirty: boolean;
  // Drives the "Saving…/Saved" chip. Set by the store-level autosave (see the
  // useAIImportStore.subscribe(...) below) so persistence is decoupled from any
  // particular review surface (wizard OR the standalone ReviewSurface).
  reviewSaveState: 'idle' | 'saving' | 'saved';
  // Monotonic counter bumped each time set-approved completes server-side
  // (which materializes approved items into Submission.narratives). The
  // Standards editor shell subscribes to this and invalidates its
  // react-query ['submission'] cache so approved items appear in the spec
  // editor immediately — not only after a hard reload.
  reviewMaterializedAt: number;

  // Errors surfaced from any stage
  errors: string[];

  // CR-034 — per-card "Reviewed" tracker. Stored as a string[] (Set is not
  // JSON-serializable). Previously local React state in ReviewStep, which
  // meant a hard refresh wiped the coordinator's progress.
  approvedIds: string[];
  // CR-048 — sectionIds the PC has discarded (explicitly NOT included in
  // the self-study). Mirrors Submission.aiReviewState.discardedIds so the
  // DRAFTS counts can show un-triaged items only (total − approved −
  // discarded) and "Finish review" can drop the count to zero.
  discardedIds: string[];

  // CR-024 — spec-rail click broadcasts the selected spec so EVERY visible
  // matrix scrolls + flashes its matching row simultaneously. Distinct
  // from selectedMatrixRowAnchor (which targets one specific row from an
  // explicit "View in matrix" button) — this is the soft pre-position
  // signal that applies across all matrices at once.
  matrixScrollSpec: string | null;

  // CR-039 — Introduction buckets keyed by 'document' or `standard-{N}`.
  // Coordinators move misplaced intro material here via the Reassign
  // dropdown. ai-service auto-detection lands in a follow-on phase; until
  // then the buckets exist and are manually populated.
  introductions: Record<string, IntroductionBucket>;

  // CR-040 Phase 1 — appendix paper + syllabus extractions. ai-service
  // detection + .docx generation + S3 upload land in Phase 2/3; the field
  // sits at [] until then so apply() and renderers can be wired against
  // a stable shape today.
  evidenceDocs: EvidenceDocItem[];

  // CR-033 Phase 1 — per-faculty CV extractions. ai-service detector +
  // standalone-CV upload + UI card variant land in Phase 2/3.
  cvs: CVItem[];

  // CR-033 Phase 2c part 2 — true when the upload is a standalone CV(s)
  // file. ReviewStep checks this and renders the simplified
  // single-card Review instead of the full three-column workspace.
  standaloneCv: boolean;

  // CR-040 Phase 3b — coverage report from ai-service. The wizard
  // surfaces it as a Parse-step stat (with color cue), a SpecRail
  // "Missing from import" entry when missingFragments is non-empty,
  // and a soft Apply gate when coverage is below the threshold.
  coverageReport: AICoverageReport | null;

  // CR-041 US-2/US-4 — multi-file batch context. Null in single-file
  // mode (backward-compat). When set, the wizard uses the batch's
  // per-child status for Parse progress and gates Review on
  // batch.holdForReview semantics.
  batchId: string | null;
  batchSnapshot: ChildSnapshotBatch | null;
  // CR-041 US-5 — Hold-for-review flag. Coordinator-controlled on the
  // Upload step (default ON). When true, "Next: Review" is gated until
  // every child in the batch finishes. When false, Review opens as
  // soon as the first child completes.
  holdForReview: boolean;
  // CR-041 US-6 — Source-file filter for the merged Review. null = all
  // sources visible; an importId scopes SpecRail counts + visible
  // cards to that single source child.
  reviewSourceFilter: string | null;
  // CR-040 Phase 3b — coordinator-resolved missing fragments (the
  // coordinator clicked Discard / Reassigned a fragment from the
  // "Missing from import" rail entry). Apply is gated until every
  // missing fragment is in this set. Persisted across refresh.
  resolvedMissingFragmentIds: string[];

  // CR-041 user story 1 — pending file queue when the coordinator
  // drops multiple files on the Upload step. The first file is
  // promoted into `uploadFile` for the existing single-file pipeline;
  // remaining files queue here. User stories 2-10 (parallel imports,
  // batched Review merge, hold-for-review) ride on top of this in a
  // follow-on. Stored as File[] (not persisted via partialize — files
  // can't be serialized to JSON).
  pendingFiles: File[];

  // ---------- actions ----------
  setStep: (s: WizardStep) => void;
  setApprovedIds: (ids: string[]) => void;
  // Set the approved-id set AND persist it to the server (Review surface). The
  // local set updates instantly; the DB write means the "Reviewed" marks
  // survive reload / Re-run detectors. No-op persistence in a wizard-only run.
  persistApprovedIds: (ids: string[]) => Promise<boolean>;
  // Autosave the review-rail content (buckets/tags/cvs/evidenceDocs/intros) to
  // the DB so every change persists without waiting for "Apply to editor".
  // No-op in a wizard-only run (no submissionId). Clears `dirty` on success.
  saveReviewStateToServer: () => Promise<boolean>;
  setMatrixScrollSpec: (specKey: string | null) => void;
  // CR-039
  setIntroductions: (introductions: Record<string, IntroductionBucket>) => void;
  moveItemToIntroduction: (
    sectionId: string,
    targetKey: string
  ) => void;
  // CR-040 Phase 1
  setEvidenceDocs: (docs: EvidenceDocItem[]) => void;
  // CR-033 Phase 1
  setCVs: (cvs: CVItem[]) => void;
  // CR-033 Phase 2c part 2 — coordinator edits a CV's faculty name on
  // the standalone-CV Review screen.
  updateCvFacultyName: (sectionId: string, name: string) => void;
  // CR-033 Phase 2c part 2 — coordinator picks a different (std, spec)
  // for a CV on the standalone-CV Review screen.
  updateCvRouting: (sectionId: string, std: string, spec: string) => void;
  // Coordinator assigns a (std, spec) to a syllabus / appendix paper from
  // the Review wizard's Evidence-Docs rail. Mirrors updateCvRouting; sets
  // both the display fields (resolvedStd/resolvedSpec) and routing.{std,spec}
  // which the server's apply path reads to stamp SupportingEvidence
  // standardCode/specCode (aiImportController.ts ~1508).
  updateEvidenceDocRouting: (sectionId: string, std: string, spec: string) => void;
  // Persist a CV/evidence-doc Standard+Substandard assignment to the server so
  // it survives reload + Re-run detectors. No-op when there's no submissionId
  // (wizard-only run). Resolves to true on success, false on failure.
  persistEvidenceRouting: (sectionId: string, std: string, spec: string) => Promise<boolean>;
  // Move a selected portion of a card into another subspec. Splits the source
  // item to `remainderHtml` and adds the `movedHtml` as a new item in
  // buckets[`${targetStd}.${targetSpec}`]. Updates the store immediately and
  // persists to the server. Resolves false on persistence failure.
  moveSelectionToSpec: (args: {
    sourceSectionId: string;
    kind: 'narratives' | 'evidenceText' | 'evidenceFiles';
    movedHtml: string;
    remainderHtml: string;
    targetStd: string;
    targetSpec: string;
  }) => Promise<boolean>;
  // CR-041 user story 1
  enqueueFiles: (files: File[]) => void;
  popNextPendingFile: () => File | null;
  clearPendingFiles: () => void;
  setSubmissionId: (id: string) => void;
  setUploadFile: (f: File | null) => void;
  setProgramLevel: (l: ProgramLevel) => void;
  setIsReimport: (v: boolean) => void;
  setForceFormat: (f: 'template' | 'self_study' | null) => void;
  selectSpec: (key: string) => void;
  selectSection: (sectionId: string) => void;
  // Jump the wizard to the Matrices view scrolled+highlighted to the given
  // row id (e.g. "matrix-hsr-row-11-a"). Used by per-spec "View in Matrix"
  // buttons and by the Standards-editor "Jump to matrix row" link.
  selectMatrixRow: (rowAnchor: string) => void;
  // CR-026 row controls. Per-row coordinator edits applied locally; they
  // ride along into apply() so applyAIImport persists the corrected layout.
  retagMatrixRow: (matrixSlug: string, rowAnchor: string, newStd: string, newSpec: string) => void;
  removeMatrixRow: (matrixSlug: string, rowAnchor: string) => void;
  restoreMatrixRow: (matrixSlug: string, rowAnchor: string) => void;
  // CR-032 — inline-edit a bucket item's snippet on the Review step.
  // Preserves the AI's original snippet (originalSnippet) on first edit.
  // Sets dirty=true so the edit survives hard refresh via CR-029.
  editBucketItem: (
    specKey: string,
    sectionId: string,
    kind: 'narratives' | 'evidenceText',
    newSnippet: string
  ) => void;
  // CR-032 — same, for an unplaced Tag's fullText.
  editTag: (tagId: string, newText: string) => void;
  // CR-039 follow-on (UX feedback 2026-05-30) — edit + revert for an
  // Introduction-bucket item by sectionId. The store walks every
  // introduction bucket so the caller doesn't need to know which one
  // owns the item (intro keys are e.g. `document` or `standard-3`).
  editIntroductionItem: (sectionId: string, newSnippet: string) => void;
  revertIntroductionItem: (sectionId: string) => void;
  // CR-032 — restore from originalSnippet; clears editedAt + originalSnippet.
  revertBucketItem: (
    specKey: string,
    sectionId: string,
    kind: 'narratives' | 'evidenceText'
  ) => void;
  revertTag: (tagId: string) => void;
  // Set the matrix row anchor WITHOUT switching the center pane to the
  // Matrices view. Used when the user clicks a spec in the rail — we want
  // the matrix view to pre-position itself silently so when the user
  // eventually clicks the "Matrices" entry the right row is already
  // scrolled into view.
  setMatrixRowAnchor: (rowAnchor: string | null) => void;
  clearMatrixRowAnchor: () => void;
  setMergeMode: (m: 'merge' | 'replace' | 'per_spec') => void;

  startUpload: () => Promise<void>;
  openEventStream: () => void;
  closeEventStream: () => void;
  pollAIStatus: () => Promise<void>;
  cancelImport: () => Promise<void>;
  apply: () => Promise<void>;
  loadExisting: (importId: string) => Promise<void>;
  // CR-041 US-5
  setHoldForReview: (v: boolean) => void;
  // CR-041 US-6 — Source-file filter setter. Pass null to clear.
  setReviewSourceFilter: (importId: string | null) => void;
  // CR-040 Phase 3b — coordinator resolved a missing fragment (Discard
  // or Reassign action on the "Missing from import" rail entry).
  resolveMissingFragment: (sectionId: string) => void;
  clearResolvedMissingFragments: () => void;
  // CR-041 US-2/US-3 — initiate a multi-file batch run. Creates a
  // batch, uploads each file as a child, kicks off the advancer.
  startBatchUpload: (files: File[]) => Promise<void>;
  // CR-041 US-4 — poll the parent batch's status + per-child rows for
  // the Parse step UI. Idempotent.
  pollBatch: () => Promise<void>;
  // CR-041 US-6 — fetch every child's snapshot + merge buckets / tags /
  // cvs / evidenceDocs / introductions into the parent state. Each
  // item is stamped with sourceImportId + sourceFilename so the Review
  // UI can show provenance chips.
  loadBatchChildren: () => Promise<void>;
  // CR-043 — fetch the submission-scoped persisted Review state and
  // hydrate the in-memory wizard store from it. Idempotent. Called on
  // ReviewSurface mount + after every per-item approve/discard so the
  // store and server stay in sync.
  loadPersistedReviewState: () => Promise<void>;
  // CR-043 — per-item server-persisted approve/discard.
  approveItemOnServer: (sectionId: string, approved: boolean) => Promise<void>;
  discardItemOnServer: (sectionId: string, discarded: boolean) => Promise<void>;
  clearItemOnServer: (sectionId: string) => Promise<void>;
  // CR-048 — "I'm done reviewing": discard every still-untriaged draft so
  // the unresolved count drops to zero. Returns the number newly discarded.
  finishReviewOnServer: () => Promise<number>;
  reset: () => void;
  // Clear the transient state from a finished or failed run (errors, stages,
  // buckets, matrices, importId) and return the wizard to the Upload step.
  // Used by the Parse step's "Start over" button so the user doesn't see
  // stale red error panels until they drop a new file.
  startOver: () => void;

  // Internal helpers (exposed for testing)
  _applySnapshot: (snap: AIStatusSnapshot) => void;
}

// ---------------------------------------------------------------- helpers

const initialState = {
  importId: null,
  submissionId: null,
  jobId: null,
  step: 'upload' as WizardStep,
  status: 'idle' as WizardStatus,
  uploadFile: null,
  uploadProgress: 0,
  programLevel: 'bachelors' as ProgramLevel,
  isReimport: false,
  forceFormat: null,
  queuePosition: null,
  queueDepth: null,
  etaSeconds: null,
  eventsTransport: 'sse' as const,
  eventsReconnectAttempt: 0,
  format: null,
  pipelineStages: [],
  buckets: {},
  tags: [],
  placeholderSections: [],
  matrices: [] as MatrixData[],
  selectedSpecKey: null,
  selectedSectionId: null,
  selectedMatrixRowAnchor: null as string | null,
  matrixRowEdits: {} as Record<
    string,
    | { kind: 'retag'; newStd: string; newSpec: string }
    | { kind: 'remove' }
  >,
  mergeMode: 'merge' as const,
  perSpecResolution: {},
  applyError: null,
  appliedCounts: null,
  dirty: false,
  reviewSaveState: 'idle' as const,
  reviewMaterializedAt: 0,
  errors: [],
  approvedIds: [] as string[],
  discardedIds: [] as string[],
  matrixScrollSpec: null as string | null,
  // CR-039 — seeded with the 1 document-level + 9 standard-level
  // Introduction buckets so the UI can render them as empty rails even
  // before the matcher or coordinator routes anything in. Standards 1-9
  // cover the full CSHSE rubric; any additional standards added later
  // get their bucket lazily on first use.
  introductions: ((): Record<string, IntroductionBucket> => {
    const out: Record<string, IntroductionBucket> = {
      document: { scope: 'document', standardCode: null, items: [] }
    };
    for (let n = 1; n <= 9; n++) {
      out[`standard-${n}`] = {
        scope: 'standard',
        standardCode: String(n),
        items: []
      };
    }
    return out;
  })(),
  // CR-040 Phase 1
  evidenceDocs: [] as EvidenceDocItem[],
  // CR-033 Phase 1
  cvs: [] as CVItem[],
  // CR-033 Phase 2c part 2
  standaloneCv: false,
  // CR-040 Phase 3b
  coverageReport: null as AICoverageReport | null,
  // CR-041 US-2/US-4/US-5 — multi-file batch context. batchId is null
  // when the wizard is running a single-file legacy import.
  batchId: null as string | null,
  batchSnapshot: null as ChildSnapshotBatch | null,
  // CR-041 US-5 — Hold-for-review flag (default ON per spec).
  // Persisted across refresh so the coordinator's preference survives.
  holdForReview: true,
  // CR-041 US-6 — Source-file filter. null = show all sources.
  reviewSourceFilter: null as string | null,
  // CR-040 Phase 3b — coordinator-resolved missing fragment ids.
  resolvedMissingFragmentIds: [] as string[],
  // CR-041 user story 1
  pendingFiles: [] as File[]
};

// CR-015 — auto-linkify bare http(s) URLs in plain-text snippets so the
// Reader/PC view surfaces them as clickable anchors when no htmlSnippet
// was captured by the walker. Exported for unit-test coverage; the apply()
// flow at two sites (narrative + introduction render) calls into this.
export function linkifyPlainText(s: string): string {
  return s.replace(
    /\bhttps?:\/\/[^\s<>"')]+/g,
    (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`
  );
}

function deriveStepFromStatus(status: WizardStatus, currentStep: WizardStep): WizardStep {
  // Terminal failure ALWAYS forces back to the Parse step regardless of where
  // the user (or persisted state) thought they were — ParseStep renders the
  // red error surface for failed/canceled and gives a Start Over action.
  if (status === 'failed' || status === 'canceled') return 'parse';
  // CR-043 follow-on — wizard is now strictly Upload + Parse. Review,
  // Matrix, and Apply live as standalone toolbar surfaces. When status
  // reaches parsed/applied/finished the wizard stays on Parse (which
  // renders a "Done — open the Review tab" banner). The coordinator
  // clicks the toolbar's Review button to continue.
  if (currentStep === 'tags') return 'tags';
  if (status === 'applied' || status === 'finished') return 'parse';
  if (status === 'parsed') return 'parse';
  if (status === 'queued' || status === 'parsing') return 'parse';
  return currentStep;
}

// Module-level SSE / polling handles. Kept outside of state so the
// store stays serializable.
let _eventSource: EventSource | null = null;
let _pollHandle: ReturnType<typeof setInterval> | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function _clearTransport(): void {
  if (_eventSource) {
    _eventSource.close();
    _eventSource = null;
  }
  if (_pollHandle) {
    clearInterval(_pollHandle);
    _pollHandle = null;
  }
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

/**
 * Persist a single matrix per-row edit to the DB via the existing
 * POST /matrix-state endpoint. `edit: null` removes the persisted edit
 * (restore). Fire-and-forget — the local store already updated optimistically.
 */
function _persistMatrixEdit(
  get: () => { submissionId: string | null },
  matrixSlug: string,
  rowAnchor: string,
  edit: unknown
): void {
  const submissionId = get().submissionId;
  if (!submissionId) return; // wizard-only run
  api
    .post(`/api/submissions/${submissionId}/matrix-state`, { matrixSlug, rowAnchor, edit })
    .catch((err) => console.warn('[matrix-state] persist failed:', err));
}

// ---------------------------------------------------------------- store

export const useAIImportStore = create<AIImportState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (s) => {
        // CR-027 — clear stale errors when the coordinator navigates BACK
        // to Upload (the canonical "fresh start" surface). Only fires when
        // there's no active job in flight — mid-run errors stay so the
        // user sees what just broke.
        const current = get();
        const inFlight =
          current.status === 'uploading' ||
          current.status === 'queued' ||
          current.status === 'parsing' ||
          current.status === 'applying';
        if (s === 'upload' && !inFlight && (current.errors?.length ?? 0) > 0) {
          set({ step: s, errors: [] });
          return;
        }
        set({ step: s });
      },
      setApprovedIds: (ids) => set({ approvedIds: ids }),
      saveReviewStateToServer: async () => {
        // Serialize every save-state write. A debounced autosave fired at mount
        // (the localStorage seed carries dirty=true) and a later one fired by a
        // user edit must NOT race on the network — if the earlier (stale) POST
        // landed last it would persist the pre-edit buckets and the edit would
        // vanish on reload. Chaining means each run starts only after the prior
        // settles and reads get() at RUN time, so the server always ends with
        // the latest state regardless of which timer fired first.
        const run = async (): Promise<boolean> => {
          const s = get();
          if (!s.submissionId) return false; // wizard-only run
          try {
            await api.post(`/api/submissions/${s.submissionId}/review/save-state`, {
              buckets: s.buckets,
              tags: s.tags,
              cvs: s.cvs,
              evidenceDocs: s.evidenceDocs,
              introductions: s.introductions,
              placeholderSections: s.placeholderSections,
            });
            set({ dirty: false });
            return true;
          } catch (err) {
            console.warn('[save-state] autosave failed:', err);
            return false;
          }
        };
        _reviewSaveQueue = _reviewSaveQueue.then(run, run);
        return _reviewSaveQueue;
      },
      persistApprovedIds: async (ids) => {
        const unique = [...new Set(ids)];
        set({ approvedIds: unique }); // optimistic — instant checkmarks
        const { submissionId } = get();
        if (!submissionId) return false; // wizard-only run — nothing to persist
        try {
          const res = await api.post(
            `/api/submissions/${submissionId}/review/set-approved`,
            { approvedIds: unique }
          );
          // Mirror the server's authoritative set (also drops any discards it
          // cleared).
          if (Array.isArray(res.data?.approvedIds)) {
            set({ approvedIds: res.data.approvedIds });
          }
          // 2026-06-07 (user-reported) — set-approved ALSO materializes the
          // approved text into Submission.narratives server-side. The Standards
          // editor reads that via the react-query ['submission'] cache, which the
          // Zustand store can't touch directly. Bump a counter so the editor
          // shell (SelfStudyEditor) can subscribe and invalidate/refetch the
          // submission the moment materialization lands — otherwise approved
          // items only appear after a hard reload.
          set({ reviewMaterializedAt: (get().reviewMaterializedAt || 0) + 1 });
          return true;
        } catch (err) {
          console.warn('[set-approved] persist failed:', err);
          return false;
        }
      },
      setMatrixScrollSpec: (specKey) => set({ matrixScrollSpec: specKey }),
      setIntroductions: (introductions) => set({ introductions, dirty: true }),
      setEvidenceDocs: (docs) => set({ evidenceDocs: docs, dirty: true }),
      setCVs: (cvs) => set({ cvs, dirty: true }),
      // CR-033 Phase 2c part 2 — standalone-CV Review edits. These mutate
      // the existing CV entry in place so apply() picks up the
      // coordinator's choices via the existing aiCVs pass-through.
      updateCvFacultyName: (sectionId, name) =>
        set((s) => ({
          cvs: s.cvs.map((c) =>
            c.sectionId === sectionId ? { ...c, facultyName: name } : c
          ),
          dirty: true
        })),
      updateCvRouting: (sectionId, std, spec) =>
        set((s) => ({
          cvs: s.cvs.map((c) =>
            c.sectionId === sectionId
              ? {
                  ...c,
                  resolvedStd: std,
                  resolvedSpec: spec,
                  // Coordinator override — mark routing as 'matcher' so the
                  // post-Apply audit shows the choice came from a deliberate
                  // pick, not a matrix-row autoresolve.
                  routing: { ...(c.routing || { source: 'matcher' }), source: 'matcher' as const }
                }
              : c
          ),
          dirty: true
        })),
      updateEvidenceDocRouting: (sectionId, std, spec) =>
        set((s) => ({
          evidenceDocs: s.evidenceDocs.map((d) =>
            d.sectionId === sectionId
              ? {
                  ...d,
                  resolvedStd: std,
                  resolvedSpec: spec,
                  // routing.{std,spec} is the field the server reads when it
                  // packages the doc into a SupportingEvidence record at Apply.
                  // source:'coordinator' records that this was a manual pick.
                  routing: { ...(d.routing || {}), std, spec, source: 'coordinator' }
                }
              : d
          ),
          dirty: true
        })),
      persistEvidenceRouting: async (sectionId, std, spec) => {
        const submissionId = get().submissionId;
        if (!submissionId) return false; // wizard-only run — nothing to persist
        try {
          await api.post(
            `/api/submissions/${submissionId}/review/route-evidence`,
            { sectionId, std, spec }
          );
          return true;
        } catch (err) {
          console.warn('[route-evidence] persist failed:', err);
          return false;
        }
      },
      moveSelectionToSpec: async ({
        sourceSectionId,
        kind,
        movedHtml,
        remainderHtml,
        targetStd,
        targetSpec,
      }) => {
        const wordCount = (html: string) => {
          const t = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          return t ? t.split(' ').length : 0;
        };
        const text = (html: string) =>
          html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        const newSectionId = `${sourceSectionId}::split-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

        let sourceItem: any = null;
        set((s) => {
          const buckets: Record<string, any> = { ...s.buckets };
          // Trim the source item wherever it lives.
          for (const key of Object.keys(buckets)) {
            const b = { ...buckets[key] };
            for (const k of ['narratives', 'evidenceText', 'evidenceFiles'] as const) {
              const arr = b[k] || [];
              const idx = arr.findIndex((it: any) => it.sectionId === sourceSectionId);
              if (idx >= 0) {
                sourceItem = arr[idx];
                const updated = { ...arr[idx], htmlSnippet: remainderHtml, snippet: text(remainderHtml), wordCount: wordCount(remainderHtml) };
                b[k] = [...arr.slice(0, idx), updated, ...arr.slice(idx + 1)];
              }
            }
            buckets[key] = b;
          }
          // Ensure the target bucket exists, then add the moved item.
          const targetKey = `${targetStd}.${targetSpec}`;
          const target = buckets[targetKey]
            ? { ...buckets[targetKey] }
            : {
                standardCode: targetStd,
                specCode: targetSpec,
                standardTitle: '',
                specPrompt: '',
                narratives: [],
                evidenceText: [],
                evidenceFiles: [],
                matrixCells: [],
                coverageScore: null,
                coverageCovered: null,
                coverageGaps: [],
                coverageStrengths: [],
              };
          const newItem = {
            sectionId: newSectionId,
            heading: 'Moved here from another subspec',
            snippet: text(movedHtml),
            htmlSnippet: movedHtml,
            wordCount: wordCount(movedHtml),
            confidence: typeof sourceItem?.confidence === 'number' ? sourceItem.confidence : 1,
            acceptState: 'pending',
            rationale: 'Moved here from another subspec by the coordinator.',
            sourceImportId: sourceItem?.sourceImportId,
            sourceFilename: sourceItem?.sourceFilename,
          };
          target[kind] = [...(target[kind] || []), newItem];
          buckets[targetKey] = target;
          return { buckets, dirty: true } as any;
        });

        const submissionId = get().submissionId;
        if (!submissionId) return false;
        try {
          await api.post(`/api/submissions/${submissionId}/review/split-item`, {
            sourceSectionId,
            kind,
            remainderHtml,
            movedHtml,
            targetStd,
            targetSpec,
            newSectionId,
            heading: 'Moved here from another subspec',
          });
          return true;
        } catch (err) {
          console.warn('[split-item] persist failed:', err);
          return false;
        }
      },
      // CR-041 user story 1 — multi-file queue. First file in `files`
      // promotes into `uploadFile` (the single-file pipeline's input);
      // the rest queue. If `uploadFile` is already set the entire batch
      // queues without disturbing the in-flight run.
      enqueueFiles: (files) =>
        set((s) => {
          if (!files || files.length === 0) return s;
          if (!s.uploadFile) {
            const [first, ...rest] = files;
            return {
              uploadFile: first,
              uploadProgress: 0,
              pendingFiles: [...s.pendingFiles, ...rest]
            };
          }
          return { pendingFiles: [...s.pendingFiles, ...files] };
        }),
      popNextPendingFile: () => {
        const { pendingFiles } = get();
        if (pendingFiles.length === 0) return null;
        const [next, ...rest] = pendingFiles;
        set({ pendingFiles: rest });
        return next;
      },
      clearPendingFiles: () => set({ pendingFiles: [] }),
      moveItemToIntroduction: (sectionId, targetKey) =>
        set((s) => {
          // Pull the item out of whichever bucket OR introduction currently
          // holds it, then drop it into the target Introduction bucket.
          // No-op if the item isn't found anywhere (defensive — UI should
          // only offer Reassign on items that exist).
          let pulled: BucketItem | null = null;

          // Search SpecBuckets for the item (narratives / evidenceText only;
          // matrix cells + evidenceFiles aren't movable to Introductions).
          const newBuckets: Record<string, SpecBucket> = {};
          for (const [key, b] of Object.entries(s.buckets)) {
            const nIdx = b.narratives.findIndex((i) => i.sectionId === sectionId);
            const eIdx = b.evidenceText.findIndex((i) => i.sectionId === sectionId);
            if (nIdx >= 0) {
              pulled = b.narratives[nIdx];
              newBuckets[key] = {
                ...b,
                narratives: [...b.narratives.slice(0, nIdx), ...b.narratives.slice(nIdx + 1)]
              };
            } else if (eIdx >= 0) {
              pulled = b.evidenceText[eIdx];
              newBuckets[key] = {
                ...b,
                evidenceText: [...b.evidenceText.slice(0, eIdx), ...b.evidenceText.slice(eIdx + 1)]
              };
            } else {
              newBuckets[key] = b;
            }
          }

          // Also search other Introduction buckets (in case the coordinator
          // is re-routing intro material from one Introduction to another).
          const newIntros: Record<string, IntroductionBucket> = {};
          for (const [key, ib] of Object.entries(s.introductions)) {
            const idx = ib.items.findIndex((i) => i.sectionId === sectionId);
            if (idx >= 0) {
              if (!pulled) pulled = ib.items[idx];
              newIntros[key] = {
                ...ib,
                items: [...ib.items.slice(0, idx), ...ib.items.slice(idx + 1)]
              };
            } else {
              newIntros[key] = ib;
            }
          }

          if (!pulled) return s;

          const target = newIntros[targetKey];
          if (!target) {
            // Target Introduction bucket doesn't exist — refuse silently.
            return s;
          }
          newIntros[targetKey] = {
            ...target,
            items: [...target.items, pulled]
          };

          return {
            buckets: newBuckets,
            introductions: newIntros,
            dirty: true
          };
        }),
      setSubmissionId: (id) => set({ submissionId: id }),
      setUploadFile: (f) => set({ uploadFile: f, uploadProgress: 0 }),
      setProgramLevel: (l) => set({ programLevel: l }),
      setIsReimport: (v) => set({ isReimport: v }),
      setForceFormat: (f) => set({ forceFormat: f }),
      selectSpec: (key) => set({ selectedSpecKey: key, selectedSectionId: null }),
      selectSection: (id) => set({ selectedSectionId: id }),
      selectMatrixRow: (rowAnchor) =>
        set({ selectedSpecKey: '_matrices', selectedMatrixRowAnchor: rowAnchor }),
      setMatrixRowAnchor: (rowAnchor) => set({ selectedMatrixRowAnchor: rowAnchor }),
      clearMatrixRowAnchor: () => set({ selectedMatrixRowAnchor: null }),

      // CR-026 row controls — store local-only edits keyed by matrix+row.
      // The apply() action reads matrixRowEdits and forwards the edited
      // layout to applyAIImport (S2B.8 follow-on). dirty=true so a hard
      // refresh + _applySnapshot preserves the row decisions.
      retagMatrixRow: (matrixSlug, rowAnchor, newStd, newSpec) => {
        set((s) => ({
          matrixRowEdits: {
            ...s.matrixRowEdits,
            [`${matrixSlug}|${rowAnchor}`]: { kind: 'retag', newStd, newSpec }
          },
          dirty: true
        }));
        _persistMatrixEdit(get, matrixSlug, rowAnchor, { kind: 'retag', newStd, newSpec });
      },
      removeMatrixRow: (matrixSlug, rowAnchor) => {
        set((s) => ({
          matrixRowEdits: {
            ...s.matrixRowEdits,
            [`${matrixSlug}|${rowAnchor}`]: { kind: 'remove' }
          },
          dirty: true
        }));
        _persistMatrixEdit(get, matrixSlug, rowAnchor, { kind: 'remove' });
      },
      restoreMatrixRow: (matrixSlug, rowAnchor) => {
        set((s) => {
          const next = { ...s.matrixRowEdits };
          delete next[`${matrixSlug}|${rowAnchor}`];
          return { matrixRowEdits: next, dirty: true };
        });
        // edit:null tells the server to drop the persisted row edit.
        _persistMatrixEdit(get, matrixSlug, rowAnchor, null);
      },

      // CR-032 — inline edit bucket item snippet. The first edit copies
      // the AI's current snippet into originalSnippet so a later
      // "Revert to AI original" can restore it. editedAt is stamped on
      // every edit so the UI badge knows the item has been touched.
      editBucketItem: (specKey, sectionId, kind, newSnippet) =>
        set((s) => {
          const bucket = s.buckets[specKey];
          if (!bucket) return {} as Partial<AIImportState>;
          const list = bucket[kind] as BucketItem[];
          const idx = list.findIndex((i) => i.sectionId === sectionId);
          if (idx < 0) return {} as Partial<AIImportState>;
          const existing = list[idx];
          const updated: BucketItem = {
            ...existing,
            snippet: newSnippet,
            wordCount: newSnippet.trim() ? newSnippet.trim().split(/\s+/).length : 0,
            // Preserve the AI's original snippet ONLY on first edit so a
            // re-edit doesn't keep overwriting originalSnippet with a
            // mid-edit value.
            originalSnippet:
              existing.originalSnippet !== undefined
                ? existing.originalSnippet
                : existing.snippet,
            editedAt: Date.now(),
          };
          const newList = [...list];
          newList[idx] = updated;
          return {
            buckets: {
              ...s.buckets,
              [specKey]: { ...bucket, [kind]: newList },
            },
            dirty: true,
          };
        }),

      // CR-032 — inline edit a Tag's fullText (Unplaced rail).
      editTag: (tagId, newText) =>
        set((s) => {
          const idx = s.tags.findIndex((t) => t.tagId === tagId);
          if (idx < 0) return {} as Partial<AIImportState>;
          const existing = s.tags[idx];
          const updated: Tag = {
            ...existing,
            fullText: newText,
            originalSnippet:
              existing.originalSnippet !== undefined
                ? existing.originalSnippet
                : existing.fullText,
            editedAt: Date.now(),
          };
          const newTags = [...s.tags];
          newTags[idx] = updated;
          return { tags: newTags, dirty: true };
        }),

      // CR-039 follow-on (UX feedback 2026-05-30) — inline edit an
      // Introduction-bucket item. Walks every intro bucket since the
      // caller only has the sectionId; first match wins. Mirrors
      // editBucketItem's originalSnippet/editedAt bookkeeping so the
      // existing "edited" badge + Revert button light up the same way.
      editIntroductionItem: (sectionId, newSnippet) =>
        set((s) => {
          const intros = s.introductions;
          for (const [key, bucket] of Object.entries(intros)) {
            const idx = bucket.items.findIndex((i) => i.sectionId === sectionId);
            if (idx < 0) continue;
            const existing = bucket.items[idx];
            const updated: BucketItem = {
              ...existing,
              snippet: newSnippet,
              wordCount: newSnippet.trim() ? newSnippet.trim().split(/\s+/).length : 0,
              originalSnippet:
                existing.originalSnippet !== undefined
                  ? existing.originalSnippet
                  : existing.snippet,
              editedAt: Date.now(),
            };
            const newItems = [...bucket.items];
            newItems[idx] = updated;
            return {
              introductions: {
                ...intros,
                [key]: { ...bucket, items: newItems },
              },
              dirty: true,
            };
          }
          return {} as Partial<AIImportState>;
        }),

      revertIntroductionItem: (sectionId) =>
        set((s) => {
          const intros = s.introductions;
          for (const [key, bucket] of Object.entries(intros)) {
            const idx = bucket.items.findIndex((i) => i.sectionId === sectionId);
            if (idx < 0) continue;
            const existing = bucket.items[idx];
            if (existing.originalSnippet === undefined) {
              return {} as Partial<AIImportState>;
            }
            const restored: BucketItem = {
              ...existing,
              snippet: existing.originalSnippet,
              wordCount: existing.originalSnippet.trim()
                ? existing.originalSnippet.trim().split(/\s+/).length
                : 0,
              originalSnippet: undefined,
              editedAt: undefined,
            };
            const newItems = [...bucket.items];
            newItems[idx] = restored;
            return {
              introductions: {
                ...intros,
                [key]: { ...bucket, items: newItems },
              },
              dirty: true,
            };
          }
          return {} as Partial<AIImportState>;
        }),

      // CR-032 — restore originalSnippet on a bucket item. Clears editedAt
      // + originalSnippet so the card stops showing the "edited" badge.
      revertBucketItem: (specKey, sectionId, kind) =>
        set((s) => {
          const bucket = s.buckets[specKey];
          if (!bucket) return {} as Partial<AIImportState>;
          const list = bucket[kind] as BucketItem[];
          const idx = list.findIndex((i) => i.sectionId === sectionId);
          if (idx < 0) return {} as Partial<AIImportState>;
          const existing = list[idx];
          if (existing.originalSnippet === undefined) {
            return {} as Partial<AIImportState>; // never edited; no-op
          }
          const restored: BucketItem = {
            ...existing,
            snippet: existing.originalSnippet,
            wordCount: existing.originalSnippet.trim()
              ? existing.originalSnippet.trim().split(/\s+/).length
              : 0,
            originalSnippet: undefined,
            editedAt: undefined,
          };
          const newList = [...list];
          newList[idx] = restored;
          return {
            buckets: {
              ...s.buckets,
              [specKey]: { ...bucket, [kind]: newList },
            },
            dirty: true,
          };
        }),

      revertTag: (tagId) =>
        set((s) => {
          const idx = s.tags.findIndex((t) => t.tagId === tagId);
          if (idx < 0) return {} as Partial<AIImportState>;
          const existing = s.tags[idx];
          if (existing.originalSnippet === undefined) {
            return {} as Partial<AIImportState>;
          }
          const restored: Tag = {
            ...existing,
            fullText: existing.originalSnippet,
            originalSnippet: undefined,
            editedAt: undefined,
          };
          const newTags = [...s.tags];
          newTags[idx] = restored;
          return { tags: newTags, dirty: true };
        }),

      setMergeMode: (m) => set({ mergeMode: m }),

      // CR-041 US-5 — Hold-for-review flag.
      setHoldForReview: (v) => set({ holdForReview: v }),
      // CR-041 US-6 — Source-file filter.
      setReviewSourceFilter: (importId) => set({ reviewSourceFilter: importId }),
      // CR-043 — hydrate from the submission-scoped persisted Review
      // state. The store's buckets/tags/cvs/evidenceDocs/introductions
      // fields become read-through caches of aiReviewState.
      loadPersistedReviewState: async () => {
        const { submissionId } = get();
        if (!submissionId) return;
        try {
          // Snapshot the buckets reference BEFORE the await. The Review cards
          // render instantly from the localStorage Zustand seed, so the PC can
          // flip a kind / move an item WHILE this GET is in flight. zustand
          // replaces the `buckets` object on every such edit, so an identity
          // change here means "the user edited during this fetch" — in which
          // case the in-memory buckets are NEWER than the server response and
          // must NOT be clobbered (otherwise the debounced autosave then
          // re-saves the reverted copy and the edit vanishes on reload).
          //
          // This is intentionally scoped to `buckets` and to THIS fetch window
          // (object identity, fresh every mount) rather than the persisted
          // `dirty` flag — a blanket dirty-guard wrongly kept stale local state
          // on seeded reloads and broke the approve/assign/move specs.
          const bucketsBefore = get().buckets;
          const res = await api.get(`/api/submissions/${submissionId}/review`);
          const state = res.data?.aiReviewState;
          const matrixState = res.data?.aiMatrixState;
          const bucketsEditedDuringFetch = get().buckets !== bucketsBefore;
          if (state) {
            // CR-043 follow-on — conservative merge: if the server omits a
            // field, keep the in-memory value rather than clobbering with `{}`
            // (matters when hydrated from a localStorage seed before the
            // server-side merge has run).
            const current = get();
            set({
              buckets: bucketsEditedDuringFetch
                ? current.buckets
                : (state.buckets ?? current.buckets),
              tags: state.tags ?? current.tags,
              cvs: state.cvs ?? current.cvs,
              evidenceDocs: state.evidenceDocs ?? current.evidenceDocs,
              introductions: state.introductions ?? current.introductions,
              placeholderSections: state.placeholderSections || [],
              coverageReport: state.coverageReport ?? get().coverageReport,
              approvedIds: state.approvedIds || [],
              discardedIds: state.discardedIds || []
            });
          }
          if (matrixState) {
            const current = get();
            set({
              matrices: matrixState.matrices ?? current.matrices,
              matrixRowEdits: matrixState.matrixRowEdits ?? current.matrixRowEdits
            });
          }

          // Recovery (2026-06-05): some submissions have rich review content in
          // the browser (localStorage Zustand seed from the import) but the
          // SERVER's aiReviewState.buckets is empty — the narratives were never
          // persisted server-side, so the PC dashboard / workflow-summary and
          // any other server-reading surface under-count (e.g. "0 spec items"
          // while the rail shows hundreds). If the server returned no buckets
          // but the client has them, flag the store dirty so the ReviewSurface
          // autosave pushes the full state back to the server (idempotent;
          // server body limit is 50mb so the narratives fit).
          const serverBucketCount =
            state && state.buckets && typeof state.buckets === 'object'
              ? Object.keys(state.buckets).length
              : 0;
          const clientBucketCount = Object.keys(get().buckets || {}).length;
          if (serverBucketCount === 0 && clientBucketCount > 0) {
            set({ dirty: true });
          }
        } catch (err) {
          // Non-fatal — Review surface renders an empty state instead.
          console.warn('[CR-043] loadPersistedReviewState failed:', err);
        }
      },

      approveItemOnServer: async (sectionId, approved) => {
        const { submissionId } = get();
        if (!submissionId) return;
        try {
          const res = await api.post(`/api/submissions/${submissionId}/review/approve`, {
            sectionId,
            approved
          });
          set({
            approvedIds: res.data?.approvedIds ?? get().approvedIds,
            // Approving overrides a prior discard (server does the same).
            discardedIds:
              approved !== false
                ? get().discardedIds.filter((id) => id !== sectionId)
                : get().discardedIds
          });
        } catch (err) {
          console.warn('[CR-043] approveItemOnServer failed:', err);
        }
      },

      discardItemOnServer: async (sectionId, discarded) => {
        const { submissionId } = get();
        if (!submissionId) return;
        try {
          const res = await api.post(`/api/submissions/${submissionId}/review/discard`, {
            sectionId,
            discarded
          });
          // CR-048 — mirror the server's discardedIds so the unresolved
          // DRAFTS count updates immediately. Discarding overrides approve.
          set({
            discardedIds: res.data?.discardedIds ?? get().discardedIds,
            approvedIds:
              discarded !== false
                ? get().approvedIds.filter((id) => id !== sectionId)
                : get().approvedIds
          });
        } catch (err) {
          console.warn('[CR-043] discardItemOnServer failed:', err);
        }
      },

      clearItemOnServer: async (sectionId) => {
        const { submissionId } = get();
        if (!submissionId) return;
        try {
          await api.post(`/api/submissions/${submissionId}/review/clear-item`, {
            sectionId
          });
          // After clear, re-pull the state so the store mirrors the
          // server's authoritative shape.
          await get().loadPersistedReviewState();
        } catch (err) {
          console.warn('[CR-043] clearItemOnServer failed:', err);
        }
      },

      finishReviewOnServer: async () => {
        const { submissionId } = get();
        if (!submissionId) return 0;
        try {
          const res = await api.post(`/api/submissions/${submissionId}/review/finish`);
          // Mirror the server's discardedIds so the unresolved DRAFTS count
          // drops to zero immediately (the badge + open-on-Review read it).
          set({ discardedIds: res.data?.discardedIds ?? get().discardedIds });
          return Number(res.data?.newlyDiscarded ?? 0);
        } catch (err) {
          console.warn('[CR-048] finishReviewOnServer failed:', err);
          return 0;
        }
      },

      // CR-040 Phase 3b — fragment resolution.
      resolveMissingFragment: (sectionId) =>
        set((s) => ({
          resolvedMissingFragmentIds: s.resolvedMissingFragmentIds.includes(sectionId)
            ? s.resolvedMissingFragmentIds
            : [...s.resolvedMissingFragmentIds, sectionId],
          dirty: true
        })),
      clearResolvedMissingFragments: () => set({ resolvedMissingFragmentIds: [] }),

      // CR-041 US-2/US-3 — multi-file batch upload. Coordinator dropped
      // N files; we (1) create a batch, (2) upload each as a child via
      // /api/imports/batch/:id/file, (3) call /start to kick off the
      // serial advancer. Errors at any step land in the wizard's error
      // surface; partial successes keep the batch alive.
      startBatchUpload: async (files) => {
        const { submissionId, holdForReview } = get();
        if (!submissionId) {
          throw new Error('submissionId is required to start a batch');
        }
        if (!files || files.length === 0) return;

        // CR-043 — keep persisted Review state; only reset ephemeral
        // wizard fields. See startUpload comment.
        set({
          status: 'uploading',
          uploadProgress: 0,
          errors: [],
          dirty: false,
          batchId: null,
          batchSnapshot: null
        });

        let batchId: string;
        try {
          const res = await api.post('/api/imports/batch', {
            submissionId,
            holdForReview
          });
          batchId = res.data.batchId;
          set({ batchId, importId: null });
        } catch (err: any) {
          const detail =
            err?.response?.data?.error || err?.message || String(err);
          set({ status: 'failed', errors: [`Batch create failed: ${detail}`] });
          throw new Error(`Batch create failed: ${detail}`);
        }

        // Upload each file as a child. Sequential to keep server pressure
        // bounded; files are typically a handful of docx blobs.
        const childImportIds: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const form = new FormData();
          form.append('file', f);
          try {
            const res = await api.post(
              `/api/imports/batch/${batchId}/file`,
              form,
              {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (event) => {
                  if (event.total) {
                    // Aggregate progress: (completed files + current
                    // file's fraction) / total files.
                    const fraction = event.loaded / event.total;
                    set({ uploadProgress: (i + fraction) / files.length });
                  }
                }
              }
            );
            childImportIds.push(res.data.importId);
          } catch (err: any) {
            const detail =
              err?.response?.data?.error || err?.message || String(err);
            // Surface the per-file failure; continue with the rest so
            // the batch isn't all-or-nothing on upload.
            set((s) => ({
              errors: [
                ...s.errors,
                `Upload failed for ${f.name}: ${detail}`
              ]
            }));
          }
        }
        set({ uploadProgress: 1 });

        if (childImportIds.length === 0) {
          set({
            status: 'failed',
            errors: [...get().errors, 'No files in the batch uploaded successfully.']
          });
          return;
        }

        // Kick off the advancer.
        try {
          await api.post(`/api/imports/batch/${batchId}/start`);
        } catch (err: any) {
          const detail =
            err?.response?.data?.error || err?.message || String(err);
          set({
            status: 'failed',
            step: 'parse',
            errors: [...get().errors, `Batch start failed: ${detail}`]
          });
          throw new Error(`Batch start failed: ${detail}`);
        }

        set({
          status: 'queued',
          step: 'parse',
          // For convenience the wizard's existing single-file SSE
          // connection points at the FIRST child so the user gets at
          // least one live stream; the per-child Parse rows come from
          // the polling pollBatch loop.
          importId: childImportIds[0]
        });
        get().pollBatch();
      },

      // CR-041 US-4 — pull the parent batch snapshot for Parse rendering.
      pollBatch: async () => {
        const { batchId } = get();
        if (!batchId) return;
        try {
          const res = await api.get(`/api/imports/batch/${batchId}`);
          set({ batchSnapshot: res.data as ChildSnapshotBatch });
        } catch (err) {
          // Non-fatal — Parse step will keep showing the last-known
          // snapshot; next poll tick retries.
        }
      },

      // CR-041 US-6 — fetch each child's snapshot + merge into parent
      // state. The merged view mirrors the single-file shape so all
      // existing Review components keep working without modification.
      // Each item carries sourceImportId + sourceFilename for chip
      // rendering.
      loadBatchChildren: async () => {
        const { batchId } = get();
        if (!batchId) return;
        // CR-041 US-6 — ensure we have the batch snapshot first; the
        // Review step may mount before BatchProgress's polling tick.
        let { batchSnapshot } = get();
        if (!batchSnapshot) {
          await get().pollBatch();
          batchSnapshot = get().batchSnapshot;
        }
        if (!batchSnapshot) return;
        const childrenSnapshots: Array<{
          importId: string;
          filename: string;
          snap: AIStatusSnapshot;
        }> = [];
        for (const c of batchSnapshot.children) {
          // Only merge children that have finished parsing — partial
          // results would show empty buckets and confuse the count.
          if (c.status !== 'parsed') continue;
          try {
            const res = await api.get(`/api/imports/${c.importId}/ai-status`);
            childrenSnapshots.push({
              importId: c.importId,
              filename: c.originalFilename,
              snap: res.data as AIStatusSnapshot
            });
          } catch (err) {
            // Per-child fetch failure is non-fatal; skip and continue.
          }
        }
        if (childrenSnapshots.length === 0) return;

        // CR-041 smart merge: start from CURRENT store state, then ADD
        // items from each child whose sectionId isn't already present.
        // Pre-existing items (coordinator-edited, discarded, retagged,
        // etc.) are preserved. Late-completing children's content lands
        // additively. This replaces the prior `dirty` binary guard
        // which either blocked all merges or overwrote all edits.
        const current = get();
        const mergedBuckets: Record<string, SpecBucket> = {};
        // Deep-copy the existing buckets so the merge mutations don't
        // alias the previous render's data structures.
        for (const [bk, b] of Object.entries(current.buckets)) {
          mergedBuckets[bk] = {
            ...b,
            narratives: [...b.narratives],
            evidenceText: [...b.evidenceText],
            evidenceFiles: [...b.evidenceFiles]
          };
        }
        const mergedTags: Tag[] = [...current.tags];
        // Matrices come from the AI service whole; we union by matrixId
        // (the matrix structure is per-document; merging cells across
        // documents is the per-cell concat already in matrices' shape).
        const mergedMatrices: MatrixData[] = [...current.matrices];
        const mergedCvs: CVItem[] = [...current.cvs];
        const mergedEvidenceDocs: EvidenceDocItem[] = [...current.evidenceDocs];
        const mergedIntroductions: Record<string, IntroductionBucket> = {};
        for (const [key, ib] of Object.entries(current.introductions)) {
          mergedIntroductions[key] = { ...ib, items: [...ib.items] };
        }

        // Build sectionId sets so we can dedupe by id across re-merges.
        const seenBucketIds = new Set<string>();
        for (const b of Object.values(mergedBuckets)) {
          for (const it of b.narratives) seenBucketIds.add(it.sectionId);
          for (const it of b.evidenceText) seenBucketIds.add(it.sectionId);
          for (const it of b.evidenceFiles) seenBucketIds.add(it.sectionId);
        }
        const seenTagIds = new Set(mergedTags.map((t) => t.tagId));
        const seenCvIds = new Set(mergedCvs.map((c) => c.sectionId));
        const seenEvidenceDocIds = new Set(mergedEvidenceDocs.map((e) => e.sectionId));
        const seenIntroIds = new Set<string>();
        for (const ib of Object.values(mergedIntroductions)) {
          for (const it of ib.items) seenIntroIds.add(it.sectionId);
        }
        const seenMatrixIds = new Set(mergedMatrices.map((m) => m.matrixId));

        const stamp = <T extends { sourceImportId?: string; sourceFilename?: string }>(
          item: T,
          importId: string,
          filename: string
        ): T => ({
          ...item,
          sourceImportId: importId,
          sourceFilename: filename
        });

        for (const { importId, filename, snap } of childrenSnapshots) {
          if (snap.buckets) {
            for (const [bk, b] of Object.entries(snap.buckets)) {
              const existing = mergedBuckets[bk] || {
                ...b,
                narratives: [],
                evidenceText: [],
                evidenceFiles: []
              };
              const additions = {
                narratives: b.narratives
                  .filter((it) => !seenBucketIds.has(it.sectionId))
                  .map((it) => stamp(it, importId, filename)),
                evidenceText: b.evidenceText
                  .filter((it) => !seenBucketIds.has(it.sectionId))
                  .map((it) => stamp(it, importId, filename)),
                evidenceFiles: b.evidenceFiles
                  .filter((it) => !seenBucketIds.has(it.sectionId))
                  .map((it) => stamp(it, importId, filename))
              };
              for (const it of additions.narratives) seenBucketIds.add(it.sectionId);
              for (const it of additions.evidenceText) seenBucketIds.add(it.sectionId);
              for (const it of additions.evidenceFiles) seenBucketIds.add(it.sectionId);
              mergedBuckets[bk] = {
                ...existing,
                // Preserve coverage signals from the most recent merge —
                // last writer wins for the metadata fields.
                standardTitle: b.standardTitle || existing.standardTitle,
                specPrompt: b.specPrompt || existing.specPrompt,
                coverageScore: b.coverageScore ?? existing.coverageScore,
                coverageCovered: b.coverageCovered ?? existing.coverageCovered,
                coverageGaps: b.coverageGaps?.length ? b.coverageGaps : existing.coverageGaps,
                coverageStrengths: b.coverageStrengths?.length
                  ? b.coverageStrengths
                  : existing.coverageStrengths,
                narratives: [...existing.narratives, ...additions.narratives],
                evidenceText: [...existing.evidenceText, ...additions.evidenceText],
                evidenceFiles: [...existing.evidenceFiles, ...additions.evidenceFiles]
              };
            }
          }
          if (Array.isArray(snap.tags)) {
            for (const t of snap.tags) {
              if (seenTagIds.has(t.tagId)) continue;
              mergedTags.push(stamp(t, importId, filename));
              seenTagIds.add(t.tagId);
            }
          }
          if (Array.isArray(snap.matrices)) {
            for (const m of snap.matrices) {
              if (seenMatrixIds.has(m.matrixId)) continue;
              mergedMatrices.push(m);
              seenMatrixIds.add(m.matrixId);
            }
          }
          if (Array.isArray(snap.cvs)) {
            for (const c of snap.cvs) {
              if (seenCvIds.has(c.sectionId)) continue;
              mergedCvs.push(stamp(c, importId, filename));
              seenCvIds.add(c.sectionId);
            }
          }
          if (Array.isArray(snap.evidenceDocs)) {
            for (const e of snap.evidenceDocs) {
              if (seenEvidenceDocIds.has(e.sectionId)) continue;
              mergedEvidenceDocs.push(stamp(e, importId, filename));
              seenEvidenceDocIds.add(e.sectionId);
            }
          }
          if (snap.introductionHints && Object.keys(snap.introductionHints).length > 0) {
            for (const [sectionId, hint] of Object.entries(snap.introductionHints)) {
              if (seenIntroIds.has(sectionId)) continue;
              const targetKey = hint.startsWith('introduction:')
                ? hint.slice('introduction:'.length)
                : null;
              if (!targetKey || !mergedIntroductions[targetKey]) continue;
              if (snap.buckets) {
                for (const b of Object.values(snap.buckets)) {
                  const found = b.narratives.find((n) => n.sectionId === sectionId);
                  if (found) {
                    mergedIntroductions[targetKey].items.push(
                      stamp(found, importId, filename)
                    );
                    seenIntroIds.add(sectionId);
                    break;
                  }
                }
              }
            }
          }
        }

        set({
          buckets: mergedBuckets,
          tags: mergedTags,
          matrices: mergedMatrices,
          cvs: mergedCvs,
          evidenceDocs: mergedEvidenceDocs,
          introductions: mergedIntroductions
        });
      },


      _applySnapshot: (snap) => {
        const current = get();
        // BUG FIX 2026-05-21: keep local edits across hard-refresh and
        // across mid-session SSE redeliveries. When the coordinator has
        // already made at least one local mutation (Reassign / kind-flip
        // / matrix row Keep-or-Remove), `dirty` is true and any
        // subsequent snapshot from cshse-ai (which carries the AI's
        // original placement) must NOT overwrite the user's work.
        //
        // The server-side Submission is only written on Apply, so all
        // pre-Apply edits live client-side. localStorage carries them
        // through a hard refresh via the partialize block above.
        const keepLocalBuckets = current.dirty === true;

        // CR-033/039/040 Phase 2c — seed Introduction buckets from
        // aiIntroductionHints (when present and not edited locally). Each
        // hint maps a section_id → 'introduction:document' |
        // 'introduction:standard-N'. We resolve each hint against the
        // matcher's buckets to find the BucketItem matching the section
        // and lift it into the corresponding IntroductionBucket. Skipped
        // entirely when the local coordinator has already mutated the
        // store (dirty=true), to preserve their hand-routing decisions.
        let nextIntroductions = current.introductions;
        if (!keepLocalBuckets && snap.introductionHints && Object.keys(snap.introductionHints).length > 0) {
          const seededIntros: Record<string, IntroductionBucket> = {};
          for (const [key, ib] of Object.entries(current.introductions)) {
            // Start with empty-item copies so re-applies don't accumulate.
            seededIntros[key] = { ...ib, items: [] };
          }
          const newBucketsForIntro: Record<string, SpecBucket> = {};
          const incomingBuckets = (snap.buckets ?? current.buckets) || {};
          for (const [bk, b] of Object.entries(incomingBuckets)) {
            newBucketsForIntro[bk] = { ...b, narratives: [...b.narratives] };
          }
          for (const [sectionId, hint] of Object.entries(snap.introductionHints)) {
            const targetKey = hint.startsWith('introduction:')
              ? hint.slice('introduction:'.length)
              : null;
            if (!targetKey || !seededIntros[targetKey]) continue;
            // Find the BucketItem matching the sectionId across all incoming
            // buckets. If we find it, move it out (so it doesn't double-show)
            // and append into the Introduction bucket.
            let found: BucketItem | null = null;
            for (const [bk, b] of Object.entries(newBucketsForIntro)) {
              const idx = b.narratives.findIndex((n) => n.sectionId === sectionId);
              if (idx >= 0) {
                found = b.narratives[idx];
                newBucketsForIntro[bk] = {
                  ...b,
                  narratives: [
                    ...b.narratives.slice(0, idx),
                    ...b.narratives.slice(idx + 1)
                  ]
                };
                break;
              }
            }
            if (found) {
              seededIntros[targetKey].items.push(found);
            }
          }
          nextIntroductions = seededIntros;
          // Reuse the seeded buckets below
          (snap as AIStatusSnapshot).buckets = newBucketsForIntro;
        }

        set({
          status: snap.status,
          queuePosition: snap.queuePosition ?? null,
          queueDepth: snap.queueDepth ?? null,
          etaSeconds: snap.etaSeconds ?? null,
          format: snap.format ?? current.format,
          pipelineStages: snap.stages ?? current.pipelineStages,
          buckets: keepLocalBuckets ? current.buckets : (snap.buckets ?? current.buckets),
          tags: keepLocalBuckets ? current.tags : (snap.tags ?? current.tags),
          matrices: keepLocalBuckets ? current.matrices : (snap.matrices ?? current.matrices),
          placeholderSections: keepLocalBuckets
            ? current.placeholderSections
            : (snap.placeholderSections ?? current.placeholderSections),
          errors: snap.errors ?? current.errors,
          step: deriveStepFromStatus(snap.status, current.step),
          // CR-033 / CR-040 / CR-039 Phase 2c — detector outputs.
          cvs: keepLocalBuckets ? current.cvs : (snap.cvs ?? current.cvs),
          evidenceDocs: keepLocalBuckets
            ? current.evidenceDocs
            : (snap.evidenceDocs ?? current.evidenceDocs),
          introductions: nextIntroductions,
          // CR-033 Phase 2c part 2 — standalone-CV mode is a server-side
          // determination; mirror it onto the client so ReviewStep can
          // route to the single-card flow. Sticky across snapshots so a
          // subsequent /ai-status poll doesn't drop the flag.
          standaloneCv:
            typeof snap.standaloneCv === 'boolean'
              ? snap.standaloneCv
              : current.standaloneCv,
          // CR-040 Phase 3b — coverage report. Server-side determination,
          // mirror onto client for UI surfaces.
          coverageReport:
            snap.coverageReport !== undefined
              ? (snap.coverageReport as AICoverageReport | null)
              : current.coverageReport
        });
      },

      startUpload: async () => {
        const { uploadFile, programLevel, submissionId, isReimport, forceFormat } = get();
        if (!uploadFile || !submissionId) {
          throw new Error('uploadFile and submissionId are required to start an import');
        }

        // CR-043 — DO NOT clear buckets / tags / matrices / cvs /
        // evidenceDocs / introductions / approvedIds on startUpload.
        // The server-side aiReviewState is the source of truth and
        // merges this import's output into the persisted state. The
        // pre-CR-043 reset destroyed coordinator work between imports;
        // we keep the only state that's still wizard-local (status,
        // progress, errors). dirty=false because we're about to merge
        // the next snapshot.
        set({
          status: 'uploading',
          uploadProgress: 0,
          errors: [],
          dirty: false
        });

        const form = new FormData();
        form.append('file', uploadFile);
        form.append('submissionId', submissionId);

        let importId: string;
        try {
          const uploadRes = await api.post('/api/imports/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (event) => {
              if (event.total) {
                set({ uploadProgress: event.loaded / event.total });
              }
            }
          });
          importId = uploadRes.data.importId;
          set({ importId, uploadProgress: 1 });
        } catch (err: any) {
          const detail = err?.response?.data?.error || err?.response?.data?.detail || err?.message || String(err);
          set({ status: 'failed', errors: [`Upload failed: ${detail}`] });
          throw new Error(`Upload failed: ${detail}`);
        }

        try {
          const startRes = await api.post(`/api/imports/${importId}/start-ai`, {
            programLevel,
            forceFormat,
            isReimport
          });
          const { jobId, status, queuePosition, queueDepth, etaSeconds } = startRes.data;
          set({
            jobId,
            status,
            queuePosition: queuePosition ?? null,
            queueDepth: queueDepth ?? null,
            etaSeconds: etaSeconds ?? null,
            step: 'parse'
          });

          // Open the SSE stream so the user sees live progress.
          get().openEventStream();
        } catch (err: any) {
          // Server returned non-2xx (e.g. 502 'AI service unreachable',
          // 409 race, 500 internal). Land on the Parse step in a 'failed'
          // state so ParseStep renders the error surface instead of an
          // optimistic "Starting AI service…" forever.
          const detail = err?.response?.data?.error || err?.response?.data?.detail || err?.message || String(err);
          set({
            status: 'failed',
            step: 'parse',
            errors: [`Could not start AI service: ${detail}`]
          });
          throw new Error(`Could not start AI service: ${detail}`);
        }
      },

      openEventStream: () => {
        const { importId } = get();
        if (!importId) return;
        _clearTransport();

        const baseUrl = (import.meta as any).env?.VITE_API_URL || '';
        const url = `${baseUrl}/api/imports/${importId}/ai-events`;

        // Note: EventSource doesn't support custom headers; auth flows
        // through cookies. The server can also be configured to accept
        // a `?token=` query-string fallback if cookie auth isn't set up.
        try {
          const source = new EventSource(url, { withCredentials: true });
          _eventSource = source;
          set({ eventsTransport: 'sse', eventsReconnectAttempt: 0 });

          source.addEventListener('status', (ev: MessageEvent) => {
            try {
              const snap = JSON.parse(ev.data);
              get()._applySnapshot(snap);
              // Close the stream on terminal states.
              if (['parsed', 'failed', 'canceled', 'applied', 'finished'].includes(snap.status)) {
                _clearTransport();
              }
            } catch (err) {
              console.warn('[ai-import] failed to parse SSE event:', err);
            }
          });

          source.addEventListener('ping', () => {
            // Keepalive; reset reconnect counter on receipt.
            set({ eventsReconnectAttempt: 0 });
          });

          source.addEventListener('auth-expired', () => {
            // Server signalled token expiry — close + let the user re-auth.
            _clearTransport();
            set({ errors: ['Authentication expired — please refresh.'] });
          });

          source.onerror = () => {
            const attempt = get().eventsReconnectAttempt + 1;
            set({ eventsReconnectAttempt: attempt });
            source.close();
            _eventSource = null;
            if (attempt >= 3) {
              // Three consecutive failures → fall back to polling.
              set({ eventsTransport: 'polling' });
              _pollHandle = setInterval(() => {
                void get().pollAIStatus();
              }, 2000);
            } else {
              const delay = Math.min(30_000, 1000 * 2 ** (attempt - 1));
              _reconnectTimer = setTimeout(() => get().openEventStream(), delay);
            }
          };
        } catch (err) {
          // Browser doesn't support EventSource or the URL is invalid →
          // fall back to polling.
          console.warn('[ai-import] SSE unsupported, falling back to polling:', err);
          set({ eventsTransport: 'polling' });
          _pollHandle = setInterval(() => {
            void get().pollAIStatus();
          }, 2000);
        }
      },

      closeEventStream: () => {
        _clearTransport();
      },

      pollAIStatus: async () => {
        const { importId } = get();
        if (!importId) return;
        try {
          const res = await api.get(`/api/imports/${importId}/ai-status`);
          get()._applySnapshot(res.data);
          // Stop polling once terminal.
          if (['parsed', 'failed', 'canceled', 'applied', 'finished'].includes(res.data.status)) {
            _clearTransport();
          }
        } catch (err: any) {
          set({ errors: [...get().errors, `poll failed: ${err?.message || String(err)}`] });
        }
      },

      cancelImport: async () => {
        const { importId } = get();
        if (!importId) return;
        _clearTransport();
        try {
          await api.post(`/api/imports/${importId}/cancel`);
          set({ status: 'canceled' });
        } catch (err: any) {
          set({ errors: [...get().errors, `cancel failed: ${err?.message || String(err)}`] });
        }
      },

      apply: async () => {
        const { importId, batchId, buckets, tags, placeholderSections, matrices, mergeMode, perSpecResolution, matrixRowEdits } = get();
        // CR-041 US-8 — batch mode short-circuits to the batch Apply
        // endpoint which iterates per-child apply server-side.
        //
        // CR-041 Phase 2 follow-on (edit-routing for batch mode):
        // Client-side edits in the merged Review are stamped with
        // `editedAt` + carry the `sourceImportId` of the file they came
        // from. Group those edits by sourceImportId so the server can
        // route them back to each child's aiBuckets BEFORE the per-
        // child applyAIImportCore runs. Without this, edits made on
        // the merged view get silently dropped at Apply time.
        if (batchId) {
          set({ status: 'applying', applyError: null });
          // Build editsByChild: { importId: { sectionId: { snippet, kind } } }.
          // Only items with editedAt set are propagated.
          const editsByChild: Record<string, Record<string, {
            snippet: string;
            kind: 'narrative' | 'evidenceText' | 'tag';
          }>> = {};
          for (const bucket of Object.values(buckets)) {
            for (const it of bucket.narratives) {
              if (it.editedAt && (it as any).sourceImportId) {
                const sid = (it as any).sourceImportId;
                editsByChild[sid] ||= {};
                editsByChild[sid][it.sectionId] = { snippet: it.snippet, kind: 'narrative' };
              }
            }
            for (const it of bucket.evidenceText) {
              if (it.editedAt && (it as any).sourceImportId) {
                const sid = (it as any).sourceImportId;
                editsByChild[sid] ||= {};
                editsByChild[sid][it.sectionId] = { snippet: it.snippet, kind: 'evidenceText' };
              }
            }
          }
          for (const t of tags) {
            if (t.editedAt && (t as any).sourceImportId) {
              const sid = (t as any).sourceImportId;
              editsByChild[sid] ||= {};
              editsByChild[sid][t.sectionId] = { snippet: t.fullText, kind: 'tag' };
            }
          }
          try {
            const res = await api.post(`/api/imports/batch/${batchId}/apply`, {
              editsByChild,
            });
            if (res.data?.ok === false) {
              const failedChildren = (res.data?.results || [])
                .filter((r: any) => !r.ok)
                .map((r: any) => `${r.importId}: ${r.error}`)
                .join('; ');
              set({
                status: 'failed',
                applyError: `Batch apply had failures — ${failedChildren}`
              });
              return;
            }
            set({ status: 'finished', applyError: null });
            return;
          } catch (err: any) {
            const detail =
              err?.response?.data?.error || err?.message || String(err);
            set({ status: 'failed', applyError: `Batch apply failed: ${detail}` });
            return;
          }
        }
        if (!importId) return;
        set({ status: 'applying', applyError: null });

        // CR-026 — apply the coordinator's per-row edits to the matrices
        // payload BEFORE we POST. Removed rows are dropped; retagged rows
        // get their std/spec updated on every cell of the affected row.
        // The rowAnchor stays as-is for traceability; the server's
        // applyAIImport reads std/spec to drive CurriculumMatrix.standards
        // and tagged-spec lookups, so updating those fields is enough.
        const editedMatrices = matrices.map((m) => {
          const cells = (m.cells || []).filter((c: any) => {
            const std = c?.std ?? c?.standardCode ?? '?';
            const spec = c?.spec ?? c?.specCode ?? '?';
            const rk = `${std}.${spec}`;
            // Find the rowAnchor for this cell — same logic as the UI.
            const anchor =
              c?.rowAnchor ||
              `matrix-${m.matrixId}-row-${rk.replace('.', '-')}`;
            const edit = matrixRowEdits[`${m.matrixId}|${anchor}`];
            if (edit?.kind === 'remove') return false;
            if (edit?.kind === 'retag') {
              // Mutate in-place via the map below — keep the cell here.
              c.std = edit.newStd;
              c.spec = edit.newSpec;
              // Some legacy payloads also carry standardCode/specCode
              if (c.standardCode !== undefined) c.standardCode = edit.newStd;
              if (c.specCode !== undefined) c.specCode = edit.newSpec;
            }
            return true;
          });
          return { ...m, cells };
        });

        // Idempotency key — stored in localStorage so a retry after a
        // refresh hits the same key (server dedupes).
        const idempotencyKey = (() => {
          const k = localStorage.getItem(`ai-apply-${importId}`);
          if (k) return k;
          const fresh = `ai-apply-${importId}-${Date.now()}`;
          localStorage.setItem(`ai-apply-${importId}`, fresh);
          return fresh;
        })();

        const narrativesPayload: Record<string, Record<string, { content: string; mode: string }>> = {};
        const evidenceTextPayload: Record<string, Record<string, { text: string; mode: string }>> = {};
        const evidenceFilesPayload: any[] = [];

        // Helper: render a per-item AI analysis card as HTML. Goes inside
        // the narrative content so the Standards-tab editor surfaces what
        // the wizard's matcher decided alongside the imported text.
        const renderAIBlock = (heading: string, conf: number, kind: string, accept: string, rationale: string) => {
          const safe = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const band = conf >= 0.85 ? '#dcfce7' : conf >= 0.5 ? '#fef3c7' : '#f1f5f9';
          const bandText = conf >= 0.85 ? '#166534' : conf >= 0.5 ? '#b45309' : '#475569';
          return [
            `<div class="ai-analysis" data-ai-confidence="${conf.toFixed(2)}" data-ai-accept-state="${safe(accept)}" data-ai-kind="${safe(kind)}" style="background:${band};border-left:3px solid ${bandText};padding:8px 12px;margin:8px 0;border-radius:4px;font-size:13px;color:#1f2937">`,
            `  <div style="font-weight:600;color:${bandText};font-size:11px;text-transform:uppercase;letter-spacing:0.05em">AI analysis · ${kind} · conf ${conf.toFixed(2)} · ${safe(accept)}</div>`,
            heading ? `  <div style="margin-top:4px;font-style:italic">Source: ${safe(heading)}</div>` : '',
            rationale ? `  <div style="margin-top:4px">${safe(rationale)}</div>` : '',
            `</div>`
          ].filter(Boolean).join('\n');
        };

        // Render body as either the preserved `<table>` HTML (when the
        // walker captured one) or the plain-text snippet wrapped in <p>.
        // Table-bearing items would otherwise round-trip as the get_text()
        // flattened blob, losing rows/columns in the editor.
        //
        // CR-015 — when only the plain-text snippet is available
        // (htmlSnippet was lost to a PDF source or simplified DOCX run),
        // auto-linkify bare URLs so the Reader/PC view still surfaces them
        // as clickable anchors. The htmlSnippet path is unchanged — if the
        // walker already preserved <a href>, we keep that as-is.
        // (Linkifier extracted to module-scope linkifyPlainText for shared
        // use + unit-test coverage.)
        const renderBody = (item: { snippet: string; htmlSnippet?: string | null }): string => {
          const h = (item.htmlSnippet || '').trim();
          if (h) return h;
          return `<p>${linkifyPlainText(item.snippet || '').replace(/\n/g, '<br/>')}</p>`;
        };

        for (const [key, bucket] of Object.entries(buckets)) {
          if (bucket.narratives.length > 0) {
            const html = bucket.narratives
              .map((n) =>
                [
                  renderAIBlock(n.heading, n.confidence, 'Narrative', n.acceptState, n.rationale),
                  renderBody(n)
                ].join('\n')
              )
              .join('<hr/>');
            narrativesPayload[bucket.standardCode] = narrativesPayload[bucket.standardCode] || {};
            narrativesPayload[bucket.standardCode][bucket.specCode] = { content: html, mode: mergeMode };
          }
          if (bucket.evidenceText.length > 0) {
            // Same approach for evidence text: render each item's AI block
            // followed by its body (HTML if a table, otherwise the plain
            // snippet), separated by markdown horizontal rules so the editor
            // can present them sequentially.
            const text = bucket.evidenceText
              .map((e) =>
                [
                  renderAIBlock(e.heading, e.confidence, 'Evidence text', e.acceptState, e.rationale),
                  renderBody(e)
                ].join('\n\n')
              )
              .join('\n\n---\n\n');
            evidenceTextPayload[bucket.standardCode] = evidenceTextPayload[bucket.standardCode] || {};
            evidenceTextPayload[bucket.standardCode][bucket.specCode] = { text, mode: mergeMode };
          }
          for (const f of bucket.evidenceFiles) {
            evidenceFilesPayload.push({
              std: bucket.standardCode,
              spec: bucket.specCode,
              sectionId: f.sectionId,
              title: f.heading,
              snippet: f.snippet,
              // Surface the AI metadata so the server can store it on the
              // SupportingEvidence row (linkedDocuments) for traceability.
              aiConfidence: f.confidence,
              aiAcceptState: f.acceptState,
              aiRationale: f.rationale
            });
          }
        }

        // CR-039 — collapse the per-bucket Introduction items into a flat
        // payload keyed by 'document' / 'standard-N'. Server's apply path
        // unpacks this and writes documentIntroduction +
        // standardIntroductions on the Submission.
        const { introductions, evidenceDocs, cvs } = get();
        // CR-015 — share the same linkifier used by the narrative renderBody
        // above so introduction content gets the same anchor treatment.
        const linkify = linkifyPlainText;
        const introductionsPayload: Record<
          string,
          { scope: 'document' | 'standard'; standardCode: string | null; content: string }
        > = {};
        for (const [key, ib] of Object.entries(introductions)) {
          if (!ib.items?.length) continue;
          const content = ib.items
            .map((it) => {
              const h = (it.htmlSnippet || '').trim();
              if (h) return h;
              return `<p>${linkify(it.snippet || '').replace(/\n/g, '<br/>')}</p>`;
            })
            .join('<hr/>');
          introductionsPayload[key] = {
            scope: ib.scope,
            standardCode: ib.standardCode,
            content
          };
        }

        try {
          const res = await api.post(`/api/imports/${importId}/apply-ai`, {
            narratives: narrativesPayload,
            supportingEvidenceText: evidenceTextPayload,
            supportingEvidenceFiles: evidenceFilesPayload,
            // Legacy flat-cell payload retained for back-compat; new server
            // code reads `matrices` (per-matrix object) instead. CR-026:
            // editedMatrices reflects the coordinator's per-row retag/remove.
            matrixCells: editedMatrices.flatMap((m: any) => m.cells || []),
            matrices: editedMatrices,
            importTags: tags,
            placeholderSections,
            globalMergeMode: mergeMode,
            perSpecResolution,
            idempotencyKey,
            // CR-039 / CR-040 / CR-033 Phase 1 — new content kinds.
            // Server is forward-compat: when these payloads land before
            // the server-side handlers are wired (Phase 2 for
            // evidenceDocs/cvs), the extra fields are ignored — no
            // behavior change for anyone NOT producing them.
            introductions: introductionsPayload,
            evidenceDocs,
            cvs
          });
          set({
            status: 'applied',
            appliedCounts: res.data.appliedCounts || null,
            applyError: null,
            // Clear dirty — server now reflects the edits. Future
            // snapshots from cshse-ai can safely overwrite buckets.
            dirty: false
          });
          // Clear the idempotency key once the apply succeeds.
          localStorage.removeItem(`ai-apply-${importId}`);
        } catch (err: any) {
          const detail = err?.response?.data?.error || err?.message || String(err);
          set({ status: 'parsed', applyError: detail });
        }
      },

      loadExisting: async (importId) => {
        const res = await api.get(`/api/imports/${importId}/ai-status`);
        set({ importId });
        get()._applySnapshot(res.data);
        // If still actively running, reopen SSE.
        if (['queued', 'parsing'].includes(res.data.status)) {
          get().openEventStream();
        }
      },

      reset: () => {
        _clearTransport();
        // Drop the cached ShowInSourceModal HTML for this import — a brand
        // new import means the next modal open should re-fetch.
        const oldImportId = get().importId;
        if (oldImportId) {
          import('../features/selfStudy/Editor/AIImport/review/ShowInSourceModal')
            .then((m) => m.invalidateShowInSourceCache(oldImportId))
            .catch(() => undefined);
        }
        set({ ...initialState });
      },

      // Clear the transient state from a finished or failed run, drop any
      // open SSE/polling, and land back on the Upload step. Keeps
      // `submissionId` + `programLevel` + `isReimport` so the coordinator
      // doesn't have to re-pick those after a failed attempt.
      startOver: () => {
        _clearTransport();
        const oldImportId = get().importId;
        if (oldImportId) {
          import('../features/selfStudy/Editor/AIImport/review/ShowInSourceModal')
            .then((m) => m.invalidateShowInSourceCache(oldImportId))
            .catch(() => undefined);
        }
        const keep = {
          submissionId: get().submissionId,
          programLevel: get().programLevel,
          isReimport: get().isReimport,
        };
        set({ ...initialState, ...keep, step: 'upload' });
      }
    }),
    {
      name: 'ai-import-storage',
      // 2026-06-06 — localStorage now holds ONLY the lightweight, resumable
      // wizard identity (which import / submission / step / selection we're on,
      // + batch progress). The heavy review CONTENT — buckets (narratives),
      // tags, cvs, evidenceDocs, introductions, matrices, matrixRowEdits,
      // approvedIds, discardedIds, coverageReport, placeholderSections — is NO
      // LONGER persisted to the browser. It lives on the server
      // (Submission.aiReviewState / aiMatrixState) and is the single source of
      // truth: the import merge writes it, the store-level autosave keeps it in
      // sync on every edit, and loadPersistedReviewState reads it back. This is
      // the user's directive ("nothing in localStorage except the document +
      // comparison items, for speed") and it removes the class of bug where
      // review data lived only in the browser (the dashboard under-count, and
      // a real data-loss risk on cache clear).
      partialize: (s) => ({
        importId: s.importId,
        submissionId: s.submissionId,
        jobId: s.jobId,
        step: s.step,
        status: s.status,
        programLevel: s.programLevel,
        isReimport: s.isReimport,
        selectedSpecKey: s.selectedSpecKey,
        selectedSectionId: s.selectedSectionId,
        standaloneCv: s.standaloneCv,
        // Batch context so the wizard rejoins Parse polling on the right batch.
        batchId: s.batchId,
        batchSnapshot: s.batchSnapshot,
        holdForReview: s.holdForReview
      })
    }
  )
);

// ---------------------------------------------------------------------------
// Store-level autosave (2026-06-06).
//
// Persistence is now decoupled from the UI: whenever a review edit flips the
// store `dirty`, we debounce 1.2s and push the full review state to the server
// (saveReviewStateToServer, which is serialized). This runs no matter which
// surface is mounted — the AI-Import wizard's ReviewStep OR the standalone
// ReviewSurface — so review content is ALWAYS written to the DB and never
// depends on localStorage. (localStorage now keeps only the lightweight,
// resumable wizard identity + the read-and-compare document cache — see the
// trimmed `partialize` above.)
//
// The `reviewSaveState` field drives the "Saving…/Saved" chip; components read
// it instead of owning a local effect, which prevents two surfaces from racing
// duplicate writes.
let _autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let _lastDirty = false;
useAIImportStore.subscribe((state) => {
  const dirty = state.dirty === true;
  // Only react to the false -> true transition (a fresh edit). Saves reset
  // dirty back to false, which must not re-arm the timer.
  if (dirty && !_lastDirty) {
    _lastDirty = true;
    if (!state.submissionId) return; // wizard-only run, nothing to persist
    useAIImportStore.setState({ reviewSaveState: 'saving' });
    if (_autosaveTimer) clearTimeout(_autosaveTimer);
    _autosaveTimer = setTimeout(async () => {
      const ok = await useAIImportStore.getState().saveReviewStateToServer();
      useAIImportStore.setState({ reviewSaveState: ok ? 'saved' : 'idle' });
    }, 1200);
  } else if (!dirty) {
    _lastDirty = false;
  }
});

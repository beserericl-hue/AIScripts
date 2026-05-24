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

export type BucketItem = {
  sectionId: string;
  heading: string;
  snippet: string;
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

export type Tag = {
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

  // Errors surfaced from any stage
  errors: string[];

  // CR-034 — per-card "Reviewed" tracker. Stored as a string[] (Set is not
  // JSON-serializable). Previously local React state in ReviewStep, which
  // meant a hard refresh wiped the coordinator's progress.
  approvedIds: string[];

  // ---------- actions ----------
  setStep: (s: WizardStep) => void;
  setApprovedIds: (ids: string[]) => void;
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
  errors: [],
  approvedIds: [] as string[]
};

function deriveStepFromStatus(status: WizardStatus, currentStep: WizardStep): WizardStep {
  // Terminal failure ALWAYS forces back to the Parse step regardless of where
  // the user (or persisted state) thought they were — ParseStep renders the
  // red error surface for failed/canceled and gives a Start Over action.
  if (status === 'failed' || status === 'canceled') return 'parse';
  // Don't bounce the user back to an earlier step if they've already navigated.
  // The status drives the FURTHEST reached step; the user can navigate back.
  if (currentStep === 'tags') return 'tags';
  if (status === 'applied' || status === 'finished') return 'apply';
  if (status === 'parsed') return currentStep === 'upload' || currentStep === 'parse' ? 'review' : currentStep;
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
      retagMatrixRow: (matrixSlug, rowAnchor, newStd, newSpec) =>
        set((s) => ({
          matrixRowEdits: {
            ...s.matrixRowEdits,
            [`${matrixSlug}|${rowAnchor}`]: { kind: 'retag', newStd, newSpec }
          },
          dirty: true
        })),
      removeMatrixRow: (matrixSlug, rowAnchor) =>
        set((s) => ({
          matrixRowEdits: {
            ...s.matrixRowEdits,
            [`${matrixSlug}|${rowAnchor}`]: { kind: 'remove' }
          },
          dirty: true
        })),
      restoreMatrixRow: (matrixSlug, rowAnchor) =>
        set((s) => {
          const next = { ...s.matrixRowEdits };
          delete next[`${matrixSlug}|${rowAnchor}`];
          return { matrixRowEdits: next, dirty: true };
        }),

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
          step: deriveStepFromStatus(snap.status, current.step)
        });
      },

      startUpload: async () => {
        const { uploadFile, programLevel, submissionId, isReimport, forceFormat } = get();
        if (!uploadFile || !submissionId) {
          throw new Error('uploadFile and submissionId are required to start an import');
        }

        // Clear stale edit state + leftover buckets from a prior import.
        // Otherwise the dirty=true guard on _applySnapshot would block
        // the new run's snapshots from populating buckets.
        set({
          status: 'uploading',
          uploadProgress: 0,
          errors: [],
          dirty: false,
          buckets: {},
          tags: [],
          matrices: [],
          placeholderSections: [],
          matrixRowEdits: {},
          approvedIds: []
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
        const { importId, buckets, tags, placeholderSections, matrices, mergeMode, perSpecResolution, matrixRowEdits } = get();
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
        const linkifyPlainText = (s: string): string =>
          s.replace(
            /\bhttps?:\/\/[^\s<>"')]+/g,
            (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`
          );
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
            idempotencyKey
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
      // Persist resumable identity + step + ALL bucket/tag/matrix state
      // so coordinator edits made before clicking Apply survive a tab
      // reload. Without this, hitting Reassign / kind-flip / Keep-or-
      // Remove and then refreshing reverts every edit to the AI's
      // original placement (bug reported 2026-05-21).
      //
      // The server-side Submission is only written on Apply, so all
      // pre-Apply state has to live client-side. localStorage caps out
      // around 5 MB per origin; a Stevenson run with 274 narratives is
      // ~150-400 KB, well within the budget.
      //
      // On rehydrate + initial /ai-status fetch, _applySnapshot keeps
      // the local buckets when they belong to the same importId — see
      // its implementation for the keep-local-when-edited guard.
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
        buckets: s.buckets,
        tags: s.tags,
        placeholderSections: s.placeholderSections,
        matrices: s.matrices,
        matrixRowEdits: s.matrixRowEdits,
        // MUST persist — without this, hard refresh defaults dirty to
        // false. _applySnapshot then sees dirty=false on the next
        // /ai-status fetch and overwrites buckets with the AI's
        // original placement. That's exactly the regression reported
        // 2026-05-22 (rail badge correct, middle pane empty).
        dirty: s.dirty,
        // CR-034 — per-card review checkmarks survive hard refresh.
        approvedIds: s.approvedIds
      })
    }
  )
);

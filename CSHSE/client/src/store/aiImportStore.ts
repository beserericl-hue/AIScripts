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
  wordCount: number;
  confidence: number;
  acceptState: string;
  rationale: string;
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
  suggestedStd: string | null;
  suggestedSpec: string | null;
  confidence: number;
  sourceHeading: string;
  acceptState: string;
  rationale: string;
};

export type PlaceholderSection = {
  paragraphIndex: number;
  heading: string;
  standardHint: string | null;
  specHint: string | null;
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
  matrices?: any[] | null;
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
  matrices: any[];
  selectedSpecKey: string | null;
  selectedSectionId: string | null;

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

  // Errors surfaced from any stage
  errors: string[];

  // ---------- actions ----------
  setStep: (s: WizardStep) => void;
  setSubmissionId: (id: string) => void;
  setUploadFile: (f: File | null) => void;
  setProgramLevel: (l: ProgramLevel) => void;
  setIsReimport: (v: boolean) => void;
  setForceFormat: (f: 'template' | 'self_study' | null) => void;
  selectSpec: (key: string) => void;
  selectSection: (sectionId: string) => void;
  setMergeMode: (m: 'merge' | 'replace' | 'per_spec') => void;

  startUpload: () => Promise<void>;
  openEventStream: () => void;
  closeEventStream: () => void;
  pollAIStatus: () => Promise<void>;
  cancelImport: () => Promise<void>;
  apply: () => Promise<void>;
  loadExisting: (importId: string) => Promise<void>;
  reset: () => void;

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
  matrices: [],
  selectedSpecKey: null,
  selectedSectionId: null,
  mergeMode: 'merge' as const,
  perSpecResolution: {},
  applyError: null,
  appliedCounts: null,
  errors: []
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

      setStep: (s) => set({ step: s }),
      setSubmissionId: (id) => set({ submissionId: id }),
      setUploadFile: (f) => set({ uploadFile: f, uploadProgress: 0 }),
      setProgramLevel: (l) => set({ programLevel: l }),
      setIsReimport: (v) => set({ isReimport: v }),
      setForceFormat: (f) => set({ forceFormat: f }),
      selectSpec: (key) => set({ selectedSpecKey: key, selectedSectionId: null }),
      selectSection: (id) => set({ selectedSectionId: id }),
      setMergeMode: (m) => set({ mergeMode: m }),

      _applySnapshot: (snap) => {
        const current = get();
        set({
          status: snap.status,
          queuePosition: snap.queuePosition ?? null,
          queueDepth: snap.queueDepth ?? null,
          etaSeconds: snap.etaSeconds ?? null,
          format: snap.format ?? current.format,
          pipelineStages: snap.stages ?? current.pipelineStages,
          buckets: snap.buckets ?? current.buckets,
          tags: snap.tags ?? current.tags,
          matrices: snap.matrices ?? current.matrices,
          placeholderSections: snap.placeholderSections ?? current.placeholderSections,
          errors: snap.errors ?? current.errors,
          step: deriveStepFromStatus(snap.status, current.step)
        });
      },

      startUpload: async () => {
        const { uploadFile, programLevel, submissionId, isReimport, forceFormat } = get();
        if (!uploadFile || !submissionId) {
          throw new Error('uploadFile and submissionId are required to start an import');
        }

        set({ status: 'uploading', uploadProgress: 0, errors: [] });

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
        const { importId, buckets, tags, placeholderSections, matrices, mergeMode, perSpecResolution } = get();
        if (!importId) return;
        set({ status: 'applying', applyError: null });

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

        for (const [key, bucket] of Object.entries(buckets)) {
          if (bucket.narratives.length > 0) {
            const html = bucket.narratives.map((n) => `<p>${n.snippet}</p>`).join('<hr/>');
            narrativesPayload[bucket.standardCode] = narrativesPayload[bucket.standardCode] || {};
            narrativesPayload[bucket.standardCode][bucket.specCode] = { content: html, mode: mergeMode };
          }
          if (bucket.evidenceText.length > 0) {
            const text = bucket.evidenceText.map((e) => e.snippet).join('\n\n---\n\n');
            evidenceTextPayload[bucket.standardCode] = evidenceTextPayload[bucket.standardCode] || {};
            evidenceTextPayload[bucket.standardCode][bucket.specCode] = { text, mode: mergeMode };
          }
          for (const f of bucket.evidenceFiles) {
            evidenceFilesPayload.push({
              std: bucket.standardCode,
              spec: bucket.specCode,
              sectionId: f.sectionId,
              title: f.heading,
              snippet: f.snippet
            });
          }
        }

        try {
          const res = await api.post(`/api/imports/${importId}/apply-ai`, {
            narratives: narrativesPayload,
            supportingEvidenceText: evidenceTextPayload,
            supportingEvidenceFiles: evidenceFilesPayload,
            matrixCells: matrices,
            importTags: tags,
            placeholderSections,
            globalMergeMode: mergeMode,
            perSpecResolution,
            idempotencyKey
          });
          set({
            status: 'applied',
            appliedCounts: res.data.appliedCounts || null,
            applyError: null
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
        set({ ...initialState });
      }
    }),
    {
      name: 'ai-import-storage',
      // Persist only the resumable identity + step so a tab reload lands
      // on the right step. Heavy state (buckets/tags) is rehydrated from
      // /api/imports/:importId on load.
      partialize: (s) => ({
        importId: s.importId,
        submissionId: s.submissionId,
        jobId: s.jobId,
        step: s.step,
        status: s.status,
        programLevel: s.programLevel,
        isReimport: s.isReimport,
        selectedSpecKey: s.selectedSpecKey,
        selectedSectionId: s.selectedSectionId
      })
    }
  )
);

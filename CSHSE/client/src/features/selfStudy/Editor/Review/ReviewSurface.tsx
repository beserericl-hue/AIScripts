/**
 * CR-043 — Review surface, decoupled from the AI Import Wizard.
 *
 * Lives on the Self-Study Editor toolbar (between "Importer Wizard"
 * and "Matrix"). Renders the same UX the wizard's ReviewStep used to
 * render, but its state comes from the submission-scoped persisted
 * `aiReviewState` (via aiImportStore.loadPersistedReviewState) and
 * NOT from the wizard's ephemeral run.
 *
 * CR-040 follow-on — "Re-run detectors" button in the header runs
 * cv_detector + appendix_paper_detector + introduction_detector
 * against the persisted DOCX without a full re-import. Populates the
 * Supporting Evidence tiles for older imports that predate the
 * detector deploys.
 *
 * Mount lifecycle:
 *   1. Set submissionId on the store (so loadPersistedReviewState +
 *      approve/discard/clear calls know which submission to hit).
 *   2. Hydrate: pull /api/submissions/:id/review and populate the
 *      store's buckets / tags / cvs / evidenceDocs / introductions /
 *      approvedIds / coverageReport.
 *   3. Render the existing ReviewStep — its UI works against the same
 *      store keys.
 */
import React, { useEffect, useState } from 'react';
import { ReviewStep } from '../AIImport/steps/ReviewStep';
import { useAIImportStore } from '../../../../store/aiImportStore';
import { api } from '../../../../services/api';

export interface ReviewSurfaceProps {
  submissionId: string;
  onClose: () => void;
  /** Jump to the Supporting File Library view (for the new-files banner). */
  onOpenFileLibrary?: () => void;
}

interface RedetectResult {
  ok: boolean;
  counts?: { cvs?: number; papers?: number; syllabi?: number; introHints?: number };
  message?: string;
  error?: string;
  detail?: string;
}

export function ReviewSurface({ submissionId, onClose, onOpenFileLibrary }: ReviewSurfaceProps): JSX.Element {
  const setSubmissionId = useAIImportStore((s) => s.setSubmissionId);
  const loadPersistedReviewState = useAIImportStore((s) => s.loadPersistedReviewState);
  const importId = useAIImportStore((s) => s.importId);

  // Supporting files land in the File Library, NOT the per-spec review cards, so
  // the reviewer otherwise gets no signal that a coordinator uploaded files.
  // Surface a banner counting new (last 3 days) + unassigned files.
  const [fileSummary, setFileSummary] = useState<{ total: number; recent: number; unassigned: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ evidence?: any[] }>(`/submissions/${submissionId}/evidence`);
        const list: any[] = (res.data as any)?.evidence || (res.data as any) || [];
        const live = list.filter((f) => !f.isDeleted);
        const now = Date.now();
        const recent = live.filter(
          (f) => f.createdAt && now - new Date(f.createdAt).getTime() < 3 * 24 * 60 * 60 * 1000
        ).length;
        const unassigned = live.filter((f) => !f.standardCode).length;
        if (!cancelled) setFileSummary({ total: live.length, recent, unassigned });
      } catch {
        if (!cancelled) setFileSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  // CR-048 — "Finish review" bookkeeping. Compute how many drafts are
  // still un-triaged (neither approved nor discarded) so the button can
  // show the count + disable when there's nothing left.
  const buckets = useAIImportStore((s) => s.buckets);
  const tags = useAIImportStore((s) => s.tags);
  const cvs = useAIImportStore((s) => s.cvs);
  const evidenceDocs = useAIImportStore((s) => s.evidenceDocs);
  const introductions = useAIImportStore((s) => s.introductions);
  const approvedIds = useAIImportStore((s) => s.approvedIds);
  const discardedIds = useAIImportStore((s) => s.discardedIds);
  const finishReviewOnServer = useAIImportStore((s) => s.finishReviewOnServer);
  // Autosave is store-level now (useAIImportStore.subscribe): every review-rail
  // mutation flips `dirty`, the store debounces and pushes the full state to the
  // DB regardless of which surface is mounted, so nothing lives only in the
  // browser. This chip just reflects the shared save status.
  const saveState = useAIImportStore((s) => s.reviewSaveState);

  const unresolvedCount = React.useMemo(() => {
    const approved = new Set(approvedIds || []);
    const discarded = new Set(discardedIds || []);
    const pending = (it: any) =>
      !!it?.sectionId && !approved.has(it.sectionId) && !discarded.has(it.sectionId);
    let n = 0;
    for (const b of Object.values(buckets || {}) as any[]) {
      n += (b?.narratives || []).filter(pending).length;
      n += (b?.evidenceText || []).filter(pending).length;
      n += (b?.evidenceFiles || []).filter(pending).length;
    }
    n += (tags || []).filter(pending).length;
    n += (cvs || []).filter(pending).length;
    n += (evidenceDocs || []).filter(pending).length;
    for (const ib of Object.values(introductions || {}) as any[]) {
      n += (ib?.items || []).filter(pending).length;
    }
    return n;
  }, [buckets, tags, cvs, evidenceDocs, introductions, approvedIds, discardedIds]);

  const [finishing, setFinishing] = useState(false);
  const handleFinishReview = async () => {
    if (unresolvedCount === 0) return;
    const ok = window.confirm(
      `Finish review? The ${unresolvedCount} remaining un-reviewed draft${
        unresolvedCount === 1 ? '' : 's'
      } will be marked "not included" in the self-study. You can re-open any of them later from the Discarded list.`
    );
    if (!ok) return;
    setFinishing(true);
    try {
      await finishReviewOnServer();
      await loadPersistedReviewState();
    } finally {
      setFinishing(false);
    }
  };

  const [redetectState, setRedetectState] = useState<
    | { kind: 'idle' }
    | { kind: 'running' }
    | { kind: 'done'; result: RedetectResult }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const [coverageState, setCoverageState] = useState<
    | { kind: 'idle' }
    | { kind: 'running'; done?: number; total?: number }
    | { kind: 'done'; assessed: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // How many filled specs still have NO coverage assessment (gray dots). Drives
  // the "Check coverage (N)" label so the coordinator knows there's work to do.
  const coverageMissing = React.useMemo(() => {
    let n = 0;
    for (const b of Object.values(buckets || {})) {
      const hasContent = b.narratives.length || b.evidenceText.length || b.evidenceFiles.length;
      const assessed = b.coverageCovered !== null || b.coverageScore !== null;
      if (hasContent && !assessed) n += 1;
    }
    return n;
  }, [buckets]);

  const handleCheckCoverage = async (onlyMissing: boolean = true) => {
    setCoverageState({ kind: 'running' });
    try {
      // Enqueue — a background worker drains the coverage queue in small batches,
      // so a full re-check of every spec never blocks this request past the edge
      // timeout. We then poll progress until it drains.
      const res = await api.post<{ ok: boolean; queued?: number; message?: string; error?: string }>(
        `/api/submissions/${submissionId}/review/recompute-coverage`,
        { onlyMissing }
      );
      if (!res.data?.ok) {
        setCoverageState({ kind: 'error', message: res.data?.error || 'Coverage review failed.' });
        return;
      }
      const queued = res.data.queued ?? 0;
      if (queued === 0) {
        setCoverageState({ kind: 'done', assessed: 0 });
        await loadPersistedReviewState();
        return;
      }
      // Poll until the background queue empties (guarded so it can't spin forever).
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const p = await api.get<{ total: number; remaining: number; done: number; running: boolean }>(
          `/api/submissions/${submissionId}/review/coverage-progress`
        );
        const prog = p.data;
        if (!prog?.running) {
          setCoverageState({ kind: 'done', assessed: prog?.done ?? queued });
          await loadPersistedReviewState();
          return;
        }
        setCoverageState({ kind: 'running', done: prog.done, total: prog.total });
      }
      // Timed out watching (worker still draining server-side) — refresh anyway.
      setCoverageState({ kind: 'done', assessed: queued });
      await loadPersistedReviewState();
    } catch (err: any) {
      const detail = err?.response?.data?.error || err?.message;
      setCoverageState({ kind: 'error', message: detail || 'Coverage review failed.' });
    }
  };

  useEffect(() => {
    setSubmissionId(submissionId);
    loadPersistedReviewState();
  }, [submissionId, setSubmissionId, loadPersistedReviewState]);


  const handleRedetect = async () => {
    if (!importId) {
      setRedetectState({
        kind: 'error',
        message:
          'No import is associated with this review yet. Upload a document via the Importer Wizard first.'
      });
      return;
    }
    setRedetectState({ kind: 'running' });
    try {
      const res = await api.post<RedetectResult>(
        `/api/imports/${importId}/redetect`
      );
      if (res.data && res.data.ok) {
        setRedetectState({ kind: 'done', result: res.data });
        // Refresh the store's read-through cache so the new tile counts
        // show up immediately.
        await loadPersistedReviewState();
      } else {
        setRedetectState({
          kind: 'error',
          message: res.data?.detail || res.data?.error || 'Re-detect failed.'
        });
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error;
      setRedetectState({
        kind: 'error',
        message: detail || err?.message || 'Re-detect failed.'
      });
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-6 py-1.5">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-900">Review</h1>
          <span
            className="text-xs text-gray-400"
            title="Items live on the submission and survive close + re-open. Approve pushes into the editor; discard skips; clear removes from the rail."
          >
            ⓘ
          </span>
          {/* CR-040 follow-on — redetect status banner. Shows the count
              of CVs / papers / syllabi the detector pass surfaced so
              the coordinator can verify the rail update + course-correct
              if a detector misclassified. */}
          {redetectState.kind === 'done' && (
            <p
              data-testid="cr-040-redetect-result"
              className="mt-1 text-xs text-emerald-700"
            >
              ✓ {redetectState.result.message ||
                `Re-detect complete: ${redetectState.result.counts?.cvs ?? 0} CV(s), ${
                  redetectState.result.counts?.papers ?? 0
                } paper(s), ${redetectState.result.counts?.syllabi ?? 0} syllab${
                  redetectState.result.counts?.syllabi === 1 ? 'us' : 'i'
                }.`}
            </p>
          )}
          {redetectState.kind === 'error' && (
            <p className="mt-1 text-xs text-red-700">
              ✗ {redetectState.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Autosave indicator — proves to the coordinator that every change is
              being written to the database (not just the browser). */}
          <span
            data-testid="review-save-state"
            data-state={saveState}
            className={`text-xs ${saveState === 'saving' ? 'text-gray-400' : saveState === 'saved' ? 'text-emerald-600' : 'text-transparent'}`}
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ All changes saved' : 'saved'}
          </span>
          {/* Check coverage — (re)run the AI coverage reviewer over the filled
              specs so every red/yellow/green dot has a real assessment behind
              it. Backfills imports that never ran it (older MCC imports). */}
          <button
            onClick={() => handleCheckCoverage(coverageMissing > 0)}
            data-testid="check-coverage-cta"
            disabled={coverageState.kind === 'running'}
            title={
              coverageMissing > 0
                ? `Run the AI coverage review for the ${coverageMissing} spec(s) that haven't been assessed yet — populates the score, gaps and strengths behind each dot. No re-reading of the document.`
                : 'Recheck coverage: re-run the AI review for EVERY filled spec, re-reading the File-Library evidence assigned to each. Use this to refresh assessments after assigning files or editing narratives.'
            }
            className="rounded border border-cshse-300 bg-white px-3 py-1 text-sm font-medium text-cshse-700 hover:bg-cshse-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {coverageState.kind === 'running'
              ? (coverageState.total
                  ? `⏳ Checking coverage… ${coverageState.done ?? 0}/${coverageState.total}`
                  : '⏳ Checking coverage…')
              : coverageMissing > 0
              ? `✅ Check coverage (${coverageMissing})`
              : '🔄 Recheck coverage'}
          </button>
          {coverageState.kind === 'done' && (
            <span className="text-xs text-emerald-600" data-testid="coverage-done">
              ✓ {coverageState.assessed} assessed
            </span>
          )}
          {coverageState.kind === 'error' && (
            <span className="text-xs text-red-600">✗ {coverageState.message}</span>
          )}
          {/* CR-040 follow-on — Re-run detectors button. Pulls the
              persisted DOCX from S3 and re-runs cv_detector +
              appendix_paper_detector + introduction_detector only.
              No matcher, no callback. Existing review state preserved
              via aiReviewMerge dedupe-by-sectionId. */}
          <button
            onClick={handleRedetect}
            data-tour="review-redetect"
            disabled={redetectState.kind === 'running' || !importId}
            title={
              !importId
                ? 'Re-detect requires an existing import on this submission.'
                : 'Re-run cv_detector + appendix_paper_detector + introduction_detector against the persisted DOCX. ~5-10 seconds. Existing review state (approvals, edits) is preserved.'
            }
            className="rounded border border-cshse-300 bg-white px-3 py-1 text-sm font-medium text-cshse-700 hover:bg-cshse-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {redetectState.kind === 'running' ? '⏳ Re-detecting…' : '🔍 Re-run detectors'}
          </button>
          {/* CR-048 — "I'm done reviewing": discard every still-untriaged
              draft so the remaining items are explicitly NOT included and
              the workflow stops treating Review as having pending work. */}
          <button
            onClick={handleFinishReview}
            disabled={finishing || unresolvedCount === 0}
            data-testid="finish-review-cta"
            title={
              unresolvedCount === 0
                ? 'Every draft has been triaged (approved or discarded).'
                : `Mark the ${unresolvedCount} remaining un-reviewed draft(s) as "not included". Reversible from the Discarded list.`
            }
            className="rounded border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finishing
              ? '⏳ Finishing…'
              : unresolvedCount > 0
              ? `✓ Finish review — exclude remaining (${unresolvedCount})`
              : '✓ Review complete'}
          </button>
          {/* CR-064 — "Back to editor" removed: confusing + redundant with the
              top workflow tabs which already navigate. `onClose` stays wired for
              the spec-approve → editor path. */}
        </div>
      </header>
      {fileSummary && fileSummary.total > 0 && (fileSummary.recent > 0 || fileSummary.unassigned > 0) && (
        <div
          data-testid="review-new-files-banner"
          className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900"
        >
          <span aria-hidden>📎</span>
          <span>
            <strong>{fileSummary.total}</strong> supporting file{fileSummary.total === 1 ? '' : 's'} in the library
            {fileSummary.recent > 0 && (
              <> · <strong>{fileSummary.recent}</strong> uploaded in the last 3 days</>
            )}
            {fileSummary.unassigned > 0 && (
              <> · <strong>{fileSummary.unassigned}</strong> not yet assigned to a Standard</>
            )}
          </span>
          {onOpenFileLibrary && (
            <button
              onClick={onOpenFileLibrary}
              className="ml-auto rounded border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 whitespace-nowrap"
            >
              Open File Library →
            </button>
          )}
        </div>
      )}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <ReviewStep />
      </div>
    </div>
  );
}

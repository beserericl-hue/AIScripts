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
}

interface RedetectResult {
  ok: boolean;
  counts?: { cvs?: number; papers?: number; syllabi?: number; introHints?: number };
  message?: string;
  error?: string;
  detail?: string;
}

export function ReviewSurface({ submissionId, onClose }: ReviewSurfaceProps): JSX.Element {
  const setSubmissionId = useAIImportStore((s) => s.setSubmissionId);
  const loadPersistedReviewState = useAIImportStore((s) => s.loadPersistedReviewState);
  const importId = useAIImportStore((s) => s.importId);

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
  // Autosave: every review-rail mutation flips `dirty`; persist the content to
  // the DB after a short idle so nothing lives only in the browser.
  const dirty = useAIImportStore((s) => s.dirty);
  const saveReviewStateToServer = useAIImportStore((s) => s.saveReviewStateToServer);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

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

  useEffect(() => {
    setSubmissionId(submissionId);
    loadPersistedReviewState();
  }, [submissionId, setSubmissionId, loadPersistedReviewState]);

  // Debounced autosave — when the store goes dirty, persist the rail content to
  // the DB after 1.2s of quiet. Resets the timer on each further change so
  // rapid edits batch into one write.
  useEffect(() => {
    if (!dirty) return;
    setSaveState('saving');
    const t = setTimeout(async () => {
      const ok = await saveReviewStateToServer();
      setSaveState(ok ? 'saved' : 'idle');
    }, 1200);
    return () => clearTimeout(t);
  }, [dirty, saveReviewStateToServer]);

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
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-6 py-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Review</h1>
          <p className="text-xs text-gray-500">
            Items live on the submission and survive wizard close + re-open.
            Approve to push into the editor; discard to skip; clear to remove
            from the rail entirely.
          </p>
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
          <button
            onClick={onClose}
            data-tour="review-back-to-editor"
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            ◂ Back to editor
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <ReviewStep />
      </div>
    </div>
  );
}

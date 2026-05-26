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
          <h1 className="text-lg font-semibold text-gray-900">Review (CR-043)</h1>
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
          {/* CR-040 follow-on — Re-run detectors button. Pulls the
              persisted DOCX from S3 and re-runs cv_detector +
              appendix_paper_detector + introduction_detector only.
              No matcher, no callback. Existing review state preserved
              via aiReviewMerge dedupe-by-sectionId. */}
          <button
            onClick={handleRedetect}
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
          <button
            onClick={onClose}
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

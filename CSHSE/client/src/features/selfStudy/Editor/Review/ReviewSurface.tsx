/**
 * CR-043 — Review surface, decoupled from the AI Import Wizard.
 *
 * Lives on the Self-Study Editor toolbar (between "Importer Wizard"
 * and "Matrix"). Renders the same UX the wizard's ReviewStep used to
 * render, but its state comes from the submission-scoped persisted
 * `aiReviewState` (via aiImportStore.loadPersistedReviewState) and
 * NOT from the wizard's ephemeral run.
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
import React, { useEffect } from 'react';
import { ReviewStep } from '../AIImport/steps/ReviewStep';
import { useAIImportStore } from '../../../../store/aiImportStore';

export interface ReviewSurfaceProps {
  submissionId: string;
  onClose: () => void;
}

export function ReviewSurface({ submissionId, onClose }: ReviewSurfaceProps): JSX.Element {
  const setSubmissionId = useAIImportStore((s) => s.setSubmissionId);
  const loadPersistedReviewState = useAIImportStore((s) => s.loadPersistedReviewState);

  useEffect(() => {
    setSubmissionId(submissionId);
    loadPersistedReviewState();
  }, [submissionId, setSubmissionId, loadPersistedReviewState]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Review (CR-043)</h1>
          <p className="text-xs text-gray-500">
            Items live on the submission and survive wizard close + re-open.
            Approve to push into the editor; discard to skip; clear to remove
            from the rail entirely.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          ◂ Back to editor
        </button>
      </header>
      <div className="flex-1 overflow-hidden">
        <ReviewStep />
      </div>
    </div>
  );
}

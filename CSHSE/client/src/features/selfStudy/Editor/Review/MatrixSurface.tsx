/**
 * CR-043 — Matrix surface, decoupled from the AI Import Wizard.
 *
 * Lives on the Self-Study Editor toolbar. Reads aiMatrixState from
 * the submission-scoped store via loadPersistedReviewState (which also
 * pulls matrix state), then renders the existing MatrixStep UI.
 */
import React, { useEffect } from 'react';
import { MatrixStep } from '../AIImport/steps/MatrixStep';
import { useAIImportStore } from '../../../../store/aiImportStore';

export interface MatrixSurfaceProps {
  submissionId: string;
  onClose: () => void;
}

export function MatrixSurface({ submissionId, onClose }: MatrixSurfaceProps): JSX.Element {
  const setSubmissionId = useAIImportStore((s) => s.setSubmissionId);
  const loadPersistedReviewState = useAIImportStore((s) => s.loadPersistedReviewState);

  useEffect(() => {
    setSubmissionId(submissionId);
    loadPersistedReviewState();
  }, [submissionId, setSubmissionId, loadPersistedReviewState]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Matrix</h1>
          <p className="text-xs text-gray-500">
            In-flight matrix from the most recent imports. Row edits persist
            with the submission. Apply via the Review surface to write the
            structured CurriculumMatrix.
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
        <MatrixStep />
      </div>
    </div>
  );
}

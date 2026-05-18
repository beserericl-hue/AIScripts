/**
 * AI Import Wizard — top-level component (sub-sprint 1.a scaffold).
 *
 * Lays out the left stepper + active step content. Handles step routing
 * internally (no separate React Router routes — those land in 1.b once
 * we need deep-linking for the TagPopup, per UI spec §20.8).
 *
 * Loads existing wizard state on mount via `loadExisting` if the store
 * has a persisted importId — this is how a tab refresh resumes mid-flow.
 */
import React, { useEffect } from 'react';
import { Stepper } from './Stepper';
import { UploadStep } from './steps/UploadStep';
import { ParseStep } from './steps/ParseStep';
import { ReviewStep } from './steps/ReviewStep';
import { MatrixStep } from './steps/MatrixStep';
import { ApplyStep } from './steps/ApplyStep';
import { TagListView } from './tags/TagListView';
import { useAIImportStore } from '../../../../store/aiImportStore';

interface WizardProps {
  submissionId: string;
  /** Optional deep-link target — open the TagListView with this tagId pre-selected. */
  initialTagId?: string | null;
}

export function Wizard({ submissionId, initialTagId = null }: WizardProps): JSX.Element {
  const step = useAIImportStore((s) => s.step);
  const status = useAIImportStore((s) => s.status);
  const matrices = useAIImportStore((s) => s.matrices);
  const tags = useAIImportStore((s) => s.tags);
  const importId = useAIImportStore((s) => s.importId);
  const setStep = useAIImportStore((s) => s.setStep);
  const setSubmissionId = useAIImportStore((s) => s.setSubmissionId);
  const loadExisting = useAIImportStore((s) => s.loadExisting);

  // Track which submission we're operating on. If it changes, treat it
  // as a fresh wizard run.
  useEffect(() => {
    setSubmissionId(submissionId);
  }, [submissionId, setSubmissionId]);

  // On mount, if a persisted importId exists for this submission,
  // rehydrate the wizard from the server snapshot. Resilient to tab
  // close + re-open.
  useEffect(() => {
    if (importId) {
      void loadExisting(importId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once an import has been applied and tags remain, route the user
  // into the Tags view by default. They can still click back into Upload
  // to start a fresh import.
  React.useEffect(() => {
    if ((status === 'applied' || status === 'finished') && tags.length > 0 && step !== 'tags' && step !== 'upload') {
      setStep('tags');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tags.length]);

  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {step !== 'tags' && (
        <Stepper
          current={step}
          status={status}
          showMatrix={matrices.length > 0}
          onSelect={setStep}
        />
      )}
      <div className="flex-1 overflow-auto">
        {step === 'upload' && <UploadStep />}
        {step === 'parse' && <ParseStep />}
        {step === 'review' && <ReviewStep />}
        {step === 'matrix' && <MatrixStep />}
        {step === 'apply' && <ApplyStep />}
        {step === 'tags' && <TagListView initialTagId={initialTagId} />}
      </div>
    </div>
  );
}

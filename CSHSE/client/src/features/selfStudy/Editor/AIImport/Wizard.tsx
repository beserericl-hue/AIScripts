/**
 * AI Import Wizard — top-level component.
 *
 * CR-043 follow-on (post-release feedback 2026-05-26): the wizard is
 * now strictly the INGEST surface — Upload + Parse only. Review, Matrix,
 * and Apply moved to standalone toolbar surfaces (ReviewSurface,
 * MatrixSurface, with Apply inline in the Review header). When parsing
 * completes the wizard stays on its Parse step but renders a
 * "Done — open the Review tab" CTA that flips the editor's activeView
 * to 'review-surface'. Coordinator never has to think about wizard
 * steps beyond "did the file parse?".
 *
 * Loads existing wizard state on mount via `loadExisting` if the store
 * has a persisted importId — this is how a tab refresh resumes mid-flow.
 */
import React, { useEffect } from 'react';
import { Stepper } from './Stepper';
import { UploadStep } from './steps/UploadStep';
import { ParseStep } from './steps/ParseStep';
import { TagListView } from './tags/TagListView';
import { useAIImportStore } from '../../../../store/aiImportStore';

type ActiveView =
  | 'standards'
  | 'curriculum'
  | 'files'
  | 'ai-import'
  | 'review-surface'
  | 'matrix-surface';

interface WizardProps {
  submissionId: string;
  /** Optional deep-link target — open the TagListView with this tagId pre-selected. */
  initialTagId?: string | null;
  /**
   * CR-043 follow-on — Wizard's Parse step hands off to the Review
   * surface once parsing completes. The parent (SelfStudyEditor) wires
   * this callback so the "Open the Review tab" CTA in ParseStep can
   * flip activeView without the user having to click into the toolbar.
   */
  setActiveView?: (v: ActiveView) => void;
}

export function Wizard({ submissionId, initialTagId = null, setActiveView }: WizardProps): JSX.Element {
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
  //
  // 2026-06-07 (user direction) — but if that prior import is already SETTLED
  // (parsed / applied / finished / failed / canceled), the coordinator has
  // review data and is re-opening the importer to bring in a NEW file. Land
  // them on the Upload step, not the stale "Parsing complete" view. The old
  // parse stays reachable via the stepper; an actively-running parse still
  // lands on Parse so live progress isn't hidden.
  useEffect(() => {
    if (importId) {
      void loadExisting(importId).then(() => {
        const s = useAIImportStore.getState();
        const settled = ['parsed', 'applied', 'finished', 'failed', 'canceled'].includes(
          String(s.status)
        );
        if (settled && s.step === 'parse') {
          s.setStep('upload');
        }
      });
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

  // CR-043 follow-on — `review` / `matrix` / `apply` are no longer
  // wizard steps. If the persisted store still carries one of those
  // (older Zustand snapshots from before this deploy), normalize to
  // 'parse' so the wizard surface renders correctly.
  const normalizedStep =
    step === 'review' || step === 'matrix' || step === 'apply' ? 'parse' : step;
  // Suppress unused-imports lint complaint after we stopped rendering matrices/tags here.
  void matrices;
  void tags;

  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {normalizedStep !== 'tags' && (
        <Stepper
          current={normalizedStep}
          status={status}
          showMatrix={false}
          onSelect={setStep}
        />
      )}
      <div className="flex-1 overflow-auto">
        {normalizedStep === 'upload' && <UploadStep />}
        {normalizedStep === 'parse' && (
          <ParseStep onOpenReview={setActiveView ? () => setActiveView('review-surface') : undefined} />
        )}
        {normalizedStep === 'tags' && <TagListView initialTagId={initialTagId} />}
      </div>
    </div>
  );
}

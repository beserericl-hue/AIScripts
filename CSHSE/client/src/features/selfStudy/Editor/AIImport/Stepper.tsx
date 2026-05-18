/**
 * Left-rail step navigator for the AI Import Wizard.
 *
 * Steps are clickable once "reached" — forward navigation is gated by
 * `isReached`; backwards navigation is always allowed and never destroys
 * state (UI spec §6). The Matrix step is conditionally shown based on
 * the host's `showMatrix` prop (only when matrices were detected).
 */
import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { WizardStep, WizardStatus } from '../../../../store/aiImportStore';

const STEP_ORDER: WizardStep[] = ['upload', 'parse', 'review', 'matrix', 'apply'];
const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload',
  parse: 'Parse',
  review: 'Review',
  matrix: 'Matrix',
  apply: 'Apply',
  tags: 'Tags'
};

interface StepperProps {
  current: WizardStep;
  status: WizardStatus;
  showMatrix: boolean;
  onSelect: (step: WizardStep) => void;
}

function isStepReached(step: WizardStep, status: WizardStatus, current: WizardStep): boolean {
  // Upload always reached. Other steps reached once we've moved past them.
  if (step === 'upload') return true;
  const currentIdx = STEP_ORDER.indexOf(current);
  const stepIdx = STEP_ORDER.indexOf(step);
  if (stepIdx === -1 || currentIdx === -1) return false;
  if (stepIdx <= currentIdx) return true;
  // Forward steps unreached until we've actually navigated to them.
  return false;
}

function stepState(step: WizardStep, current: WizardStep, status: WizardStatus): 'active' | 'reached' | 'locked' {
  if (step === current) return 'active';
  if (isStepReached(step, status, current)) return 'reached';
  return 'locked';
}

export function Stepper({ current, status, showMatrix, onSelect }: StepperProps): JSX.Element {
  const visible = STEP_ORDER.filter((s) => s !== 'matrix' || showMatrix);

  return (
    <nav aria-label="Wizard steps" role="tablist" className="w-56 border-r border-gray-200 bg-gray-50 p-4">
      <ol className="space-y-1">
        {visible.map((step, idx) => {
          const state = stepState(step, current, status);
          const reached = state !== 'locked';
          return (
            <li key={step}>
              <button
                role="tab"
                aria-selected={state === 'active'}
                aria-current={state === 'active' ? 'step' : undefined}
                aria-disabled={state === 'locked'}
                disabled={state === 'locked'}
                onClick={() => reached && onSelect(step)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  state === 'active'
                    ? 'bg-cshse-100 text-cshse-700 ring-1 ring-cshse-500'
                    : state === 'reached'
                    ? 'text-gray-700 hover:bg-gray-100'
                    : 'cursor-not-allowed text-gray-400'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    state === 'active'
                      ? 'bg-cshse-500 text-white'
                      : state === 'reached'
                      ? 'bg-cshse-200 text-cshse-700'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {state === 'reached' && step !== current ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : state === 'active' && (status === 'parsing' || status === 'queued' || status === 'applying') ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span>{STEP_LABELS[step]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

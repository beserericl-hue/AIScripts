/**
 * PhaseIndicator — CR-045.
 *
 * The wizard's progress strip. Sits above the Self-Study Editor toolbar
 * and shows the PC where they are in the four-step guided workflow:
 *
 *   [1. Import]  →  [2. Drafts (N)]  →  [3. Self-Study (X/Y)]  →  [4. Submit]
 *
 * Per the user (2026-05-27): "the importer wizard is really ... the
 * entire process ... the wizard approach ... directs the workflow to
 * the final draft." This strip IS the wizard. The four chips are its
 * steps. Each chip is clickable and jumps to the canonical view for
 * that phase; the active phase (derived from `activeView`) is
 * highlighted.
 *
 * Plain-English labels only — these are teachers, not engineers.
 */
import React from 'react';
import { Upload, ClipboardCheck, BookOpen, Send, ChevronRight } from 'lucide-react';

export type EditorActiveView =
  | 'standards'
  | 'curriculum'
  | 'files'
  | 'introduction'
  | 'ai-import'
  | 'review-surface'
  | 'matrix-surface';

type Phase = 'import' | 'drafts' | 'self-study' | 'submit';

export interface PhaseIndicatorProps {
  activeView: EditorActiveView;
  setActiveView: (v: EditorActiveView) => void;
  /** Count of items waiting in the Drafts (Review) queue. 0 hides the badge. */
  draftsCount: number;
  /** Validated spec count for the Self-Study phase chip. */
  validated: number;
  /** Total spec count for the Self-Study phase chip. */
  totalSpecs: number;
  /** Fires when the PC clicks the Submit chip — parent scrolls to / focuses
   *  the standalone Submit CTA (the chip is a marker, not the action). */
  onSubmitClick: () => void;
}

/** Map the current view to its workflow phase. */
function phaseForView(view: EditorActiveView): Phase {
  if (view === 'ai-import') return 'import';
  if (view === 'review-surface' || view === 'matrix-surface') return 'drafts';
  // standards / curriculum / files / introduction
  return 'self-study';
}

export function PhaseIndicator({
  activeView,
  setActiveView,
  draftsCount,
  validated,
  totalSpecs,
  onSubmitClick
}: PhaseIndicatorProps): JSX.Element {
  const current = phaseForView(activeView);

  const chips: Array<{
    phase: Phase;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    onClick: () => void;
  }> = [
    {
      phase: 'import',
      label: '1. Import',
      icon: <Upload className="h-3.5 w-3.5" aria-hidden />,
      onClick: () => setActiveView('ai-import')
    },
    {
      phase: 'drafts',
      label: '2. Drafts',
      icon: <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />,
      badge: draftsCount > 0 ? String(draftsCount) : undefined,
      onClick: () => setActiveView('review-surface')
    },
    {
      phase: 'self-study',
      label: '3. Self-Study',
      icon: <BookOpen className="h-3.5 w-3.5" aria-hidden />,
      badge: totalSpecs > 0 ? `${validated}/${totalSpecs}` : undefined,
      onClick: () => setActiveView('standards')
    },
    {
      phase: 'submit',
      label: '4. Submit',
      icon: <Send className="h-3.5 w-3.5" aria-hidden />,
      onClick: onSubmitClick
    }
  ];

  return (
    <nav
      aria-label="Self-study workflow steps"
      className="flex flex-wrap items-center gap-1 px-4 py-2"
      data-testid="phase-indicator"
    >
      {chips.map((chip, i) => {
        const isActive = chip.phase === current;
        return (
          <React.Fragment key={chip.phase}>
            <button
              type="button"
              onClick={chip.onClick}
              aria-current={isActive ? 'step' : undefined}
              data-phase={chip.phase}
              data-active={isActive ? 'true' : 'false'}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {chip.icon}
              {chip.label}
              {chip.badge && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-white text-gray-700'
                  }`}
                >
                  {chip.badge}
                </span>
              )}
            </button>
            {i < chips.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" aria-hidden />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

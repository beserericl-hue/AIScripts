import React from 'react';
import type { TooltipRenderProps } from 'react-joyride';
import { TOUR_THEME } from './tourTheme';
import { t } from '../../i18n/strings';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — Custom tooltip rendered by react-joyride.
//
// Layout:
//   ┌─────────────────────────────────────────┐
//   │ ━━━━━━━━━━━━░░░░░░░░░░░░ <- progress bar │
//   │                                         │
//   │  step.content (provided by the step)    │
//   │                                         │
//   │  [Back]            [Skip]   [Next →]    │
//   └─────────────────────────────────────────┘
//
// - Back hidden on the first step (index === 0).
// - Skip hidden on the last step (last index).
// - Primary button label flips: "Next →" / "Finish".
// - Progress bar fill = ((index + 1) / size) * 100%.
// ---------------------------------------------------------------------------

export function CshseTooltip(props: TooltipRenderProps): JSX.Element {
  const {
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    step,
    tooltipProps,
    index,
    size,
    isLastStep,
  } = props;

  const progressPct = Math.max(0, Math.min(100, ((index + 1) / size) * 100));

  return (
    <div
      {...tooltipProps}
      data-testid="tour-tooltip"
      data-step-index={index}
      data-step-total={size}
      style={{
        zIndex: TOUR_THEME.zIndex,
        maxWidth: 380,
        minWidth: 280,
      }}
      className="rounded-lg border border-slate-200 bg-white p-0 shadow-xl"
    >
      {/* progress bar */}
      <div
        data-testid="tour-tooltip-progress-track"
        className="h-1 w-full overflow-hidden rounded-t-lg bg-slate-200"
      >
        <div
          data-testid="tour-tooltip-progress-fill"
          style={{
            width: `${progressPct}%`,
            backgroundColor: TOUR_THEME.primary,
            transition: 'width 200ms ease-out',
            height: '100%',
          }}
        />
      </div>

      <div className="space-y-2 p-4">
        <div data-testid="tour-tooltip-content" className="text-sm leading-relaxed" style={{ color: TOUR_THEME.text }}>
          {step.content as React.ReactNode}
        </div>
        <p data-testid="tour-tooltip-step-label" className="text-[10px] uppercase tracking-wide text-slate-500">
          {t('tour.controls.stepLabel', { current: index + 1, total: size })}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2">
        <div className="min-w-[64px]">
          {index > 0 && (
            <button
              {...backProps}
              data-testid="tour-tooltip-back"
              className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {t('tour.controls.back')}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isLastStep && (
            <button
              {...skipProps}
              data-testid="tour-tooltip-skip"
              className="rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
            >
              {t('tour.controls.skip')}
            </button>
          )}
          <button
            {...primaryProps}
            data-testid="tour-tooltip-primary"
            style={{ backgroundColor: TOUR_THEME.primary }}
            className="rounded px-3 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            {isLastStep ? t('tour.controls.finish') : t('tour.controls.next')}
          </button>
        </div>
      </div>
      {/* Joyride needs a close handler bound somewhere; we surface a tiny X
          for keyboard users (visually hidden — buttons above carry the
          weight). */}
      <button
        {...closeProps}
        aria-label={t('tour.controls.skip')}
        data-testid="tour-tooltip-close"
        className="sr-only"
      />
    </div>
  );
}

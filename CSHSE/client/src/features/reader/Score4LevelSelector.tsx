import React from 'react';

// ---------------------------------------------------------------------------
// CR-003 / S3.2 — 0-3 compliance-rubric selector.
// Each value carries the CSHSE-defined label (Non/Partial/Largely/Fully)
// with short helper text the reader sees inline so they don't have to look
// up the rubric. The server's `Score` model accepts 0..3 integers and
// scopes by (submissionId, std, spec, reviewerId).
// ---------------------------------------------------------------------------

export type ScoreValue = 0 | 1 | 2 | 3;

export interface ScoreLevel {
  value: ScoreValue;
  label: string;
  shortHelper: string;
  cls: string;
}

export const SCORE_LEVELS: ScoreLevel[] = [
  {
    value: 0,
    label: 'Non',
    shortHelper: 'Not met — missing or non-compliant.',
    cls: 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100',
  },
  {
    value: 1,
    label: 'Partial',
    shortHelper: 'Partially met — fixable gaps remain.',
    cls: 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
  },
  {
    value: 2,
    label: 'Largely',
    shortHelper: 'Largely met — minor improvements only.',
    cls: 'border-lime-300 bg-lime-50 text-lime-900 hover:bg-lime-100',
  },
  {
    value: 3,
    label: 'Fully',
    shortHelper: 'Fully met — no concerns.',
    cls: 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100',
  },
];

export interface Score4LevelSelectorProps {
  value: ScoreValue | null;
  onChange: (next: ScoreValue) => void;
  disabled?: boolean;
  saving?: boolean;
}

export function Score4LevelSelector({
  value,
  onChange,
  disabled,
  saving,
}: Score4LevelSelectorProps): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Compliance score"
      data-testid="score-4-selector"
      className="grid grid-cols-1 gap-2 sm:grid-cols-4"
    >
      {SCORE_LEVELS.map((lvl) => {
        const selected = value === lvl.value;
        return (
          <button
            key={lvl.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`score-${lvl.value}`}
            disabled={disabled || saving}
            onClick={() => onChange(lvl.value)}
            className={[
              'flex flex-col items-start rounded-md border-2 p-3 text-left text-sm transition',
              lvl.cls,
              selected ? 'ring-2 ring-offset-1 ring-slate-700' : 'opacity-90',
              disabled || saving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            ].join(' ')}
          >
            <span className="flex items-center gap-2 font-semibold">
              <span className="font-mono text-base">{lvl.value}</span>
              <span>{lvl.label}</span>
            </span>
            <span className="mt-1 text-xs leading-snug">{lvl.shortHelper}</span>
          </button>
        );
      })}
    </div>
  );
}

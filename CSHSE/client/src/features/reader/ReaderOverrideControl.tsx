import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-049 S3.4 — Reader override of the AI verdict.
// The reader picks pass / needs_improvement / fail and (optionally) types
// a note. The server's POST /standards/:std/specs/:spec/override stamps
// the verdict as readerOverridden=true on the latest ValidationResult AND
// posts a `section_eval_override` correction into the institution's
// Qdrant store — closing the CR-049 learning loop end-to-end.
// ---------------------------------------------------------------------------

export type OverrideVerdict = 'pass' | 'needs_improvement' | 'fail';

const VERDICTS: Array<{
  value: OverrideVerdict;
  label: string;
  cls: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'pass', label: 'Pass', cls: 'border-green-400 bg-green-50 text-green-900 hover:bg-green-100', Icon: CheckCircle2 },
  { value: 'needs_improvement', label: 'Needs improvement', cls: 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100', Icon: AlertTriangle },
  { value: 'fail', label: 'Fail', cls: 'border-red-400 bg-red-50 text-red-900 hover:bg-red-100', Icon: XCircle },
];

export interface ReaderOverrideViewProps {
  current: OverrideVerdict | null;
  draft: OverrideVerdict | null;
  setDraft: (v: OverrideVerdict) => void;
  note: string;
  setNote: (n: string) => void;
  disabled?: boolean;
  saving?: boolean;
  onSubmit: () => void;
  readerOverridden?: boolean;
}

export function ReaderOverrideView({
  current,
  draft,
  setDraft,
  note,
  setNote,
  disabled,
  saving,
  onSubmit,
  readerOverridden,
}: ReaderOverrideViewProps): JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-slate-800">Reader verdict override</p>
        {readerOverridden && (
          <span
            data-testid="override-status-chip"
            className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
          >
            Reader-overridden
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-slate-600">
        Replace the AI verdict on this spec. Your override is the report value
        and feeds the AI's learning store for future evaluations.
      </p>
      <div role="radiogroup" aria-label="Reader verdict" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {VERDICTS.map((v) => {
          const Icon = v.Icon;
          const selected = draft === v.value;
          return (
            <button
              key={v.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`override-verdict-${v.value}`}
              disabled={disabled || saving}
              onClick={() => setDraft(v.value)}
              className={[
                'flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm transition',
                v.cls,
                selected ? 'ring-2 ring-offset-1 ring-slate-700' : 'opacity-90',
                disabled || saving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="font-medium">{v.label}</span>
            </button>
          );
        })}
      </div>
      <textarea
        data-testid="override-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why are you overriding? (Optional; surfaced in the report.)"
        rows={2}
        disabled={disabled || saving}
        className="mt-3 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          data-testid="override-submit"
          disabled={disabled || saving || !draft || draft === current}
          onClick={onSubmit}
          className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          <span>Save reader override</span>
        </button>
      </div>
    </div>
  );
}

export interface ReaderOverrideControlProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  /** Last persisted verdict + note from the ValidationResult / GET evaluation. */
  current: OverrideVerdict | null;
  readerOverridden?: boolean;
  /** Hide entirely when the viewer can't override (PC, anonymous). */
  canOverride: boolean;
  disabled?: boolean;
}

export function ReaderOverrideControl({
  submissionId,
  standardCode,
  specCode,
  current,
  readerOverridden,
  canOverride,
  disabled,
}: ReaderOverrideControlProps): JSX.Element | null {
  const [draft, setDraft] = React.useState<OverrideVerdict | null>(current);
  const [note, setNote] = React.useState('');
  const qc = useQueryClient();

  // Keep the local draft in sync if the server-side current verdict changes
  // (e.g. someone else overrode it, or a fresh eval rewrote it).
  React.useEffect(() => {
    setDraft(current);
  }, [current]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('verdict required');
      return api.post(
        `/api/submissions/${submissionId}/standards/${standardCode}/specs/${specCode}/override`,
        { verdict: draft, note: note || undefined }
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['spec-evaluation', submissionId, standardCode, specCode] });
      void qc.invalidateQueries({ queryKey: ['reader-scores', submissionId] });
    },
  });

  if (!canOverride) return null;

  return (
    <ReaderOverrideView
      current={current}
      draft={draft}
      setDraft={setDraft}
      note={note}
      setNote={setNote}
      disabled={disabled}
      saving={mutation.isPending}
      onSubmit={() => mutation.mutate()}
      readerOverridden={readerOverridden}
    />
  );
}

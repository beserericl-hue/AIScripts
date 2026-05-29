import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Ban, Loader2, RotateCcw } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-050 — "Mark not applicable" toggle for a single spec in the Self-Study
// editor. Lets a PC declare intent that this spec does not apply to their
// program. The submit-readiness gate (server + client) then treats the spec
// as satisfied even though it has no content / never passed validation.
// ---------------------------------------------------------------------------

export interface SpecNotApplicableProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  /** Current persisted excluded flag from the submission. */
  excluded?: boolean;
  /** Current persisted excluded reason from the submission. */
  excludedReason?: string;
  /** Disables the toggle when the submission is locked / submitted. */
  disabled?: boolean;
  /** Hide entirely for non-PC roles. */
  canToggle: boolean;
}

/**
 * Pure view. Unit-testable without react-query.
 */
export function SpecNotApplicableView({
  excluded,
  excludedReason,
  reason,
  setReason,
  disabled,
  isSaving,
  onMark,
  onClear,
}: {
  excluded: boolean;
  excludedReason?: string;
  reason: string;
  setReason: (v: string) => void;
  disabled: boolean;
  isSaving: boolean;
  onMark: () => void;
  onClear: () => void;
}): JSX.Element {
  if (excluded) {
    return (
      <div
        data-testid="spec-na-status"
        className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Ban className="h-4 w-4" aria-hidden />
            <span className="font-medium">Marked Not Applicable</span>
          </div>
          <button
            type="button"
            disabled={disabled || isSaving}
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            <span>Restore</span>
          </button>
        </div>
        {excludedReason ? (
          <p className="mt-1 text-xs text-slate-600">{excludedReason}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-start gap-2">
        <Ban className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden />
        <div className="flex-1">
          <p className="font-medium text-slate-800">This spec does not apply</p>
          <p className="text-xs text-slate-600">
            Mark this spec Not Applicable so it does not block Final Submit. A reason helps the reader understand your intent.
          </p>
          <textarea
            data-testid="spec-na-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={2}
            disabled={disabled || isSaving}
            className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              data-testid="spec-na-mark"
              disabled={disabled || isSaving}
              onClick={onMark}
              className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
              <span>Mark Not Applicable</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpecNotApplicable(props: SpecNotApplicableProps): JSX.Element | null {
  const { submissionId, standardCode, specCode, excluded, excludedReason, disabled, canToggle } = props;
  const [reason, setReason] = React.useState('');
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    void queryClient.invalidateQueries({ queryKey: ['workflow-summary', submissionId] });
  };

  const markMutation = useMutation({
    mutationFn: async () => {
      return api.post(
        `/api/submissions/${submissionId}/standards/${standardCode}/specs/${specCode}/not-applicable`,
        { reason: reason || undefined }
      );
    },
    onSuccess: invalidate,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      return api.delete(
        `/api/submissions/${submissionId}/standards/${standardCode}/specs/${specCode}/not-applicable`
      );
    },
    onSuccess: invalidate,
  });

  if (!canToggle) return null;

  const isSaving = markMutation.isPending || clearMutation.isPending;
  return (
    <SpecNotApplicableView
      excluded={!!excluded}
      excludedReason={excludedReason}
      reason={reason}
      setReason={setReason}
      disabled={!!disabled}
      isSaving={isSaving}
      onMark={() => markMutation.mutate()}
      onClear={() => clearMutation.mutate()}
    />
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Send, Lock, X, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

export interface PreflightIssue {
  code: string;
  message: string;
  standardCode?: string;
  specCode?: string;
}

export interface PreflightResult {
  submitDisabled: boolean;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  counts: {
    totalSpecs: number;
    passed: number;
    excluded: number;
    satisfied: number;
    missing: number;
  };
}

interface FinalSubmitModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (submissionNote: string) => Promise<void> | void;
  validated: number;
  total: number;
  busy: boolean;
  // CR-008 / S2A.2 — pre-submission preflight surfaces errors + warnings
  // before the PC presses Submit. When `preflight` is provided and has
  // errors, Submit is disabled and each error renders as a "jump to spec"
  // row. The optional `onGoToSpec` lets the modal navigate the editor.
  preflight?: PreflightResult | null;
  preflightLoading?: boolean;
  onGoToSpec?: (standardCode: string, specCode: string) => void;
}

/**
 * Final Submit confirmation modal (CR-006, S2A.5).
 *
 * Replaces the previous window.confirm() banner with a proper React
 * modal so the PC understands exactly what's happening — lockout
 * semantics + reader-access implications — before the submission is
 * locked.
 *
 * The optional "Submission note" field flows through to the
 * submission.final_submit audit log entry (CR-005 + the auditLog
 * service shipped in 168cf1f).
 */
export function FinalSubmitModal({
  open,
  onClose,
  onConfirm,
  validated,
  total,
  busy,
  preflight,
  preflightLoading,
  onGoToSpec
}: FinalSubmitModalProps): JSX.Element | null {
  const [note, setNote] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset the note each time the modal re-opens — a stale note from a
  // prior aborted submit shouldn't appear on the next attempt.
  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  // Esc-to-close (only when not busy, so we don't abandon an in-flight submit)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    await onConfirm(note.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="final-submit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        // Click outside closes — unless busy
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-teal-100 p-2">
              <Lock className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <div>
              <h2 id="final-submit-title" className="text-lg font-semibold text-gray-900">
                Submit Self-Study for Review
              </h2>
              <p className="text-sm text-gray-500">This action is irreversible without admin help.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="space-y-4 px-6 py-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" aria-hidden />
              <div>
                <p className="font-medium text-amber-900">After you submit:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-900">
                  <li>You can <strong>view + print</strong> the self-study but cannot edit it.</li>
                  <li>Assigned readers gain access for the first time.</li>
                  <li>To make changes, you'll need to ask the administrator to unlock it.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Validated specifications</span>
              <span className="font-mono font-medium text-gray-900">{validated} / {total}</span>
            </div>
          </div>

          {/* CR-008 / S2A.2 — preflight summary. Errors block submit and
              link the PC straight to the offending spec. Warnings are
              informational and do not block. */}
          {preflightLoading && (
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>Running pre-submission checks…</span>
            </div>
          )}
          {!preflightLoading && preflight && preflight.errors.length > 0 && (
            <div
              role="alert"
              data-testid="preflight-errors"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm"
            >
              <p className="mb-2 font-medium text-red-900">
                {preflight.errors.length} item{preflight.errors.length === 1 ? '' : 's'} need attention before Submit:
              </p>
              <ul className="max-h-44 space-y-1 overflow-y-auto">
                {preflight.errors.slice(0, 12).map((err, i) => (
                  <li key={`${err.code}-${i}`} className="flex items-start justify-between gap-2 text-red-900">
                    <span className="leading-snug">{err.message}</span>
                    {onGoToSpec && err.standardCode && err.specCode && (
                      <button
                        type="button"
                        data-testid={`preflight-goto-${err.standardCode}-${err.specCode}`}
                        onClick={() => onGoToSpec(err.standardCode!, err.specCode!)}
                        className="ml-2 inline-flex shrink-0 items-center gap-0.5 rounded border border-red-300 bg-white px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-100"
                      >
                        Go to
                        <ChevronRight className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
                {preflight.errors.length > 12 && (
                  <li className="pt-1 text-xs text-red-700">…and {preflight.errors.length - 12} more.</li>
                )}
              </ul>
            </div>
          )}
          {!preflightLoading && preflight && preflight.warnings.length > 0 && (
            <div
              data-testid="preflight-warnings"
              className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <p className="mb-1 font-medium">Worth checking before you submit:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {preflight.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label
              htmlFor="submission-note"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Submission note <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="submission-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              rows={3}
              maxLength={2000}
              placeholder="Anything you want the lead reader to know — site visit dates, contacts, follow-up commitments…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Persisted on the submission audit trail. {note.length}/2000
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="final-submit-confirm"
            onClick={handleConfirm}
            disabled={busy || preflightLoading || (preflight ? preflight.submitDisabled : false)}
            className="flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </footer>
      </div>
    </div>
  );
}

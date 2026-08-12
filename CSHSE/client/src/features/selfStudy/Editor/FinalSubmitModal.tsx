import React, { useState, useEffect, useRef } from 'react';
import { Send, Lock, X, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

export interface PreflightIssue {
  code: string;
  message: string;
  standardCode?: string;
  specCode?: string;
}

export interface NeedsImprovementItem {
  standardCode: string;
  specCode: string;
  standardTitle: string;
  specTitle: string;
  rationale: string;
}

export interface NeedsImprovementNote {
  standardCode: string;
  specCode: string;
  note: string;
}

export interface PreflightResult {
  submitDisabled: boolean;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  // CR-074 — files uploaded but never assigned to a Standard. A HARD block
  // (not overridable): after submit the study is read-only and the file would
  // be stranded.
  unassignedFiles?: { id: string; name: string }[];
  counts: {
    totalSpecs: number;
    passed: number;
    excluded: number;
    satisfied: number;
    missing: number;
    unassignedFiles?: number;
  };
}

interface FinalSubmitModalProps {
  open: boolean;
  onClose: () => void;
  // CR-008 / S10.3 — when preflight has errors the PC may override by
  // checking the override box and supplying a reason. The reason flows to
  // the server which records a `submission.final_submit_override` audit
  // event. A clean submit passes `override` undefined.
  onConfirm: (
    submissionNote: string,
    override?: { reason: string },
    needsImprovementNotes?: NeedsImprovementNote[]
  ) => Promise<void> | void;
  // AACC (Nicole) — specs the AI flagged "Needs Improvement". The PC records a
  // note per item at submit (why it stands: school policy, non-public page…);
  // each becomes a Program-Coordinator comment in the Reader Report.
  needsImprovement?: NeedsImprovementItem[];
  needsImprovementLoading?: boolean;
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
  // CR-074 — jump to the File Library filtered to unassigned files so the PC
  // can resolve the hard block.
  onOpenFileLibrary?: () => void;
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
  onGoToSpec,
  onOpenFileLibrary,
  needsImprovement,
  needsImprovementLoading
}: FinalSubmitModalProps): JSX.Element | null {
  const [note, setNote] = useState('');
  // Per-spec PC acknowledgement notes for the Needs-Improvement items, keyed by
  // "std.spec".
  const [niNotes, setNiNotes] = useState<Record<string, string>>({});
  // CR-008 / S10.3 — override-with-reason state. Only relevant when preflight
  // reports blocking errors.
  const [overrideChecked, setOverrideChecked] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset the note + override each time the modal re-opens — stale state from
  // a prior aborted submit shouldn't appear on the next attempt.
  useEffect(() => {
    if (open) {
      setNote('');
      setOverrideChecked(false);
      setOverrideReason('');
      setNiNotes({});
    }
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

  // CR-074 — unassigned-file errors are a HARD block, separate from the
  // overridable validation gaps. The override checkbox never clears them.
  const unassignedFiles = (preflight?.unassignedFiles) || [];
  const hasUnassignedBlock =
    unassignedFiles.length > 0 ||
    !!preflight?.errors.some((e) => e.code === 'UNASSIGNED_FILES');
  const overridableErrors = (preflight?.errors || []).filter((e) => e.code !== 'UNASSIGNED_FILES');
  const hasErrors = overridableErrors.length > 0;
  const reasonOk = overrideReason.trim().length >= 10;
  // The submit button is blocked while preflight is loading or busy. The
  // unassigned-files block cannot be overridden. Overridable errors are only
  // cleared with the override checkbox AND a >=10-char reason.
  const submitBlocked =
    busy ||
    preflightLoading ||
    hasUnassignedBlock ||
    (hasErrors && !(overrideChecked && reasonOk));

  const handleConfirm = async () => {
    const niPayload: NeedsImprovementNote[] = (needsImprovement || [])
      .map((it) => ({
        standardCode: it.standardCode,
        specCode: it.specCode,
        note: (niNotes[`${it.standardCode}.${it.specCode}`] || '').trim(),
      }))
      .filter((n) => n.note.length > 0);
    if (hasErrors && overrideChecked) {
      await onConfirm(note.trim(), { reason: overrideReason.trim() }, niPayload);
    } else {
      await onConfirm(note.trim(), undefined, niPayload);
    }
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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
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
          {/* CR-074 — unassigned-files HARD block. Not overridable: the study
              becomes read-only at submit, so a stranded file would never reach a
              reader. The PC must open the File Library and assign or remove
              them. */}
          {!preflightLoading && hasUnassignedBlock && (
            <div
              role="alert"
              data-testid="preflight-unassigned-files"
              className="rounded-md border border-red-300 bg-red-50 p-3 text-sm"
            >
              <p className="font-semibold text-red-900">
                {unassignedFiles.length > 0
                  ? `${unassignedFiles.length} file${unassignedFiles.length === 1 ? '' : 's'} not yet assigned to a Standard`
                  : 'Some files are not yet assigned to a Standard'}
              </p>
              <p className="mt-0.5 text-xs text-red-800">
                You can't submit until every uploaded file is assigned to a Standard (or the Introduction). After submit the self-study is read-only, so an unassigned file would be stranded.
              </p>
              {unassignedFiles.length > 0 && (
                <ul className="mt-2 max-h-28 list-disc space-y-0.5 overflow-y-auto pl-5 text-red-900">
                  {unassignedFiles.slice(0, 12).map((f) => (
                    <li key={f.id} className="leading-snug">{f.name}</li>
                  ))}
                  {unassignedFiles.length > 12 && (
                    <li className="list-none pt-1 text-xs text-red-700">…and {unassignedFiles.length - 12} more.</li>
                  )}
                </ul>
              )}
              {onOpenFileLibrary && (
                <button
                  type="button"
                  data-testid="preflight-open-file-library"
                  onClick={onOpenFileLibrary}
                  className="mt-3 inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  Open File Library → Unassigned
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          )}
          {!preflightLoading && preflight && overridableErrors.length > 0 && (
            <div
              role="alert"
              data-testid="preflight-errors"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm"
            >
              <p className="mb-2 font-medium text-red-900">
                {overridableErrors.length} item{overridableErrors.length === 1 ? '' : 's'} need attention before Submit:
              </p>
              <ul className="max-h-44 space-y-1 overflow-y-auto">
                {overridableErrors.slice(0, 12).map((err, i) => (
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
                {overridableErrors.length > 12 && (
                  <li className="pt-1 text-xs text-red-700">…and {overridableErrors.length - 12} more.</li>
                )}
              </ul>

              {/* CR-008 / S10.3 — override-with-reason. Lets the PC submit
                  despite the blocking errors above, but only after explicitly
                  acknowledging and recording why. The reason is mandatory
                  (>= 10 chars) and persists in the audit trail. */}
              <div className="mt-3 border-t border-red-200 pt-3">
                <label className="flex items-start gap-2 text-red-900">
                  <input
                    type="checkbox"
                    data-testid="preflight-override-checkbox"
                    checked={overrideChecked}
                    disabled={busy}
                    onChange={(e) => setOverrideChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-red-400 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium">
                    Submit anyway, despite the items above
                  </span>
                </label>
                {overrideChecked && (
                  <div className="mt-2">
                    <label htmlFor="override-reason" className="mb-1 block text-xs font-medium text-red-900">
                      Reason for overriding <span className="text-red-600">(required)</span>
                    </label>
                    <textarea
                      id="override-reason"
                      data-testid="preflight-override-reason"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      disabled={busy}
                      rows={2}
                      maxLength={2000}
                      placeholder="Explain why this self-study is being submitted with unresolved items…"
                      className="w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-red-50"
                    />
                    <p className="mt-1 text-xs text-red-700">
                      {overrideReason.trim().length < 10
                        ? `At least 10 characters required (${overrideReason.trim().length}/10).`
                        : 'This reason is recorded on the audit trail.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* The preflight "warnings" list (each needs-improvement spec restated)
              was removed — it duplicated the acknowledgement section below, which
              lists the same specs WITH a note field. The PC already knows the AI
              flagged them; they just need to annotate each. */}

          {/* AACC (Nicole) — acknowledge each AI "Needs Improvement" finding with
              a note explaining why it stands (school policy, non-public page, to
              be discussed at the site visit…). Each note becomes a Program-
              Coordinator comment in the Reader Report so the readers see why. */}
          {needsImprovementLoading && (
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>Loading the AI "Needs Improvement" findings…</span>
            </div>
          )}
          {!needsImprovementLoading && needsImprovement && needsImprovement.length > 0 && (
            <div data-testid="ni-notes-section" className="rounded-md border border-yellow-300 bg-yellow-50 p-3">
              <p className="text-sm font-semibold text-yellow-900">
                {needsImprovement.length} specification{needsImprovement.length === 1 ? '' : 's'} the AI marked "Needs Improvement"
              </p>
              <p className="mt-0.5 text-xs text-yellow-800">
                For each, add a note explaining why it stands (e.g. "not implemented because of school policy", "on a page that isn't publicly accessible", "to be discussed at the site visit"). Your notes appear in the Reader Report as Program-Coordinator comments.
              </p>
              <div className="mt-3 space-y-3">
                {needsImprovement.map((it) => {
                  const key = `${it.standardCode}.${it.specCode}`;
                  return (
                    <div key={key} data-testid={`ni-item-${key}`} className="rounded border border-yellow-200 bg-white p-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          Standard {it.standardCode}{it.specCode ? `.${it.specCode}` : ''}
                          {it.specTitle ? <span className="font-normal text-gray-600"> — {it.specTitle}</span> : null}
                        </span>
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Needs Improvement</span>
                      </div>
                      {it.rationale && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-amber-700">Why the AI flagged this</summary>
                          <div className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">{it.rationale}</div>
                        </details>
                      )}
                      <textarea
                        data-testid={`ni-note-${key}`}
                        value={niNotes[key] || ''}
                        onChange={(e) => setNiNotes((m) => ({ ...m, [key]: e.target.value }))}
                        disabled={busy}
                        rows={2}
                        maxLength={2000}
                        placeholder="Your note (why this remains) — shown to the readers…"
                        className="mt-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-50"
                      />
                    </div>
                  );
                })}
              </div>
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
            disabled={submitBlocked}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              hasErrors && overrideChecked
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {busy
              ? 'Submitting…'
              : hasErrors && overrideChecked
                ? 'Override & submit anyway'
                : 'Submit for review'}
          </button>
        </footer>
      </div>
    </div>
  );
}

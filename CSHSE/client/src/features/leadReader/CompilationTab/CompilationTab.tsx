import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, ChevronLeft, Check, X, FileDown, Lock, Send, ClipboardList } from 'lucide-react';
import { api } from '../../../services/api';
import { useOnceHint } from '../../tour/useOnceHint';
import { t } from '../../../i18n/strings';

// ---------------------------------------------------------------------------
// CR-009 / Sprint 5.1 — Compilation tab (lead reader side-by-side).
//
// Every reader's Compliant / Non-compliant mark per (std, spec) side by
// side — the marks each reader set on their own Reader Report (Lauri CR,
// Nov 2026, removed the 0-3 score). Row highlighting:
//   - red    when ANY reader marked it Non-compliant
//   - yellow when the readers' marks differ (disagreement)
//   - green  when all readers agree
//   - muted  when the spec is excluded (CR-050 N/A)
//
// The lead reader sets a Final mark (Compliant / Non-compliant) per spec
// with one click. The write is audit-logged server-side
// (compilation.final_set); a Non-compliant Final adds the spec to the
// site-visit checklist, a Compliant one removes the auto-added row.
//
// View / container split: CompilationTabView is presentational and gets
// unit-tested in isolation; the container wires queries/mutations.
// ---------------------------------------------------------------------------

export type ComplianceMark = 'compliant' | 'noncompliant';

export interface CompilationReader {
  id: string;
  name: string;
  completed?: boolean;
}

export interface CompilationReaderMark {
  reviewerId: string;
  reviewerName: string;
  mark: ComplianceMark;
}

export interface CompilationRow {
  standardCode: string;
  specCode: string;
  marks: CompilationReaderMark[];
  hasNonCompliant: boolean;
  hasDisagreement: boolean;
  allAgree: boolean;
  finalMark: ComplianceMark | null;
  finalSetByName?: string;
  finalSetAt?: string;
  finalNote?: string;
  excluded: boolean;
  excludedReason?: string;
}

export interface CompilationPayload {
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  status: string;
  readers: CompilationReader[];
  rows: CompilationRow[];
}

export type SuggestionsExportMode = 'internal' | 'pc_facing';

export interface CompilationTabViewProps {
  data: CompilationPayload | null;
  isLoading: boolean;
  error?: string | null;
  savingKey?: string | null;
  /** Lead reader sets the Final mark for this (std, spec) pair. */
  onSetFinal: (standardCode: string, specCode: string, mark: ComplianceMark) => void;
  onClearFinal: (standardCode: string, specCode: string) => void;
  // CR-011 export
  exportMode: SuggestionsExportMode;
  onChangeExportMode: (mode: SuggestionsExportMode) => void;
  onExportSuggestions: () => void;
  exporting?: boolean;
  // CR-022 / S13c — reader assignments are locked after submit; the lead
  // reader can't reassign, so they ask an admin from here.
  lockedPhase?: boolean;
  requestState?: 'idle' | 'pending' | 'done' | 'error';
  onRequestAssignmentChange?: (reason: string) => void;
  // CR-056 — "Complete review & send to board": flips the submission to
  // review_complete so it lands in the board queue.
  onFinalizeToBoard?: () => void;
  finalizing?: boolean;
  finalizeError?: string | null;
}

/**
 * CR-056 — "Complete review & send to board".
 *
 * The board queue (admin BoardConsole) reads submissions in `review_complete`.
 * Nothing in the compilation surface advanced a submission to that
 * status, so the reader → lead-reader → board chain dead-ended here. This
 * panel gives the lead reader (or admin) the governed hand-off: a two-step
 * confirm that flips the status. Once sent, it shows the post-hand-off state.
 */
export function SendToBoardPanel({
  status,
  onFinalizeToBoard,
  finalizing = false,
  finalizeError = null,
}: {
  status: string;
  onFinalizeToBoard?: () => void;
  finalizing?: boolean;
  finalizeError?: string | null;
}): JSX.Element {
  const [confirming, setConfirming] = React.useState(false);
  const ADVANCEABLE = ['submitted', 'readers_assigned', 'under_review'];

  if (status === 'review_complete') {
    return (
      <div
        data-testid="send-to-board-done"
        className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      >
        Sent to the board — this review is in the board queue awaiting a decision.
      </div>
    );
  }
  if (status === 'compliant' || status === 'non_compliant') {
    return (
      <div
        data-testid="send-to-board-decided"
        className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
      >
        The board has recorded a decision on this self-study.
      </div>
    );
  }
  if (!ADVANCEABLE.includes(status)) {
    return <></>;
  }

  return (
    <div
      data-testid="send-to-board-box"
      className="mb-3 flex flex-wrap items-center gap-3 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900"
    >
      <span className="font-medium">
        Finished compiling? Send this review to the board for a decision.
      </span>
      {finalizeError && (
        <span data-testid="send-to-board-error" className="text-xs text-red-700">
          {finalizeError}
        </span>
      )}
      {!confirming ? (
        <button
          type="button"
          data-testid="send-to-board-open"
          onClick={() => setConfirming(true)}
          className="ml-auto inline-flex items-center gap-1 rounded bg-indigo-700 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-800"
        >
          Complete review &amp; send to board
        </button>
      ) : (
        <div className="ml-auto inline-flex items-center gap-2">
          <span className="text-xs">Send to the board now? Readers can no longer change their marks after this.</span>
          <button
            type="button"
            data-testid="send-to-board-cancel"
            onClick={() => setConfirming(false)}
            disabled={finalizing}
            className="rounded border border-indigo-300 bg-white px-3 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="send-to-board-confirm"
            onClick={() => onFinalizeToBoard?.()}
            disabled={finalizing}
            className="inline-flex items-center gap-1 rounded bg-indigo-700 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            {finalizing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            <span>{finalizing ? 'Sending…' : 'Yes, send to board'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * CR-022 / S13c — "Request change from admin" affordance.
 *
 * Rendered only in a locked phase, where the lead reader cannot reassign
 * readers directly (server returns 403). Instead of a disabled reassign
 * control, we give them a governed ask: a reason + Send. On success the box
 * confirms the admin was notified.
 */
export function AssignmentChangeRequestBox({
  requestState = 'idle',
  onRequestAssignmentChange,
}: {
  requestState?: 'idle' | 'pending' | 'done' | 'error';
  onRequestAssignmentChange?: (reason: string) => void;
}): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const pending = requestState === 'pending';

  if (requestState === 'done') {
    return (
      <div
        data-testid="assignment-change-done"
        className="mb-3 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
      >
        <Check className="h-4 w-4" aria-hidden />
        <span>Your note went to the admin. They will fix who is assigned.</span>
      </div>
    );
  }

  return (
    <div
      id="assignment-change-box"
      data-testid="assignment-change-box"
      className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
    >
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-slate-500" aria-hidden />
        <span className="font-medium">Reader list is locked.</span>
        <span className="text-slate-600">Only an admin can change who reads this self-study.</span>
        {!open && (
          <button
            type="button"
            data-testid="assignment-change-open"
            onClick={() => setOpen(true)}
            className="ml-auto inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900"
          >
            Ask admin to change readers
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <label htmlFor="assignment-change-reason" className="block text-xs font-medium text-slate-600">
            Tell the admin what to change and why
          </label>
          <textarea
            id="assignment-change-reason"
            data-testid="assignment-change-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Example: Dr. Smith should not read this one — they used to work there."
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {requestState === 'error' && (
            <p data-testid="assignment-change-error" className="text-xs text-red-700">
              That did not send. Please try again.
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="assignment-change-cancel"
              onClick={() => {
                setOpen(false);
                setReason('');
              }}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              data-testid="assignment-change-send"
              onClick={() => onRequestAssignmentChange?.(reason.trim())}
              disabled={pending || !reason.trim()}
              className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              <span>Send to admin</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function rowClasses(row: CompilationRow): string {
  if (row.excluded) return 'bg-slate-50 text-slate-500';
  if (row.hasNonCompliant) return 'bg-red-50';
  if (row.hasDisagreement) return 'bg-amber-50';
  if (row.allAgree) return 'bg-emerald-50';
  return 'bg-white';
}

export function markLabel(mark: ComplianceMark): string {
  return mark === 'compliant' ? 'Compliant' : 'Non-compliant';
}

function markChipClasses(mark: ComplianceMark): string {
  return mark === 'noncompliant'
    ? 'border-red-300 bg-red-100 text-red-900'
    : 'border-green-300 bg-green-100 text-green-900';
}

/** Two-button Compliant / Non-compliant picker for the lead's Final mark. */
function FinalMarkPicker({
  rowKey,
  value,
  saving,
  onPick,
}: {
  rowKey: string;
  value: ComplianceMark | null;
  saving: boolean;
  onPick: (mark: ComplianceMark) => void;
}): JSX.Element {
  const btn = (mark: ComplianceMark) => {
    const active = value === mark;
    const tone =
      mark === 'compliant'
        ? active
          ? 'border-green-600 bg-green-600 text-white'
          : 'border-green-300 bg-white text-green-800 hover:bg-green-50'
        : active
          ? 'border-red-600 bg-red-600 text-white'
          : 'border-red-300 bg-white text-red-800 hover:bg-red-50';
    return (
      <button
        type="button"
        id={mark === 'compliant' ? `final-compliant-${rowKey}` : undefined}
        data-testid={`compilation-final-${mark}-${rowKey}`}
        aria-pressed={active}
        disabled={saving}
        onClick={() => {
          if (!active) onPick(mark);
        }}
        className={`rounded-md border px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${tone}`}
      >
        {markLabel(mark)}
      </button>
    );
  };
  return (
    <div role="group" aria-label="Final mark" className="inline-flex items-center gap-1">
      {btn('compliant')}
      {btn('noncompliant')}
      {saving ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" aria-hidden /> : null}
    </div>
  );
}

/**
 * Entry point from the lead reader's compilation into the per-reader Reader
 * Reports. The lead reader IS a reader: this opens THEIR own Reader Report
 * checklist, and the editor there lists every assigned reader's report
 * (lead reader / admin only) so the lead reader can read each one and switch
 * the whole view between readers.
 */
function ReaderReportsLink({ submissionId }: { submissionId: string }): JSX.Element {
  return (
    <Link
      data-testid="compilation-reader-reports-link"
      to={`/reader-report/${submissionId}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
      title="Open your own Reader Report and read each assigned reader's report"
    >
      <ClipboardList className="h-4 w-4" aria-hidden />
      <span>Reader reports — mine &amp; all readers</span>
    </Link>
  );
}

export function CompilationTabView({
  data,
  isLoading,
  error,
  savingKey,
  onSetFinal,
  onClearFinal,
  exportMode,
  onChangeExportMode,
  onExportSuggestions,
  exporting,
  lockedPhase,
  requestState,
  onRequestAssignmentChange,
  onFinalizeToBoard,
  finalizing,
  finalizeError,
}: CompilationTabViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="compilation-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading compilation…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="compilation-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load compilation: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div data-testid="compilation-empty" className="m-6 rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No compilation data.
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div data-testid="compilation" className="mx-auto max-w-6xl p-6">
        <Link to="/lead-reader" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span>Back to compilations</span>
        </Link>
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{data.institutionName}</h1>
            <p className="text-sm text-slate-600">
              {data.programName} <span className="text-slate-400">·</span>{' '}
              <span className="uppercase">{data.programLevel}</span>
            </p>
          </div>
          <ReaderReportsLink submissionId={data.submissionId} />
        </header>
        {lockedPhase && (
          <AssignmentChangeRequestBox
            requestState={requestState}
            onRequestAssignmentChange={onRequestAssignmentChange}
          />
        )}
        <div data-testid="compilation-no-rows" className="rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No reader has marked a specification Compliant or Non-compliant yet.
        </div>
      </div>
    );
  }

  const readers = data.readers;

  return (
    <div data-testid="compilation" className="mx-auto max-w-6xl p-6">
      <Link to="/lead-reader" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span>Back to compilations</span>
      </Link>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{data.institutionName}</h1>
          <p className="text-sm text-slate-600">
            {data.programName} <span className="text-slate-400">·</span>{' '}
            <span className="uppercase">{data.programLevel}</span>
          </p>
        </div>
        <ReaderReportsLink submissionId={data.submissionId} />
      </header>

      {lockedPhase && (
        <AssignmentChangeRequestBox
          requestState={requestState}
          onRequestAssignmentChange={onRequestAssignmentChange}
        />
      )}

      <div data-testid="compilation-toolbar" className="mb-3 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <span className="font-medium uppercase tracking-wide text-slate-500">Suggestions doc</span>
        <fieldset className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="suggestions-mode"
              data-testid="suggestions-mode-internal"
              value="internal"
              checked={exportMode === 'internal'}
              onChange={() => onChangeExportMode('internal')}
            />
            <span>Internal (board / VP)</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="suggestions-mode"
              data-testid="suggestions-mode-pc"
              value="pc_facing"
              checked={exportMode === 'pc_facing'}
              onChange={() => onChangeExportMode('pc_facing')}
            />
            <span>PC-facing (anonymized)</span>
          </label>
        </fieldset>
        <button
          type="button"
          data-testid="suggestions-export-btn"
          onClick={onExportSuggestions}
          disabled={exporting}
          className="ml-auto inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
          <span>{exporting ? 'Generating…' : 'Generate suggestions doc'}</span>
        </button>
      </div>

      <SendToBoardPanel
        status={data.status}
        onFinalizeToBoard={onFinalizeToBoard}
        finalizing={finalizing}
        finalizeError={finalizeError}
      />

      <CompilationLegend />

      <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] table-auto text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Spec</th>
              {readers.map((r) => (
                <th key={r.id} data-testid={`compilation-reader-col-${r.id}`} className="px-3 py-2 text-left">
                  {r.name}
                </th>
              ))}
              <th className="px-3 py-2 text-left">Final mark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row) => {
              const key = `${row.standardCode}_${row.specCode}`;
              const saving = savingKey === key;
              return (
                <tr
                  key={key}
                  data-testid={`compilation-row-${key}`}
                  data-disagreement={row.hasDisagreement ? 'true' : 'false'}
                  data-noncompliant={row.hasNonCompliant ? 'true' : 'false'}
                  data-excluded={row.excluded ? 'true' : 'false'}
                  className={rowClasses(row)}
                >
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <span className="font-mono text-xs text-slate-700">
                      {row.standardCode}.{row.specCode}
                    </span>
                    {row.excluded && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                        N/A
                      </span>
                    )}
                  </td>
                  {readers.map((r) => {
                    const m = row.marks.find((s) => s.reviewerId === r.id);
                    return (
                      <td
                        key={r.id}
                        data-testid={`compilation-cell-${key}-${r.id}`}
                        className="px-3 py-2 align-top"
                      >
                        {m ? (
                          <span
                            data-mark={m.mark}
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${markChipClasses(m.mark)}`}
                          >
                            {markLabel(m.mark)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 align-top" data-testid={`compilation-final-${key}`}>
                    {row.excluded ? (
                      <span className="text-xs text-slate-500">Excluded</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <FinalMarkPicker
                          rowKey={key}
                          value={row.finalMark}
                          saving={saving}
                          onPick={(mark) => onSetFinal(row.standardCode, row.specCode, mark)}
                        />
                        {row.finalMark != null && (
                          <button
                            type="button"
                            data-testid={`compilation-final-clear-${key}`}
                            onClick={() => onClearFinal(row.standardCode, row.specCode)}
                            disabled={saving}
                            className="text-xs text-slate-600 hover:text-slate-900 underline disabled:opacity-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                    {row.finalSetByName && row.finalMark != null && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Set by {row.finalSetByName}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompilationLegend(): JSX.Element {
  return (
    <div data-testid="compilation-legend" className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-red-300 bg-red-50" />
        Any reader marked Non-compliant
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-50" />
        Disagreement
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-emerald-300 bg-emerald-50" />
        All agree
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-slate-300 bg-slate-50" />
        Excluded (N/A)
      </span>
    </div>
  );
}

export interface CompilationTabProps {
  submissionId: string;
}

export function CompilationTab({ submissionId }: CompilationTabProps): JSX.Element {
  const qc = useQueryClient();
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [exportMode, setExportMode] = React.useState<SuggestionsExportMode>('internal');
  const [exporting, setExporting] = React.useState<boolean>(false);
  const [requestState, setRequestState] = React.useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [finalizing, setFinalizing] = React.useState<boolean>(false);
  const [finalizeError, setFinalizeError] = React.useState<string | null>(null);
  const { fireOnce } = useOnceHint();

  const compilationQuery = useQuery({
    queryKey: ['compilation', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/compilation`);
      return r.data as CompilationPayload;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['compilation', submissionId] });
  };

  // CR-052 / Sprint 9.3 — first time the compilation table is on screen,
  // nudge the lead reader on what the Final mark means. Anchored to the first
  // row's Compliant button, which is committed to the DOM once rows load.
  const firstOpenRow = compilationQuery.data?.rows.find((r) => !r.excluded);
  const firstRowKey = firstOpenRow ? `${firstOpenRow.standardCode}_${firstOpenRow.specCode}` : null;
  React.useEffect(() => {
    if (!firstRowKey) return;
    fireOnce({
      id: 'compilation-first-final',
      message: t('hint.compilation.firstFinal'),
      targetId: `final-compliant-${firstRowKey}`,
    });
  }, [firstRowKey, fireOnce]);

  const setFinal = useMutation({
    mutationFn: async (vars: { standardCode: string; specCode: string; mark: ComplianceMark }) => {
      setSavingKey(`${vars.standardCode}_${vars.specCode}`);
      return api.put(`/api/submissions/${submissionId}/compilation/final-mark`, vars);
    },
    onSettled: () => {
      setSavingKey(null);
      invalidate();
      // A Final mark changes the site-visit checklist (Non-compliant adds it).
      void qc.invalidateQueries({ queryKey: ['site-visit-checklist', submissionId] });
    },
  });

  const clearFinal = useMutation({
    mutationFn: async (vars: { standardCode: string; specCode: string }) => {
      setSavingKey(`${vars.standardCode}_${vars.specCode}`);
      return api.delete(`/api/submissions/${submissionId}/compilation/final-mark`, {
        data: vars,
      });
    },
    onSettled: () => {
      setSavingKey(null);
      invalidate();
      void qc.invalidateQueries({ queryKey: ['site-visit-checklist', submissionId] });
    },
  });

  const onSetFinal = (standardCode: string, specCode: string, mark: ComplianceMark) => {
    setFinal.mutate({ standardCode, specCode, mark });
  };

  const onClearFinal = (standardCode: string, specCode: string) => {
    clearFinal.mutate({ standardCode, specCode });
  };

  // CR-022 / S13c — once a self-study is locked, lead readers cannot reassign
  // readers (server 403s the assign call). The compilation surface only ever
  // loads at status >= submitted, so it is always a "locked phase" here, but
  // we compute it explicitly to keep the affordance honest.
  const LOCKED_STATUSES = ['submitted', 'under_review', 'readers_assigned', 'review_complete', 'compliant', 'non_compliant'];
  const lockedPhase = !!compilationQuery.data && LOCKED_STATUSES.includes(compilationQuery.data.status);

  // CR-052 / Sprint 12.3 — first time the locked-phase "ask admin to change
  // readers" box is on screen, nudge the lead reader on why reassignment is
  // not theirs to do and what the box is for. The box (`assignment-change-box`)
  // is rendered whenever `lockedPhase` is true, so the anchor is present.
  React.useEffect(() => {
    if (!lockedPhase) return;
    fireOnce({
      id: 'assignment-first-request',
      message: t('hint.assignment.firstRequest'),
      targetId: 'assignment-change-box',
    });
  }, [lockedPhase, fireOnce]);

  const onRequestAssignmentChange = async (reason: string) => {
    if (!reason) return;
    setRequestState('pending');
    try {
      await api.post(`/api/reviews/submissions/${submissionId}/request-assignment-change`, { reason });
      setRequestState('done');
    } catch (err) {
      console.error('Request assignment change failed', err);
      setRequestState('error');
    }
  };

  // CR-056 — lead-reader "Complete review & send to board": flip the
  // submission to review_complete so it lands in the board queue. Server
  // gates lead/admin + advanceable status; we surface its errors inline.
  const onFinalizeToBoard = async () => {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      await api.post(`/api/submissions/${submissionId}/compilation/finalize`);
      invalidate();
      void qc.invalidateQueries({ queryKey: ['board', 'queue'] });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        'Failed to send review to the board';
      setFinalizeError(msg);
    } finally {
      setFinalizing(false);
    }
  };

  const onExportSuggestions = async () => {
    setExporting(true);
    try {
      const resp = await api.get(
        `/api/submissions/${submissionId}/compilation/suggestions-doc`,
        { params: { mode: exportMode }, responseType: 'blob' }
      );
      const blob = resp.data instanceof Blob
        ? resp.data
        : new Blob([resp.data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeInst = (compilationQuery.data?.institutionName || 'submission').replace(/[^a-z0-9_.-]+/gi, '_');
      a.href = url;
      a.download = `suggestions_${safeInst}_${exportMode}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Suggestions export failed', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <CompilationTabView
      data={compilationQuery.data ?? null}
      isLoading={compilationQuery.isLoading}
      error={compilationQuery.error ? (compilationQuery.error as Error).message : null}
      savingKey={savingKey}
      onSetFinal={onSetFinal}
      onClearFinal={onClearFinal}
      exportMode={exportMode}
      onChangeExportMode={(m) => setExportMode(m)}
      onExportSuggestions={onExportSuggestions}
      exporting={exporting}
      lockedPhase={lockedPhase}
      requestState={requestState}
      onRequestAssignmentChange={onRequestAssignmentChange}
      onFinalizeToBoard={onFinalizeToBoard}
      finalizing={finalizing}
      finalizeError={finalizeError}
    />
  );
}

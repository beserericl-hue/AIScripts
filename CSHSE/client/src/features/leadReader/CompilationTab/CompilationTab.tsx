import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, ChevronLeft, Check, X, FileDown, Lock, Send, ClipboardList } from 'lucide-react';
import { api } from '../../../services/api';
import { Score4LevelSelector, SCORE_LEVELS } from '../../reader/Score4LevelSelector';
import type { ScoreValue } from '../../reader/Score4LevelSelector';
import { useOnceHint } from '../../tour/useOnceHint';
import { t } from '../../../i18n/strings';

// ---------------------------------------------------------------------------
// CR-009 / Sprint 5.1 — Compilation tab (lead reader side-by-side).
//
// All readers' 0-3 scores per (std, spec) side-by-side, with row
// highlighting per the CR spec:
//   - red    when ANY reader scored 0 (Non)
//   - yellow when at least two reader scores differ (disagreement)
//   - green  when all readers agree
//   - muted  when the spec is excluded (CR-050 N/A)
//
// The lead reader stamps a Final score per spec inline. The Final
// score endpoint is audit-logged server-side (compilation.final_set).
//
// View / container split: CompilationTabView is presentational and gets
// unit-tested in isolation; the container wires queries/mutations.
// ---------------------------------------------------------------------------

export interface CompilationReader {
  id: string;
  name: string;
}

export interface CompilationReaderVote {
  reviewerId: string;
  reviewerName: string;
  score: number;
}

export interface CompilationRow {
  standardCode: string;
  specCode: string;
  scores: CompilationReaderVote[];
  hasZero: boolean;
  hasDisagreement: boolean;
  allAgree: boolean;
  finalScore: number | null;
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
  editingKey?: string | null;
  pendingFinalScore?: ScoreValue | null;
  savingKey?: string | null;
  /** Lead reader opens the inline editor for this (std, spec) pair. */
  onBeginEdit: (standardCode: string, specCode: string, current: number | null) => void;
  onCancelEdit: () => void;
  onChangePendingFinal: (next: ScoreValue) => void;
  onSaveFinal: (standardCode: string, specCode: string) => void;
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
 * Nothing in the Score-based compilation surface advanced a submission to that
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
          <span className="text-xs">Send to the board now? Readers can no longer change scores after this.</span>
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
  if (row.hasZero) return 'bg-red-50';
  if (row.hasDisagreement) return 'bg-amber-50';
  if (row.allAgree) return 'bg-emerald-50';
  return 'bg-white';
}

function scoreLabel(value: number): string {
  const lvl = SCORE_LEVELS.find((l) => l.value === value);
  return lvl ? `${value} ${lvl.label}` : String(value);
}

function scoreChipClasses(value: number): string {
  if (value === 0) return 'border-red-300 bg-red-100 text-red-900';
  if (value === 1) return 'border-amber-300 bg-amber-100 text-amber-900';
  if (value === 2) return 'border-lime-300 bg-lime-100 text-lime-900';
  return 'border-green-300 bg-green-100 text-green-900';
}

/**
 * Entry point from the lead reader's compilation into the per-reader Reader
 * Reports. The lead reader IS a reader: this opens THEIR own Reader Report
 * checklist, and the editor there lists every assigned reader's report
 * (lead reader / admin only) so the lead reader can read each one and switch
 * the whole view between readers. Score-based compilation never surfaced this.
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
  editingKey,
  pendingFinalScore,
  savingKey,
  onBeginEdit,
  onCancelEdit,
  onChangePendingFinal,
  onSaveFinal,
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
          No reader scores have been submitted yet.
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
              <th className="px-3 py-2 text-left">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row) => {
              const key = `${row.standardCode}_${row.specCode}`;
              const editing = editingKey === key;
              const saving = savingKey === key;
              return (
                <tr
                  key={key}
                  data-testid={`compilation-row-${key}`}
                  data-disagreement={row.hasDisagreement ? 'true' : 'false'}
                  data-haszero={row.hasZero ? 'true' : 'false'}
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
                    const vote = row.scores.find((s) => s.reviewerId === r.id);
                    return (
                      <td
                        key={r.id}
                        data-testid={`compilation-cell-${key}-${r.id}`}
                        className="px-3 py-2 align-top"
                      >
                        {vote ? (
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${scoreChipClasses(vote.score)}`}
                          >
                            {scoreLabel(vote.score)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 align-top">
                    {row.excluded ? (
                      <span className="text-xs text-slate-500">Excluded</span>
                    ) : editing ? (
                      <div data-testid={`compilation-final-editor-${key}`} className="space-y-2">
                        <Score4LevelSelector
                          value={pendingFinalScore ?? null}
                          onChange={onChangePendingFinal}
                          saving={saving}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            data-testid={`compilation-final-cancel-${key}`}
                            onClick={onCancelEdit}
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <X className="h-3 w-3" aria-hidden />
                            <span>Cancel</span>
                          </button>
                          <button
                            type="button"
                            id={`final-save-${key}`}
                            data-testid={`compilation-final-save-${key}`}
                            onClick={() => onSaveFinal(row.standardCode, row.specCode)}
                            disabled={saving || pendingFinalScore == null}
                            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            <span>Save final</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {row.finalScore != null ? (
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${scoreChipClasses(row.finalScore)}`}
                          >
                            {scoreLabel(row.finalScore)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">— not set</span>
                        )}
                        <button
                          type="button"
                          data-testid={`compilation-final-edit-${key}`}
                          onClick={() => onBeginEdit(row.standardCode, row.specCode, row.finalScore)}
                          className="text-xs text-slate-600 hover:text-slate-900 underline"
                        >
                          {row.finalScore != null ? 'Change' : 'Set'}
                        </button>
                        {row.finalScore != null && (
                          <button
                            type="button"
                            data-testid={`compilation-final-clear-${key}`}
                            onClick={() => onClearFinal(row.standardCode, row.specCode)}
                            disabled={saving}
                            className="text-xs text-red-700 hover:text-red-900 underline disabled:opacity-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                    {row.finalSetByName && row.finalScore != null && !editing && (
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
        Any reader scored 0
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
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [pendingFinal, setPendingFinal] = React.useState<ScoreValue | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [exportMode, setExportMode] = React.useState<SuggestionsExportMode>('internal');
  const [exporting, setExporting] = React.useState<boolean>(false);
  const [requestState, setRequestState] = React.useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [finalizing, setFinalizing] = React.useState<boolean>(false);
  const [finalizeError, setFinalizeError] = React.useState<string | null>(null);
  const { fireOnce } = useOnceHint();

  // CR-052 / Sprint 9.3 — first time the lead reader opens the Final-score
  // editor, nudge them on what the Final score means. Fired from an effect so
  // the save button (the anchor) is committed to the DOM before we measure it.
  React.useEffect(() => {
    if (!editingKey) return;
    fireOnce({
      id: 'compilation-first-final',
      message: t('hint.compilation.firstFinal'),
      targetId: `final-save-${editingKey}`,
    });
  }, [editingKey, fireOnce]);

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

  const setFinal = useMutation({
    mutationFn: async (vars: { standardCode: string; specCode: string; score: ScoreValue }) => {
      setSavingKey(`${vars.standardCode}_${vars.specCode}`);
      return api.put(`/api/submissions/${submissionId}/compilation/final-score`, vars);
    },
    onSettled: () => {
      setSavingKey(null);
      setEditingKey(null);
      setPendingFinal(null);
      invalidate();
    },
  });

  const clearFinal = useMutation({
    mutationFn: async (vars: { standardCode: string; specCode: string }) => {
      setSavingKey(`${vars.standardCode}_${vars.specCode}`);
      return api.delete(`/api/submissions/${submissionId}/compilation/final-score`, {
        data: vars,
      });
    },
    onSettled: () => {
      setSavingKey(null);
      invalidate();
    },
  });

  const onBeginEdit = (standardCode: string, specCode: string, current: number | null) => {
    setEditingKey(`${standardCode}_${specCode}`);
    setPendingFinal((current as ScoreValue) ?? null);
  };

  const onCancelEdit = () => {
    setEditingKey(null);
    setPendingFinal(null);
  };

  const onSaveFinal = (standardCode: string, specCode: string) => {
    if (pendingFinal == null) return;
    setFinal.mutate({ standardCode, specCode, score: pendingFinal });
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
      editingKey={editingKey}
      pendingFinalScore={pendingFinal}
      savingKey={savingKey}
      onBeginEdit={onBeginEdit}
      onCancelEdit={onCancelEdit}
      onChangePendingFinal={(next) => setPendingFinal(next)}
      onSaveFinal={onSaveFinal}
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

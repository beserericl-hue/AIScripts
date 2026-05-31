import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, Check, X, Clock, AlertTriangle, Ban } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-053 / Sprint 7.1 — Admin Board Console.
//
// One screen with two columns:
//   - Queue: submissions in `review_complete` with no decision yet
//   - Upcoming: re-accreditation expiries + tabled decisions inside a window
//
// Inline decision form on the queue card (outcome + comments + optional
// reconsiderAt for table + optional effectiveAt/expiresAt for accept).
// Admin only — server enforces too.
// ---------------------------------------------------------------------------

export type BoardOutcome = 'accept' | 'table' | 'deny' | 'suspend' | 'revoke';

const OUTCOME_META: Record<BoardOutcome, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  accept: { label: 'Accept', cls: 'bg-green-100 text-green-900 border-green-300', Icon: Check },
  table: { label: 'Table', cls: 'bg-amber-100 text-amber-900 border-amber-300', Icon: Clock },
  deny: { label: 'Deny', cls: 'bg-red-100 text-red-900 border-red-300', Icon: X },
  suspend: { label: 'Suspend', cls: 'bg-orange-100 text-orange-900 border-orange-300', Icon: AlertTriangle },
  revoke: { label: 'Revoke', cls: 'bg-red-200 text-red-900 border-red-400', Icon: Ban },
};

export interface QueueRow {
  _id: string;
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: string;
  updatedAt?: string;
}

export interface UpcomingRow {
  _id: string;
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: string;
  expiresAt?: string;
  reconsiderAt?: string;
}

export interface UpcomingPayload {
  withinDays: number;
  horizon: string;
  expiring: UpcomingRow[];
  tabled: UpcomingRow[];
}

export interface BoardConsoleViewProps {
  queue: QueueRow[];
  upcoming: UpcomingPayload | null;
  isLoading: boolean;
  error?: string | null;
  drafts: Record<string, { outcome: BoardOutcome; comments: string; reconsiderAt?: string; effectiveAt?: string; expiresAt?: string }>;
  setDraft: (id: string, patch: Partial<{ outcome: BoardOutcome; comments: string; reconsiderAt: string; effectiveAt: string; expiresAt: string }>) => void;
  onRecord: (id: string) => void;
  savingId?: string | null;
}

export function BoardConsoleView({
  queue,
  upcoming,
  isLoading,
  error,
  drafts,
  setDraft,
  onRecord,
  savingId,
}: BoardConsoleViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="board-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading board console…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="board-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load: {error}
      </div>
    );
  }

  return (
    <div data-testid="board-console" className="mx-auto max-w-6xl p-6">
      <header className="mb-4 border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Board console</h1>
        <p className="text-sm text-slate-600">
          Review-complete submissions awaiting a decision · upcoming re-accreditation cycles
        </p>
      </header>

      <section data-testid="board-queue-section" className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Awaiting decision ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <p data-testid="board-queue-empty" className="rounded border border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
            No submissions are waiting for a board decision.
          </p>
        ) : (
          <ul className="space-y-3">
            {queue.map((row) => {
              const d = drafts[row._id] || { outcome: 'accept', comments: '' };
              const saving = savingId === row._id;
              return (
                <li
                  key={row._id}
                  data-testid={`board-row-${row._id}`}
                  className="rounded border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <header className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium text-slate-900">{row.institutionName}</h3>
                    <span className="text-xs text-slate-500">
                      {row.programName} · <span className="uppercase">{row.programLevel}</span> · {row.submissionId}
                    </span>
                  </header>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
                    <label className="text-xs text-slate-700">
                      Outcome
                      <select
                        data-testid={`board-outcome-${row._id}`}
                        value={d.outcome}
                        onChange={(e) => setDraft(row._id, { outcome: e.target.value as BoardOutcome })}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        {(Object.keys(OUTCOME_META) as BoardOutcome[]).map((k) => (
                          <option key={k} value={k}>
                            {OUTCOME_META[k].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-slate-700">
                      Comments
                      <input
                        data-testid={`board-comments-${row._id}`}
                        value={d.comments}
                        onChange={(e) => setDraft(row._id, { comments: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </label>
                  </div>
                  {d.outcome === 'table' && (
                    <label className="mt-2 block text-xs text-slate-700">
                      Reconsider on
                      <input
                        type="date"
                        data-testid={`board-reconsider-${row._id}`}
                        value={d.reconsiderAt || ''}
                        onChange={(e) => setDraft(row._id, { reconsiderAt: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </label>
                  )}
                  {d.outcome === 'accept' && (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="text-xs text-slate-700">
                        Effective on (optional)
                        <input
                          type="date"
                          data-testid={`board-effective-${row._id}`}
                          value={d.effectiveAt || ''}
                          onChange={(e) => setDraft(row._id, { effectiveAt: e.target.value })}
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-700">
                        Expires on (optional; default +7y)
                        <input
                          type="date"
                          data-testid={`board-expires-${row._id}`}
                          value={d.expiresAt || ''}
                          onChange={(e) => setDraft(row._id, { expiresAt: e.target.value })}
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                    </div>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      data-testid={`board-record-${row._id}`}
                      onClick={() => onRecord(row._id)}
                      disabled={saving || !d.comments.trim()}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      <span>Record decision</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section data-testid="board-upcoming-section">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Upcoming cycles ({upcoming ? upcoming.expiring.length + upcoming.tabled.length : 0})
        </h2>
        {!upcoming || (upcoming.expiring.length === 0 && upcoming.tabled.length === 0) ? (
          <p data-testid="board-upcoming-empty" className="rounded border border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
            No re-accreditation cycles or tabled decisions in the next {upcoming?.withinDays ?? 365} days.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.expiring.map((r) => (
              <li
                key={`exp-${r._id}`}
                data-testid={`board-upcoming-exp-${r._id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <span>
                  <span className="font-medium">{r.institutionName}</span>
                  <span className="text-slate-500"> · {r.programName} · {r.programLevel.toUpperCase()}</span>
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-900">
                  Expires {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
            {upcoming.tabled.map((r) => (
              <li
                key={`tab-${r._id}`}
                data-testid={`board-upcoming-tab-${r._id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <span>
                  <span className="font-medium">{r.institutionName}</span>
                  <span className="text-slate-500"> · {r.programName} · {r.programLevel.toUpperCase()}</span>
                </span>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900">
                  Reconsider {r.reconsiderAt ? new Date(r.reconsiderAt).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function BoardConsole(): JSX.Element {
  const qc = useQueryClient();
  const [drafts, setDrafts] = React.useState<Record<string, any>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const queueQ = useQuery({
    queryKey: ['board-queue'],
    queryFn: async () => {
      const r = await api.get('/api/board/queue');
      return (r.data?.submissions || []) as QueueRow[];
    },
    refetchOnWindowFocus: false,
  });
  const upcomingQ = useQuery({
    queryKey: ['board-upcoming'],
    queryFn: async () => {
      const r = await api.get('/api/board/upcoming-reaccreditations', { params: { withinDays: 365 } });
      return r.data as UpcomingPayload;
    },
    refetchOnWindowFocus: false,
  });

  const setDraft = (id: string, patch: any) =>
    setDrafts((prev) => ({ ...prev, [id]: { outcome: 'accept', comments: '', ...prev[id], ...patch } }));

  const record = useMutation({
    mutationFn: async (id: string) => {
      const d = drafts[id];
      setSavingId(id);
      return api.post(`/api/submissions/${id}/decision`, d);
    },
    onSettled: () => {
      setSavingId(null);
      void qc.invalidateQueries({ queryKey: ['board-queue'] });
      void qc.invalidateQueries({ queryKey: ['board-upcoming'] });
    },
  });

  return (
    <BoardConsoleView
      queue={queueQ.data || []}
      upcoming={upcomingQ.data ?? null}
      isLoading={queueQ.isLoading || upcomingQ.isLoading}
      error={
        queueQ.error
          ? (queueQ.error as Error).message
          : upcomingQ.error
            ? (upcomingQ.error as Error).message
            : null
      }
      drafts={drafts}
      setDraft={setDraft}
      onRecord={(id) => record.mutate(id)}
      savingId={savingId}
    />
  );
}

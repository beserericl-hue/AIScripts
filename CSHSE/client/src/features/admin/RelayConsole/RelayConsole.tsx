import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, Send, Undo2, Flag, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-023 — Julia / board Relay Console.
//
// Lists comments awaiting relay (and any board-escalated ones) for a
// submission. Each card lets the lead reader (or admin / Julia) sanitize
// the relayed text, set a pseudonym (`pcLabel`), and ship it to the PC.
// Un-relay and escalate are surfaced too — the three transitions that
// CR-004 + CR-023's server endpoints support.
//
// This is intentionally a thin admin tool; the heavy redaction logic
// lives server-side in commentSerializer + the relay endpoints. The UI
// here is the cursor for those endpoints, not a parallel implementation.
// ---------------------------------------------------------------------------

export interface RelayQueueComment {
  _id: string;
  submissionId: string;
  standardCode: string;
  specCode?: string | null;
  authorName: string;
  authorRole: 'reader' | 'lead_reader';
  selectedText: string;
  content: string;
  relayed?: boolean;
  relayedText?: string;
  pcLabel?: string;
  boardEscalated?: boolean;
  createdAt?: string;
}

export interface RelayConsoleViewProps {
  comments: RelayQueueComment[];
  isLoading: boolean;
  error?: string | null;
  draftsByComment: Record<string, { relayedText: string; pcLabel: string; reason: string }>;
  setDraft: (id: string, patch: { relayedText?: string; pcLabel?: string; reason?: string }) => void;
  savingId?: string | null;
  onRelay: (id: string) => void;
  onUnrelay: (id: string) => void;
  onEscalate: (id: string) => void;
}

export function RelayConsoleView({
  comments,
  isLoading,
  error,
  draftsByComment,
  setDraft,
  savingId,
  onRelay,
  onUnrelay,
  onEscalate,
}: RelayConsoleViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="relay-console-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading relay queue…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="relay-console-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load relay queue: {error}
      </div>
    );
  }
  if (!comments.length) {
    return (
      <div data-testid="relay-console-empty" className="m-6 rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No comments awaiting relay or board escalation.
      </div>
    );
  }
  return (
    <div data-testid="relay-console" className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Relay queue</h2>
        <span className="text-xs text-slate-500">
          {comments.length} comment{comments.length === 1 ? '' : 's'}
        </span>
      </header>
      {comments.map((c) => {
        const d = draftsByComment[c._id] || { relayedText: c.relayedText || c.content || '', pcLabel: c.pcLabel || '', reason: '' };
        const isSaving = savingId === c._id;
        return (
          <article
            key={c._id}
            data-testid={`relay-card-${c._id}`}
            className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"
          >
            <header className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                Standard {c.standardCode}
                {c.specCode ? `.${c.specCode}` : ''} <span className="text-slate-400">·</span>{' '}
                <span className="text-slate-700">{c.authorName}</span>
              </p>
              <div className="flex items-center gap-1">
                {c.boardEscalated && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Escalated</span>
                )}
                {c.relayed && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">Relayed</span>
                )}
              </div>
            </header>
            <p className="mb-2 text-xs text-slate-600">
              <span className="italic">"{c.selectedText}"</span>
            </p>
            <div className="rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-800">{c.content}</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-700">
                PC pseudonym
                <input
                  data-testid={`relay-pcLabel-${c._id}`}
                  value={d.pcLabel}
                  onChange={(e) => setDraft(c._id, { pcLabel: e.target.value })}
                  placeholder="Reader A (optional)"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs text-slate-700">
                Audit reason
                <input
                  data-testid={`relay-reason-${c._id}`}
                  value={d.reason}
                  onChange={(e) => setDraft(c._id, { reason: e.target.value })}
                  placeholder="Why this is OK to share"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-slate-700">
              Sanitized text the PC will see
              <textarea
                data-testid={`relay-text-${c._id}`}
                value={d.relayedText}
                onChange={(e) => setDraft(c._id, { relayedText: e.target.value })}
                rows={3}
                placeholder="Leave blank to use the original content verbatim"
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              {c.relayed ? (
                <button
                  type="button"
                  data-testid={`relay-unrelay-${c._id}`}
                  disabled={isSaving}
                  onClick={() => onUnrelay(c._id)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Undo2 className="h-3 w-3" aria-hidden />
                  <span>Un-relay</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid={`relay-escalate-${c._id}`}
                  disabled={isSaving}
                  onClick={() => onEscalate(c._id)}
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  <Flag className="h-3 w-3" aria-hidden />
                  <span>Escalate</span>
                </button>
              )}
              <button
                type="button"
                data-testid={`relay-send-${c._id}`}
                disabled={isSaving}
                onClick={() => onRelay(c._id)}
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                <span>{c.relayed ? 'Update relay' : 'Relay to PC'}</span>
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export interface RelayConsoleProps {
  submissionId: string;
}

export function RelayConsole({ submissionId }: RelayConsoleProps): JSX.Element {
  const qc = useQueryClient();
  const [drafts, setDrafts] = React.useState<Record<string, { relayedText: string; pcLabel: string; reason: string }>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['relay-queue', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/comments/relay-queue`);
      return (r.data?.comments || []) as RelayQueueComment[];
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  const setDraft = React.useCallback(
    (id: string, patch: { relayedText?: string; pcLabel?: string; reason?: string }) => {
      setDrafts((prev) => ({
        ...prev,
        [id]: { relayedText: '', pcLabel: '', reason: '', ...prev[id], ...patch },
      }));
    },
    []
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['relay-queue', submissionId] });
  };

  const relay = useMutation({
    mutationFn: async (id: string) => {
      const d = drafts[id] || { relayedText: '', pcLabel: '', reason: '' };
      setSavingId(id);
      return api.post(`/api/comments/${id}/relay`, {
        relayedText: d.relayedText || undefined,
        pcLabel: d.pcLabel || undefined,
        reason: d.reason || undefined,
      });
    },
    onSettled: () => {
      setSavingId(null);
      invalidate();
    },
  });

  const unrelay = useMutation({
    mutationFn: async (id: string) => {
      setSavingId(id);
      return api.delete(`/api/comments/${id}/relay`);
    },
    onSettled: () => {
      setSavingId(null);
      invalidate();
    },
  });

  const escalate = useMutation({
    mutationFn: async (id: string) => {
      const d = drafts[id] || { reason: '' };
      setSavingId(id);
      return api.post(`/api/comments/${id}/escalate`, { reason: d.reason || undefined });
    },
    onSettled: () => {
      setSavingId(null);
      invalidate();
    },
  });

  return (
    <RelayConsoleView
      comments={queueQuery.data || []}
      isLoading={queueQuery.isLoading}
      error={queueQuery.error ? (queueQuery.error as Error).message : null}
      draftsByComment={drafts}
      setDraft={setDraft}
      savingId={savingId}
      onRelay={(id) => relay.mutate(id)}
      onUnrelay={(id) => unrelay.mutate(id)}
      onEscalate={(id) => escalate.mutate(id)}
    />
  );
}

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, Send, MessageSquare } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-010 / Sprint 5.4 — Messages tab for reader / lead-reader.
//
// Minimal first surface: list of threads on the current submission +
// inline thread reader / composer. PCs never see this (server 403s; the
// nav link is also hidden via the role gate in the parent route, but the
// server is the source of truth).
//
// Container loads the threads via /api/submissions/:id/messages; opens a
// thread inline via /api/messages/:threadId.
// ---------------------------------------------------------------------------

export interface DmThread {
  _id: string;
  subject: string;
  participantIds: string[];
  createdByName: string;
  lastMessageAt: string;
  contextStandardCode?: string;
  contextSpecCode?: string;
}

export interface DmMessage {
  _id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: 'reader' | 'lead_reader' | 'admin';
  content: string;
  createdAt: string;
}

export interface MessagesViewProps {
  threads: DmThread[];
  isLoading: boolean;
  error?: string | null;
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  messages: DmMessage[];
  threadLoading: boolean;
  draft: string;
  onChangeDraft: (next: string) => void;
  onPost: () => void;
  posting?: boolean;
}

export function MessagesView({
  threads,
  isLoading,
  error,
  selectedThreadId,
  onSelectThread,
  messages,
  threadLoading,
  draft,
  onChangeDraft,
  onPost,
  posting,
}: MessagesViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="messages-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading conversations…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="messages-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load conversations: {error}
      </div>
    );
  }

  return (
    <div data-testid="messages-shell" className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[260px_1fr]">
      <aside className="rounded border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-800">Conversations</h2>
          <span className="text-xs text-slate-500">{threads.length}</span>
        </header>
        {threads.length === 0 ? (
          <div data-testid="messages-empty" className="p-6 text-center text-xs text-slate-500">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 text-slate-400" aria-hidden />
            No conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {threads.map((t) => {
              const active = selectedThreadId === t._id;
              return (
                <li key={t._id}>
                  <button
                    type="button"
                    data-testid={`thread-${t._id}`}
                    onClick={() => onSelectThread(t._id)}
                    className={[
                      'w-full px-3 py-2 text-left text-xs hover:bg-slate-50',
                      active ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700',
                    ].join(' ')}
                  >
                    <p className="truncate">{t.subject}</p>
                    {t.contextStandardCode && t.contextSpecCode && (
                      <p className="text-[10px] text-slate-500">
                        Re: Standard {t.contextStandardCode}.{t.contextSpecCode}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section data-testid="thread-pane" className="flex h-[420px] flex-col rounded border border-slate-200 bg-white">
        {!selectedThreadId ? (
          <div data-testid="thread-pane-empty" className="flex flex-1 items-center justify-center p-6 text-xs text-slate-500">
            Select a conversation to view messages.
          </div>
        ) : threadLoading ? (
          <div data-testid="thread-pane-loading" className="flex flex-1 items-center justify-center p-6 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading messages…
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((m) => (
                <article
                  key={m._id}
                  data-testid={`message-${m._id}`}
                  className="rounded border border-slate-100 bg-slate-50 p-2 text-xs"
                >
                  <header className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-slate-800">{m.senderName}</span>
                    <span className="text-[10px] text-slate-500">{new Date(m.createdAt).toLocaleString()}</span>
                  </header>
                  <p className="whitespace-pre-wrap text-slate-800">{m.content}</p>
                </article>
              ))}
            </div>
            <form
              className="flex items-end gap-2 border-t border-slate-200 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                onPost();
              }}
            >
              <textarea
                data-testid="thread-composer"
                value={draft}
                onChange={(e) => onChangeDraft(e.target.value)}
                rows={2}
                placeholder="Write a reply…"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                disabled={posting}
              />
              <button
                type="submit"
                data-testid="thread-send"
                disabled={posting || !draft.trim()}
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                <span>Send</span>
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export interface MessagesProps {
  submissionId: string;
}

export function Messages({ submissionId }: MessagesProps): JSX.Element {
  const qc = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');

  const threadsQuery = useQuery({
    queryKey: ['dm-threads', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/messages`);
      return (r.data?.threads || []) as DmThread[];
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  const threadQuery = useQuery({
    queryKey: ['dm-thread', selectedThreadId],
    queryFn: async () => {
      const r = await api.get(`/api/messages/${selectedThreadId}`);
      return {
        thread: r.data.thread as DmThread,
        messages: (r.data.messages || []) as DmMessage[],
      };
    },
    enabled: !!selectedThreadId,
    refetchOnWindowFocus: false,
  });

  const postMutation = useMutation({
    mutationFn: async (text: string) => {
      return api.post(`/api/messages/${selectedThreadId}`, { message: text });
    },
    onSuccess: () => {
      setDraft('');
      void qc.invalidateQueries({ queryKey: ['dm-thread', selectedThreadId] });
      void qc.invalidateQueries({ queryKey: ['dm-threads', submissionId] });
    },
  });

  return (
    <MessagesView
      threads={threadsQuery.data || []}
      isLoading={threadsQuery.isLoading}
      error={threadsQuery.error ? (threadsQuery.error as Error).message : null}
      selectedThreadId={selectedThreadId}
      onSelectThread={(id) => setSelectedThreadId(id)}
      messages={threadQuery.data?.messages || []}
      threadLoading={!!selectedThreadId && threadQuery.isLoading}
      draft={draft}
      onChangeDraft={setDraft}
      onPost={() => {
        if (!draft.trim() || !selectedThreadId) return;
        postMutation.mutate(draft.trim());
      }}
      posting={postMutation.isPending}
    />
  );
}

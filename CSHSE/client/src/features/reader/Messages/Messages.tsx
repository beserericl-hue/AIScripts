import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, Send, MessageSquare, Plus, X } from 'lucide-react';
import { useOnceHint } from '../../tour/useOnceHint';
import { t } from '../../../i18n/strings';

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

export interface DmRecipient {
  _id: string;
  name: string;
  role: 'reader' | 'lead_reader';
}

export interface NewMessageDraft {
  recipientIds: string[];
  subject: string;
  message: string;
}

export interface MessagesViewProps {
  /** People on this submission's review team the user can write to. */
  recipients?: DmRecipient[];
  /** Open/closed state of the New message form (null = closed). */
  newDraft?: NewMessageDraft | null;
  onOpenNew?: () => void;
  onChangeNew?: (next: NewMessageDraft | null) => void;
  onSendNew?: () => void;
  sendingNew?: boolean;
  newError?: string | null;
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
  recipients = [],
  newDraft = null,
  onOpenNew,
  onChangeNew,
  onSendNew,
  sendingNew,
  newError,
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
        <header
          id="messages-conversations-header"
          className="flex items-center justify-between border-b border-slate-200 px-3 py-2"
        >
          <h2 className="text-sm font-semibold text-slate-800">
            Conversations <span className="text-xs font-normal text-slate-500">{threads.length}</span>
          </h2>
          {onOpenNew && (
            <button
              type="button"
              data-testid="messages-new"
              onClick={onOpenNew}
              className="inline-flex items-center gap-1 rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700"
            >
              <Plus className="h-3 w-3" /> New message
            </button>
          )}
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
        {newDraft ? (
          <form
            data-testid="messages-new-form"
            className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              onSendNew?.();
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">New message</h3>
              <button type="button" aria-label="Cancel new message" data-testid="messages-new-cancel" onClick={() => onChangeNew?.(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <fieldset>
              <legend className="mb-1 font-medium text-slate-700">To</legend>
              {recipients.length === 0 ? (
                <p data-testid="messages-new-no-recipients" className="text-slate-500">No one else is on this review team yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recipients.map((r) => {
                    const on = newDraft.recipientIds.includes(r._id);
                    return (
                      <label key={r._id} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 ${on ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-300 text-slate-700'}`}>
                        <input
                          type="checkbox"
                          data-testid={`messages-new-to-${r._id}`}
                          checked={on}
                          onChange={() =>
                            onChangeNew?.({
                              ...newDraft,
                              recipientIds: on ? newDraft.recipientIds.filter((x) => x !== r._id) : [...newDraft.recipientIds, r._id],
                            })
                          }
                          className="h-3 w-3"
                        />
                        {r.name}
                        <span className="text-[10px] text-slate-500">{r.role === 'lead_reader' ? 'Lead reader' : 'Reader'}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
            <input
              data-testid="messages-new-subject"
              value={newDraft.subject}
              onChange={(e) => onChangeNew?.({ ...newDraft, subject: e.target.value })}
              placeholder="Subject"
              className="rounded border border-slate-300 px-2 py-1"
              disabled={sendingNew}
            />
            <textarea
              data-testid="messages-new-body"
              value={newDraft.message}
              onChange={(e) => onChangeNew?.({ ...newDraft, message: e.target.value })}
              rows={6}
              placeholder="Write your message… The program coordinator never sees these conversations."
              className="flex-1 rounded border border-slate-300 px-2 py-1"
              disabled={sendingNew}
            />
            {newError && <p className="rounded bg-red-50 px-2 py-1 text-red-800">{newError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                data-testid="messages-new-send"
                disabled={sendingNew || !newDraft.recipientIds.length || !newDraft.subject.trim() || !newDraft.message.trim()}
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {sendingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send
              </button>
            </div>
          </form>
        ) : !selectedThreadId ? (
          <div data-testid="thread-pane-empty" className="flex flex-1 items-center justify-center p-6 text-xs text-slate-500">
            {onOpenNew ? 'Select a conversation, or start one with New message.' : 'Select a conversation to view messages.'}
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
  const { fireOnce } = useOnceHint();
  const [newDraft, setNewDraft] = React.useState<NewMessageDraft | null>(null);
  const [newError, setNewError] = React.useState<string | null>(null);

  const recipientsQuery = useQuery({
    queryKey: ['dm-recipients', submissionId],
    queryFn: async () => ((await api.get(`/api/submissions/${submissionId}/messages/recipients`)).data?.recipients || []) as DmRecipient[],
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (d: NewMessageDraft) =>
      (await api.post(`/api/submissions/${submissionId}/messages`, { subject: d.subject.trim(), participantIds: d.recipientIds, message: d.message.trim() })).data,
    onSuccess: (data: any) => {
      setNewDraft(null);
      setNewError(null);
      void qc.invalidateQueries({ queryKey: ['dm-threads', submissionId] });
      if (data?.thread?._id) setSelectedThreadId(String(data.thread._id));
    },
    onError: (e: any) => setNewError(e?.response?.data?.error || 'Could not send the message.'),
  });

  const threadsQuery = useQuery({
    queryKey: ['dm-threads', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/messages`);
      return (r.data?.threads || []) as DmThread[];
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  // CR-052 / Sprint 12.3 — first time the Messages surface loads, nudge the
  // reader on what conversations are for. Fired from an effect so the
  // Conversations header (the anchor) is committed to the DOM first.
  const messagesReady = !threadsQuery.isLoading && !threadsQuery.error;
  React.useEffect(() => {
    if (!messagesReady) return;
    fireOnce({
      id: 'messages-first-thread',
      message: t('hint.messages.firstThread'),
      targetId: 'messages-conversations-header',
    });
  }, [messagesReady, fireOnce]);

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
      recipients={recipientsQuery.data || []}
      newDraft={newDraft}
      onOpenNew={() => {
        setNewError(null);
        setNewDraft({ recipientIds: [], subject: '', message: '' });
      }}
      onChangeNew={setNewDraft}
      onSendNew={() => newDraft && createMutation.mutate(newDraft)}
      sendingNew={createMutation.isPending}
      newError={newError}
      threads={threadsQuery.data || []}
      isLoading={threadsQuery.isLoading}
      error={threadsQuery.error ? (threadsQuery.error as Error).message : null}
      selectedThreadId={selectedThreadId}
      onSelectThread={(id) => {
        setNewDraft(null);
        setSelectedThreadId(id);
      }}
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

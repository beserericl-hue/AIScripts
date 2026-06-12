import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageSquare, X, Check, CornerDownRight, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Reply { _id?: string; authorName?: string; authorRole?: string; content?: string }
interface AllComment {
  _id: string;
  standardCode: string;
  specCode?: string;
  selectedText?: string;
  content?: string;
  authorName?: string;
  authorRole?: string;
  isResolved?: boolean;
  createdAt?: string;
  replies?: Reply[];
}

interface AllCommentsDrawerProps {
  submissionId: string;
  currentUserRole: 'reader' | 'lead_reader' | 'program_coordinator' | 'admin';
  open: boolean;
  onClose: () => void;
  onJump: (std: string, spec?: string, commentId?: string) => void;
}

/**
 * A persistent "chat window" docked on the right of the Reader Report showing
 * ALL comments for the submission (from reader 1, reader 2 and the lead reader),
 * grouped by specification. Reply, resolve, and click to jump to the spec.
 */
export function AllCommentsDrawer({ submissionId, currentUserRole, open, onClose, onJump }: AllCommentsDrawerProps): JSX.Element | null {
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data, refetch } = useQuery({
    queryKey: ['comments-all', submissionId],
    queryFn: async () => {
      // No standardCode → the API returns every comment for the submission.
      const r = await api.get(`${API_BASE}/submissions/${submissionId}/comments?limit=500`);
      return r.data as { comments: AllComment[] };
    },
    enabled: !!submissionId && open,
    refetchOnWindowFocus: false,
  });
  const comments = data?.comments || [];

  const reply = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) =>
      api.post(`${API_BASE}/comments/${commentId}/replies`, { content }),
    onSuccess: () => { setReplyFor(null); setReplyText(''); refetch(); },
  });
  const resolve = useMutation({
    mutationFn: async (commentId: string) => api.post(`${API_BASE}/comments/${commentId}/resolve`),
    onSuccess: () => refetch(),
  });
  const canReply = ['reader', 'lead_reader', 'program_coordinator'].includes(currentUserRole);
  const canResolve = ['reader', 'lead_reader'].includes(currentUserRole);

  // Group by standard.spec, in code order.
  const groups: { key: string; std: string; spec?: string; items: AllComment[] }[] = [];
  const byKey = new Map<string, AllComment[]>();
  for (const c of comments) {
    const key = c.specCode ? `${c.standardCode}.${c.specCode}` : c.standardCode;
    if (!byKey.has(key)) { byKey.set(key, []); groups.push({ key, std: c.standardCode, spec: c.specCode, items: byKey.get(key)! }); }
    byKey.get(key)!.push(c);
  }
  groups.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  if (!open) return null;
  const unresolved = comments.filter((c) => !c.isResolved).length;

  return (
    <aside
      data-testid="rr-all-comments"
      className="fixed right-0 top-[96px] z-30 flex h-[calc(100vh-96px)] w-96 max-w-[90vw] flex-col border-l border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <MessageSquare className="h-4 w-4" /> All comments
          <span className="font-normal text-slate-500">({comments.length}, {unresolved} unresolved)</span>
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200" aria-label="Close comments"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet. Select text under any specification and right-click to add one.</p>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="mb-4">
              <button
                onClick={() => onJump(g.std, g.spec)}
                className="mb-1 flex w-full items-center gap-1 rounded bg-slate-100 px-2 py-1 text-left text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                <ChevronRight className="h-3.5 w-3.5" /> Specification {g.spec ? `${g.std}.${g.spec}` : g.std}
              </button>
              {g.items.map((c) => (
                <div key={c._id} data-testid={`rr-allc-${c._id}`} className="mb-2 rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {c.authorName || 'Reviewer'}
                      {c.authorRole && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-500">{c.authorRole.replace('_', ' ')}</span>}
                    </span>
                    {c.isResolved
                      ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><Check className="h-3 w-3" />resolved</span>
                      : canResolve && <button onClick={() => resolve.mutate(c._id)} className="text-[10px] text-slate-400 hover:text-emerald-600">resolve</button>}
                  </div>
                  {c.selectedText && (
                    <button onClick={() => onJump(c.standardCode, c.specCode, c._id)} className="mt-1 block w-full truncate rounded bg-yellow-100 px-1.5 py-0.5 text-left text-[11px] text-yellow-800 hover:bg-yellow-200" title="Jump to this text">“{c.selectedText}”</button>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{c.content}</p>
                  {(c.replies || []).map((rp, i) => (
                    <div key={rp._id || i} className="mt-1 flex gap-1 border-l-2 border-slate-100 pl-2 text-xs text-slate-600">
                      <CornerDownRight className="h-3 w-3 flex-shrink-0 text-slate-300" />
                      <span><span className="font-semibold">{rp.authorName}:</span> {rp.content}</span>
                    </div>
                  ))}
                  {canReply && (
                    replyFor === c._id ? (
                      <div className="mt-2">
                        <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Reply…" className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-300" />
                        <div className="mt-1 flex justify-end gap-2">
                          <button onClick={() => { setReplyFor(null); setReplyText(''); }} className="text-xs text-slate-500">Cancel</button>
                          <button disabled={!replyText.trim() || reply.isPending} onClick={() => reply.mutate({ commentId: c._id, content: replyText })} className="rounded bg-teal-600 px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50">Send</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setReplyFor(c._id); setReplyText(''); }} className="mt-1 text-xs text-teal-700 hover:underline">Reply</button>
                    )
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default AllCommentsDrawer;

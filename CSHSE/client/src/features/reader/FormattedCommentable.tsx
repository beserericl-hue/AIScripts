import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquare, MessageSquarePlus, ChevronUp, ChevronDown, User, CheckCircle, Circle, Reply as ReplyIcon, Send, Clock } from 'lucide-react';
import { api } from '../../services/api';
import { useToastStore } from '../../store/toastStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface CommentReply {
  _id?: string;
  content?: string;
  authorName?: string;
  authorRole?: string;
  createdAt?: string;
}

interface CommentLite {
  _id: string;
  selectedText?: string;
  selectionStart?: number;
  selectionEnd?: number;
  content?: string;
  authorName?: string;
  authorRole?: string;
  isResolved?: boolean;
  replies?: CommentReply[];
  createdAt?: string;
}

interface FormattedCommentableProps {
  html: string;                 // formatted narrative/evidence HTML (tables intact)
  submissionId: string;
  standardCode: string;
  specCode: string;
  comments: CommentLite[];
  currentUserRole: 'reader' | 'lead_reader' | 'program_coordinator' | 'admin';
  proseClassName: string;
  onCommentAdded: () => void;
  highlightCommentId?: string | null;
  // Global comment order (ids across every spec) + a jump handler, so each
  // comment's up/down nav walks EVERY comment in the report and scrolls to it.
  orderedCommentIds?: string[];
  onJumpToComment?: (id: string) => void;
  // Rendered BETWEEN the narrative and the comment sidebar (the reader's
  // checklist), giving the column order: narrative | checklist | comments.
  middleSlot?: React.ReactNode;
}

const roleColors: Record<string, string> = {
  reader: 'bg-blue-100 text-blue-800',
  lead_reader: 'bg-purple-100 text-purple-800',
  program_coordinator: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800',
};
const roleLabels: Record<string, string> = {
  reader: 'Reader',
  lead_reader: 'Lead Reader',
  program_coordinator: 'Program Coordinator',
  admin: 'Lead Reader',
};

function formatDate(s?: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Remove any markers we previously inserted, restoring the original DOM. */
function clearMarks(container: HTMLElement) {
  container.querySelectorAll('mark[data-rr-comment]').forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  });
  container.normalize();
}

/** Wrap the text range [start,end) (offsets into container.textContent) in marks,
 *  splitting across text nodes — works INSIDE table cells. */
function wrapRange(container: HTMLElement, start: number, end: number, id: string, flash: boolean): boolean {
  if (end <= start) return false;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const pieces: { node: Text; s: number; e: number }[] = [];
  let pos = 0;
  let node: Node | null;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) {
    const t = node as Text;
    const len = t.nodeValue?.length || 0;
    const nodeStart = pos;
    const nodeEnd = pos + len;
    if (nodeEnd > start && nodeStart < end) {
      pieces.push({ node: t, s: Math.max(0, start - nodeStart), e: Math.min(len, end - nodeStart) });
    }
    pos = nodeEnd;
    if (pos >= end) break;
  }
  if (!pieces.length) return false;
  pieces.reverse().forEach((p, i) => {
    try {
      const range = document.createRange();
      range.setStart(p.node, p.s);
      range.setEnd(p.node, p.e);
      const mark = document.createElement('mark');
      mark.setAttribute('data-rr-comment', id);
      if (i === pieces.length - 1) mark.id = `comment-marker-${id}`;
      mark.className = (flash ? 'bg-yellow-400 ring-2 ring-yellow-500 rounded-sm' : 'bg-yellow-200 rounded-sm') + ' cursor-pointer hover:bg-yellow-300';
      range.surroundContents(mark);
    } catch { /* range crossed an element boundary mid-node — skip that piece */ }
  });
  return true;
}

/** Place a comment's marker: prefer exact offsets, else find its selectedText. */
function markComment(container: HTMLElement, c: CommentLite, flash: boolean) {
  const text = container.textContent || '';
  const sel = c.selectedText || '';
  let start = typeof c.selectionStart === 'number' ? c.selectionStart : -1;
  let end = typeof c.selectionEnd === 'number' ? c.selectionEnd : -1;
  if (!(start >= 0 && end > start && text.slice(start, end) === sel) && sel) {
    const idx = text.indexOf(sel);
    if (idx >= 0) { start = idx; end = idx + sel.length; }
  }
  if (start >= 0 && end > start) wrapRange(container, start, end, c._id, flash);
}

/**
 * Renders FORMATTED html (tables/lists/links intact) on the left, and a comment
 * sidebar on the right that matches the SELF-STUDY screen: a list of comment
 * cards (author, role, quoted text, body, replies, resolve, reply). Selecting
 * text adds a comment; clicking a card's quote scrolls to the highlighted text.
 * Each card has up/down arrows that walk EVERY comment in the report.
 */
export function FormattedCommentable({ html, submissionId, standardCode, specCode, comments, currentUserRole, proseClassName, onCommentAdded, highlightCommentId = null, orderedCommentIds = [], onJumpToComment, middleSlot }: FormattedCommentableProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);     // the prose container (marks live here)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [composer, setComposer] = useState<{ x: number; y: number; selectedText: string; start: number; end: number } | null>(null);
  const [body, setBody] = useState('');
  const canComment = currentUserRole === 'reader' || currentUserRole === 'lead_reader' || currentUserRole === 'admin';

  const hasComments = comments.length > 0;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [justCreated, setJustCreated] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.push);
  const create = useMutation({
    mutationFn: async (payload: { selectedText: string; selectionStart: number; selectionEnd: number; content: string }) =>
      (await api.post(`${API_BASE}/submissions/${submissionId}/comments`, { standardCode, specCode, ...payload })).data,
    onSuccess: (data: any) => { setJustCreated(data?.comment?._id || null); onCommentAdded(); pushToast('Comment added', 'success'); },
    onError: () => pushToast('Could not add the comment', 'error'),
  });
  const reply = useMutation({
    mutationFn: async (payload: { commentId: string; content: string }) =>
      (await api.post(`${API_BASE}/comments/${payload.commentId}/replies`, { content: payload.content })).data,
    onSuccess: () => { setReplyText(''); setReplyFor(null); onCommentAdded(); pushToast('Reply added', 'success'); },
    onError: () => pushToast('Could not add the reply', 'error'),
  });
  const resolve = useMutation({
    mutationFn: async (payload: { commentId: string }) =>
      (await api.post(`${API_BASE}/comments/${payload.commentId}/resolve`, {})).data,
    onSuccess: (data: any) => { onCommentAdded(); pushToast(data?.comment?.isResolved ? 'Comment resolved' : 'Comment reopened', 'success'); },
    onError: () => pushToast('Could not update the comment', 'error'),
  });

  const submitComment = () => {
    if (!composer || !body.trim()) return;
    const payload = { selectedText: composer.selectedText, selectionStart: composer.start, selectionEnd: composer.end, content: body };
    setComposer(null);
    setBody('');
    window.getSelection()?.removeAllRanges();
    create.mutate(payload);
  };

  // (Re)apply markers whenever the content or comments change (before paint).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    clearMarks(el);
    for (const c of comments) markComment(el, c, c._id === highlightCommentId || c._id === justCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, comments, highlightCommentId, justCreated]);

  useEffect(() => {
    if (!justCreated) return;
    const t = setTimeout(() => setJustCreated(null), 3000);
    return () => clearTimeout(t);
  }, [justCreated]);

  // When navigated to, flash + scroll the comment card.
  useEffect(() => {
    if (!highlightCommentId) return;
    setActiveId(highlightCommentId);
    const card = document.getElementById(`rr-card-${highlightCommentId}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightCommentId]);

  // On selection, offer an "Add comment" button anchored at the selection.
  const onMouseUp = () => {
    if (!canComment) return;
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0) { return; }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const selectedText = sel.toString().trim();
    if (!selectedText) return;
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const end = start + selectedText.length;
    const rect = range.getBoundingClientRect();
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    setComposer({ x: rect.left - (wrapRect?.left || 0) + rect.width / 2, y: rect.bottom - (wrapRect?.top || 0) + 6, selectedText, start, end });
  };

  // Clicking a highlight focuses its comment card.
  const onContainerClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('mark[data-rr-comment]') as HTMLElement | null;
    if (!mark) return;
    const id = mark.getAttribute('data-rr-comment');
    if (!id) return;
    setActiveId(id);
    const card = document.getElementById(`rr-card-${id}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Scroll the narrative to a comment's highlighted text.
  const scrollToMark = (id: string) => {
    setActiveId(id);
    const m = document.getElementById(`comment-marker-${id}`);
    if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const total = orderedCommentIds.length;

  const CommentCard = ({ c }: { c: CommentLite }) => {
    const idx = orderedCommentIds.indexOf(c._id);
    const active = activeId === c._id || highlightCommentId === c._id;
    const role = c.authorRole || 'reader';
    return (
      <div
        id={`rr-card-${c._id}`}
        data-testid={`rr-card-${c._id}`}
        className={`overflow-hidden rounded-lg border bg-white shadow-sm transition-all ${active ? 'border-teal-400 ring-2 ring-teal-200' : 'border-gray-200'} ${c.isResolved ? 'opacity-70' : ''}`}
      >
        {/* Header: author + role + resolve + up/down nav */}
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200"><User className="h-4 w-4 text-gray-600" /></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{c.authorName || roleLabels[role] || 'Reviewer'}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[role] || 'bg-gray-100 text-gray-700'}`}>{roleLabels[role] || 'Reviewer'}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {(currentUserRole === 'reader' || currentUserRole === 'lead_reader' || currentUserRole === 'admin') && (
              <button data-testid={`rr-card-resolve-${c._id}`} onClick={() => resolve.mutate({ commentId: c._id })} title={c.isResolved ? 'Reopen' : 'Resolve'} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                {c.isResolved ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
              </button>
            )}
            {total > 1 && idx >= 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <button data-testid={`rr-card-prev-${c._id}`} aria-label="Previous comment" title="Previous comment" onClick={() => onJumpToComment?.(orderedCommentIds[(idx - 1 + total) % total])} className="rounded border border-teal-300 bg-teal-50 p-0.5 text-teal-700 hover:bg-teal-100"><ChevronUp className="h-4 w-4" /></button>
                <span className="tabular-nums">{idx + 1}/{total}</span>
                <button data-testid={`rr-card-next-${c._id}`} aria-label="Next comment" title="Next comment" onClick={() => onJumpToComment?.(orderedCommentIds[(idx + 1) % total])} className="rounded border border-teal-300 bg-teal-50 p-0.5 text-teal-700 hover:bg-teal-100"><ChevronDown className="h-4 w-4" /></button>
              </span>
            )}
          </div>
        </div>
        {/* Quoted text — click to scroll to the highlighted passage. */}
        {c.selectedText && (
          <div className="cursor-pointer border-l-4 border-yellow-400 bg-yellow-50 px-3 py-2" onClick={() => scrollToMark(c._id)} title="Go to the highlighted text">
            <p className="line-clamp-2 text-xs italic text-yellow-800">“{c.selectedText}”</p>
          </div>
        )}
        {/* Body */}
        <div className="p-3">
          <p className="whitespace-pre-wrap text-sm text-gray-700">{c.content}</p>
          {c.createdAt && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />{formatDate(c.createdAt)}</div>
          )}
        </div>
        {/* Replies */}
        {(c.replies || []).length > 0 && (
          <div className="space-y-3 border-t border-gray-100 px-3 py-2">
            {(c.replies || []).map((r, i) => (
              <div key={r._id || i} className="border-l-2 border-gray-200 pl-3">
                <p className="text-xs font-medium text-gray-900">{r.authorName || roleLabels[r.authorRole || 'reader']}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{r.content}</p>
                {r.createdAt && <p className="mt-1 text-xs text-gray-400">{formatDate(r.createdAt)}</p>}
              </div>
            ))}
          </div>
        )}
        {/* Reply box */}
        {(currentUserRole === 'reader' || currentUserRole === 'lead_reader' || currentUserRole === 'admin' || currentUserRole === 'program_coordinator') && (
          <div className="border-t border-gray-100 p-3">
            {replyFor === c._id ? (
              <div className="space-y-2">
                <textarea
                  data-testid={`rr-card-reply-${c._id}`}
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && replyText.trim()) reply.mutate({ commentId: c._id, content: replyText }); }}
                  rows={2}
                  placeholder="Write a reply…"
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setReplyFor(null); setReplyText(''); }} className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800">Cancel</button>
                  <button data-testid={`rr-card-reply-add-${c._id}`} disabled={!replyText.trim()} onClick={() => reply.mutate({ commentId: c._id, content: replyText })} className="flex items-center gap-1 rounded bg-teal-600 px-3 py-1 text-xs text-white hover:bg-teal-700 disabled:opacity-50"><Send className="h-3 w-3" />Reply</button>
                </div>
              </div>
            ) : (
              <button data-testid={`rr-card-reply-open-${c._id}`} onClick={() => { setReplyFor(c._id); setReplyText(''); }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600"><ReplyIcon className="h-3 w-3" />Reply</button>
            )}
          </div>
        )}
      </div>
    );
  };

  const useRow = hasComments || !!middleSlot;

  return (
    <div ref={wrapRef} className="relative">
      {/* Column order: narrative (wide) | checklist (middleSlot) | comments. */}
      <div className={useRow ? 'lg:flex lg:items-start lg:gap-4' : ''}>
        {/* Narrative keeps its full readable width. */}
        <div className={useRow ? 'min-w-0 lg:flex-1' : ''}>
          <div
            ref={ref}
            data-testid={`rr-formatted-${standardCode}-${specCode}`}
            className={proseClassName}
            onMouseUp={onMouseUp}
            onClick={onContainerClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        {/* Reader's checklist column (passed in by the editor). */}
        {middleSlot}
        {/* Comment sidebar — same look as the self-study screen — on the right. */}
        {hasComments && (
          <div data-testid={`rr-comments-sidebar-${standardCode}-${specCode}`} className="mt-4 lg:mt-0 lg:w-80 lg:shrink-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <MessageSquare className="h-4 w-4 text-gray-500" />Comments ({comments.length})
            </div>
            <div className="space-y-3">
              {comments.map((c) => <CommentCard key={c._id} c={c} />)}
            </div>
          </div>
        )}
      </div>

      {composer && (
        <div
          className="absolute z-20 w-72 -translate-x-1/2 rounded-lg border border-slate-300 bg-white p-2 shadow-lg"
          style={{ left: composer.x, top: composer.y }}
        >
          <p className="mb-1 truncate rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800" title={composer.selectedText}>“{composer.selectedText}”</p>
          <textarea
            data-testid="rr-fc-composer"
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitComment(); }}
            rows={2}
            placeholder="Add a comment on the selected text…"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-300"
          />
          <div className="mt-1 flex justify-end gap-2">
            <button onClick={() => { setComposer(null); setBody(''); window.getSelection()?.removeAllRanges(); }} className="text-xs text-slate-500">Cancel</button>
            <button
              data-testid="rr-fc-add"
              disabled={!body.trim()}
              onClick={submitComment}
              className="inline-flex items-center gap-1 rounded bg-teal-600 px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormattedCommentable;

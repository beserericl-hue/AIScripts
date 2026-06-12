import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquarePlus, ChevronUp, ChevronDown, Check } from 'lucide-react';
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
  // comment card carries its OWN prev/next that walks every comment — the
  // navigation lives ON the comment, not in a bar that scrolls away.
  orderedCommentIds?: string[];
  onJumpToComment?: (id: string) => void;
}

/** Human label for an author role. */
function roleName(role?: string): string {
  switch (role) {
    case 'reader': return 'Reader';
    case 'lead_reader': return 'Lead Reader';
    case 'program_coordinator': return 'Program Coordinator';
    case 'admin': return 'Admin';
    default: return 'Reviewer';
  }
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
  // Wrap from last to first so earlier ranges stay valid.
  pieces.reverse().forEach((p, i) => {
    try {
      const range = document.createRange();
      range.setStart(p.node, p.s);
      range.setEnd(p.node, p.e);
      const mark = document.createElement('mark');
      mark.setAttribute('data-rr-comment', id);
      // The scroll/anchor target id goes on the FIRST piece (last in this loop).
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
  // Use offsets only if they actually point at the selected text (same basis);
  // otherwise fall back to searching for the selected text in the rendered DOM.
  if (!(start >= 0 && end > start && text.slice(start, end) === sel) && sel) {
    const idx = text.indexOf(sel);
    if (idx >= 0) { start = idx; end = idx + sel.length; }
  }
  if (start >= 0 && end > start) wrapRange(container, start, end, c._id, flash);
}

const CARD_GAP = 10;        // px between stacked cards
const CARD_EST_HEIGHT = 96; // px assumed per card for anti-overlap stacking

/**
 * Renders FORMATTED html (tables/lists/links intact) AND shows each comment as a
 * card in the right margin, vertically aligned with the text it flags (like
 * Google-Docs margin comments). Selecting text adds a new comment; the card has
 * its own reply box, resolve, and prev/next that walks every comment.
 */
export function FormattedCommentable({ html, submissionId, standardCode, specCode, comments, currentUserRole, proseClassName, onCommentAdded, highlightCommentId = null, orderedCommentIds = [], onJumpToComment }: FormattedCommentableProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);     // the prose container (marks live here)
  const wrapRef = useRef<HTMLDivElement>(null);  // relative wrapper (cards anchor here)
  const [composer, setComposer] = useState<{ x: number; y: number; selectedText: string; start: number; end: number } | null>(null);
  const [body, setBody] = useState('');
  // Readers/lead-readers comment; admins/superusers may too (server enforces).
  const canComment = currentUserRole === 'reader' || currentUserRole === 'lead_reader' || currentUserRole === 'admin';

  const hasComments = comments.length > 0;
  // Measured vertical offset (px, relative to the wrapper top) of each comment's
  // marker, so its margin card sits next to the text it flags.
  const [markTops, setMarkTops] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // The comment just created here — flash + scroll to it once it re-marks.
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

  // Submit: drop the dialog immediately (clear the selection) for instant
  // feedback, then save in the background.
  const submitComment = () => {
    if (!composer || !body.trim()) return;
    const payload = { selectedText: composer.selectedText, selectionStart: composer.start, selectionEnd: composer.end, content: body };
    setComposer(null);
    setBody('');
    window.getSelection()?.removeAllRanges();
    create.mutate(payload);
  };

  // (Re)apply markers AND measure their offsets in one layout pass (before paint),
  // so each comment's margin card aligns with the text it flags.
  useLayoutEffect(() => {
    const el = ref.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    clearMarks(el);
    for (const c of comments) markComment(el, c, c._id === highlightCommentId || c._id === justCreated);
    const measure = () => {
      const wrapTop = wrap.getBoundingClientRect().top;
      const tops: Record<string, number> = {};
      for (const c of comments) {
        const m = document.getElementById(`comment-marker-${c._id}`);
        if (m) tops[c._id] = Math.max(0, m.getBoundingClientRect().top - wrapTop);
      }
      setMarkTops((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(tops)]);
        for (const k of keys) if (Math.abs((prev[k] ?? -1) - (tops[k] ?? -1)) > 1) return tops;
        return prev;
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, comments, highlightCommentId, justCreated]);

  // Clear the freshly-created flash after a moment.
  useEffect(() => {
    if (!justCreated) return;
    const t = setTimeout(() => setJustCreated(null), 3000);
    return () => clearTimeout(t);
  }, [justCreated]);

  // When navigated to, flash + scroll the card.
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

  // Clicking a highlight focuses (scrolls to + flashes) its margin card.
  const onContainerClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('mark[data-rr-comment]') as HTMLElement | null;
    if (!mark) return;
    const id = mark.getAttribute('data-rr-comment');
    if (!id) return;
    setActiveId(id);
    const card = document.getElementById(`rr-card-${id}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Anti-overlap stacking: order cards by measured top, pushing each below the
  // previous so adjacent comments don't sit on top of each other.
  const layout = new Map<string, number>();
  const placed = comments.filter((c) => markTops[c._id] != null).sort((a, b) => markTops[a._id] - markTops[b._id]);
  let prevBottom = -Infinity;
  for (const c of placed) {
    const top = Math.max(markTops[c._id], prevBottom + CARD_GAP);
    layout.set(c._id, top);
    prevBottom = top + CARD_EST_HEIGHT;
  }

  const navIndex = (id: string) => orderedCommentIds.indexOf(id);
  const total = orderedCommentIds.length;

  const Card = ({ c, absolute }: { c: CommentLite; absolute: boolean }) => {
    const idx = navIndex(c._id);
    const active = activeId === c._id || highlightCommentId === c._id;
    // Only the desktop (absolute) cards carry test ids — the mobile copies are
    // display:none duplicates that would otherwise break strict-mode locators.
    const tid = (s: string) => (absolute ? s : undefined);
    return (
      <div
        id={absolute ? `rr-card-${c._id}` : undefined}
        data-testid={absolute ? `rr-card-${c._id}` : undefined}
        onClick={() => { setActiveId(c._id); const m = document.getElementById(`comment-marker-${c._id}`); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
        className={`${absolute ? 'absolute right-0 w-[16.5rem]' : 'mb-3 w-full'} cursor-pointer rounded-lg border bg-white p-2.5 shadow-sm transition-all ${active ? 'border-teal-400 ring-2 ring-teal-200' : 'border-slate-200'} ${c.isResolved ? 'opacity-70' : ''}`}
        style={absolute ? { top: layout.get(c._id) ?? 0 } : undefined}
      >
        {c.selectedText && (
          <p className="mb-1 truncate rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] text-yellow-800" title={c.selectedText}>“{c.selectedText}”</p>
        )}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700">{c.authorName || roleName(c.authorRole)}</span>
          {/* Prev/next walks every comment — navigation lives ON the comment. */}
          {total > 1 && idx >= 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-slate-400" onClick={(e) => e.stopPropagation()}>
              <button data-testid={tid(`rr-card-prev-${c._id}`)} aria-label="Previous comment" title="Previous comment" onClick={() => onJumpToComment?.(orderedCommentIds[(idx - 1 + total) % total])} className="rounded p-0.5 hover:bg-slate-100"><ChevronUp className="h-3.5 w-3.5" /></button>
              <span className="tabular-nums">{idx + 1}/{total}</span>
              <button data-testid={tid(`rr-card-next-${c._id}`)} aria-label="Next comment" title="Next comment" onClick={() => onJumpToComment?.(orderedCommentIds[(idx + 1) % total])} className="rounded p-0.5 hover:bg-slate-100"><ChevronDown className="h-3.5 w-3.5" /></button>
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{c.content}</p>
        {(c.replies || []).map((r, i) => (
          <div key={r._id || i} className="mt-1.5 border-l-2 border-slate-200 pl-2">
            <span className="text-[11px] font-semibold text-slate-600">{r.authorName || roleName(r.authorRole)}</span>
            <p className="whitespace-pre-wrap text-xs text-slate-700">{r.content}</p>
          </div>
        ))}
        {canComment && (
          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
            {replyFor === c._id ? (
              <div>
                <textarea
                  data-testid={tid(`rr-card-reply-${c._id}`)}
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && replyText.trim()) reply.mutate({ commentId: c._id, content: replyText }); }}
                  rows={2}
                  placeholder="Reply…"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-300"
                />
                <div className="mt-1 flex justify-end gap-2">
                  <button onClick={() => { setReplyFor(null); setReplyText(''); }} className="text-[11px] text-slate-500">Cancel</button>
                  <button data-testid={tid(`rr-card-reply-add-${c._id}`)} disabled={!replyText.trim()} onClick={() => reply.mutate({ commentId: c._id, content: replyText })} className="rounded bg-teal-600 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50">Reply</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[11px]">
                <button data-testid={tid(`rr-card-reply-open-${c._id}`)} onClick={() => { setReplyFor(c._id); setReplyText(''); }} className="text-teal-700 hover:underline">Reply</button>
                <button data-testid={tid(`rr-card-resolve-${c._id}`)} onClick={() => resolve.mutate({ commentId: c._id })} className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-800">
                  {c.isResolved ? 'Reopen' : (<><Check className="h-3 w-3" />Resolve</>)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className={hasComments ? 'lg:flex lg:items-start lg:gap-0' : ''}>
        <div className={hasComments ? 'min-w-0 lg:flex-1 lg:pr-[17.5rem]' : ''}>
          <div
            ref={ref}
            data-testid={`rr-formatted-${standardCode}-${specCode}`}
            className={proseClassName}
            onMouseUp={onMouseUp}
            onClick={onContainerClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        {/* Margin comment cards (desktop): absolutely positioned next to the text
            they flag, aligned to each marked passage. */}
        {hasComments && (
          <div data-testid={`rr-comments-margin-${standardCode}-${specCode}`} className="hidden lg:absolute lg:right-0 lg:top-0 lg:block lg:h-full lg:w-[16.5rem]">
            {comments.map((c) => <Card key={c._id} c={c} absolute />)}
          </div>
        )}
        {/* Same cards stacked below the text on narrow screens. */}
        {hasComments && (
          <div className="mt-3 lg:hidden">
            {comments.map((c) => <Card key={c._id} c={c} absolute={false} />)}
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

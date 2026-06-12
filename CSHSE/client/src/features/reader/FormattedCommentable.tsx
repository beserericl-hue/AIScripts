import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquarePlus } from 'lucide-react';
import { api } from '../../services/api';
import { useToastStore } from '../../store/toastStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface CommentLite {
  _id: string;
  selectedText?: string;
  selectionStart?: number;
  selectionEnd?: number;
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
      mark.className = flash ? 'bg-yellow-400 ring-2 ring-yellow-500 rounded-sm' : 'bg-yellow-200 rounded-sm';
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

/**
 * Renders FORMATTED html (tables/lists/links intact) AND lets the reader select
 * text inside it to add a comment. Commented text is highlighted IN PLACE — the
 * marker sits on the selected text inside the table, not on a tag outside it.
 */
export function FormattedCommentable({ html, submissionId, standardCode, specCode, comments, currentUserRole, proseClassName, onCommentAdded, highlightCommentId = null }: FormattedCommentableProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [composer, setComposer] = useState<{ x: number; y: number; selectedText: string; start: number; end: number } | null>(null);
  const [body, setBody] = useState('');
  // Readers/lead-readers comment; admins/superusers may too (server enforces).
  const canComment = currentUserRole === 'reader' || currentUserRole === 'lead_reader' || currentUserRole === 'admin';

  // The comment just created here — flash + scroll to it once it re-marks.
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.push);
  const create = useMutation({
    mutationFn: async (payload: { selectedText: string; selectionStart: number; selectionEnd: number; content: string }) =>
      (await api.post(`${API_BASE}/submissions/${submissionId}/comments`, { standardCode, specCode, ...payload })).data,
    onSuccess: (data: any) => { setJustCreated(data?.comment?._id || null); onCommentAdded(); pushToast('Comment added', 'success'); },
    onError: () => pushToast('Could not add the comment', 'error'),
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

  // (Re)apply markers whenever the content or comments change, and scroll to a
  // freshly-created comment so it shows right next to the text it's on.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    clearMarks(el);
    for (const c of comments) markComment(el, c, c._id === highlightCommentId || c._id === justCreated);
    if (justCreated) {
      const m = document.getElementById(`comment-marker-${justCreated}`);
      if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => setJustCreated(null), 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, comments, highlightCommentId, justCreated]);

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
    // Offset of the selection start within the container's textContent.
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const end = start + selectedText.length;
    const rect = range.getBoundingClientRect();
    setComposer({ x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY + 6, selectedText, start, end });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        data-testid={`rr-formatted-${standardCode}-${specCode}`}
        className={proseClassName}
        onMouseUp={onMouseUp}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {composer && (
        <div
          className="absolute z-20 w-72 -translate-x-1/2 rounded-lg border border-slate-300 bg-white p-2 shadow-lg"
          style={{ left: composer.x - (ref.current?.getBoundingClientRect().left || 0), top: (composer.y - window.scrollY) - (ref.current?.getBoundingClientRect().top || 0) }}
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

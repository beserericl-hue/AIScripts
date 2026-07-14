/**
 * CompareEditOverlay — the single Review edit surface.
 *
 * Opened by the "Compare" button on a card. Fills the screen with a clean
 * side-by-side: the imported content (left, editable, full format) next to the
 * original source document (right, scrolled to this section). The coordinator
 * edits on the left and verifies against the source on the right; pasting from
 * the source keeps links / images / tables.
 *
 * This REPLACES the old cramped right-pane inline editor — editing no longer
 * resizes the review layout (so cancelling can't leave it in a broken state):
 * the overlay is a fixed layer that simply unmounts on close.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Undo2, Columns } from 'lucide-react';
import { SourceComparePane } from './SourceComparePane';

interface CompareEditOverlayProps {
  open: boolean;
  sectionId: string | null;
  heading: string;
  snippet: string;
  htmlSnippet?: string | null;
  /** Present once the item has been edited — enables "Revert to AI original". */
  isEdited?: boolean;
  sourceImportId?: string | null;
  submissionId?: string | null;
  onSave: (sectionId: string, plain: string, html: string) => void;
  onRevert?: (sectionId: string) => void;
  onClose: () => void;
}

function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function CompareEditOverlay({
  open,
  sectionId,
  heading,
  snippet,
  htmlSnippet,
  isEdited,
  sourceImportId,
  submissionId,
  onSave,
  onRevert,
  onClose
}: CompareEditOverlayProps): JSX.Element | null {
  const editorRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(0);
  // CR-072 (P2) — opt-in synchronized scroll. Off by default so it never fights
  // the user. The two panes render the SAME passage at DIFFERENT heights (tables,
  // line-wrapping, spacing differ), so a proportional map drifts — especially
  // around tables. Instead we align on ACTUAL CONTENT: find the text block at the
  // top of the pane being scrolled, find the same block in the other pane (by
  // normalized-text key), and align those two exactly. Falls back to the matched
  // span / percentage only when no text block matches.
  const [syncScroll, setSyncScroll] = useState(false);

  useEffect(() => {
    // Depend on `open` + `sectionId` (not just syncScroll): the panes unmount
    // when the overlay closes, so on REOPEN we must re-bind the scroll listeners
    // to the fresh DOM. Without this the sync worked once, then silently stopped
    // after the first close (listeners bound to removed nodes) — user had to
    // close/reopen to recover.
    if (!syncScroll || !open) return;
    const left = leftScrollRef.current;
    const right = document.querySelector<HTMLElement>('[data-testid="compare-source-pane"]');
    if (!left || !right) return;
    let lock = false;
    const release = () => requestAnimationFrame(() => { lock = false; });

    const BLOCK_SEL = 'p,li,td,th,h1,h2,h3,h4,h5,h6,blockquote,pre';
    const norm = (s: string | null) =>
      (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 48);

    // Index the other pane's blocks by text key (first occurrence wins). Rebuilt
    // lazily — content is static while the user is scrolling, not editing.
    const buildIndex = (container: HTMLElement) => {
      const m = new Map<string, HTMLElement>();
      container.querySelectorAll<HTMLElement>(BLOCK_SEL).forEach((el) => {
        const k = norm(el.textContent);
        if (k.length >= 10 && !m.has(k)) m.set(k, el);
      });
      return m;
    };
    let leftIndex: Map<string, HTMLElement> | null = null;
    let rightIndex: Map<string, HTMLElement> | null = null;

    // Blocks of `container` nearest its viewport TOP EDGE (above or below),
    // closest first. Looking slightly above the fold lets us ride THROUGH a
    // table: its short numeric cells can't anchor, so we lock onto the nearest
    // descriptive block (e.g. a row label or the paragraph just above it).
    const topBlocks = (container: HTMLElement) => {
      const cTop = container.getBoundingClientRect().top;
      const h = container.clientHeight;
      return Array.from(container.querySelectorAll<HTMLElement>(BLOCK_SEL))
        .map((el) => ({ el, off: el.getBoundingClientRect().top - cTop }))
        .filter((b) => b.off > -h && b.off < h && norm(b.el.textContent).length >= 10)
        .sort((a, b) => Math.abs(a.off) - Math.abs(b.off))
        .slice(0, 10);
    };

    // Scroll `to` so the block matching `from`'s top block sits at the same
    // vertical offset. Returns true if a content anchor was found.
    const alignByContent = (
      from: HTMLElement,
      to: HTMLElement,
      toIndex: Map<string, HTMLElement>
    ) => {
      for (const b of topBlocks(from)) {
        const srcEl = toIndex.get(norm(b.el.textContent));
        if (!srcEl) continue;
        const toTop = to.getBoundingClientRect().top;
        const dTo = srcEl.getBoundingClientRect().top - toTop; // current offset
        to.scrollTop += dTo - b.off; // make it equal b.off
        return true;
      }
      return false;
    };

    // Fallback: map onto the highlighted matched span (handles the no-text-match
    // case, e.g. heavily-edited left content).
    const span = () => {
      const start = right.querySelector<HTMLElement>('[data-compare-match-start]');
      if (!start) return null;
      const end = right.querySelector<HTMLElement>('[data-compare-match-end]') || start;
      const rTop = right.getBoundingClientRect().top;
      const top = start.getBoundingClientRect().top - rTop + right.scrollTop;
      const bottom = end.getBoundingClientRect().bottom - rTop + right.scrollTop;
      return { top, height: Math.max(1, bottom - top) };
    };

    const onLeft = () => {
      if (lock) return;
      lock = true;
      if (!rightIndex) rightIndex = buildIndex(right);
      if (!alignByContent(left, right, rightIndex)) {
        const s = span();
        const leftMax = left.scrollHeight - left.clientHeight;
        const f = leftMax > 0 ? left.scrollTop / leftMax : 0;
        right.scrollTop = s
          ? s.top - 8 + f * Math.max(0, s.height - right.clientHeight)
          : f * (right.scrollHeight - right.clientHeight);
      }
      release();
    };
    const onRight = () => {
      if (lock) return;
      lock = true;
      if (!leftIndex) leftIndex = buildIndex(left);
      if (!alignByContent(right, left, leftIndex)) {
        const s = span();
        const leftMax = left.scrollHeight - left.clientHeight;
        if (s) {
          const denom = Math.max(1, s.height - right.clientHeight);
          const f = Math.min(1, Math.max(0, (right.scrollTop - (s.top - 8)) / denom));
          left.scrollTop = f * leftMax;
        } else {
          const fromMax = right.scrollHeight - right.clientHeight;
          left.scrollTop = fromMax > 0 ? (right.scrollTop / fromMax) * leftMax : 0;
        }
      }
      release();
    };

    left.addEventListener('scroll', onLeft, { passive: true });
    right.addEventListener('scroll', onRight, { passive: true });
    // Align immediately on enable.
    onLeft();
    return () => {
      left.removeEventListener('scroll', onLeft);
      right.removeEventListener('scroll', onRight);
    };
  }, [syncScroll, open, sectionId]);

  // Seed the editor with the faithful HTML (full format) when the overlay opens
  // for a section. Keyed on sectionId so re-opening a different card re-seeds.
  useEffect(() => {
    if (!open || !sectionId || !editorRef.current) return;
    const seed = htmlSnippet && htmlSnippet.trim() ? htmlSnippet : `<p>${escapeHtml(snippet || '')}</p>`;
    editorRef.current.innerHTML = seed;
    setWordCount((editorRef.current.innerText || '').trim().split(/\s+/).filter(Boolean).length);
    const id = window.setTimeout(() => editorRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open, sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !sectionId) return null;

  const handleSave = () => {
    const html = editorRef.current?.innerHTML ?? '';
    const plain = (editorRef.current?.innerText ?? '').trim();
    onSave(sectionId, plain, html);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare and edit"
      data-testid="compare-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-[1700px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-3">
          <Columns className="h-5 w-5 text-cshse-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Compare &amp; edit</div>
            <div className="truncate text-sm font-medium text-gray-900" title={heading}>
              {heading || '(no heading)'}
            </div>
          </div>
          {isEdited && onRevert && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Restore the AI's original imported content? Your edits will be lost.")) {
                  onRevert(sectionId);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden /> Revert to AI original
            </button>
          )}
          {/* CR-072 (P2) — opt-in synchronized scroll between the two panes. */}
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            title="Scroll both panes together"
          >
            <input
              type="checkbox"
              data-testid="compare-sync-scroll"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="rounded text-cshse-600 focus:ring-cshse-500"
            />
            Sync scroll
          </label>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            data-testid="compare-save"
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> Save
          </button>
        </div>

        {/* Body — two equal columns */}
        <div className="flex min-h-0 flex-1">
          {/* LEFT — editable imported content */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 bg-cshse-50/40 px-4 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-cshse-700">
                Imported content — editable
              </span>
              <span className="text-[11px] text-gray-500">{wordCount} words · paste keeps formatting</span>
            </div>
            <div ref={leftScrollRef} data-testid="compare-imported-pane" className="min-h-0 flex-1 overflow-auto p-4">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck
                data-testid="compare-editor"
                onInput={() =>
                  setWordCount((editorRef.current?.innerText || '').trim().split(/\s+/).filter(Boolean).length)
                }
                className="ai-html-snippet prose max-w-none min-h-full rounded border border-gray-300 bg-white p-4 text-[15px] leading-relaxed text-gray-900 focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500
                  [&_a]:text-cshse-700 [&_a]:underline
                  [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1
                  [&_img]:max-w-full [&_img]:my-2"
              />
            </div>
            {/* Always-visible Save bar for the editable LEFT window. */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-2.5">
              <span className="mr-auto text-xs text-gray-500">Edit or paste above, then save.</span>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" aria-hidden /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                data-testid="compare-save-footer"
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" aria-hidden /> Save changes
              </button>
            </div>
          </div>

          {/* RIGHT — source document */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SourceComparePane
              importId={sourceImportId || null}
              submissionId={submissionId}
              sectionId={sectionId}
              matchText={snippet}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

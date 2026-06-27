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
  // the user; when on, the two panes mirror scroll percentage.
  const [syncScroll, setSyncScroll] = useState(false);

  useEffect(() => {
    if (!syncScroll) return;
    const left = leftScrollRef.current;
    const right = document.querySelector<HTMLElement>('[data-testid="compare-source-pane"]');
    if (!left || !right) return;
    let lock = false;
    const mirror = (from: HTMLElement, to: HTMLElement) => {
      if (lock) return;
      lock = true;
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      to.scrollTop = fromMax > 0 ? (from.scrollTop / fromMax) * toMax : 0;
      // release on the next frame so the programmatic scroll doesn't echo back
      requestAnimationFrame(() => { lock = false; });
    };
    const onLeft = () => mirror(left, right);
    const onRight = () => mirror(right, left);
    left.addEventListener('scroll', onLeft, { passive: true });
    right.addEventListener('scroll', onRight, { passive: true });
    return () => {
      left.removeEventListener('scroll', onLeft);
      right.removeEventListener('scroll', onRight);
    };
  }, [syncScroll]);

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
            <div ref={leftScrollRef} className="min-h-0 flex-1 overflow-auto p-4">
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

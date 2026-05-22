/**
 * ShowInSourceModal — side modal that opens the latest DocumentVersion's
 * HTML scrolled to the anchor for the selected tag/item (UI spec §20.9).
 *
 * Strategy:
 *  1. Fetch the rendered HTML for the current import's source document.
 *  2. Look up the section's anchor via the matcher's section_id. If found
 *     in the DOM, scrollIntoView.
 *  3. If not found, fuzzy-search for the snippet text (first 200 chars,
 *     case-insensitive, whitespace-collapsed) and surface an amber
 *     "best-effort match" banner.
 *  4. If still not found, surface a "no longer in current document"
 *     message.
 *
 * Modal width 60vw; Esc closes; clicking outside closes.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle, Loader2, Check } from 'lucide-react';
import { api } from '../../../../../services/api';
import { tableizeIfBareRows } from './tableizeHtml';

interface ShowInSourceModalProps {
  open: boolean;
  importId: string | null;
  sectionId: string | null;
  /** Body text used as the fuzzy-match fallback when the anchor is missing. */
  matchText: string;
  onClose: () => void;
  /**
   * Selection-mode target: when set, the modal renders as a passage picker
   * for the named spec (no scroll-to-anchor). The user highlights text and
   * clicks "Use this passage" — we call `onSelectionConfirmed` with the
   * highlighted text + a best-effort location anchor.
   */
  selectionTarget?: { std: string; spec: string } | null;
  onSelectionConfirmed?: (
    text: string,
    location: { paragraphIndex?: number; html?: string }
  ) => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; html: string; matchKind: 'anchor' | 'fuzzy' | 'missing' }
  | { kind: 'error'; message: string };

function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Module-scoped cache: keyed by importId, value = the fetched HTML string.
// Live for the lifetime of the tab. Stevenson's HTML is ~353 MB so this
// matters — re-fetching on every modal open made selecting a second source
// passage feel broken. The HTML for a given importId is immutable (the
// SelfStudyImport snapshot is set at parse time and never changes), so
// caching is safe.
const HTML_CACHE = new Map<string, string>();
// Track in-flight fetches so concurrent opens for the same importId share
// one network request instead of triggering N parallel downloads.
const HTML_INFLIGHT = new Map<string, Promise<string>>();

async function fetchOrUseCachedHtml(importId: string): Promise<string> {
  const cached = HTML_CACHE.get(importId);
  if (cached) return cached;
  const existing = HTML_INFLIGHT.get(importId);
  if (existing) return existing;
  // Ask for raw HTML so the server streams chunks straight to the wire
  // instead of buffering the full 353 MB string in memory + JSON-stringifying
  // it (which is what was causing the "timeout exceeded" first-load errors).
  // The server's content negotiation falls back to JSON for legacy callers
  // that don't send Accept: text/html.
  const p = api.get(`/api/imports/${importId}/content`, {
    headers: { Accept: 'text/html' },
    responseType: 'text',
    // Skip JSON parsing on a 353 MB string — saves several seconds of CPU.
    transformResponse: [(data) => data],
    // No artificial timeout — let the server stream finish. The browser's
    // own network timeout still applies but is generous (~5 min).
    timeout: 0,
  }).then((res) => {
    const html: string = typeof res.data === 'string' ? res.data : '';
    if (!html) throw new Error('No document content returned by the server.');
    HTML_CACHE.set(importId, html);
    HTML_INFLIGHT.delete(importId);
    return html;
  }).catch((err) => {
    HTML_INFLIGHT.delete(importId);
    throw err;
  });
  HTML_INFLIGHT.set(importId, p);
  return p;
}

/** Drop the cached document HTML for an importId. Call after a re-import
 *  fires so a new modal-open doesn't show the stale prior-version HTML. */
export function invalidateShowInSourceCache(importId: string): void {
  HTML_CACHE.delete(importId);
  HTML_INFLIGHT.delete(importId);
}

export function ShowInSourceModal({
  open,
  importId,
  sectionId,
  matchText,
  onClose,
  selectionTarget,
  onSelectionConfirmed
}: ShowInSourceModalProps): JSX.Element | null {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const contentRef = useRef<HTMLDivElement>(null);
  const inSelectionMode = !!selectionTarget && !!onSelectionConfirmed;
  const [selectedPassage, setSelectedPassage] = useState<string>('');

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Fetch the document HTML on open — use the module-level cache so the
  // second + third "Pick the source passage…" open is instant. The 353 MB
  // Stevenson HTML re-downloads + re-renders made every open feel hung.
  useEffect(() => {
    if (!open || !importId) return;
    let cancelled = false;

    // Synchronous cache hit — flip straight to 'ready' without ever
    // showing the loading spinner.
    const cached = HTML_CACHE.get(importId);
    if (cached) {
      setState({ kind: 'ready', html: cached, matchKind: 'missing' });
      return () => { cancelled = true; };
    }

    setState({ kind: 'loading' });
    fetchOrUseCachedHtml(importId)
      .then((html) => {
        if (cancelled) return;
        setState({ kind: 'ready', html, matchKind: 'missing' });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err?.response?.data?.error || err?.message || String(err)
        });
      });
    return () => { cancelled = true; };
  }, [open, importId]);

  // After HTML mounts, try to locate the anchor (or fuzzy fallback).
  // Skipped in selection mode — the coordinator is picking a passage by hand,
  // not looking at a known anchor.
  useEffect(() => {
    if (state.kind !== 'ready' || !contentRef.current) return;
    if (inSelectionMode) return;
    const root = contentRef.current;

    // Strategy 1: direct anchor match via the section_id (matcher emits
    // anchors as "<source>:<tier>:<hash>" — we look for an element with
    // a matching id or data-section-id attribute).
    if (sectionId) {
      const direct = root.querySelector(`[data-section-id="${sectionId}"], #${CSS.escape(sectionId)}`);
      if (direct) {
        (direct as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        (direct as HTMLElement).style.outline = '2px solid #006B3F';
        setState((s) => (s.kind === 'ready' ? { ...s, matchKind: 'anchor' } : s));
        return;
      }
    }

    // Strategy 2: longest-substring fuzzy text match across several start
    // offsets in the needle.
    //
    // The original "longest-prefix from offset 0" version (still kept as
    // the FIRST pass below) fails when the AI prepends a synthesized
    // heading to the snippet — observed 2026-05-22 on Stevenson card
    // "Describe the institution. Table of Contents". The heading is NOT
    // a literal substring of the source document, so no node matched
    // even 60 chars of the needle's prefix → match-kind 'missing' → modal
    // scrolled to the top of the doc, useless to the coordinator.
    //
    // Fix: when prefix matching fails, slide the needle window. Try
    // offsets 50 / 100 / 200 / 300 / 500 — the document text starts
    // SOMEWHERE in the snippet; we just don't know exactly where. Pick
    // whichever offset's longest-match is largest.
    //
    // Also defeats a separate failure mode where the AI's snippet has
    // formatting differences from the source (line breaks turned into
    // spaces, smart quotes vs straight quotes, etc.) that happen to
    // disagree in the first 60 chars but agree in the body.
    const fullNeedle = normalizeForSearch(matchText.slice(0, 600));
    if (fullNeedle.length < 20) {
      setState((s) => (s.kind === 'ready' ? { ...s, matchKind: 'missing' } : s));
      return;
    }

    const minPrefix = 60; // require at least this many matching chars to score
    const offsetsToTry = [0, 50, 100, 200, 300, 500].filter(
      (o) => o + minPrefix < fullNeedle.length
    );
    // Always include offset 0 (the original behavior is the most likely to win).
    if (!offsetsToTry.includes(0)) offsetsToTry.unshift(0);

    let bestNode: Node | null = null;
    let bestScore = 0;
    let bestOffset = 0;

    for (const offset of offsetsToTry) {
      const needle = fullNeedle.slice(offset);
      if (needle.length < minPrefix) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const t = (node.textContent || '').trim();
        if (t.length < minPrefix) continue;
        const nt = normalizeForSearch(t);
        // Find the longest prefix of `needle` contained anywhere in nt.
        // Binary-search the prefix length so we don't pay O(N*L) on long
        // narratives.
        let lo = minPrefix;
        let hi = Math.min(needle.length, nt.length);
        let candidate = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (nt.includes(needle.slice(0, mid))) {
            candidate = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (candidate > bestScore) {
          bestScore = candidate;
          bestNode = node;
          bestOffset = offset;
          // Short-circuit if we've matched (almost) the entire needle.
          if (candidate >= Math.min(needle.length, 400)) break;
        }
      }
      // If we found a strong match (>= 200 chars) at this offset, stop
      // trying further offsets. Earlier offsets are preferred — they're
      // more likely to be the right paragraph.
      if (bestScore >= 200) break;
    }

    if (bestNode) {
      const parent = (bestNode as Node).parentElement;
      if (parent) {
        parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        parent.style.outline = '2px solid #d97706'; // amber
      }
      // Diagnostic: log the offset + score so we can see in dev tools how
      // often the slid-window strategy is rescuing matches that would
      // otherwise have been 'missing'.
      if (bestOffset !== 0) {
        // eslint-disable-next-line no-console
        console.debug(
          `[show-in-source] fuzzy match via offset=${bestOffset} score=${bestScore} ` +
            `(prefix-from-0 had insufficient match; AI-prepended heading likely)`
        );
      }
      setState((s) => (s.kind === 'ready' ? { ...s, matchKind: 'fuzzy' } : s));
      return;
    }
    setState((s) => (s.kind === 'ready' ? { ...s, matchKind: 'missing' } : s));
  }, [state.kind, sectionId, matchText, inSelectionMode]);

  // CR-031-style fix 2026-05-22 — also capture the selection's HTML so
  // tables / formatted lists survive the round-trip into a bucket item.
  // Previously only the plain text was captured, which flattened tables
  // into one-line-per-cell text that was unreadable.
  const [selectedHtml, setSelectedHtml] = useState<string>('');

  // In selection mode, watch the document selection so the confirm button
  // can flip enabled the moment the user highlights something.
  useEffect(() => {
    if (!inSelectionMode) return;
    const onSelChange = () => {
      const sel = window.getSelection?.();
      const text = sel?.toString().trim() || '';
      // Only count selections that are inside our modal's content viewport.
      if (text && contentRef.current && sel && sel.anchorNode) {
        const anchorIn = contentRef.current.contains(sel.anchorNode);
        if (anchorIn) {
          setSelectedPassage(text);
          // Capture HTML from the first range. cloneContents preserves
          // <table>, <tr>, <td>, <ul>, etc structure. tableizeIfBareRows
          // handles the partial-table case (bare <tr>/<td> from
          // selecting rows inside a table) — fix 2026-05-22.
          try {
            const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
            if (range) {
              const fragment = range.cloneContents();
              const container = document.createElement('div');
              container.appendChild(fragment);
              const raw = container.innerHTML.trim();
              const html = tableizeIfBareRows(raw);
              const hasStructure = /<(table|tr|td|th|ul|ol|li|p|br)\b/i.test(html);
              setSelectedHtml(hasStructure ? html : '');
            } else {
              setSelectedHtml('');
            }
          } catch {
            setSelectedHtml('');
          }
          return;
        }
      }
      setSelectedPassage('');
      setSelectedHtml('');
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [inSelectionMode]);

  // Reset captured selection whenever the target changes.
  useEffect(() => {
    setSelectedPassage('');
    setSelectedHtml('');
  }, [selectionTarget?.std, selectionTarget?.spec]);

  const handleConfirmSelection = () => {
    if (!inSelectionMode || !selectedPassage) return;
    onSelectionConfirmed?.(selectedPassage, { html: selectedHtml || undefined });
    setSelectedPassage('');
    setSelectedHtml('');
  };

  // IMPORTANT: don't `return null` when closed — that would unmount the
  // <div dangerouslySetInnerHTML={{__html: state.html}} />, throwing away
  // the browser's parsed-and-laid-out 353 MB Stevenson DOM. Reopening
  // would force the browser to re-parse the same HTML — every modal
  // open felt hung for 10-15 seconds even after the network cache was
  // populated. Instead, keep the modal mounted always (once `importId`
  // is known) and toggle visibility with CSS `display`. Children stay
  // in the DOM; the second open is instant.
  if (!importId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Source document"
      aria-hidden={!open}
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      style={{ display: open ? 'flex' : 'none' }}
      onClick={onClose}
    >
      <div
        className="flex h-full w-[60vw] flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            {inSelectionMode
              ? `Pick the source passage for ${selectionTarget!.std}.${selectionTarget!.spec}`
              : 'Show in source'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {inSelectionMode && (
          <div className="border-b border-cshse-200 bg-cshse-50/60 px-4 py-2 text-xs text-cshse-800">
            Highlight the passage in the document that addresses this spec, then
            click <strong>Use this passage</strong>. The selection becomes the
            new card content AND is sent to the matcher as a labeled example
            so future imports pick it up automatically (per-institution scope).
          </div>
        )}

        {state.kind === 'ready' && state.matchKind === 'fuzzy' && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            This document has changed since the item was created — best-effort match shown below.
          </div>
        )}
        {state.kind === 'ready' && state.matchKind === 'missing' && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            This content is no longer in the current document version. Showing the document from the top.
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          {state.kind === 'loading' && (
            <div className="flex h-32 items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Loading document…
            </div>
          )}
          {state.kind === 'error' && (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {state.message}
            </div>
          )}
          {state.kind === 'ready' && (
            <div
              ref={contentRef}
              className="prose max-w-none text-sm"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: state.html }}
            />
          )}
        </div>

        {inSelectionMode && (
          <div className="border-t border-gray-200 bg-white px-4 py-3">
            <div className="mb-2 max-h-20 overflow-auto rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {selectedPassage
                ? <><span className="font-semibold">Selected:</span> {selectedPassage.slice(0, 320)}{selectedPassage.length > 320 ? '…' : ''}</>
                : <span className="italic text-gray-500">No passage selected yet. Highlight text in the document above.</span>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedPassage}
                className="inline-flex items-center gap-1 rounded bg-cshse-600 px-3 py-1.5 text-sm text-white hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Check className="h-3.5 w-3.5" aria-hidden /> Use this passage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

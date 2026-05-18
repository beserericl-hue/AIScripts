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
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../../../../services/api';

interface ShowInSourceModalProps {
  open: boolean;
  importId: string | null;
  sectionId: string | null;
  /** Body text used as the fuzzy-match fallback when the anchor is missing. */
  matchText: string;
  onClose: () => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; html: string; matchKind: 'anchor' | 'fuzzy' | 'missing' }
  | { kind: 'error'; message: string };

function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function ShowInSourceModal({
  open,
  importId,
  sectionId,
  matchText,
  onClose
}: ShowInSourceModalProps): JSX.Element | null {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const contentRef = useRef<HTMLDivElement>(null);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Fetch the document HTML on open.
  useEffect(() => {
    if (!open || !importId) return;
    setState({ kind: 'loading' });
    api
      .get(`/api/imports/${importId}/content`)
      .then((res) => {
        const html = typeof res.data === 'string' ? res.data : res.data?.html || res.data?.content || '';
        if (!html) {
          setState({ kind: 'error', message: 'No document content returned by the server.' });
          return;
        }
        setState({ kind: 'ready', html, matchKind: 'missing' });
      })
      .catch((err: any) => {
        setState({
          kind: 'error',
          message: err?.response?.data?.error || err?.message || String(err)
        });
      });
  }, [open, importId]);

  // After HTML mounts, try to locate the anchor (or fuzzy fallback).
  useEffect(() => {
    if (state.kind !== 'ready' || !contentRef.current) return;
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

    // Strategy 2: fuzzy text match. Walk the DOM looking for the first
    // text node whose normalized content contains the normalized match
    // string.
    const needle = normalizeForSearch(matchText.slice(0, 200));
    if (needle.length < 20) {
      setState((s) => (s.kind === 'ready' ? { ...s, matchKind: 'missing' } : s));
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = (node.textContent || '').trim();
      if (t.length === 0) continue;
      if (normalizeForSearch(t).includes(needle.slice(0, 80))) {
        const parent = node.parentElement;
        if (parent) {
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          parent.style.outline = '2px solid #d97706'; // amber
        }
        setState((s) => (s.kind === 'ready' ? { ...s, matchKind: 'fuzzy' } : s));
        return;
      }
    }
    setState((s) => (s.kind === 'ready' ? { ...s, matchKind: 'missing' } : s));
  }, [state.kind, sectionId, matchText]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Source document"
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-[60vw] flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Show in source</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

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
      </div>
    </div>
  );
}

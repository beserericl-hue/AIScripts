/**
 * Phase 2c — Source pane for the Review "Compare" mode.
 *
 * Renders the original source document (read-only, selectable) beside the
 * editable imported content so the coordinator can verify fidelity and
 * copy/paste rich content (links, images, tables) from the source into the
 * imported pane. Reuses ShowInSourceModal's cached fetch + the same
 * anchor/fuzzy locate so the document scrolls to this item's section.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { fetchOrUseCachedHtml } from './ShowInSourceModal';
import { openLinksInNewTab } from './linkNewTab';

interface SourceComparePaneProps {
  importId: string | null;
  submissionId?: string | null;
  sectionId: string | null;
  /** Snippet text used to locate the section when the anchor is missing. */
  matchText: string;
}

function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; html: string }
  | { kind: 'error'; message: string };

export function SourceComparePane({
  importId,
  submissionId,
  sectionId,
  matchText
}: SourceComparePaneProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [matchKind, setMatchKind] = useState<'anchor' | 'fuzzy' | 'missing'>('missing');
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll the source pane so `el` sits near the top. Set scrollTop directly
  // (reliable across large documents, unlike smooth scrollIntoView). Deferred
  // across two animation frames + a timeout so the 300KB document has finished
  // laying out before we measure — otherwise the offset is computed against a
  // not-yet-expanded DOM and the scroll lands at 0.
  const scrollToElement = (el: HTMLElement) => {
    const doScroll = () => {
      const sc = scrollRef.current;
      if (!sc) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
      sc.scrollTop = sc.scrollTop + (el.getBoundingClientRect().top - sc.getBoundingClientRect().top) - 16;
    };
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
    window.setTimeout(doScroll, 350);
    window.setTimeout(doScroll, 800);
  };

  useEffect(() => {
    if (!importId) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchOrUseCachedHtml(importId, submissionId)
      .then((html) => {
        if (!cancelled) setState({ kind: 'ready', html });
      })
      .catch((err: any) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err?.response?.data?.error || err?.message || String(err)
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [importId, submissionId]);

  // Locate this item's section in the source after the HTML mounts: direct
  // anchor first, then a best-effort longest-prefix fuzzy text match.
  useEffect(() => {
    if (state.kind !== 'ready' || !contentRef.current) return;
    const root = contentRef.current;

    if (sectionId) {
      const direct = root.querySelector(
        `[data-section-id="${sectionId}"], #${CSS.escape(sectionId)}`
      );
      if (direct) {
        const el = direct as HTMLElement;
        el.style.outline = '3px solid #d97706';
        el.style.outlineOffset = '2px';
        el.style.background = '#fef3c7';
        el.style.borderRadius = '4px';
        scrollToElement(el);
        setMatchKind('anchor');
        return;
      }
    }

    // Slide the needle window across several start offsets — the AI often
    // prepends a synthesized heading to the snippet, so offset 0 isn't always
    // where the document text begins. Pick the offset whose longest prefix
    // match is largest (ported from ShowInSourceModal).
    const fullNeedle = normalizeForSearch((matchText || '').slice(0, 600));
    if (fullNeedle.length >= 20) {
      const minPrefix = 40;
      const offsets = [0, 50, 100, 200, 300, 500].filter((o) => o + minPrefix < fullNeedle.length);
      if (!offsets.includes(0)) offsets.unshift(0);
      let best: Node | null = null;
      let bestScore = 0;
      for (const offset of offsets) {
        const needle = fullNeedle.slice(offset);
        if (needle.length < minPrefix) continue;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const t = normalizeForSearch(node.textContent || '');
          if (t.length < minPrefix) continue;
          let lo = minPrefix;
          let hi = Math.min(needle.length, t.length);
          let cand = 0;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (t.includes(needle.slice(0, mid))) {
              cand = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          if (cand > bestScore) {
            bestScore = cand;
            best = node;
            if (cand >= Math.min(needle.length, 400)) break;
          }
        }
        if (bestScore >= 200) break;
      }
      if (best) {
        const p = (best as Node).parentElement;
        if (p) {
          // Highlight the match prominently (orange box + tint) and scroll it
          // near the TOP of the source pane so it's obvious what to copy.
          p.style.outline = '3px solid #d97706';
          p.style.outlineOffset = '2px';
          p.style.background = '#fef3c7';
          p.style.borderRadius = '4px';
          scrollToElement(p);
        }
        setMatchKind('fuzzy');
        return;
      }
    }
    setMatchKind('missing');
  }, [state.kind, sectionId, matchText]);

  return (
    <div className="flex min-w-0 flex-1 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Source document
        </span>
        {state.kind === 'ready' && matchKind === 'anchor' && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
            located
          </span>
        )}
        {state.kind === 'ready' && matchKind === 'fuzzy' && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
            best-effort match
          </span>
        )}
        {state.kind === 'ready' && matchKind === 'missing' && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
            section not located — showing top
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">read-only · select to copy</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3" data-testid="compare-source-pane">
        {!importId && (
          <div className="rounded border border-dashed border-gray-300 bg-white p-3 text-xs italic text-gray-500">
            No source document is linked to this item.
          </div>
        )}
        {state.kind === 'loading' && (
          <div className="flex h-32 items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Loading source…
          </div>
        )}
        {state.kind === 'error' && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {state.message}
          </div>
        )}
        {state.kind === 'ready' && (
          <div
            ref={contentRef}
            onClick={openLinksInNewTab}
            className="prose prose-sm max-w-none text-sm
              [&_a]:text-cshse-700 [&_a]:underline [&_a]:cursor-pointer
              [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1
              [&_img]:max-w-full"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
        )}
      </div>
    </div>
  );
}

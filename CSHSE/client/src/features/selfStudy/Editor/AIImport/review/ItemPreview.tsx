/**
 * ItemPreview — right column of the Review step (AI evaluation panel).
 *
 * Smoke-test feedback (2026-05-18): the prior preview duplicated the
 * body text shown in the middle column, leaving little room for the
 * AI's evaluation. This rewrite focuses the right pane on EVALUATION
 * only:
 *
 *   - Source heading + anchor
 *   - Confidence with band label (high / medium / low)
 *   - Accept-state badge (auto_accept / review_letter_disagrees /
 *     review_low_confidence / review_unknown)
 *   - AI rationale (verbatim from the matcher)
 *   - Alternates (top candidate specs the matcher considered)
 *   - Action chooser (kind dropdown + reassign)
 *   - "Show in source" button
 *
 * The body text itself now lives in the middle ItemCardList cards.
 */
import React, { useEffect, useRef } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { BucketItem, SpecBucket, Tag } from '../../../../../store/aiImportStore';
import { ItemKind } from './ItemCardList';

interface ItemPreviewProps {
  bucket: SpecBucket | null;
  selectedSectionId: string | null;
  tags: Tag[];
  onChangeKind: (sectionId: string, kind: ItemKind | 'discard') => void;
  onReassign: (sectionId: string) => void;
  onShowInSource: (sectionId: string) => void;
}

function findItem(
  bucket: SpecBucket | null,
  tags: Tag[],
  sectionId: string | null
): { kind: ItemKind | 'tag'; item: BucketItem | Tag } | null {
  if (!sectionId) return null;
  if (bucket) {
    const narr = bucket.narratives.find((i) => i.sectionId === sectionId);
    if (narr) return { kind: 'text', item: narr };
    const evtxt = bucket.evidenceText.find((i) => i.sectionId === sectionId);
    if (evtxt) return { kind: 'evidenceText', item: evtxt };
    const file = bucket.evidenceFiles.find((i) => i.sectionId === sectionId);
    if (file) return { kind: 'file', item: file };
  }
  const tag = tags.find((t) => t.sectionId === sectionId);
  if (tag) return { kind: 'tag', item: tag };
  return null;
}

function isTag(x: BucketItem | Tag): x is Tag {
  return 'tagId' in x;
}

function confBand(c: number): { label: string; textCls: string; bgCls: string } {
  if (c >= 0.85) return { label: 'high', textCls: 'text-green-700', bgCls: 'bg-green-50 border-green-200' };
  if (c >= 0.5) return { label: 'medium', textCls: 'text-amber-700', bgCls: 'bg-amber-50 border-amber-200' };
  return { label: 'low', textCls: 'text-slate-600', bgCls: 'bg-slate-50 border-slate-200' };
}

const ACCEPT_STATE_LABEL: Record<string, string> = {
  auto_accept: 'Auto-accepted',
  review_letter_disagrees: 'Letter disagreement — review',
  review_low_confidence: 'Low confidence — review',
  review_unknown: 'Unknown — manual review',
};

const ACCEPT_STATE_COLOR: Record<string, string> = {
  auto_accept: 'bg-green-100 text-green-800',
  review_letter_disagrees: 'bg-amber-100 text-amber-800',
  review_low_confidence: 'bg-amber-100 text-amber-800',
  review_unknown: 'bg-red-100 text-red-800',
};

export function ItemPreview({
  bucket,
  selectedSectionId,
  tags,
  onChangeKind,
  onReassign,
  onShowInSource
}: ItemPreviewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const found = findItem(bucket, tags, selectedSectionId);

  useEffect(() => {
    if (found && containerRef.current) {
      containerRef.current.focus({ preventScroll: true });
    }
  }, [selectedSectionId, found]);

  if (!found) {
    return (
      <aside
        className="flex h-full w-96 items-center justify-center border-l border-gray-200 bg-white text-sm text-gray-500 p-6 text-center"
        aria-label="AI evaluation"
      >
        Select an item from the middle pane to see the AI's evaluation.
      </aside>
    );
  }

  const { kind, item } = found;
  const heading = isTag(item) ? item.summary : item.heading;
  const rationale = item.rationale;
  const confidence = isTag(item) ? item.confidence : item.confidence;
  const wordCount = isTag(item) ? item.fullText.split(/\s+/).length : item.wordCount;
  const acceptState = isTag(item) ? item.acceptState : (item as BucketItem).acceptState;
  const band = confBand(confidence);

  return (
    <aside
      ref={containerRef}
      tabIndex={-1}
      aria-label="AI evaluation panel"
      className="flex h-full w-96 flex-col border-l border-gray-200 bg-white focus:outline-none"
    >
      {/* Header — what the AI saw */}
      <div className="border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cshse-600" aria-hidden />
          <h3 className="text-sm font-semibold text-gray-900">AI evaluation</h3>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Source heading</div>
          <div className="mt-1 text-sm font-medium text-gray-900 break-words">
            {heading || '(no heading)'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`rounded border px-2 py-1.5 ${band.bgCls}`}>
            <div className="uppercase tracking-wide text-[10px] text-gray-500">Confidence</div>
            <div className={`mt-0.5 font-mono font-semibold ${band.textCls}`}>
              {confidence.toFixed(2)} <span className="font-sans text-[10px]">({band.label})</span>
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
            <div className="uppercase tracking-wide text-[10px] text-gray-500">Word count</div>
            <div className="mt-0.5 font-mono font-semibold text-gray-700">{wordCount}</div>
          </div>
        </div>

        {acceptState && (
          <div className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ACCEPT_STATE_COLOR[acceptState] || 'bg-gray-100 text-gray-700'}`}>
            {ACCEPT_STATE_LABEL[acceptState] || acceptState}
          </div>
        )}
      </div>

      {/* Rationale — the meat of the evaluation */}
      <div className="flex-1 overflow-auto p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">AI rationale</div>
        {rationale ? (
          <div className="rounded border border-cshse-100 bg-cshse-50 px-3 py-3 text-sm leading-relaxed text-cshse-900">
            {rationale}
          </div>
        ) : (
          <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm italic text-gray-500">
            No rationale recorded — the matcher returned this item without a written explanation.
          </div>
        )}

        <button
          onClick={() => onShowInSource(selectedSectionId!)}
          className="mt-4 inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
          Show in source document
        </button>
      </div>

      {/* Action footer */}
      <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-2">
        <label className="block text-xs font-medium text-gray-700">Place this item as:</label>
        <select
          value={kind}
          onChange={(e) => onChangeKind(selectedSectionId!, e.target.value as ItemKind | 'discard')}
          className="block w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-cshse-500 focus:ring-1 focus:ring-cshse-500"
        >
          <option value="text">Narrative</option>
          <option value="evidenceText">Supporting evidence text</option>
          <option value="file">Supporting evidence file</option>
          <option value="tag">Defer to tag list</option>
          <option value="discard">Discard</option>
        </select>
        <button
          onClick={() => onReassign(selectedSectionId!)}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Reassign to a different (Std, Spec)…
        </button>
      </div>
    </aside>
  );
}

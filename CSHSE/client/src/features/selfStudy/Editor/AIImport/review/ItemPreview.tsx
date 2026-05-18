/**
 * ItemPreview — right column of the Review step.
 *
 * Shows full body + AI rationale + action chooser for the currently
 * selected item. The action chooser lets the Coordinator change the
 * destination kind or reassign the (std, spec) before Apply.
 *
 * Keyboard: focus auto-moves into the preview when an item is selected
 * (UI spec §14); Esc returns focus to the table.
 */
import React, { useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import type { BucketItem, SpecBucket, Tag } from '../../../../../store/aiImportStore';
import { ItemKind } from './ItemTable';

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
): { kind: ItemKind | 'tag'; item: BucketItem | Tag; bucketKey?: string } | null {
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

  // Auto-focus into the preview when an item is newly selected.
  useEffect(() => {
    if (found && containerRef.current) {
      containerRef.current.focus({ preventScroll: true });
    }
  }, [selectedSectionId, found]);

  if (!found) {
    return (
      <aside
        className="flex h-full w-96 items-center justify-center border-l border-gray-200 bg-white text-sm text-gray-500"
        aria-label="Item preview"
      >
        Select an item to preview
      </aside>
    );
  }

  const { kind, item } = found;
  const heading = isTag(item) ? item.summary : item.heading;
  const snippet = isTag(item) ? item.fullText : item.snippet;
  const rationale = item.rationale;
  const confidence = isTag(item) ? item.confidence : item.confidence;
  const wordCount = isTag(item) ? item.fullText.split(/\s+/).length : item.wordCount;

  return (
    <aside
      ref={containerRef}
      tabIndex={-1}
      aria-label="Item preview"
      className="flex h-full w-96 flex-col border-l border-gray-200 bg-white focus:outline-none"
    >
      <div className="border-b border-gray-200 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
        <div className="mt-1 text-sm font-medium text-gray-900">{heading || '(no heading)'}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
          <span>
            Conf <strong>{confidence.toFixed(2)}</strong>
          </span>
          <span>{wordCount} words</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5">{kind}</span>
        </div>
        <button
          onClick={() => onShowInSource(selectedSectionId!)}
          className="mt-3 inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
          Show in source
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 text-sm">
        {rationale && (
          <div className="mb-3 rounded border border-cshse-100 bg-cshse-50 px-3 py-2 text-xs text-cshse-900">
            <span className="font-semibold">AI rationale:</span> {rationale}
          </div>
        )}
        <div className="whitespace-pre-wrap font-mono text-xs text-gray-800">{snippet}</div>
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <label className="block text-xs font-medium text-gray-700">Place this item as:</label>
        <select
          value={kind}
          onChange={(e) => onChangeKind(selectedSectionId!, e.target.value as ItemKind | 'discard')}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-cshse-500 focus:ring-1 focus:ring-cshse-500"
        >
          <option value="text">Narrative</option>
          <option value="evidenceText">Supporting evidence text</option>
          <option value="file">Supporting evidence file</option>
          <option value="tag">Defer to tag list</option>
          <option value="discard">Discard</option>
        </select>

        <button
          onClick={() => onReassign(selectedSectionId!)}
          className="mt-2 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Reassign to a different (Std, Spec)…
        </button>
      </div>
    </aside>
  );
}

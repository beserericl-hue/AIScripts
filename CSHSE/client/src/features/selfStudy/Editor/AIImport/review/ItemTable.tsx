/**
 * ItemTable — middle column of the Review step.
 *
 * Lists every item the matcher placed in the currently-selected spec
 * (or the "Unplaced" / "Unwritten" synthetic buckets). Supports row
 * selection, bulk actions (send-to-tags / promote-to-file / reassign),
 * sorting by confidence or source, and keyboard navigation (UI spec
 * §14 — arrow keys move rows, Enter opens preview, Space toggles
 * checkbox, j/k Vim aliases).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, FileBox, Tag as TagIcon, Move } from 'lucide-react';
import type {
  BucketItem,
  PlaceholderSection,
  SpecBucket,
  Tag
} from '../../../../../store/aiImportStore';
import { UNPLACED_KEY, UNWRITTEN_KEY } from './SpecRail';

export type ItemKind = 'text' | 'evidenceText' | 'file' | 'matrix' | 'tag';

export interface FlatItem {
  /** Stable identifier — sectionId for real items, "placeholder-N" for placeholder rows. */
  rowId: string;
  sectionId: string;
  source: string;
  confidence: number;
  kind: ItemKind;
  wordCount: number;
  heading: string;
  snippet: string;
  rationale: string;
}

interface ItemTableProps {
  selectedKey: string | null;
  bucket: SpecBucket | null;
  unplacedTags: Tag[];
  placeholders: PlaceholderSection[];
  selectedSectionId: string | null;
  onSelect: (sectionId: string) => void;
  onBulkAction: (
    action: 'to-tags' | 'to-file' | 'reassign',
    sectionIds: string[],
    target?: { std: string; spec: string }
  ) => void;
}

function flattenBucket(bucket: SpecBucket): FlatItem[] {
  const rows: FlatItem[] = [];
  for (const n of bucket.narratives) rows.push(toFlat(n, 'text'));
  for (const e of bucket.evidenceText) rows.push(toFlat(e, 'evidenceText'));
  for (const f of bucket.evidenceFiles) rows.push(toFlat(f, 'file'));
  return rows;
}

function toFlat(item: BucketItem, kind: ItemKind): FlatItem {
  return {
    rowId: item.sectionId,
    sectionId: item.sectionId,
    source: item.heading || '(no heading)',
    confidence: item.confidence,
    kind,
    wordCount: item.wordCount,
    heading: item.heading,
    snippet: item.snippet,
    rationale: item.rationale
  };
}

function flattenTags(tags: Tag[]): FlatItem[] {
  return tags.map((t) => ({
    rowId: t.tagId,
    sectionId: t.sectionId,
    source: t.sourceHeading || '(no heading)',
    confidence: t.confidence,
    kind: 'tag' as ItemKind,
    wordCount: t.fullText.split(/\s+/).length,
    heading: t.summary,
    snippet: t.fullText,
    rationale: t.rationale
  }));
}

function flattenPlaceholders(items: PlaceholderSection[]): FlatItem[] {
  return items.map((p, idx) => ({
    rowId: `placeholder-${idx}-${p.paragraphIndex}`,
    sectionId: `placeholder-${p.paragraphIndex}`,
    source: `paragraph ${p.paragraphIndex}`,
    confidence: 0,
    kind: 'tag' as ItemKind,
    wordCount: 0,
    heading: p.heading,
    snippet: '(no content authored yet)',
    rationale: p.standardHint
      ? `Heading hints at Standard ${p.standardHint}${p.specHint ? `.${p.specHint}` : ''}.`
      : ''
  }));
}

function confColor(c: number): { ring: string; text: string; bg: string } {
  if (c >= 0.85) return { ring: 'ring-green-300', text: 'text-green-700', bg: 'bg-green-50' };
  if (c >= 0.5) return { ring: 'ring-amber-300', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { ring: 'ring-slate-300', text: 'text-slate-500', bg: 'bg-slate-50' };
}

const KIND_LABEL: Record<ItemKind, string> = {
  text: 'Narrative',
  evidenceText: 'Evidence text',
  file: 'Evidence file',
  matrix: 'Matrix cell',
  tag: 'Tag'
};

export function ItemTable({
  selectedKey,
  bucket,
  unplacedTags,
  placeholders,
  selectedSectionId,
  onSelect,
  onBulkAction
}: ItemTableProps): JSX.Element {
  const [sortBy, setSortBy] = useState<'confidence' | 'source' | 'words'>('confidence');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLTableElement>(null);

  const items = useMemo<FlatItem[]>(() => {
    if (selectedKey === UNPLACED_KEY) return flattenTags(unplacedTags);
    if (selectedKey === UNWRITTEN_KEY) return flattenPlaceholders(placeholders);
    if (!bucket) return [];
    return flattenBucket(bucket);
  }, [selectedKey, bucket, unplacedTags, placeholders]);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'confidence') return (a.confidence - b.confidence) * dir;
      if (sortBy === 'words') return (a.wordCount - b.wordCount) * dir;
      return a.source.localeCompare(b.source) * dir;
    });
    return copy;
  }, [items, sortBy, sortDir]);

  // Reset checks when the spec changes.
  useEffect(() => {
    setChecked(new Set());
  }, [selectedKey]);

  const toggleCheck = (rowId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const allChecked = sorted.length > 0 && sorted.every((r) => checked.has(r.rowId));
  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(sorted.map((r) => r.rowId)));
  };

  // Keyboard navigation per UI spec §14.
  const handleKeyDown = (e: React.KeyboardEvent, item: FlatItem, idx: number) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const next = sorted[Math.min(idx + 1, sorted.length - 1)];
      if (next) onSelect(next.sectionId);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prev = sorted[Math.max(idx - 1, 0)];
      if (prev) onSelect(prev.sectionId);
    } else if (e.key === ' ') {
      e.preventDefault();
      toggleCheck(item.rowId);
    }
  };

  const bulk = (action: 'to-tags' | 'to-file' | 'reassign') => {
    const ids = [...checked]
      .map((rowId) => sorted.find((r) => r.rowId === rowId)?.sectionId)
      .filter((s): s is string => !!s);
    if (ids.length === 0) return;
    onBulkAction(action, ids);
    setChecked(new Set());
  };

  const isPlaceholder = selectedKey === UNWRITTEN_KEY;

  return (
    <div className="flex h-full flex-col">
      {/* Bulk-action toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">
            {sorted.length} item{sorted.length === 1 ? '' : 's'}
            {checked.size > 0 && ` · ${checked.size} selected`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={checked.size === 0 || isPlaceholder}
            onClick={() => bulk('to-tags')}
            className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Move the checked rows to the tag list for triage"
          >
            <TagIcon className="h-3 w-3" aria-hidden /> Send to tags
          </button>
          <button
            disabled={checked.size === 0 || isPlaceholder}
            onClick={() => bulk('to-file')}
            className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Promote the checked rows to evidence files"
          >
            <FileBox className="h-3 w-3" aria-hidden /> Apply as file
          </button>
          <button
            disabled={checked.size === 0 || isPlaceholder}
            onClick={() => bulk('reassign')}
            className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Reassign the checked rows to a different (std, spec)"
          >
            <Move className="h-3 w-3" aria-hidden /> Reassign
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table ref={tableRef} className="w-full table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  disabled={sorted.length === 0 || isPlaceholder}
                  aria-label="Select all items"
                  className="rounded text-cshse-600 focus:ring-cshse-500"
                />
              </th>
              <th className="w-8 px-2 py-2">#</th>
              <SortableHeader col="source" current={sortBy} dir={sortDir} onChange={(c, d) => { setSortBy(c); setSortDir(d); }}>
                Source
              </SortableHeader>
              <SortableHeader col="confidence" current={sortBy} dir={sortDir} onChange={(c, d) => { setSortBy(c); setSortDir(d); }} className="w-20">
                Conf
              </SortableHeader>
              <th className="w-28 px-3 py-2">Kind</th>
              <SortableHeader col="words" current={sortBy} dir={sortDir} onChange={(c, d) => { setSortBy(c); setSortDir(d); }} className="w-16">
                Words
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  {selectedKey === UNPLACED_KEY
                    ? 'No unplaced items.'
                    : selectedKey === UNWRITTEN_KEY
                    ? 'Every detected template heading has authored content.'
                    : selectedKey
                    ? 'No items for this spec.'
                    : 'Select a spec from the left.'}
                </td>
              </tr>
            ) : (
              sorted.map((item, idx) => {
                const c = confColor(item.confidence);
                const isActive = selectedSectionId === item.sectionId;
                return (
                  <tr
                    key={item.rowId}
                    role="row"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => onSelect(item.sectionId)}
                    onKeyDown={(e) => handleKeyDown(e, item, idx)}
                    className={`cursor-pointer border-b border-gray-100 ${
                      isActive ? 'bg-cshse-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked.has(item.rowId)}
                        onChange={() => toggleCheck(item.rowId)}
                        disabled={isPlaceholder}
                        aria-label={`Select item ${idx + 1}`}
                        className="rounded text-cshse-600 focus:ring-cshse-500"
                      />
                    </td>
                    <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                    <td className="truncate px-3 py-2 text-gray-700">{item.source}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${c.ring} ${c.bg} ${c.text}`}
                        aria-label={`Confidence ${item.confidence.toFixed(2)}, ${
                          item.confidence >= 0.85 ? 'high' : item.confidence >= 0.5 ? 'medium' : 'low'
                        }`}
                      >
                        {item.confidence.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{KIND_LABEL[item.kind]}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">{item.wordCount}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({
  col,
  current,
  dir,
  onChange,
  className = '',
  children
}: {
  col: 'confidence' | 'source' | 'words';
  current: string;
  dir: 'asc' | 'desc';
  onChange: (col: any, dir: 'asc' | 'desc') => void;
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  const active = current === col;
  return (
    <th className={`px-3 py-2 ${className}`}>
      <button
        onClick={() => onChange(col, active && dir === 'desc' ? 'asc' : 'desc')}
        className={`flex items-center gap-1 font-semibold uppercase text-xs ${
          active ? 'text-cshse-700' : 'text-gray-500'
        }`}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {children}
        <ArrowUpDown className="h-3 w-3" aria-hidden />
      </button>
    </th>
  );
}

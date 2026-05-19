/**
 * ItemCardList — middle column of the Review step (post-2026-05-18 redesign).
 *
 * Per smoke-test feedback: the prior ItemTable showed only a Source / Conf /
 * Kind / Words header row per item, so a Coordinator clicking around the
 * spec rail couldn't see the actual narrative body without selecting one
 * item at a time and reading the right-hand preview. The redesign flips
 * that — the middle pane is a scrollable list of CARDS, each showing the
 * full body text expanded. Clicking a card highlights it and updates the
 * right-hand AI-evaluation pane (rationale, confidence, action chooser).
 *
 * Other improvements:
 *  - Source-label fallback for terse headings (`b.`, `c.`, `f.`) — falls
 *    back to a synthesized label from the first 80 chars of body text.
 *  - Bulk-action toolbar preserved (select-all / send-to-tags /
 *    promote-to-file / reassign).
 *  - Keyboard navigation: ArrowUp/Down + j/k navigate between cards,
 *    Enter selects, Space toggles the card's checkbox.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileBox, Tag as TagIcon, Move } from 'lucide-react';
import type {
  BucketItem,
  PlaceholderSection,
  SpecBucket,
  Tag
} from '../../../../../store/aiImportStore';
import { UNPLACED_KEY, UNWRITTEN_KEY } from './SpecRail';

export type ItemKind = 'text' | 'evidenceText' | 'file' | 'matrix' | 'tag';

export interface CardItem {
  rowId: string;
  sectionId: string;
  rawHeading: string;
  displayLabel: string;   // smart label — falls back to body snippet for terse headings
  confidence: number;
  kind: ItemKind;
  wordCount: number;
  snippet: string;
  rationale: string;
}

interface ItemCardListProps {
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

// Headings like "b.", "c.", "1)", "(a)", "i.", or "x." are non-descriptive —
// we synthesize a label from the body text instead.
const _TERSE_HEADING_RE = /^\s*[A-Za-z0-9]{1,3}[.)\]]?\s*$/;

function deriveDisplayLabel(heading: string, snippet: string): string {
  const h = (heading || '').trim();
  if (!h || _TERSE_HEADING_RE.test(h)) {
    const firstLine = (snippet || '').trim().split(/\n+/)[0] || '';
    if (firstLine) return firstLine.slice(0, 80) + (firstLine.length > 80 ? '…' : '');
    return h || '(no heading)';
  }
  return h.length > 100 ? h.slice(0, 100) + '…' : h;
}

interface BucketGroups {
  narratives: CardItem[];
  evidenceText: CardItem[];
  evidenceFiles: CardItem[];
  matrixCells: CardItem[];
}

function flattenBucket(bucket: SpecBucket): CardItem[] {
  // Preserves original kind order: narratives first, then evidence text,
  // then evidence files, then matrix cells.
  const rows: CardItem[] = [];
  for (const n of bucket.narratives) rows.push(toCard(n, 'text'));
  for (const e of bucket.evidenceText) rows.push(toCard(e, 'evidenceText'));
  for (const f of bucket.evidenceFiles) rows.push(toCard(f, 'file'));
  for (const m of (bucket as any).matrixCells || []) {
    rows.push({
      rowId: `matrix-${m.matrix || 'mx'}-${m.column_index ?? 0}-${m.code_raw || ''}`,
      sectionId: `matrix-${m.matrix || 'mx'}-${m.column_index ?? 0}-${m.code_raw || ''}`,
      rawHeading: `Matrix ${m.matrix || ''} · col ${m.column_index ?? 0}`,
      displayLabel: `Matrix cell: ${m.code_raw || ''} (col ${m.column_index ?? '?'})`,
      confidence: m.confidence ?? 1.0,
      kind: 'matrix' as ItemKind,
      wordCount: 0,
      snippet: `Code: ${m.code_raw || ''}\nContent types: ${(m.content_types || []).join(', ')}\nDepth: ${m.depth || '—'}`,
      rationale: m.spec_prompt || ''
    });
  }
  return rows;
}

function groupBucketByKind(bucket: SpecBucket): BucketGroups {
  return {
    narratives: bucket.narratives.map((n) => toCard(n, 'text')),
    evidenceText: bucket.evidenceText.map((e) => toCard(e, 'evidenceText')),
    evidenceFiles: bucket.evidenceFiles.map((f) => toCard(f, 'file')),
    matrixCells: ((bucket as any).matrixCells || []).map((m: any) => ({
      rowId: `matrix-${m.matrix || 'mx'}-${m.column_index ?? 0}-${m.code_raw || ''}`,
      sectionId: `matrix-${m.matrix || 'mx'}-${m.column_index ?? 0}-${m.code_raw || ''}`,
      rawHeading: `Matrix ${m.matrix || ''} · col ${m.column_index ?? 0}`,
      displayLabel: `Matrix cell: ${m.code_raw || ''} (col ${m.column_index ?? '?'})`,
      confidence: m.confidence ?? 1.0,
      kind: 'matrix' as ItemKind,
      wordCount: 0,
      snippet: `Code: ${m.code_raw || ''}\nContent types: ${(m.content_types || []).join(', ')}\nDepth: ${m.depth || '—'}`,
      rationale: m.spec_prompt || ''
    }))
  };
}

function toCard(item: BucketItem, kind: ItemKind): CardItem {
  return {
    rowId: item.sectionId,
    sectionId: item.sectionId,
    rawHeading: item.heading || '',
    displayLabel: deriveDisplayLabel(item.heading, item.snippet),
    confidence: item.confidence,
    kind,
    wordCount: item.wordCount,
    snippet: item.snippet,
    rationale: item.rationale
  };
}

function flattenTags(tags: Tag[]): CardItem[] {
  return tags.map((t) => ({
    rowId: t.tagId,
    sectionId: t.sectionId,
    rawHeading: t.sourceHeading || '',
    displayLabel: deriveDisplayLabel(t.sourceHeading || t.summary, t.fullText),
    confidence: t.confidence,
    kind: 'tag' as ItemKind,
    wordCount: t.fullText.split(/\s+/).length,
    snippet: t.fullText,
    rationale: t.rationale
  }));
}

function flattenPlaceholders(items: PlaceholderSection[]): CardItem[] {
  return items.map((p, idx) => ({
    rowId: `placeholder-${idx}-${p.paragraphIndex}`,
    sectionId: `placeholder-${p.paragraphIndex}`,
    rawHeading: p.heading,
    displayLabel: deriveDisplayLabel(p.heading, '(no content authored yet)'),
    confidence: 0,
    kind: 'tag' as ItemKind,
    wordCount: 0,
    snippet: '(no content authored yet — re-import after writing a response under this heading)',
    rationale: p.standardHint
      ? `Heading hints at Standard ${p.standardHint}${p.specHint ? `.${p.specHint}` : ''}.`
      : ''
  }));
}

function confBand(c: number): { label: string; textCls: string; bgCls: string } {
  if (c >= 0.85) return { label: 'high', textCls: 'text-green-700', bgCls: 'bg-green-50' };
  if (c >= 0.5) return { label: 'medium', textCls: 'text-amber-700', bgCls: 'bg-amber-50' };
  return { label: 'low', textCls: 'text-slate-600', bgCls: 'bg-slate-50' };
}

const KIND_LABEL: Record<ItemKind, string> = {
  text: 'Narrative',
  evidenceText: 'Evidence text',
  file: 'Evidence file',
  matrix: 'Matrix cell',
  tag: 'Tag'
};

export function ItemCardList({
  selectedKey,
  bucket,
  unplacedTags,
  placeholders,
  selectedSectionId,
  onSelect,
  onBulkAction
}: ItemCardListProps): JSX.Element {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<CardItem[]>(() => {
    if (selectedKey === UNPLACED_KEY) return flattenTags(unplacedTags);
    if (selectedKey === UNWRITTEN_KEY) return flattenPlaceholders(placeholders);
    if (!bucket) return [];
    return flattenBucket(bucket);
  }, [selectedKey, bucket, unplacedTags, placeholders]);

  // Grouped view for real spec buckets (synthetic Unplaced/Unwritten stay flat).
  const groups: BucketGroups | null = useMemo(() => {
    if (selectedKey === UNPLACED_KEY || selectedKey === UNWRITTEN_KEY) return null;
    if (!bucket) return null;
    return groupBucketByKind(bucket);
  }, [selectedKey, bucket]);

  // Reset selection state when the active spec changes.
  useEffect(() => {
    setChecked(new Set());
  }, [selectedKey]);

  // Auto-scroll the selected card into view when it changes externally.
  useEffect(() => {
    if (!selectedSectionId || !listRef.current) return;
    const target = listRef.current.querySelector(`[data-section-id="${CSS.escape(selectedSectionId)}"]`);
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedSectionId]);

  const toggleCheck = (rowId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const allChecked = items.length > 0 && items.every((r) => checked.has(r.rowId));
  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(items.map((r) => r.rowId)));
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: CardItem, idx: number) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const next = items[Math.min(idx + 1, items.length - 1)];
      if (next) onSelect(next.sectionId);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prev = items[Math.max(idx - 1, 0)];
      if (prev) onSelect(prev.sectionId);
    } else if (e.key === ' ') {
      e.preventDefault();
      toggleCheck(item.rowId);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(item.sectionId);
    }
  };

  const bulk = (action: 'to-tags' | 'to-file' | 'reassign') => {
    const ids = [...checked]
      .map((rowId) => items.find((r) => r.rowId === rowId)?.sectionId)
      .filter((s): s is string => !!s);
    if (ids.length === 0) return;
    onBulkAction(action, ids);
    setChecked(new Set());
  };

  const isPlaceholder = selectedKey === UNWRITTEN_KEY;
  const checkedCount = checked.size;

  if (!selectedKey) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-500">
        Select a spec from the left.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-gray-50">
      {/* Bulk-action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="rounded text-cshse-600 focus:ring-cshse-500"
              disabled={items.length === 0 || isPlaceholder}
            />
            <span>
              {items.length} item{items.length === 1 ? '' : 's'}
              {checkedCount > 0 && <span className="ml-1 text-cshse-700">· {checkedCount} selected</span>}
            </span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => bulk('to-tags')}
            disabled={checkedCount === 0 || isPlaceholder}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TagIcon className="h-3 w-3" aria-hidden /> Send to tags
          </button>
          <button
            onClick={() => bulk('to-file')}
            disabled={checkedCount === 0 || isPlaceholder}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileBox className="h-3 w-3" aria-hidden /> Apply as file
          </button>
          <button
            onClick={() => bulk('reassign')}
            disabled={checkedCount === 0 || isPlaceholder}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Move className="h-3 w-3" aria-hidden /> Reassign…
          </button>
        </div>
      </div>

      {/* Card list — grouped by kind for spec buckets, flat for Unplaced/Unwritten */}
      <div ref={listRef} className="flex-1 overflow-auto p-4" aria-label="Items for selected spec">
        {items.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No items in this spec. Pick another from the left rail or check the Unplaced / Unwritten rows.
          </div>
        ) : groups ? (
          <div className="space-y-6">
            <KindSection
              title="Narratives"
              subtitle="Auto-applied as Submission.narratives[std][spec].content"
              icon="📝"
              items={groups.narratives}
              startIdx={1}
              selectedSectionId={selectedSectionId}
              checked={checked}
              isPlaceholder={isPlaceholder}
              onSelect={onSelect}
              onToggleCheck={toggleCheck}
              onKeyDown={handleKeyDown}
            />
            <KindSection
              title="Supporting evidence — text"
              subtitle="Inline supportingEvidenceText"
              icon="📄"
              items={groups.evidenceText}
              startIdx={groups.narratives.length + 1}
              selectedSectionId={selectedSectionId}
              checked={checked}
              isPlaceholder={isPlaceholder}
              onSelect={onSelect}
              onToggleCheck={toggleCheck}
              onKeyDown={handleKeyDown}
            />
            <KindSection
              title="Supporting evidence — files"
              subtitle="Will be uploaded as separate DOCX → SupportingEvidence rows"
              icon="📎"
              items={groups.evidenceFiles}
              startIdx={groups.narratives.length + groups.evidenceText.length + 1}
              selectedSectionId={selectedSectionId}
              checked={checked}
              isPlaceholder={isPlaceholder}
              onSelect={onSelect}
              onToggleCheck={toggleCheck}
              onKeyDown={handleKeyDown}
            />
            <KindSection
              title="Matrix cells"
              subtitle="Will be applied to CurriculumMatrix.cells[]"
              icon="🔢"
              items={groups.matrixCells}
              startIdx={
                groups.narratives.length +
                groups.evidenceText.length +
                groups.evidenceFiles.length +
                1
              }
              selectedSectionId={selectedSectionId}
              checked={checked}
              isPlaceholder={isPlaceholder}
              onSelect={onSelect}
              onToggleCheck={toggleCheck}
              onKeyDown={handleKeyDown}
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item, idx) => (
              <ItemCard
                key={item.rowId}
                item={item}
                index={idx + 1}
                isSelected={item.sectionId === selectedSectionId}
                checked={checked.has(item.rowId)}
                disabled={isPlaceholder}
                onSelect={() => onSelect(item.sectionId)}
                onToggleCheck={() => toggleCheck(item.rowId)}
                onKeyDown={(e) => handleKeyDown(e, item, idx)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- helpers + cards

/**
 * Detect runs of short consecutive lines that look like flattened table cells.
 * Mammoth's DOCX → HTML conversion turns each table cell into its own
 * paragraph; the result reads as "Course code\nDescription\nCredits\n…"
 * which is unreadable as flow prose. When detected, render in monospace
 * so visual alignment helps the reader.
 */
function looksTabular(text: string): boolean {
  if (!text) return false;
  if (text.includes('<table')) return true;
  const lines = text.trim().split(/\n+/);
  if (lines.length < 6) return false;
  let shortCount = 0;
  for (const l of lines) {
    if (l.length <= 30) shortCount++;
  }
  return shortCount / lines.length >= 0.7;
}

interface KindSectionProps {
  title: string;
  subtitle: string;
  icon: string;
  items: CardItem[];
  startIdx: number;
  selectedSectionId: string | null;
  checked: Set<string>;
  isPlaceholder: boolean;
  onSelect: (sectionId: string) => void;
  onToggleCheck: (rowId: string) => void;
  onKeyDown: (e: React.KeyboardEvent, item: CardItem, idx: number) => void;
}

function KindSection({
  title,
  subtitle,
  icon,
  items,
  startIdx,
  selectedSectionId,
  checked,
  isPlaceholder,
  onSelect,
  onToggleCheck,
  onKeyDown
}: KindSectionProps): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section>
      <header className="mb-2 flex items-center gap-2 border-b border-gray-200 pb-1">
        <span aria-hidden>{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{items.length}</span>
        <span className="text-xs text-gray-500">{subtitle}</span>
      </header>
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <ItemCard
            key={item.rowId}
            item={item}
            index={startIdx + idx}
            isSelected={item.sectionId === selectedSectionId}
            checked={checked.has(item.rowId)}
            disabled={isPlaceholder}
            onSelect={() => onSelect(item.sectionId)}
            onToggleCheck={() => onToggleCheck(item.rowId)}
            onKeyDown={(e) => onKeyDown(e, item, idx)}
          />
        ))}
      </ul>
    </section>
  );
}

interface ItemCardProps {
  item: CardItem;
  index: number;
  isSelected: boolean;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function ItemCard({
  item,
  index,
  isSelected,
  checked,
  disabled,
  onSelect,
  onToggleCheck,
  onKeyDown
}: ItemCardProps): JSX.Element {
  const band = confBand(item.confidence);
  const tabular = looksTabular(item.snippet);
  return (
    <li
      data-section-id={item.sectionId}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Item ${index}, ${KIND_LABEL[item.kind]}, ${item.wordCount} words`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`group cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cshse-500 ${
        isSelected ? 'border-cshse-500 ring-2 ring-cshse-300' : 'border-gray-200 hover:border-cshse-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={disabled}
          className="mt-1 rounded text-cshse-600 focus:ring-cshse-500 disabled:opacity-40"
          aria-label="Select item"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">#{index}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${band.bgCls} ${band.textCls}`}
              title={`Confidence ${item.confidence.toFixed(2)} — ${band.label}`}
            >
              {item.confidence.toFixed(2)}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{KIND_LABEL[item.kind]}</span>
            <span className="text-xs text-gray-500">{item.wordCount} words</span>
            {tabular && (
              <span
                className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
                title="Source content looks tabular — rendered in monospace to preserve alignment"
              >
                tabular
              </span>
            )}
          </div>
          <div className="mt-2 text-sm font-semibold text-gray-900">{item.displayLabel}</div>
          {item.rawHeading && item.rawHeading !== item.displayLabel && (
            <div className="mt-0.5 text-xs italic text-gray-500">Source heading: {item.rawHeading}</div>
          )}
          {tabular ? (
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre rounded bg-gray-50 p-3 font-mono text-xs leading-snug text-gray-800">
              {item.snippet}
            </pre>
          ) : (
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{item.snippet}</div>
          )}
        </div>
      </div>
    </li>
  );
}

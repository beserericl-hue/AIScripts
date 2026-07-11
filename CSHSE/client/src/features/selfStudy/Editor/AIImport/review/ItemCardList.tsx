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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileBox, Tag as TagIcon, Move, Grid3x3, Check, Pencil, Trash2, Eye, Columns, Upload, Search } from 'lucide-react';
import { openLinksInNewTab } from './linkNewTab';
import {
  useAIImportStore,
  type BucketItem,
  type CVItem,
  type EvidenceDocItem,
  type IntroductionBucket,
  type MatrixData,
  type PlaceholderSection,
  type SpecBucket,
  type Tag
} from '../../../../../store/aiImportStore';
import {
  UNPLACED_KEY,
  UNWRITTEN_KEY,
  MATRICES_KEY,
  INTRO_DOC_KEY,
  CVS_KEY,
  EVIDENCE_DOCS_KEY,
  PAPERS_KEY,
  SYLLABI_KEY,
  isIntroKey,
  introBucketKeyFromSpecKey
} from './SpecRail';
import { nearestPlacedNeighborFor } from './nearestPlacedNeighbor';
import { tableizeIfBareRows } from './tableizeHtml';
import { useStandardsCatalog } from './useStandardsCatalog';
import { MoveTextModal } from './MoveTextModal';

// ------------------------------------------------------ SpecAssignControls
//
// Shared Standard + cascading Spec dropdown pair used by CVsView and
// EvidenceDocsView so the coordinator can assign (or override) which spec a
// CV / syllabus / appendix paper supports. The selection persists into the
// store (updateCvRouting / updateEvidenceDocRouting) and rides along to the
// server at Apply time, where it stamps SupportingEvidence.standardCode/
// specCode — the field readers use to find evidence per spec.

interface SpecAssignControlsProps {
  sectionId: string;
  std: string | undefined;
  spec: string | undefined;
  /** Local store update (updateCvRouting / updateEvidenceDocRouting). */
  onChange: (std: string, spec: string) => void;
  /** Compact layout for dense card lists. */
  idPrefix: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SpecAssignControls({
  sectionId,
  std,
  spec,
  onChange,
  idPrefix
}: SpecAssignControlsProps): JSX.Element {
  const { standards, error } = useStandardsCatalog();
  const persistEvidenceRouting = useAIImportStore((s) => s.persistEvidenceRouting);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const stdEntry = standards.find((s) => s.std === std);
  const specOptions = stdEntry?.specsForStd ?? [];

  // Update the local store immediately (snappy UI) AND persist to the server so
  // the assignment survives reload + Re-run detectors. The save chip reflects
  // the server round-trip so the coordinator knows it stuck — no separate Save
  // button needed.
  const commit = React.useCallback(
    (nextStd: string, nextSpec: string) => {
      onChange(nextStd, nextSpec);
      setSaveState('saving');
      persistEvidenceRouting(sectionId, nextStd, nextSpec).then((ok) =>
        setSaveState(ok ? 'saved' : 'error')
      );
    },
    [onChange, persistEvidenceRouting, sectionId]
  );

  return (
    <div
      className="mt-2 grid grid-cols-2 gap-2"
      data-tour="review-assign"
      // Don't let clicks inside the dropdowns bubble up to the card's
      // select-on-click handler.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div>
        <label
          htmlFor={`${idPrefix}-std`}
          className="block text-[10px] font-medium uppercase tracking-wide text-gray-500"
        >
          Standard
        </label>
        <select
          id={`${idPrefix}-std`}
          data-testid={`${idPrefix}-std`}
          value={std ?? ''}
          onChange={(e) => {
            const newStd = e.target.value;
            // Reset the spec when the standard changes — spec letters belong
            // to a specific standard. Default to the first spec of the new
            // standard so the pair is never half-set.
            const firstSpec = standards.find((s) => s.std === newStd)
              ?.specsForStd[0]?.spec;
            commit(newStd, firstSpec ?? '');
          }}
          className="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
        >
          <option value="">— standard —</option>
          {/* A file cited only in the program introduction (not under a
              lettered spec) is classified here — the MCC parser pre-selects it
              for such appendices (A1/A2/A3 …). */}
          <option value="introduction">Introduction (referenced in program intro)</option>
          {standards.map((s) => (
            <option key={s.std} value={s.std}>
              {s.std} — {s.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-spec`}
          className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-gray-500"
        >
          <span>Substandard</span>
          {/* Save chip — reflects the server round-trip so the coordinator
              knows the assignment persisted (survives reload + re-detect). */}
          {saveState === 'saving' && (
            <span data-testid={`${idPrefix}-savestate`} className="normal-case text-gray-400">Saving…</span>
          )}
          {saveState === 'saved' && (
            <span data-testid={`${idPrefix}-savestate`} className="normal-case font-medium text-emerald-600">✓ Saved</span>
          )}
          {saveState === 'error' && (
            <span data-testid={`${idPrefix}-savestate`} className="normal-case font-medium text-red-600">Couldn{"'"}t save</span>
          )}
        </label>
        <select
          id={`${idPrefix}-spec`}
          data-testid={`${idPrefix}-spec`}
          value={spec ?? ''}
          onChange={(e) => commit(std ?? '', e.target.value)}
          disabled={!std || std === 'introduction' || specOptions.length === 0}
          className="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500 disabled:bg-gray-100"
        >
          <option value="">— substandard —</option>
          {specOptions.map((opt) => (
            <option key={opt.spec} value={opt.spec}>
              {std}.{opt.spec}
              {opt.title ? ` — ${opt.title}` : ''}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="col-span-2 text-[10px] text-amber-700">
          Couldn{"'"}t load the standards list ({error}). Reload to assign.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------ FindReferencesButton
// Search the imported Introduction + every standard/substandard narrative for
// this file's appendix code and/or title (e.g. a "(Supporting Document: … MCC
// Education Guide appendix A1)" note) and let the coordinator place the file at
// whatever location(s) reference it. This is the manual fallback for when the
// parser missed a reference (or a duplicate), so a file never gets stranded.
interface RefHit {
  std: string; // 'introduction' or a standard number
  spec: string; // '' for introduction / standard-level
  label: string;
  excerpt: string;
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function excerptAround(text: string, needle: string): string {
  const plain = stripHtml(text);
  const i = plain.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return plain.slice(0, 120);
  return (i > 30 ? '…' : '') + plain.slice(Math.max(0, i - 30), i + needle.length + 70) + '…';
}

function FindReferencesButton({
  doc,
  onPlace
}: {
  doc: any;
  onPlace: (std: string, spec: string) => void;
}): JSX.Element {
  const buckets = useAIImportStore((s) => s.buckets);
  const introductions = useAIImportStore((s) => s.introductions);
  const persistEvidenceRouting = useAIImportStore((s) => s.persistEvidenceRouting);
  const [open, setOpen] = React.useState(false);
  const [hits, setHits] = React.useState<RefHit[] | null>(null);

  const runSearch = React.useCallback(() => {
    const code = String(doc.mccCode || '').trim().toLowerCase();
    // Title without the "Appendix A1:" prefix, for a phrase match.
    const title = String(doc.title || '')
      .replace(/^appendix\s+\S+:\s*/i, '')
      .trim()
      .toLowerCase();
    // A location matches if it names "appendix <code>" or the full title phrase.
    const matches = (hay: string): boolean => {
      const s = hay.toLowerCase();
      if (code && (s.includes(`appendix ${code}`) || s.includes(`appendix ${code} `) || s.includes(` ${code} `))) return true;
      if (title.length >= 10 && s.includes(title)) return true;
      return false;
    };
    const found: RefHit[] = [];
    for (const [k, ib] of Object.entries(introductions || {})) {
      for (const it of ((ib as any)?.items || [])) {
        const hay = `${it.heading || ''} ${stripHtml(it.snippet || it.htmlSnippet || '')}`;
        if (matches(hay)) {
          found.push({
            std: 'introduction', spec: '',
            label: k === 'document' ? 'Document Introduction' : `Standard ${String(k).replace('standard-', '')} Introduction`,
            excerpt: excerptAround(it.snippet || it.htmlSnippet || '', code ? `appendix ${code}` : title)
          });
          break;
        }
      }
    }
    for (const [key, b] of Object.entries(buckets || {})) {
      const [std, spec] = key.split('.');
      for (const n of ((b as any)?.narratives || [])) {
        const hay = `${n.heading || ''} ${stripHtml(n.snippet || n.htmlSnippet || '')}`;
        if (matches(hay)) {
          found.push({
            std, spec, label: `Standard ${std}.${spec}`,
            excerpt: excerptAround(n.snippet || n.htmlSnippet || '', code ? `appendix ${code}` : title)
          });
          break;
        }
      }
    }
    setHits(found);
    setOpen(true);
  }, [doc, buckets, introductions]);

  const place = (h: RefHit) => {
    onPlace(h.std, h.spec);
    persistEvidenceRouting(doc.sectionId, h.std, h.spec).catch(() => undefined);
    setOpen(false);
  };

  return (
    <span className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-testid={`evdoc-find-refs-${doc.sectionId}`}
        onClick={(e) => { e.stopPropagation(); runSearch(); }}
        title="Search the imported introduction + standard narratives for where this file is referenced, then place it there."
        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-50"
      >
        <Search className="h-3 w-3" aria-hidden /> Find references
      </button>
      {open && hits && (
        <div
          className="absolute left-0 z-20 mt-1 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-700">
              {hits.length} reference{hits.length === 1 ? '' : 's'} found
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-gray-400 hover:text-gray-700">✕</button>
          </div>
          {hits.length === 0 ? (
            <p className="text-[11px] text-gray-500">
              No mention of “{doc.mccCode || doc.title}” found in the imported introduction or standards. Assign it manually below.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {hits.map((h, i) => (
                <li key={`${h.std}.${h.spec}.${i}`}>
                  <button
                    type="button"
                    onClick={() => place(h)}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-left hover:border-cshse-400 hover:bg-cshse-50"
                  >
                    <div className="text-[11px] font-semibold text-cshse-700">Place at {h.label}</div>
                    <div className="text-[10px] text-gray-500 line-clamp-2">{h.excerpt}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}

export type ItemKind =
  | 'text'
  | 'evidenceText'
  | 'file'
  | 'matrix'
  | 'tag'
  | 'introduction'   // CR-039 — Standard-level Introduction items
  | 'evidenceDoc'    // CR-040 Phase 1 — appendix paper / syllabus file
  | 'cv';            // CR-033 Phase 1 — faculty CV supporting evidence

export interface CardItem {
  rowId: string;
  sectionId: string;
  rawHeading: string;
  displayLabel: string;   // smart label — falls back to body snippet for terse headings
  hasCustomLabel?: boolean; // true when displayLabel is a coordinator-typed override
  confidence: number;
  kind: ItemKind;
  wordCount: number;
  snippet: string;
  // Preserved <table> HTML when the walker had structural HTML to show.
  // ItemCard renders this verbatim when set; otherwise falls back to the
  // monospace heuristic over `snippet`.
  htmlSnippet?: string | null;
  rationale: string;
  // CR-041 US-6 — provenance stamped during the batch merge so the
  // ItemCard chip can render "📄 <filename>" when in batch mode.
  sourceImportId?: string;
  sourceFilename?: string;
}

interface ItemCardListProps {
  selectedKey: string | null;
  bucket: SpecBucket | null;
  unplacedTags: Tag[];
  placeholders: PlaceholderSection[];
  matrices: MatrixData[];
  selectedSectionId: string | null;
  onSelect: (sectionId: string) => void;
  onBulkAction: (
    action: 'to-tags' | 'to-file' | 'reassign',
    sectionIds: string[],
    target?: { std: string; spec: string }
  ) => void;
  /**
   * Coordinator clicked "+ Add from source" on an empty spec. ReviewStep
   * opens ShowInSourceModal in selection mode and forwards the captured
   * passage to the corrections API + local bucket.
   */
  onCorrectMissingSpec?: (std: string, spec: string) => void;
  /** Flip an item between narrative / evidence text / evidence file / tag / discard. */
  onChangeKind?: (sectionId: string, kind: ItemKind | 'discard') => void;
  /** Coordinator workflow tracker — set of rowIds explicitly marked as reviewed. */
  approvedIds?: Set<string>;
  onToggleApproval?: (rowId: string) => void;
  onApproveAll?: (rowIds: string[]) => void;
  onClearApprovals?: () => void;
  /** CR-070 — upload an appendix/evidence file for the selected spec inline. */
  /** CR-070 — upload a file for a specific card; the parent resolves the
   *  card's exact spec from the sectionId. */
  onUploadFile?: (file: File, sectionId: string) => void;
  /** CR-024: jump to the matrix view scrolled to this spec's row. ReviewStep
   *  resolves the row anchor and dispatches selectMatrixRow. */
  onJumpToMatrix?: (specKey: string) => void;
  /** CR-031: coordinator clicked "Append to neighbor's spec" on an Unplaced
   *  fragment. ReviewStep dispatches the move from Tag → Bucket(narrative). */
  onAppendUnplacedToSpec?: (tagId: string, std: string, spec: string) => void;
  /** CR-032: pencil click on a card. ReviewStep sets editingSectionId so the
   *  preview pane flips into edit mode for that item. */
  onEditStart?: (sectionId: string) => void;
  onShowAiInfo?: (sectionId: string) => void;
  /** CR-039: Introduction buckets so ItemCardList can render them when an
   *  intro key is selected AND populate Reassign-to-Introduction targets. */
  introductions?: Record<string, IntroductionBucket>;
  onMoveToIntroduction?: (sectionId: string, targetBucketKey: string) => void;
  // CR-033 / CR-040 Phase 2c — detector outputs surfaced in the rail.
  cvs?: CVItem[];
  evidenceDocs?: EvidenceDocItem[];
  // CR-051 Sprint 7 polish — inline "View source" button on each
  // CV / Syllabus / Paper card. ReviewStep wires this to
  // handleShowInSource so clicking the inline button opens
  // ShowInSourceModal against the section's source fragment.
  onShowInSource?: (sectionId: string) => void;
}

// Headings like "b.", "c.", "1)", "(a)", "i.", or "x." are non-descriptive —
// we synthesize a label from the body text instead.
const _TERSE_HEADING_RE = /^\s*[A-Za-z0-9]{1,3}[.)\]]?\s*$/;
// The splitter stamps a generic placeholder on data tables / untitled sections
// (e.g. "(data table)"). These read as noise on the card — we name the item
// from its content instead (the section heading inside the table).
const _PLACEHOLDER_HEADING_RE = /^\(?\s*(data[\s_-]?table|table|no heading|untitled|section)\s*\)?$/i;
// Boilerplate lines that aren't a good name for the item.
const _BOILERPLATE_LINE_RE = /^(table of contents|context|response|see (table|appendix))\b/i;

export function isPlaceholderHeading(heading?: string): boolean {
  const h = (heading || '').trim();
  return !h || _PLACEHOLDER_HEADING_RE.test(h);
}

// Turn HTML (or plain text) into trimmed, non-empty lines — splitting on table
// cells / rows / paragraphs so the FIRST line is the table's leading heading.
function contentToLines(html: string): string[] {
  return (html || '')
    .replace(/<\/(td|th|tr|p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// Best descriptive name we can pull from an item's content — the first
// meaningful line (a section heading like "B. Philosophical Base of Programs"),
// skipping placeholders, terse markers and boilerplate.
function deriveTitleFromContent(snippet: string, htmlSnippet?: string | null): string {
  const lines = [...contentToLines(htmlSnippet || ''), ...contentToLines(snippet || '')];
  for (const line of lines) {
    if (line.length < 3) continue;
    if (_PLACEHOLDER_HEADING_RE.test(line)) continue;
    if (_TERSE_HEADING_RE.test(line)) continue;
    if (_BOILERPLATE_LINE_RE.test(line)) continue;
    return line.length > 80 ? line.slice(0, 80) + '…' : line;
  }
  return '';
}

function deriveDisplayLabel(heading: string, snippet: string, htmlSnippet?: string | null): string {
  const h = (heading || '').trim();
  if (!h || _TERSE_HEADING_RE.test(h) || _PLACEHOLDER_HEADING_RE.test(h)) {
    const fromContent = deriveTitleFromContent(snippet, htmlSnippet);
    if (fromContent) return fromContent;
    const firstLine = (snippet || '').trim().split(/\n+/)[0] || '';
    if (firstLine && !_PLACEHOLDER_HEADING_RE.test(firstLine)) {
      return firstLine.slice(0, 80) + (firstLine.length > 80 ? '…' : '');
    }
    return '(untitled section)';
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
    displayLabel: (item.customLabel && item.customLabel.trim()) || deriveDisplayLabel(item.heading, item.snippet, item.htmlSnippet),
    hasCustomLabel: !!(item.customLabel && item.customLabel.trim()),
    confidence: item.confidence,
    kind,
    wordCount: item.wordCount,
    snippet: item.snippet,
    htmlSnippet: item.htmlSnippet ?? null,
    rationale: item.rationale,
    // CR-041 US-6 — provenance fields stamped during the batch merge
    // need to ride through the toCard projection or the source-file
    // chip never renders.
    sourceImportId: item.sourceImportId,
    sourceFilename: item.sourceFilename
  };
}

function flattenTags(tags: Tag[]): CardItem[] {
  return tags.map((t) => ({
    rowId: t.tagId,
    sectionId: t.sectionId,
    rawHeading: t.sourceHeading || '',
    displayLabel: (t.customLabel && t.customLabel.trim()) || deriveDisplayLabel(t.sourceHeading || t.summary, t.fullText, t.htmlSnippet),
    hasCustomLabel: !!(t.customLabel && t.customLabel.trim()),
    confidence: t.confidence,
    kind: 'tag' as ItemKind,
    wordCount: t.fullText.split(/\s+/).length,
    snippet: t.fullText,
    htmlSnippet: t.htmlSnippet ?? null,
    rationale: t.rationale,
    // CR-041 US-6 — same provenance pass-through for unplaced tags.
    sourceImportId: t.sourceImportId,
    sourceFilename: t.sourceFilename
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
  tag: 'Tag',
  introduction: 'Introduction',     // CR-039
  evidenceDoc: 'Evidence document', // CR-040 Phase 1
  cv: 'CV'                           // CR-033 Phase 1
};

export function ItemCardList({
  selectedKey,
  bucket,
  unplacedTags,
  placeholders,
  matrices,
  selectedSectionId,
  onSelect,
  onBulkAction,
  onCorrectMissingSpec,
  onChangeKind,
  approvedIds,
  onToggleApproval,
  onApproveAll,
  onClearApprovals,
  onUploadFile,
  onJumpToMatrix,
  onAppendUnplacedToSpec,
  onEditStart,
  onShowAiInfo,
  introductions,
  onMoveToIntroduction,
  cvs,
  evidenceDocs,
  onShowInSource
}: ItemCardListProps): JSX.Element {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const selectMatrixRow = useAIImportStore((s) => s.selectMatrixRow);
  const selectedMatrixRowAnchor = useAIImportStore((s) => s.selectedMatrixRowAnchor);
  const clearMatrixRowAnchor = useAIImportStore((s) => s.clearMatrixRowAnchor);
  // CR-024 — broadcast a spec key so every matrix in the view scrolls
  // simultaneously when the user picks a spec from the rail.
  const matrixScrollSpec = useAIImportStore((s) => s.matrixScrollSpec);
  const setMatrixScrollSpec = useAIImportStore((s) => s.setMatrixScrollSpec);
  const clearMatrixScrollSpec = useCallback(
    () => setMatrixScrollSpec(null),
    [setMatrixScrollSpec]
  );
  const matrixRowEdits = useAIImportStore((s) => s.matrixRowEdits);
  // CR-031 — full buckets state for the nearest-placed-neighbor computation
  // on the Unplaced view. Subscribe via selector so the panel updates when
  // the coordinator places items elsewhere.
  const allBuckets = useAIImportStore((s) => s.buckets);

  // CR-031 + extension — neighbor-context panel fires for:
  //   1. Selected tag in the Unplaced view (original CR-031)
  //   2. Selected LOW-CONFIDENCE item in any spec bucket (extension):
  //      placed items with confidence < LOW_CONF_THRESHOLD get the
  //      same nearest-above lookup, with a Move-to-neighbor's-spec
  //      action instead of Append.
  //
  // The neighbor lookup uses byteOffsetStart from the section, so it's a
  // no-op on legacy imports where that field wasn't populated by the
  // Python splitter. Fresh imports after a702aaa have the field set.
  const LOW_CONF_THRESHOLD = 0.30;
  const neighborSuggestion = useMemo(() => {
    if (!selectedSectionId) return null;

    // Case 1 — unplaced tag.
    if (selectedKey === UNPLACED_KEY) {
      const tag = unplacedTags.find((t) => t.sectionId === selectedSectionId);
      if (!tag) return null;
      const neighbor = nearestPlacedNeighborFor(tag, allBuckets);
      // Return even when neighbor is null so the panel shows a "no signal"
      // soft message rather than disappearing silently.
      return {
        action: 'append' as const,
        sourceSectionId: tag.sectionId,
        sourceTagId: tag.tagId,
        sourceKind: 'tag' as const,
        sourceSpecKey: null as string | null,
        neighbor,
      };
    }

    // Case 2 — low-confidence bucket item. Only on real spec keys, not
    // synthetic _matrices/_unwritten.
    if (selectedKey && !selectedKey.startsWith('_') && bucket) {
      const inNarr = bucket.narratives.find((i) => i.sectionId === selectedSectionId);
      const inEv = bucket.evidenceText.find((i) => i.sectionId === selectedSectionId);
      const item = inNarr || inEv;
      if (!item) return null;
      if (item.confidence >= LOW_CONF_THRESHOLD) return null;
      // Build a tag-shaped object for the neighbor lookup (the helper
      // just reads byteOffsetStart from a Tag, doesn't care about the
      // other fields).
      const proxy = {
        ...item,
        tagId: item.sectionId,
        summary: item.heading,
        fullText: item.snippet,
        suggestedStd: null,
        suggestedSpec: null,
        sourceHeading: item.heading,
      } as unknown as Tag;
      const neighbor = nearestPlacedNeighborFor(proxy, allBuckets);
      // Skip the neighbor if it's THIS same item placed in another bucket
      // (theoretically impossible because each section is in at most one
      // bucket, but be defensive).
      const filteredNeighbor =
        neighbor && neighbor.item.sectionId === item.sectionId ? null : neighbor;
      return {
        action: 'move' as const,
        sourceSectionId: item.sectionId,
        sourceTagId: null,
        sourceKind: (inNarr ? 'narratives' : 'evidenceText') as
          | 'narratives'
          | 'evidenceText',
        sourceSpecKey: selectedKey,
        neighbor: filteredNeighbor,
      };
    }

    return null;
  }, [selectedKey, selectedSectionId, unplacedTags, bucket, allBuckets]);

  // Per-spec matrix references: which (matrix, row, columnIndex+code) triples
  // address the currently-selected spec? Used to surface "View in Matrix"
  // buttons + inline matrix-coverage breakdown at the top of the spec card.
  //
  // Honours matrixRowEdits so a row the coordinator Removed in the Matrix
  // step disappears from this Review-page view (instead of misleadingly
  // showing as still associated with the spec). Retags appear under the
  // NEW (std, spec) as the coordinator intended.
  const specMatrixRefs = useMemo(() => {
    if (!bucket) {
      return [] as Array<{
        matrix: MatrixData;
        rowAnchor: string;
        cellCount: number;
        cells: MatrixData['cells'];
      }>;
    }
    const std = bucket.standardCode;
    const spec = bucket.specCode;
    const out: Array<{
      matrix: MatrixData;
      rowAnchor: string;
      cellCount: number;
      cells: MatrixData['cells'];
    }> = [];
    for (const m of matrices) {
      // Build the effective (std, spec) for each cell, applying any retag.
      // Then keep only cells whose effective placement matches this spec AND
      // whose row was NOT removed.
      const matching = m.cells.filter((c) => {
        const rowAnchor =
          c.rowAnchor ||
          `matrix-${m.matrixId}-row-${c.std}-${c.spec ?? 'x'}`;
        const edit = matrixRowEdits[`${m.matrixId}|${rowAnchor}`];
        if (edit?.kind === 'remove') return false;
        const effStd = edit?.kind === 'retag' ? edit.newStd : c.std;
        const effSpec = edit?.kind === 'retag' ? edit.newSpec : c.spec;
        return effStd === std && effSpec === spec;
      });
      if (matching.length === 0) continue;
      out.push({
        matrix: m,
        rowAnchor: matching[0].rowAnchor,
        cellCount: matching.length,
        cells: matching,
      });
    }
    return out;
  }, [bucket, matrices, matrixRowEdits]);

  // CR-039 — Resolve the currently-selected Introduction bucket when the
  // selectedKey is an intro key, so the items renderer can flatten it.
  const activeIntroBucket: IntroductionBucket | null = useMemo(() => {
    if (!selectedKey || !isIntroKey(selectedKey) || !introductions) return null;
    const key = introBucketKeyFromSpecKey(selectedKey);
    return introductions[key] ?? null;
  }, [selectedKey, introductions]);

  const items = useMemo<CardItem[]>(() => {
    if (selectedKey === UNPLACED_KEY) return flattenTags(unplacedTags);
    if (selectedKey === UNWRITTEN_KEY) return flattenPlaceholders(placeholders);
    if (selectedKey === MATRICES_KEY) return [];
    if (activeIntroBucket) {
      return activeIntroBucket.items.map((it) => ({
        rowId: it.sectionId,
        sectionId: it.sectionId,
        kind: 'introduction' as ItemKind,
        confidence: it.confidence ?? 1,
        wordCount: it.wordCount ?? 0,
        snippet: it.snippet,
        htmlSnippet: it.htmlSnippet ?? null,
        rawHeading: it.heading || 'Introduction item',
        displayLabel: it.heading || 'Introduction item',
        rationale: it.rationale ?? ''
      }));
    }
    if (!bucket) return [];
    return flattenBucket(bucket);
  }, [selectedKey, bucket, unplacedTags, placeholders, activeIntroBucket]);

  // CR-032 — set of sectionIds whose underlying BucketItem / Tag has been
  // edited (editedAt !== undefined). Used by KindSection to render the
  // "edited" badge on cards.
  const editedSectionIds = useMemo<Set<string>>(() => {
    const out = new Set<string>();
    if (bucket) {
      for (const i of bucket.narratives) {
        if (i.editedAt !== undefined) out.add(i.sectionId);
      }
      for (const i of bucket.evidenceText) {
        if (i.editedAt !== undefined) out.add(i.sectionId);
      }
    }
    for (const t of unplacedTags) {
      if (t.editedAt !== undefined) out.add(t.sectionId);
    }
    return out;
  }, [bucket, unplacedTags]);

  // Grouped view for real spec buckets (synthetic Unplaced/Unwritten/Matrices stay flat).
  const groups: BucketGroups | null = useMemo(() => {
    if (
      selectedKey === UNPLACED_KEY ||
      selectedKey === UNWRITTEN_KEY ||
      selectedKey === MATRICES_KEY
    ) return null;
    if (!bucket) return null;
    return groupBucketByKind(bucket);
  }, [selectedKey, bucket]);

  // 2026-06-07 (user direction) — the per-card checkbox now REPRESENTS approval
  // ("Reviewed"), so a coordinator can see at a glance which items are approved,
  // and that state is persisted (approvedIds → server). The local `checked` set
  // mirrors approvedIds; toggling a checkbox toggles approval.
  useEffect(() => {
    setChecked(new Set(approvedIds ? Array.from(approvedIds) : []));
  }, [approvedIds]);

  // Auto-scroll the selected card into view when it changes externally.
  useEffect(() => {
    if (!selectedSectionId || !listRef.current) return;
    const target = listRef.current.querySelector(`[data-section-id="${CSS.escape(selectedSectionId)}"]`);
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedSectionId]);

  // Toggling a card's checkbox = approve / un-approve that item (persisted).
  const toggleCheck = (rowId: string) => {
    onToggleApproval?.(rowId);
  };

  const allChecked = items.length > 0 && items.every((r) => checked.has(r.rowId));
  // Header checkbox = approve / un-approve every item in the current spec.
  const toggleAll = () => {
    if (allChecked) {
      items.forEach((r) => onToggleApproval?.(r.rowId));
    } else {
      const toAdd = items.filter((r) => !checked.has(r.rowId)).map((r) => r.rowId);
      if (onApproveAll) onApproveAll(toAdd);
      else toAdd.forEach((rowId) => onToggleApproval?.(rowId));
    }
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

  const isPlaceholder = selectedKey === UNWRITTEN_KEY;

  if (!selectedKey) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-500">
        Select a spec from the left.
      </div>
    );
  }

  if (selectedKey === MATRICES_KEY) {
    return (
      <MatricesView
        matrices={matrices}
        highlightedRowAnchor={selectedMatrixRowAnchor}
        onAnchorConsumed={clearMatrixRowAnchor}
        broadcastSpecKey={matrixScrollSpec}
        onBroadcastConsumed={clearMatrixScrollSpec}
      />
    );
  }

  // CR-033 Phase 2c — CVs view. Compact list with faculty name, snippet
  // preview, and a routing badge. The "Move to spec" + Discard
  // affordances ship in a future slice; for now the goal is just to
  // surface that the detector ran.
  if (selectedKey === CVS_KEY) {
    return (
      <CVsView
        cvs={cvs || []}
        onShowInSource={onShowInSource}
        approvedIds={approvedIds}
        onToggleApproval={onToggleApproval}
        onApproveAll={onApproveAll}
        onClearApprovals={onClearApprovals}
      />
    );
  }

  // CR-040 Phase 2c — Evidence docs view. The rail now splits this
  // into Syllabi (docSubKind='syllabus') and Papers (everything else),
  // each with its own synthetic key. Legacy EVIDENCE_DOCS_KEY still
  // routes here showing the combined list — kept for back-compat with
  // any persisted selectedSpecKey from before the split.
  if (selectedKey === EVIDENCE_DOCS_KEY) {
    return (
      <EvidenceDocsView
        docs={evidenceDocs || []}
        onShowInSource={onShowInSource}
        approvedIds={approvedIds}
        onToggleApproval={onToggleApproval}
        onApproveAll={onApproveAll}
        onClearApprovals={onClearApprovals}
      />
    );
  }
  if (selectedKey === SYLLABI_KEY) {
    const syllabi = (evidenceDocs || []).filter((d) => d.docSubKind === 'syllabus');
    return (
      <EvidenceDocsView
        docs={syllabi}
        onShowInSource={onShowInSource}
        approvedIds={approvedIds}
        onToggleApproval={onToggleApproval}
        onApproveAll={onApproveAll}
        onClearApprovals={onClearApprovals}
      />
    );
  }
  if (selectedKey === PAPERS_KEY) {
    const papers = (evidenceDocs || []).filter((d) => d.docSubKind !== 'syllabus');
    return (
      <EvidenceDocsView
        docs={papers}
        onShowInSource={onShowInSource}
        approvedIds={approvedIds}
        onToggleApproval={onToggleApproval}
        onApproveAll={onApproveAll}
        onClearApprovals={onClearApprovals}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50" data-tour="review-cards">
      {/* Bulk-action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2 text-sm" data-tour="review-bulk-toolbar">
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
              <span className="ml-1 text-emerald-700">
                · {items.filter((r) => approvedIds?.has(r.rowId)).length} approved
              </span>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onApproveAll && (
            <>
              <button
                data-testid="approve-all"
                onClick={() => onApproveAll(items.map((r) => r.rowId))}
                disabled={isPlaceholder || items.length === 0}
                className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                title="Approve every item shown for this specification and move them to the Self-Study editor. Other specifications are untouched."
              >
                <Check className="h-3 w-3" aria-hidden /> Approve specification → editor
              </button>
              {approvedIds && approvedIds.size > 0 && onClearApprovals && (
                <button
                  onClick={onClearApprovals}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  title="Clear the reviewed flag across all specs"
                >
                  Clear approvals
                </button>
              )}
            </>
          )}
          {/* CR-070 — the upload control moved ONTO each card (per-card "Import
              file"), so a file lands on that card's exact spec. The spec-level
              toolbar button was removed. */}
        </div>
      </div>

      {/* Per-spec matrix references — visible only when a real spec bucket is
          selected and at least one matrix has a row addressing this spec.
          Shows the matrix name + click-to-jump button AND the actual
          column-by-column coverage codes inline, so the coordinator can see
          what the matrix says about this spec without leaving the page.
          Filters out rows the coordinator Removed in the Matrix step and
          honors retags. */}
      {specMatrixRefs.length > 0 && (
        <div className="border-b border-gray-200 bg-cshse-50/40 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-cshse-800">Curriculum matrices for {bucket?.standardCode}.{bucket?.specCode}:</span>
            {specMatrixRefs.map((ref) => (
              <button
                key={ref.matrix.matrixId}
                onClick={() => selectMatrixRow(ref.rowAnchor)}
                title={`Jump to this spec's row in ${ref.matrix.name} (${ref.cellCount} course cell${ref.cellCount === 1 ? '' : 's'})`}
                className="inline-flex items-center gap-1 rounded border border-cshse-300 bg-white px-2 py-0.5 font-medium text-cshse-700 hover:bg-cshse-100"
              >
                <Grid3x3 className="h-3 w-3" aria-hidden /> {ref.matrix.name}
                <span className="ml-1 rounded bg-cshse-100 px-1 text-[10px] text-cshse-800">
                  {ref.cellCount} cell{ref.cellCount === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
          {/* Inline coverage breakdown per matrix */}
          <div className="mt-2 space-y-2">
            {specMatrixRefs.map((ref) => (
              <div key={`${ref.matrix.matrixId}-cells`} className="rounded border border-cshse-200 bg-white p-2">
                <div className="mb-1 font-medium text-cshse-800">
                  {ref.matrix.name}
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {ref.cells.map((c, i) => {
                    const colHeader =
                      c.columnHeader ||
                      ref.matrix.columnHeaders?.[(c.columnIndex ?? 1) - 1] ||
                      `Col ${c.columnIndex ?? i + 1}`;
                    return (
                      <div
                        key={`${ref.matrix.matrixId}-${c.columnIndex}-${i}`}
                        className="flex items-baseline gap-1.5 truncate"
                      >
                        <span className="truncate text-gray-600" title={colHeader}>{colHeader}:</span>
                        <span className="font-mono font-semibold text-gray-900">{c.codeRaw}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 text-[10px] italic text-gray-500">
                  Codes: I=Introduction · T=Theory · K=Knowledge · S=Skills · L/M/H=low/medium/high depth.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CR-031 — neighbor-context panel. Fires for:
            1. Unplaced tag selection (one-click "Append to neighbor's spec")
            2. Low-confidence item selection in any spec bucket (one-click
               "Move to neighbor's spec" — the matcher placed it but with
               low confidence, the spec just above is usually the right home)
          Both flows reuse existing move/append handlers so the dirty flag
          carries persistence through hard refresh.                          */}
      {neighborSuggestion && (
        <div className="border-b border-amber-200 bg-amber-50/50 px-4 py-3 text-sm">
          {neighborSuggestion.neighbor ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden>📍</span>
                <span className="font-medium text-amber-900">
                  {neighborSuggestion.action === 'append'
                    ? 'Nearest placed neighbor (just above in your document)'
                    : 'Likely-better home (low-confidence placement)'}
                </span>
              </div>
              <div className="text-sm text-amber-900">
                {neighborSuggestion.action === 'move' && bucket && (
                  <>
                    Currently placed under{' '}
                    <strong className="font-mono">
                      {bucket.standardCode}.{bucket.specCode}
                    </strong>
                    {' '}with low confidence.{' '}
                  </>
                )}
                The item just above in the source document was placed under spec{' '}
                <strong className="font-mono">
                  {neighborSuggestion.neighbor.std}.{neighborSuggestion.neighbor.spec}
                </strong>
              </div>
              <div className="rounded border border-amber-200 bg-white p-2 text-xs text-gray-700">
                <div className="font-medium text-gray-800">
                  {neighborSuggestion.neighbor.item.heading || '(no heading)'}
                </div>
                <div className="mt-1 line-clamp-3 text-gray-600">
                  {(neighborSuggestion.neighbor.item.snippet || '').slice(0, 280)}
                  {(neighborSuggestion.neighbor.item.snippet || '').length > 280 && '…'}
                </div>
                <div className="mt-1 text-[10px] italic text-gray-500">
                  {neighborSuggestion.neighbor.distance} sections earlier in the document
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {neighborSuggestion.action === 'append' && onAppendUnplacedToSpec && neighborSuggestion.sourceTagId && (
                  <button
                    type="button"
                    onClick={() =>
                      onAppendUnplacedToSpec(
                        neighborSuggestion.sourceTagId!,
                        neighborSuggestion.neighbor!.std,
                        neighborSuggestion.neighbor!.spec
                      )
                    }
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Append this fragment to {neighborSuggestion.neighbor.std}.{neighborSuggestion.neighbor.spec}
                  </button>
                )}
                {neighborSuggestion.action === 'move' && onBulkAction && neighborSuggestion.sourceSectionId && (
                  <button
                    type="button"
                    onClick={() =>
                      onBulkAction(
                        'reassign',
                        [neighborSuggestion.sourceSectionId!],
                        {
                          std: neighborSuggestion.neighbor!.std,
                          spec: neighborSuggestion.neighbor!.spec,
                        }
                      )
                    }
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Move this item to {neighborSuggestion.neighbor.std}.{neighborSuggestion.neighbor.spec}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span aria-hidden>📍</span>
              <span>
                {neighborSuggestion.action === 'append'
                  ? 'No nearby placed content above this fragment in the source document. Pick a spec manually from the list below or use Reassign.'
                  : 'No higher-confidence placed neighbor above this item. Use Reassign to move it manually if the placement looks wrong.'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Card list — grouped by kind for spec buckets, flat for Unplaced/Unwritten */}
      <div
        ref={listRef}
        data-testid="review-cards-scroll"
        className="min-h-0 flex-1 overflow-auto p-4"
        aria-label="Items for selected spec"
      >
        {items.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            <div>
              No items in this spec.
              {' '}
              {bucket
                ? `The matcher didn't route anything to ${bucket.standardCode}.${bucket.specCode}.`
                : 'Pick another from the left rail or check the Unplaced / Unwritten rows.'}
            </div>
            {bucket && onCorrectMissingSpec && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="max-w-md text-xs text-gray-600">
                  If the source document plainly addresses this spec, point at
                  the passage and we'll record a correction. The matcher
                  remembers it for this institution's future imports — no
                  per-document hardcoding.
                </p>
                <button
                  onClick={() => onCorrectMissingSpec(bucket.standardCode, bucket.specCode)}
                  className="inline-flex items-center gap-1 rounded bg-cshse-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cshse-700"
                >
                  + Add from source
                </button>
              </div>
            )}
          </div>
        ) : groups ? (
          <div className="space-y-6">
            <KindSection
              title="Narratives"
              subtitle='Written into the standard editor when you click "Apply to editor"'
              icon="📝"
              items={groups.narratives}
              startIdx={1}
              selectedSectionId={selectedSectionId}
              checked={checked}
              isPlaceholder={isPlaceholder}
              onSelect={onSelect}
              onToggleCheck={toggleCheck}
              onKeyDown={handleKeyDown}
              approvedIds={approvedIds}
              onToggleApproval={onToggleApproval}
              onChangeKind={onChangeKind}
              onEditStart={onEditStart} onShowAiInfo={onShowAiInfo} onUploadFile={onUploadFile}
              editedSectionIds={editedSectionIds}
              bucketStandardCode={bucket?.standardCode ?? null}
              onMoveToIntroduction={onMoveToIntroduction}
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
              approvedIds={approvedIds}
              onToggleApproval={onToggleApproval}
              onChangeKind={onChangeKind}
              onEditStart={onEditStart} onShowAiInfo={onShowAiInfo} onUploadFile={onUploadFile}
              editedSectionIds={editedSectionIds}
              bucketStandardCode={bucket?.standardCode ?? null}
              onMoveToIntroduction={onMoveToIntroduction}
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
              approvedIds={approvedIds}
              onToggleApproval={onToggleApproval}
              onChangeKind={onChangeKind}
              onEditStart={onEditStart} onShowAiInfo={onShowAiInfo} onUploadFile={onUploadFile}
              editedSectionIds={editedSectionIds}
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
              approvedIds={approvedIds}
              onToggleApproval={onToggleApproval}
              onChangeKind={onChangeKind}
              onEditStart={onEditStart} onShowAiInfo={onShowAiInfo} onUploadFile={onUploadFile}
              editedSectionIds={editedSectionIds}
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
                approved={!!approvedIds?.has(item.rowId)}
                onSelect={() => onSelect(item.sectionId)}
                onToggleCheck={() => toggleCheck(item.rowId)}
                onToggleApproval={onToggleApproval ? () => onToggleApproval(item.rowId) : undefined}
                onChangeKind={onChangeKind}
                onKeyDown={(e) => handleKeyDown(e, item, idx)}
                onEditStart={onEditStart} onShowAiInfo={onShowAiInfo} onUploadFile={onUploadFile}
                isEdited={editedSectionIds.has(item.sectionId)}
                bucketStandardCode={bucket?.standardCode ?? null}
                onMoveToIntroduction={
                  !activeIntroBucket ? onMoveToIntroduction : undefined
                }
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
  approvedIds?: Set<string>;
  onToggleApproval?: (rowId: string) => void;
  onChangeKind?: (sectionId: string, kind: ItemKind | 'discard') => void;
  // CR-032 — pencil click on a card. Threaded through KindSection so it
  // works on every text-bearing kind section (narratives + evidence-text
  // + tags).
  onEditStart?: (sectionId: string) => void;
  onShowAiInfo?: (sectionId: string) => void;
  onUploadFile?: (file: File, sectionId: string) => void;
  /** Per-item "is this item currently edited?" lookup (by sectionId). */
  editedSectionIds?: Set<string>;
  // CR-039 — Move-to-Introduction pass-through.
  bucketStandardCode?: string | null;
  onMoveToIntroduction?: (sectionId: string, targetKey: string) => void;
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
  onKeyDown,
  approvedIds,
  onToggleApproval,
  onChangeKind,
  onEditStart,
  onShowAiInfo,
  onUploadFile,
  editedSectionIds,
  bucketStandardCode,
  onMoveToIntroduction
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
            approved={!!approvedIds?.has(item.rowId)}
            onSelect={() => onSelect(item.sectionId)}
            onToggleCheck={() => onToggleCheck(item.rowId)}
            onToggleApproval={onToggleApproval ? () => onToggleApproval(item.rowId) : undefined}
            onChangeKind={onChangeKind}
            onKeyDown={(e) => onKeyDown(e, item, idx)}
            onEditStart={onEditStart} onShowAiInfo={onShowAiInfo} onUploadFile={onUploadFile}
            isEdited={!!editedSectionIds?.has(item.sectionId)}
            bucketStandardCode={bucketStandardCode}
            onMoveToIntroduction={onMoveToIntroduction}
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
  approved?: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onToggleApproval?: () => void;
  onChangeKind?: (sectionId: string, kind: ItemKind | 'discard') => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  // CR-032 — pencil click on this card. Card-level prop because the
  // edit mode lives in the right preview pane; clicking pencil both
  // selects the item and opens edit mode there.
  onEditStart?: (sectionId: string) => void;
  onShowAiInfo?: (sectionId: string) => void;
  onUploadFile?: (file: File, sectionId: string) => void;
  isEdited?: boolean;
  // CR-039 — Move-to-Introduction action. Renders a small "→ Intro"
  // dropdown that lists Document Introduction + the current spec's
  // Standard-N Introduction as targets. Hidden on intro cards (you
  // don't reassign an intro item to another intro from a card-level
  // chip — that goes through the standard Reassign modal).
  bucketStandardCode?: string | null;
  onMoveToIntroduction?: (sectionId: string, targetKey: string) => void;
}

function ItemCard({
  item,
  index,
  isSelected,
  checked,
  disabled,
  approved,
  onSelect,
  onToggleCheck,
  onToggleApproval,
  onChangeKind,
  onKeyDown,
  onEditStart,
  onShowAiInfo,
  onUploadFile,
  isEdited,
  bucketStandardCode,
  onMoveToIntroduction
}: ItemCardProps): JSX.Element {
  const band = confBand(item.confidence);
  const hasHtmlTable = !!(item.htmlSnippet && item.htmlSnippet.includes('<table'));
  // Render the faithful HTML (links, images, bold, tables) whenever we have it —
  // not just for tables — so URLs and pictures from the source are visible in
  // the card, matching what the editor and source document show.
  const hasRichHtml = !!(item.htmlSnippet && item.htmlSnippet.trim());
  const tabular = !hasRichHtml && looksTabular(item.snippet);
  const moveSelectionToSpec = useAIImportStore((s) => s.moveSelectionToSpec);
  const [moveOpen, setMoveOpen] = React.useState(false);
  // "Move text" only makes sense for prose-bearing items (narratives / evidence
  // text). Map the card kind to the bucket-array kind the store/server expect.
  const moveBucketKind: 'narratives' | 'evidenceText' | null =
    item.kind === 'text' ? 'narratives' : item.kind === 'evidenceText' ? 'evidenceText' : null;
  const moveHtml =
    item.htmlSnippet && item.htmlSnippet.trim()
      ? item.htmlSnippet
      : `<p>${(item.snippet || '').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
  // The kind chips only make sense for items that live in a real spec bucket
  // (text / evidenceText / file). Tag-list items + matrix cells can't be
  // re-typed in place.
  const canSwitchKind = onChangeKind && (item.kind === 'text' || item.kind === 'evidenceText' || item.kind === 'file');

  // Coordinator-editable card name. Persists to the store/server via
  // setItemCustomLabel. Only bucket items + unplaced tags have a backing
  // record to write to (matrix cells / placeholders are synthetic).
  const setItemCustomLabel = useAIImportStore((s) => s.setItemCustomLabel);
  const canRename = item.kind === 'text' || item.kind === 'evidenceText' || item.kind === 'file' || item.kind === 'tag';
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(item.displayLabel);
  const commitName = () => {
    setEditingName(false);
    const next = nameDraft.trim();
    if (next !== item.displayLabel) setItemCustomLabel(item.sectionId, next);
  };

  return (
    <li
      data-section-id={item.sectionId}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Item ${index}, ${KIND_LABEL[item.kind]}, ${item.wordCount} words${approved ? ', approved' : ''}`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`group cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cshse-500 ${
        approved
          ? 'border-emerald-400 bg-emerald-50/30 ring-1 ring-emerald-200'
          : isSelected
          ? 'border-cshse-500 ring-2 ring-cshse-300'
          : 'border-gray-200 hover:border-cshse-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          data-testid={`approve-check-${item.sectionId}`}
          checked={checked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
          aria-label={approved ? 'Approved (reviewed) — uncheck to un-approve' : 'Approve (mark reviewed)'}
          title={approved ? 'Approved — uncheck to un-approve' : 'Check to approve (Reviewed)'}
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
            {/* Kind chips — click any to flip this item between Narrative /
                Evidence text / Evidence file. Coordinator workflow: an AI
                routed something as a narrative but the coordinator wants
                it as supporting evidence. One click here re-buckets. */}
            {canSwitchKind ? (
              <div className="inline-flex overflow-hidden rounded border border-gray-300 text-[10px] font-medium" onClick={(e) => e.stopPropagation()}>
                {([
                  { k: 'text', label: 'Narrative' },
                  { k: 'evidenceText', label: 'Evidence' },
                  { k: 'file', label: 'File' }
                ] as Array<{ k: ItemKind; label: string }>).map((opt, i) => (
                  <button
                    key={opt.k}
                    data-testid={`kind-${opt.k}-${item.sectionId}`}
                    data-active={item.kind === opt.k ? 'true' : 'false'}
                    onClick={() => onChangeKind?.(item.sectionId, opt.k)}
                    title={`Mark this item as ${opt.label}`}
                    className={`${i > 0 ? 'border-l border-gray-300' : ''} px-2 py-0.5 ${
                      item.kind === opt.k
                        ? 'bg-cshse-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{KIND_LABEL[item.kind]}</span>
            )}
            <span className="text-xs text-gray-500">{item.wordCount} words</span>
            {/* CR-041 US-6 — source-file chip when in batch mode. The
                merge in aiImportStore.loadBatchChildren stamps every
                item with sourceFilename so coordinators see provenance
                at a glance. Hidden in single-file mode. */}
            {(item as any).sourceFilename && (
              <span
                className="rounded bg-cshse-50 px-1.5 py-0.5 text-[10px] font-mono text-cshse-700"
                title={`From ${(item as any).sourceFilename}`}
              >
                📄 {(item as any).sourceFilename}
              </span>
            )}
            {hasHtmlTable && (
              <span
                className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700"
                title="Source contained a <table>; rendered with original rows and columns"
              >
                table
              </span>
            )}
            {!hasHtmlTable && tabular && (
              <span
                className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
                title="Source content looks tabular — rendered in monospace to preserve alignment"
              >
                tabular (monospace)
              </span>
            )}
            {/* CR-032 — "edited" badge when the coordinator has saved an
                edit on this card. Tiny + before the action buttons. */}
            {isEdited && (
              <span
                className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                title="You edited this text. Use the Edit button on the right pane to revert."
              >
                edited
              </span>
            )}
            {/* CR-032 — pencil click selects the item + opens edit mode in
                the preview pane. Disabled for table-bearing items (htmlSnippet)
                because plain-textarea editing of an HTML table corrupts
                structure; route those to the Standards editor post-Apply. */}
            {/* CR-039 follow-on — Introduction items are editable too. They
                share the BucketItem shape with narratives, and the wizard's
                edit-save handler now routes them to editIntroductionItem in
                the store. */}
            {onEditStart && (item.kind === 'text' || item.kind === 'evidenceText' || item.kind === 'tag' || item.kind === 'introduction') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditStart(item.sectionId);
                }}
                title="Compare with the source document side-by-side and edit (full format — links, images, tables)"
                className={`${isEdited ? '' : 'ml-auto'} inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50`}
              >
                <Columns className="h-3 w-3" aria-hidden /> Compare
              </button>
            )}
            {/* CR-065 — "ⓘ" opens the read-only AI-evaluation modal (confidence,
                rationale, classification) on demand, replacing the permanent
                right sidebar. */}
            {onShowAiInfo && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowAiInfo(item.sectionId);
                }}
                title="AI evaluation — confidence, rationale, where it was pulled from"
                aria-label="AI evaluation"
                className="inline-flex items-center justify-center rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
              >
                ⓘ
              </button>
            )}
            {/* CR-070 — per-card "Import file". Uploads the appendix / evidence
                file straight into the Supporting File Library, scoped to THIS
                card's exact spec (the parent resolves it from the sectionId), so
                it works from the flat "all evidence" list too. A modal shows
                progress. */}
            {onUploadFile && (
              <label
                onClick={(e) => e.stopPropagation()}
                title="Import a file as supporting evidence for this card's specification"
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-cshse-300 bg-white px-2 py-0.5 text-xs font-medium text-cshse-700 hover:bg-cshse-50"
              >
                <Upload className="h-3 w-3" aria-hidden /> Import file
                <input
                  type="file"
                  data-testid="card-upload-input"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadFile(f, item.sectionId);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {/* Move part of this card into another subspec. The parser
                sometimes dumps a whole Standard into its first subspec; this
                lets the coordinator select prose and move it where it belongs. */}
            {moveBucketKind && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveOpen(true);
                }}
                data-testid={`move-text-open-${item.sectionId}`}
                title="Select part of this card and move it into another subspec"
                className="inline-flex items-center gap-1 rounded border border-cshse-300 bg-white px-2 py-0.5 text-xs font-medium text-cshse-700 hover:bg-cshse-50"
              >
                <Move className="h-3 w-3" aria-hidden /> Move text…
              </button>
            )}
            {/* CR-039 — Move-to-Introduction. Two-click flow: click → pick
                Document or Standard-N. Hidden on intro cards and on
                non-text kinds (matrices / files / tags don't go into
                Introductions). */}
            {onMoveToIntroduction && (item.kind === 'text' || item.kind === 'evidenceText') && (
              <select
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const target = e.target.value;
                  if (!target) return;
                  onMoveToIntroduction(item.sectionId, target);
                  e.target.value = '';
                }}
                title="Move this card to an Introduction bucket"
                defaultValue=""
                className="inline-flex items-center gap-1 rounded border border-cshse-300 bg-white px-2 py-0.5 text-xs text-cshse-700 hover:bg-cshse-50"
              >
                <option value="" disabled>→ Intro…</option>
                <option value="document">Document Introduction</option>
                {bucketStandardCode && (
                  <option value={`standard-${bucketStandardCode}`}>
                    Standard {bucketStandardCode} Introduction
                  </option>
                )}
              </select>
            )}
            {/* One-click Discard. The same outcome is available via the
                right-pane "Place this item as → Discard" dropdown, but
                coordinators couldn't find it. Visible on every card. */}
            {onChangeKind && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const label = item.displayLabel || 'this item';
                  if (window.confirm(
                    `Discard "${label}"?\n\n` +
                    'This removes the card from the spec. ' +
                    'You can re-add content via "+ Add from source" ' +
                    'or by reassigning a different item.'
                  )) {
                    onChangeKind(item.sectionId, 'discard');
                  }
                }}
                title="Discard this card (removes it from this spec)"
                className={`${isEdited || onEditStart ? '' : 'ml-auto'} inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50`}
              >
                <Trash2 className="h-3 w-3" aria-hidden /> Discard
              </button>
            )}
            {onToggleApproval && (
              <button
                data-testid={`approve-toggle-${item.sectionId}`}
                data-approved={approved ? 'true' : 'false'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleApproval();
                }}
                title={approved ? 'Mark this item as not-yet-reviewed' : 'Mark this item as reviewed'}
                className={`${isEdited || onEditStart || onChangeKind ? '' : 'ml-auto'} inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                  approved
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Check className="h-3 w-3" aria-hidden /> {approved ? 'Reviewed' : 'Approve'}
              </button>
            )}
          </div>
          {/* CR-044 — typography parity with NarrativeEditor.
              displayLabel goes to text-base font-semibold; sub-heading
              source-heading gets text-sm italic; body content wraps in
              prose prose-sm (matches Self-Study editor's exact baseline). */}
          {/* Coordinator-editable card name. Click the name (or the pencil) to
              type an override; Enter/blur saves, Esc cancels, empty resets to
              the auto-derived name. */}
          {editingName ? (
            <input
              autoFocus
              data-testid={`rename-input-${item.sectionId}`}
              value={nameDraft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') { setNameDraft(item.displayLabel); setEditingName(false); }
              }}
              placeholder="Name this item…"
              className="mt-2 w-full rounded border border-cshse-300 px-2 py-1 text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-cshse-300"
            />
          ) : (
            <div className="mt-2 flex items-center gap-1.5">
              <span data-testid={`card-name-${item.sectionId}`} className="text-base font-semibold text-gray-900">{item.displayLabel}</span>
              {canRename && (
                <button
                  data-testid={`rename-open-${item.sectionId}`}
                  onClick={(e) => { e.stopPropagation(); setNameDraft(item.displayLabel); setEditingName(true); }}
                  title="Rename this item"
                  aria-label="Rename this item"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
              {item.hasCustomLabel && (
                <span className="rounded bg-cshse-50 px-1 py-0.5 text-[10px] font-medium text-cshse-700" title="Custom name set by you">named</span>
              )}
            </div>
          )}
          {item.rawHeading && item.rawHeading !== item.displayLabel && !isPlaceholderHeading(item.rawHeading) && (
            <div className="mt-0.5 text-sm italic text-gray-500">Source heading: {item.rawHeading}</div>
          )}
          {hasRichHtml ? (
            <div
              onClick={openLinksInNewTab}
              className="ai-html-snippet prose prose-sm mt-3 max-h-[28rem] max-w-none overflow-auto rounded border border-gray-200 bg-white p-3 text-gray-800
                [&_a]:text-cshse-700 [&_a]:underline [&_a]:cursor-pointer [&_img]:max-w-full [&_img]:my-2
                [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
                [&_td]:border [&_td]:border-gray-300 [&_td]:p-1.5 [&_td]:align-top
                [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:p-1.5 [&_th]:text-left [&_th]:font-semibold
                [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              // Document-reader-converted DOCX HTML produced by our own
              // AI service; matches the trust model used by DocumentViewer
              // and ShowInSourceModal. tableizeIfBareRows wraps any bare
              // <tr>/<td> (from a partial-table selection) in <table>
              // before render — user direction 2026-05-22.
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: tableizeIfBareRows(item.htmlSnippet || '') }}
            />
          ) : tabular ? (
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre rounded bg-gray-50 p-3 font-mono text-sm leading-snug text-gray-800">
              {item.snippet}
            </pre>
          ) : (
            <div className="prose prose-sm mt-3 max-w-none whitespace-pre-wrap text-gray-800">
              {item.snippet}
            </div>
          )}
        </div>
      </div>
      {moveOpen && moveBucketKind && (
        <div onClick={(e) => e.stopPropagation()}>
          <MoveTextModal
            html={moveHtml}
            currentStd={bucketStandardCode}
            onCancel={() => setMoveOpen(false)}
            onMove={({ movedHtml, remainderHtml, targetStd, targetSpec }) => {
              void moveSelectionToSpec({
                sourceSectionId: item.sectionId,
                kind: moveBucketKind,
                movedHtml,
                remainderHtml,
                targetStd,
                targetSpec,
              });
              setMoveOpen(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

// --------------------------------------------------------------- MatricesView
//
// Renders every detected curriculum matrix in the middle pane. The matrix
// extractor's wire format gives us the original `<table>` HTML with row ids
// already injected (e.g. `id="matrix-hsr-row-11-a"`) — we just sanitize-pass
// it through `dangerouslySetInnerHTML` (matching the trust model of the rest
// of the wizard's docx-derived HTML). When `highlightedRowAnchor` is set we
// scroll that row into view and add a brief flash highlight, then clear the
// store anchor so a second click on the same button re-triggers.

interface MatricesViewProps {
  matrices: MatrixData[];
  highlightedRowAnchor: string | null;
  onAnchorConsumed: () => void;
  // CR-024 Sprint 2B — when the coordinator picks a spec in the rail, the
  // wizard broadcasts the spec key here. MatricesView resolves it to the
  // matching row anchor IN EVERY matrix simultaneously and scrolls/flashes
  // each, so the coordinator sees coverage across both HS and non-HS
  // matrices without having to scroll twice.
  broadcastSpecKey?: string | null;
  onBroadcastConsumed?: () => void;
}

function MatricesView({
  matrices,
  highlightedRowAnchor,
  onAnchorConsumed,
  broadcastSpecKey,
  onBroadcastConsumed
}: MatricesViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightedRowAnchor || !containerRef.current) return;
    const row = containerRef.current.querySelector<HTMLElement>(
      `#${CSS.escape(highlightedRowAnchor)}`
    );
    if (!row) {
      onAnchorConsumed();
      return;
    }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('cshse-matrix-row-flash');
    const t = setTimeout(() => {
      row.classList.remove('cshse-matrix-row-flash');
      onAnchorConsumed();
    }, 2200);
    return () => clearTimeout(t);
  }, [highlightedRowAnchor, onAnchorConsumed]);

  // CR-024 — when the spec broadcast fires, find the matching row in EVERY
  // matrix (anchor format: matrix-{slug}-row-{std}-{spec}) and scroll +
  // flash each. Different matrices may use different row layouts; we hunt
  // them all at once so the coordinator doesn't have to click twice.
  useEffect(() => {
    if (!broadcastSpecKey || !containerRef.current) return;
    const dot = broadcastSpecKey.indexOf('.');
    if (dot === -1) {
      onBroadcastConsumed?.();
      return;
    }
    const std = broadcastSpecKey.slice(0, dot);
    const spec = broadcastSpecKey.slice(dot + 1);
    const anchorSuffix = `row-${std}-${spec}`;
    const rows = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        `[id$="${CSS.escape(anchorSuffix)}"]`
      )
    );
    if (rows.length === 0) {
      onBroadcastConsumed?.();
      return;
    }
    // Scroll the first match into view smoothly; flash all matches so even
    // matrices that don't auto-scroll into view still visually highlight.
    rows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    for (const r of rows) r.classList.add('cshse-matrix-row-flash');
    const t = setTimeout(() => {
      for (const r of rows) r.classList.remove('cshse-matrix-row-flash');
      onBroadcastConsumed?.();
    }, 2200);
    return () => clearTimeout(t);
  }, [broadcastSpecKey, onBroadcastConsumed]);

  if (matrices.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-500">
        No curriculum matrices were detected in this import.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm">
        <span className="font-medium text-gray-800">
          {matrices.length} matrix{matrices.length === 1 ? '' : 'es'} detected
        </span>
        <span className="ml-2 text-xs text-gray-500">
          The full <code className="rounded bg-gray-100 px-1">{'<table>'}</code> is shown
          here once per matrix; spec cards link back to the relevant row.
        </span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <style>{`
          .cshse-matrix-row-flash { background-color: #fef9c3 !important; transition: background-color 0.4s ease; }
          .ai-html-snippet table { border-collapse: collapse; width: 100%; font-size: 12px; }
          .ai-html-snippet table td, .ai-html-snippet table th {
            border: 1px solid #d1d5db; padding: 4px 6px; vertical-align: top;
          }
          .ai-html-snippet table th { background: #f9fafb; font-weight: 600; text-align: left; }
          .ai-html-snippet table tr.cshse-matrix-row td:first-child {
            font-weight: 500;
          }
          /* CR-024 — sticky column headers AND sticky standard-group
             heading rows so the coordinator always knows which standard
             they're scrolled to inside a 70+ row matrix. */
          .ai-html-snippet table thead th { position: sticky; top: 0; z-index: 2; }
          .ai-html-snippet table tr.cshse-matrix-standard-header td,
          .ai-html-snippet table tr.cshse-matrix-standard-header th {
            position: sticky; top: 24px; z-index: 1;
            background: #eef2ff; font-weight: 700; color: #312e81;
          }
        `}</style>
        {matrices.map((m) => (
          <section
            key={m.matrixId}
            className="mb-6 rounded-lg border border-gray-200 bg-white"
            aria-labelledby={`matrix-h-${m.matrixId}`}
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-4 py-2">
              <div>
                <h3
                  id={`matrix-h-${m.matrixId}`}
                  className="text-sm font-semibold text-gray-900"
                >
                  <Grid3x3 className="mr-1 inline h-4 w-4 align-text-bottom text-cshse-700" aria-hidden />
                  {m.name}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Program level: {m.programLevel} · {m.rowsMatched} of {m.rowsTotal} rows matched · {m.cells.length} filled cells
                </p>
              </div>
              {m.columnHeaders.length > 0 && (
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {m.columnHeaders.map((h, i) => (
                    <span
                      key={`${m.matrixId}-col-${i}`}
                      className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </header>
            <div
              className="ai-html-snippet max-h-[36rem] overflow-auto p-3 text-sm leading-relaxed text-gray-800"
              // Matrix HTML originates from our own Python extractor (which
              // copies the mammoth-converted DOCX table and adds row ids).
              // Same trust model as DocumentViewer and ShowInSourceModal.
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: m.htmlSnippet }}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- CVsView
//
// CR-033 Phase 2c — read-only list of every CV the ai-service detector
// pulled out of the import. Each card shows the faculty name, snippet
// preview, routing badge, and a placeholder "View file" button (the
// file itself ships in CR-033 Phase 3 alongside the .docx generation).

interface CVsViewProps {
  cvs: CVItem[];
  /** CR-051 Sprint 7 polish — inline "View source" button on each card. */
  onShowInSource?: (sectionId: string) => void;
  // 2026-06-07 (user direction) — CVs are approvable just like narratives.
  // The checkbox REPRESENTS approval (persisted to the server), so the
  // coordinator can see at a glance which CVs are approved.
  approvedIds?: Set<string>;
  onToggleApproval?: (rowId: string) => void;
  onApproveAll?: (rowIds: string[]) => void;
  onClearApprovals?: () => void;
}

function CVsView({ cvs, onShowInSource, approvedIds, onToggleApproval, onApproveAll, onClearApprovals }: CVsViewProps): JSX.Element {
  // CR-040 follow-on (post-release UX feedback) — clicking a CV card
  // selects it so the right-pane AI evaluation (confidence + heuristic
  // rationale + "show in source document") reads the same sectionId.
  // Without this, the right pane stayed on "Select an item from the
  // middle pane" forever.
  const selectSection = useAIImportStore((s) => s.selectSection);
  const selectedSectionId = useAIImportStore((s) => s.selectedSectionId);
  const submissionId = useAIImportStore((s) => s.submissionId);
  const updateCvRouting = useAIImportStore((s) => s.updateCvRouting);

  if (cvs.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-500">
        No faculty CVs were detected in this import.
      </div>
    );
  }
  const approvedCount = cvs.filter((c) => approvedIds?.has(c.sectionId)).length;
  const allApproved = cvs.length > 0 && cvs.every((c) => approvedIds?.has(c.sectionId));
  const toggleAllCvs = () => {
    if (allApproved) {
      cvs.forEach((c) => onToggleApproval?.(c.sectionId));
    } else {
      const toAdd = cvs.filter((c) => !approvedIds?.has(c.sectionId)).map((c) => c.sectionId);
      if (onApproveAll) onApproveAll(toAdd);
      else toAdd.forEach((id) => onToggleApproval?.(id));
    }
  };
  return (
    <div className="flex h-full flex-1 flex-col bg-gray-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2 text-sm">
        <div>
          <span className="font-medium text-gray-800">
            {cvs.length} faculty CV{cvs.length === 1 ? '' : 's'} detected
          </span>
          <span className="ml-1 text-emerald-700">· {approvedCount} approved</span>
          <span className="ml-2 text-xs text-gray-500">
            Check a card to approve it — saved to the editor + persisted.
          </span>
        </div>
        {onToggleApproval && (
          <div className="flex items-center gap-2">
            <button
              data-testid="approve-all-cvs"
              onClick={toggleAllCvs}
              className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200"
              title={allApproved ? 'Un-approve every CV' : 'Approve every CV'}
            >
              <Check className="h-3 w-3" aria-hidden /> {allApproved ? 'Un-approve all' : 'Approve all CVs'}
            </button>
            {approvedCount > 0 && onClearApprovals && (
              <button
                onClick={onClearApprovals}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                title="Clear the approved flag across all specs"
              >
                Clear approvals
              </button>
            )}
          </div>
        )}
      </div>
      <ul className="flex-1 space-y-3 overflow-auto p-4">
        {cvs.map((cv) => {
          const isSelected = selectedSectionId === cv.sectionId;
          const approved = !!approvedIds?.has(cv.sectionId);
          return (
            <li
              key={cv.sectionId}
              data-section-id={cv.sectionId}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => selectSection(cv.sectionId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectSection(cv.sectionId);
                }
              }}
              className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cshse-500 ${
                approved
                  ? 'border-emerald-400 bg-emerald-50/30 ring-1 ring-emerald-200'
                  : isSelected
                  ? 'border-cshse-500 ring-2 ring-cshse-300'
                  : 'border-gray-200 hover:border-cshse-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  {onToggleApproval && (
                    <input
                      type="checkbox"
                      data-testid={`approve-check-${cv.sectionId}`}
                      checked={approved}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleApproval(cv.sectionId);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                      aria-label={approved ? `Approved: ${cv.facultyName} — uncheck to un-approve` : `Approve ${cv.facultyName}`}
                      title={approved ? 'Approved — uncheck to un-approve' : 'Check to approve'}
                    />
                  )}
                  <h3 className="text-sm font-semibold text-gray-900">{cv.facultyName}</h3>
                </div>
                <span className="rounded bg-cshse-100 px-1.5 py-0.5 text-[10px] font-medium text-cshse-800">
                  via {cv.routing?.source ?? 'detector'}
                </span>
              </div>
              {cv.snippet && (
                <p className="mt-1 text-xs text-gray-700 line-clamp-3">{cv.snippet}</p>
              )}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                {cv.resolvedStd && cv.resolvedSpec ? (
                  <span className="font-mono text-cshse-700">
                    → Spec {cv.resolvedStd}.{cv.resolvedSpec}
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    Unassigned
                  </span>
                )}
                {/* CR-051 Sprint 7 polish — inline "View source"
                    button. Fires the same handler the right pane uses
                    via `onShowInSource(sectionId)` so the coordinator
                    doesn't have to click the card → hunt in the right
                    pane to see the original. */}
                {onShowInSource && (
                  <button
                    type="button"
                    data-testid={`cv-view-source-${cv.sectionId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowInSource(cv.sectionId);
                    }}
                    title="Open the source-document fragment for this CV"
                    className="ml-auto inline-flex items-center gap-1 rounded border border-indigo-300 bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <Eye className="h-3 w-3" aria-hidden /> View source
                  </button>
                )}
                {/* Download appears ONLY once Apply has packaged the CV as a
                    .docx (fileId set). The pre-Apply disabled "pending Apply"
                    button was removed — it confused coordinators who expected a
                    working download. Use "View source" to read the CV now; the
                    file becomes downloadable after Apply to editor. */}
                {cv.fileId && submissionId && (
                  <a
                    href={`/api/submissions/${submissionId}/evidence/${cv.fileId}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={cv.fileName}
                    onClick={(e) => e.stopPropagation()}
                    className={`${onShowInSource ? '' : 'ml-auto'} rounded border border-cshse-300 bg-white px-2 py-0.5 text-[10px] font-medium text-cshse-700 hover:bg-cshse-50`}
                  >
                    📂 Download .docx
                  </a>
                )}
              </div>
              {/* Assign this CV to the standard / substandard it supports.
                  Persists via updateCvRouting and rides to the server at
                  Apply (SupportingEvidence.standardCode/specCode). */}
              <SpecAssignControls
                idPrefix={`cv-assign-${cv.sectionId}`}
                sectionId={cv.sectionId}
                std={cv.resolvedStd}
                spec={cv.resolvedSpec}
                onChange={(std, spec) => updateCvRouting(cv.sectionId, std, spec)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------- EvidenceDocsView
//
// CR-040 Phase 2c — same shape as CVsView for appendix papers + syllabi.

interface EvidenceDocsViewProps {
  docs: EvidenceDocItem[];
  /** CR-051 Sprint 7 polish — inline "View source" button on each card. */
  onShowInSource?: (sectionId: string) => void;
  // 2026-06-07 (user direction) — syllabi + papers are approvable. The
  // checkbox REPRESENTS approval (persisted to the server) so the
  // coordinator sees at a glance which evidence docs are approved.
  approvedIds?: Set<string>;
  onToggleApproval?: (rowId: string) => void;
  onApproveAll?: (rowIds: string[]) => void;
  onClearApprovals?: () => void;
}

function EvidenceDocsView({ docs, onShowInSource, approvedIds, onToggleApproval, onApproveAll, onClearApprovals }: EvidenceDocsViewProps): JSX.Element {
  // CR-040 Phase 2c — submissionId from the store is required to build
  // the download URL for the View-file button. The same id powers the
  // ReviewSurface + MatrixSurface.
  const submissionId = useAIImportStore((s) => s.submissionId);
  // CR-040 follow-on — click-to-select so the right-pane AI evaluation
  // shows the detector heuristics + source location for the picked doc.
  const selectSection = useAIImportStore((s) => s.selectSection);
  const selectedSectionId = useAIImportStore((s) => s.selectedSectionId);
  const updateEvidenceDocRouting = useAIImportStore((s) => s.updateEvidenceDocRouting);
  if (docs.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-500">
        No appendix papers or syllabi were detected in this import.
      </div>
    );
  }
  const papers = docs.filter((d) => d.docSubKind === 'paper');
  const syllabi = docs.filter((d) => d.docSubKind === 'syllabus');
  const anyApplied = docs.some((d) => d.fileId);
  const approvedCount = docs.filter((d) => approvedIds?.has(d.sectionId)).length;
  const allApproved = docs.length > 0 && docs.every((d) => approvedIds?.has(d.sectionId));
  const toggleAllDocs = () => {
    if (allApproved) {
      docs.forEach((d) => onToggleApproval?.(d.sectionId));
    } else {
      const toAdd = docs.filter((d) => !approvedIds?.has(d.sectionId)).map((d) => d.sectionId);
      if (onApproveAll) onApproveAll(toAdd);
      else toAdd.forEach((id) => onToggleApproval?.(id));
    }
  };
  return (
    <div className="flex h-full flex-1 flex-col bg-gray-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2 text-sm">
        <div>
          <span className="font-medium text-gray-800">
            {papers.length} paper{papers.length === 1 ? '' : 's'} ·{' '}
            {syllabi.length} syllab{syllabi.length === 1 ? 'us' : 'i'}
          </span>
          <span className="ml-1 text-emerald-700">· {approvedCount} approved</span>
          <span className="ml-2 text-xs text-gray-500">
            {anyApplied
              ? 'Check a card to approve it; "Download .docx" opens the captured evidence.'
              : 'Check a card to approve it — saved to the editor + persisted.'}
          </span>
        </div>
        {onToggleApproval && (
          <div className="flex items-center gap-2">
            <button
              data-testid="approve-all-evdocs"
              onClick={toggleAllDocs}
              className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200"
              title={allApproved ? 'Un-approve every doc in this view' : 'Approve every doc in this view'}
            >
              <Check className="h-3 w-3" aria-hidden /> {allApproved ? 'Un-approve all' : 'Approve all'}
            </button>
            {approvedCount > 0 && onClearApprovals && (
              <button
                onClick={onClearApprovals}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                title="Clear the approved flag across all specs"
              >
                Clear approvals
              </button>
            )}
          </div>
        )}
      </div>
      <ul className="flex-1 space-y-3 overflow-auto p-4">
        {docs.map((d) => {
          const isSelected = selectedSectionId === d.sectionId;
          const approved = !!approvedIds?.has(d.sectionId);
          return (
          <li
            key={d.sectionId}
            data-section-id={d.sectionId}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => selectSection(d.sectionId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectSection(d.sectionId);
              }
            }}
            className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cshse-500 ${
              approved
                ? 'border-emerald-400 bg-emerald-50/30 ring-1 ring-emerald-200'
                : isSelected
                ? 'border-cshse-500 ring-2 ring-cshse-300'
                : 'border-gray-200 hover:border-cshse-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                {onToggleApproval && (
                  <input
                    type="checkbox"
                    data-testid={`approve-check-${d.sectionId}`}
                    checked={approved}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleApproval(d.sectionId);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    aria-label={approved ? `Approved: ${d.title} — uncheck to un-approve` : `Approve ${d.title}`}
                    title={approved ? 'Approved — uncheck to un-approve' : 'Check to approve'}
                  />
                )}
                <h3 className="text-sm font-semibold text-gray-900">{d.title}</h3>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  d.docSubKind === 'paper'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {d.docSubKind === 'paper' ? '📄 paper' : '📚 syllabus'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
              {d.courseCode && <span className="font-mono">{d.courseCode}</span>}
              {d.author && <span>· {d.author}</span>}
              {d.date && <span>· {d.date}</span>}
              {typeof d.points === 'number' && <span>· {d.points} pts</span>}
              <span>· {d.pageCountEstimate} pp</span>
              {d.imageCount > 0 && <span>· {d.imageCount} image{d.imageCount === 1 ? '' : 's'}</span>}
            </div>
            {d.summary && (
              <p className="mt-2 text-xs text-gray-700 line-clamp-3">{d.summary}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              {d.resolvedStd === 'introduction' ? (
                <span className="font-mono text-cshse-700">→ Introduction</span>
              ) : d.resolvedStd && d.resolvedSpec ? (
                <span className="font-mono text-cshse-700">
                  → Spec {d.resolvedStd}.{d.resolvedSpec}
                </span>
              ) : (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  Unassigned
                </span>
              )}
              {/* Find where this file is referenced in the imported intro +
                  standard/substandard narratives, and place it there. Helps
                  when the parser missed a "(Supporting Document …)" reference. */}
              <FindReferencesButton
                doc={d}
                onPlace={(std, spec) => {
                  updateEvidenceDocRouting(d.sectionId, std, spec);
                }}
              />
              {/* CR-051 Sprint 7 polish — inline "View source" button. */}
              {onShowInSource && (
                <button
                  type="button"
                  data-testid={`evdoc-view-source-${d.sectionId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowInSource(d.sectionId);
                  }}
                  title="Open the source-document fragment for this evidence doc"
                  className="ml-auto inline-flex items-center gap-1 rounded border border-indigo-300 bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  <Eye className="h-3 w-3" aria-hidden /> View source
                </button>
              )}
              {/* CR-040 Phase 2c — View-file button. Enabled once the
                  server has packaged the evidenceDoc into a
                  SupportingEvidence record at Apply time and stamped
                  fileId. Anchors at /api/submissions/.../download with
                  target=_blank so the browser opens the captured
                  evidence in a new tab. Pre-Apply or if packaging
                  failed: stays disabled with a tooltip explaining why. */}
              {/* Download appears ONLY after Apply packages the .docx (fileId
                  set). The confusing pre-Apply "pending Apply" button was
                  removed — use "View source" to read the doc now. */}
              {d.fileId && submissionId && (
                <a
                  href={`/api/submissions/${submissionId}/evidence/${d.fileId}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={d.fileName}
                  title={`Download ${d.fileName || d.title || 'evidence file'} (.docx — opens in Word)`}
                  onClick={(e) => e.stopPropagation()}
                  className={`${onShowInSource ? '' : 'ml-auto'} rounded border border-cshse-300 bg-white px-2 py-0.5 text-[10px] font-medium text-cshse-700 hover:bg-cshse-50`}
                >
                  📂 Download .docx
                </a>
              )}
            </div>
            {/* Assign this syllabus / paper to the standard / substandard it
                supports. Persists via updateEvidenceDocRouting and rides to
                the server at Apply (SupportingEvidence.standardCode/specCode
                from routing.std/spec). */}
            <SpecAssignControls
              idPrefix={`evdoc-assign-${d.sectionId}`}
              sectionId={d.sectionId}
              std={d.resolvedStd}
              spec={d.resolvedSpec}
              onChange={(std, spec) => updateEvidenceDocRouting(d.sectionId, std, spec)}
            />
          </li>
          );
        })}
      </ul>
    </div>
  );
}

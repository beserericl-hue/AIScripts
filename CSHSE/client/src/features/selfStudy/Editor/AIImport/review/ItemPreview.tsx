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
import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Sparkles, Pencil, Check, X, Undo2, User, FileBox } from 'lucide-react';
import {
  useAIImportStore,
  type BucketItem,
  type SpecBucket,
  type Tag,
  type CVItem,
  type EvidenceDocItem,
  type IntroductionBucket,
} from '../../../../../store/aiImportStore';
import { ItemKind } from './ItemCardList';

interface ItemPreviewProps {
  bucket: SpecBucket | null;
  selectedSectionId: string | null;
  tags: Tag[];
  // CR-040 follow-on — pass the standalone Supporting Evidence arrays
  // so the preview can render a CV/evidenceDoc card when its sectionId
  // is selected (clicked from CVsView / EvidenceDocsView).
  cvs?: CVItem[];
  evidenceDocs?: EvidenceDocItem[];
  // CR-039 follow-on (UX feedback 2026-05-30) — same shape for
  // Introduction items so clicking a Document/Standard Introduction
  // card surfaces the AI evaluation in this pane. Without it, findItem
  // returned null and the right pane stayed on "Select an item from the
  // middle pane" forever for any intro selection.
  introductions?: Record<string, IntroductionBucket>;
  onChangeKind: (sectionId: string, kind: ItemKind | 'discard') => void;
  onReassign: (sectionId: string) => void;
  onShowInSource: (sectionId: string) => void;
  // CR-032 — edit-mode plumbing. When editingSectionId === selectedSectionId
  // the preview flips into edit mode showing a textarea over the item's
  // snippet (or the tag's fullText). Save/Cancel/Revert call the store
  // actions wired in ReviewStep.
  editingSectionId?: string | null;
  onEditStart?: (sectionId: string) => void;
  onEditSave?: (sectionId: string, newText: string) => void;
  onEditCancel?: () => void;
  onEditRevert?: (sectionId: string) => void;
}

function findItem(
  bucket: SpecBucket | null,
  tags: Tag[],
  sectionId: string | null,
  cvs?: CVItem[],
  evidenceDocs?: EvidenceDocItem[],
  introductions?: Record<string, IntroductionBucket>
): { kind: ItemKind | 'tag' | 'cv' | 'evidenceDoc'; item: BucketItem | Tag | CVItem | EvidenceDocItem } | null {
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
  // CR-040 follow-on — standalone Supporting Evidence sources.
  if (cvs) {
    const cv = cvs.find((c) => c.sectionId === sectionId);
    if (cv) return { kind: 'cv', item: cv };
  }
  if (evidenceDocs) {
    const ed = evidenceDocs.find((d) => d.sectionId === sectionId);
    if (ed) return { kind: 'evidenceDoc', item: ed };
  }
  // CR-039 follow-on (UX feedback 2026-05-30) — Introduction items.
  // Same BucketItem shape as narratives, so we render them as kind='text'
  // so the existing rationale + acceptState + Show-in-source + edit
  // affordances all light up. Without this branch, clicking a Document/
  // Standard Introduction card stayed on the empty right-pane state.
  if (introductions) {
    for (const b of Object.values(introductions)) {
      const hit = b.items.find((i) => i.sectionId === sectionId);
      if (hit) return { kind: 'text', item: hit };
    }
  }
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
  cvs,
  evidenceDocs,
  introductions,
  onChangeKind,
  onReassign,
  onShowInSource,
  editingSectionId,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditRevert
}: ItemPreviewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const found = findItem(bucket, tags, selectedSectionId, cvs, evidenceDocs, introductions);
  const isEditing = !!(selectedSectionId && editingSectionId === selectedSectionId);

  // Local controlled textarea state. Initialized from the item's current
  // snippet whenever edit mode opens; persists ONLY in this component
  // until the coordinator clicks Save (which dispatches editBucketItem /
  // editTag through onEditSave).
  const [draft, setDraft] = useState<string>('');
  useEffect(() => {
    // Edit mode only applies to bucket items (text / evidenceText / file)
    // and tags. CV / evidenceDoc previews are read-only and short-circuit
    // out before the editing-textarea ever mounts, so we narrow the type
    // here.
    if (isEditing && found && (found.kind === 'tag' || found.kind === 'text' || found.kind === 'evidenceText' || found.kind === 'file')) {
      const editable = found.item as BucketItem | Tag;
      const initial = isTag(editable) ? editable.fullText : (editable as BucketItem).snippet;
      setDraft(initial || '');
      // Defer focus to the next paint so the textarea has mounted.
      const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [isEditing, selectedSectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (found && containerRef.current && !isEditing) {
      containerRef.current.focus({ preventScroll: true });
    }
  }, [selectedSectionId, found, isEditing]);

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

  // CR-040 follow-on — CV / evidenceDoc previews. The standalone
  // Supporting Evidence items don't carry rationale/acceptState the
  // way bucket items do; render a focused detector-output view with
  // confidence, source location, and a downloadable .docx (when the
  // import has been Apply'd). Returns early so the bucket-item branch
  // below stays clean.
  if (found.kind === 'cv') {
    const cv = found.item as CVItem;
    const cvBand = confBand((cv as any).confidence ?? 1.0);
    return (
      <CVPreview
        cv={cv}
        band={cvBand}
        onShowInSource={onShowInSource}
        containerRef={containerRef}
      />
    );
  }
  if (found.kind === 'evidenceDoc') {
    const ed = found.item as EvidenceDocItem;
    const edBand = confBand((ed as any).confidence ?? 1.0);
    return (
      <EvidenceDocPreview
        doc={ed}
        band={edBand}
        onShowInSource={onShowInSource}
        containerRef={containerRef}
      />
    );
  }

  // CV / evidenceDoc paths are handled above with their own preview
  // components, so by here `found.item` is guaranteed to be BucketItem
  // | Tag. Narrow accordingly so the rest of the render stays clean.
  const { kind } = found;
  const item = found.item as BucketItem | Tag;
  const heading = isTag(item) ? item.summary : item.heading;
  const rationale = item.rationale;
  const confidence = isTag(item) ? item.confidence : item.confidence;
  const wordCount = isTag(item) ? item.fullText.split(/\s+/).length : item.wordCount;
  const acceptState = isTag(item) ? item.acceptState : (item as BucketItem).acceptState;
  const band = confBand(confidence);
  // CR-032 — table-bearing items keep htmlSnippet; their pencil is disabled.
  const hasHtmlTable = !isTag(item) && !!(item as BucketItem).htmlSnippet;
  const isEdited = (item as any).editedAt !== undefined && (item as any).originalSnippet !== undefined;
  const editingDraftWordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <aside
      ref={containerRef}
      tabIndex={-1}
      aria-label="AI evaluation panel"
      className="flex h-full w-96 flex-col border-l border-gray-200 bg-white focus:outline-none"
    >
      {/* Header — what the AI saw */}
      <div className="border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cshse-600" aria-hidden />
            {/* CR-044 typography parity — header stays text-base
                so it reads at the same size as the editor's heading. */}
            <h3 className="text-base font-semibold text-gray-900">
              {isEditing ? 'Editing text' : 'AI evaluation'}
            </h3>
            {isEdited && !isEditing && (
              <span
                className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                title="This text has been edited from the AI's original. Use 'Revert' to restore."
              >
                edited
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* CR-040 follow-on (2026-05-27) — "Show in source" promoted
                from the bottom of the scrollable rationale region to
                the always-visible header so it never scrolls below the
                fold when the rationale text is long. User feedback:
                "the see in original document badge is missing for this
                entry. It sometimes shows below the screen and probably
                needs to be at the top of the sidebar." */}
            {!isEditing && (
              <button
                type="button"
                onClick={() => onShowInSource(selectedSectionId!)}
                title="Open the source document and jump to where this item came from"
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Show in source
              </button>
            )}
            {/* CR-032 — Edit button. Disabled for tables (route to Standards
                editor after Apply) and during the parsing stage (snapshots
                would clobber local state — though dirty flag would protect,
                this is cleaner UX). */}
            {!isEditing && onEditStart && (
              <button
                type="button"
                onClick={() => onEditStart(selectedSectionId!)}
                disabled={hasHtmlTable}
                title={
                  hasHtmlTable
                    ? 'This item contains a table. Edit it in the Standards editor after Apply.'
                    : 'Edit this text before applying'
                }
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                Edit
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Source heading</div>
          <div className="mt-1 text-base font-medium text-gray-900 break-words">
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

      {/* CR-032 — body switches between AI rationale (read-only) and the
          edit textarea. Edit mode swallows the whole flex-1 region so the
          textarea has all available height. */}
      {isEditing ? (
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <label className="mb-1 text-xs uppercase tracking-wide text-gray-500">
            Edit the text below — delete sentences, add sentences, reword. Save when you're done.
          </label>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 resize-none rounded border border-gray-300 bg-white p-3 text-sm leading-relaxed text-gray-900 focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
            spellCheck
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>{editingDraftWordCount} words</span>
            <span>
              {(item as any).originalSnippet !== undefined && (
                <>was {((item as any).originalSnippet as string).trim() ? ((item as any).originalSnippet as string).trim().split(/\s+/).length : 0} words at AI extraction · </>
              )}
              edits stay local until Apply
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div>
              {isEdited && onEditRevert && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Restore the AI's original extracted text? Your edits since the first save will be lost."
                      )
                    ) {
                      onEditRevert(selectedSectionId!);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Undo2 className="h-3 w-3" aria-hidden />
                  Revert to AI original
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEditCancel?.()}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <X className="h-3 w-3" aria-hidden />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onEditSave?.(selectedSectionId!, draft)}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <Check className="h-3 w-3" aria-hidden />
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Rationale — the meat of the evaluation */
        <div className="flex-1 overflow-auto p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">AI rationale</div>
          {/* CR-044 typography parity — rationale body to prose-sm
              so the supporting evaluation reads at the editor baseline. */}
          {rationale ? (
            <div className="prose prose-sm max-w-none rounded border border-cshse-100 bg-cshse-50 px-3 py-3 text-cshse-900">
              {rationale}
            </div>
          ) : (
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm italic text-gray-500">
              No rationale recorded — the matcher returned this item without a written explanation.
            </div>
          )}

          {/* CR-040 follow-on (2026-05-27) — the "Show in source"
              button moved to the top-of-sidebar header so it can't
              scroll below the fold. The old bottom-of-rationale button
              has been removed. */}
        </div>
      )}

      {/* Action footer — hidden in edit mode; the textarea's own Save/Cancel
          are the only actions while editing. */}
      {!isEditing && (
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
      )}
    </aside>
  );
}

// ----------------------------------------- CR-040 follow-on — supporting evidence previews

interface CVPreviewProps {
  cv: CVItem;
  band: { label: string; textCls: string; bgCls: string };
  onShowInSource: (sectionId: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

function CVPreview({ cv, band, onShowInSource, containerRef }: CVPreviewProps): JSX.Element {
  const submissionId = useAIImportStore((s) => s.submissionId);
  return (
    <aside
      ref={containerRef as any}
      tabIndex={-1}
      aria-label="CV evaluation panel"
      className="flex h-full w-96 flex-col border-l border-gray-200 bg-white focus:outline-none"
    >
      <div className="border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-cshse-700" aria-hidden />
          <h3 className="text-base font-semibold text-gray-900">Faculty CV</h3>
          <span
            className={`ml-auto rounded border px-2 py-0.5 text-xs ${band.bgCls} ${band.textCls}`}
            title={`detector confidence — ${band.label}`}
          >
            detector · {band.label}
          </span>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Faculty name</div>
          <div className="text-base font-semibold text-gray-900">{cv.facultyName}</div>
        </div>
        {cv.resolvedStd && cv.resolvedSpec && (
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Routing</div>
            <div className="font-mono text-sm text-cshse-700">
              → Spec {cv.resolvedStd}.{cv.resolvedSpec}
              <span className="ml-2 text-xs text-gray-500">
                ({cv.routing?.source ?? 'detector'})
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">CV body</div>
        {cv.snippet ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800">
            {cv.snippet.slice(0, 4000)}
            {cv.snippet.length > 4000 && '\n…'}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">No CV body captured.</div>
        )}
      </div>
      <div className="border-t border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onShowInSource(cv.sectionId)}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Show in source document
        </button>
        {cv.fileId && submissionId && (
          <a
            href={`/api/submissions/${submissionId}/evidence/${cv.fileId}/download`}
            target="_blank"
            rel="noopener noreferrer"
            download={cv.fileName}
            className="inline-flex items-center gap-1 rounded border border-cshse-300 bg-white px-2 py-1 text-xs font-medium text-cshse-700 hover:bg-cshse-50"
          >
            📂 Download .docx
          </a>
        )}
      </div>
    </aside>
  );
}

interface EvidenceDocPreviewProps {
  doc: EvidenceDocItem;
  band: { label: string; textCls: string; bgCls: string };
  onShowInSource: (sectionId: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

function EvidenceDocPreview({
  doc,
  band,
  onShowInSource,
  containerRef,
}: EvidenceDocPreviewProps): JSX.Element {
  const submissionId = useAIImportStore((s) => s.submissionId);
  const kindLabel = doc.docSubKind === 'syllabus' ? 'Course syllabus' : 'Appendix paper';
  return (
    <aside
      ref={containerRef as any}
      tabIndex={-1}
      aria-label="Evidence document evaluation panel"
      className="flex h-full w-96 flex-col border-l border-gray-200 bg-white focus:outline-none"
    >
      <div className="border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileBox className="h-4 w-4 text-cshse-700" aria-hidden />
          <h3 className="text-base font-semibold text-gray-900">{kindLabel}</h3>
          <span
            className={`ml-auto rounded border px-2 py-0.5 text-xs ${band.bgCls} ${band.textCls}`}
          >
            {((doc as any).confidence ?? 1.0).toFixed(2)} · {band.label}
          </span>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Title</div>
          <div className="text-base font-semibold text-gray-900">{doc.title}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          {doc.courseCode && (
            <div>
              <span className="font-medium text-gray-500">Course code</span>
              <div className="font-mono">{doc.courseCode}</div>
            </div>
          )}
          {doc.author && (
            <div>
              <span className="font-medium text-gray-500">Author</span>
              <div>{doc.author}</div>
            </div>
          )}
          {doc.date && (
            <div>
              <span className="font-medium text-gray-500">Date</span>
              <div>{doc.date}</div>
            </div>
          )}
          {typeof doc.points === 'number' && (
            <div>
              <span className="font-medium text-gray-500">Points</span>
              <div>{doc.points}</div>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-500">Pages (est.)</span>
            <div>{doc.pageCountEstimate}</div>
          </div>
          {doc.imageCount > 0 && (
            <div>
              <span className="font-medium text-gray-500">Images</span>
              <div>{doc.imageCount}</div>
            </div>
          )}
        </div>
        {doc.resolvedStd && doc.resolvedSpec && (
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Routing</div>
            <div className="font-mono text-sm text-cshse-700">
              → Spec {doc.resolvedStd}.{doc.resolvedSpec}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {doc.summary ? (
          <>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Summary</div>
            <p className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800">
              {doc.summary}
            </p>
          </>
        ) : (
          <div className="text-sm text-gray-400 italic">
            No summary captured. Click "Show in source document" to view the original.
          </div>
        )}
      </div>
      <div className="border-t border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onShowInSource(doc.sectionId)}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Show in source document
        </button>
        {doc.fileId && submissionId && (
          <a
            href={`/api/submissions/${submissionId}/evidence/${doc.fileId}/download`}
            target="_blank"
            rel="noopener noreferrer"
            download={doc.fileName}
            className="inline-flex items-center gap-1 rounded border border-cshse-300 bg-white px-2 py-1 text-xs font-medium text-cshse-700 hover:bg-cshse-50"
          >
            📂 Download .docx
          </a>
        )}
      </div>
    </aside>
  );
}

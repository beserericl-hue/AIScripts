/**
 * Step 3 — Review (sub-sprint 1.b — full three-column workspace).
 *
 * Replaces the 1.a summary-only stub with the real workspace from UI
 * spec §6.3: SpecRail (left) + ItemTable (middle) + ItemPreview (right)
 * + bulk-action toolbar + ReassignPopup + ShowInSourceModal.
 *
 * Local-only operations (kind change, reassign, send-to-tags, promote-to-file)
 * stay client-side until Apply — the server doesn't see them until the
 * Step 5 commit lands.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Rocket, Loader2 } from 'lucide-react';
import { useAIImportStore, type Tag, type BucketItem, type SpecBucket } from '../../../../../store/aiImportStore';
import { SpecRail, UNPLACED_KEY, UNWRITTEN_KEY } from '../review/SpecRail';
// Any selectedSpecKey starting with '_' is a synthetic rail key (matrices,
// cvs, evidence-docs, papers, syllabi, etc.) — none of them map to a real
// bucket lookup, so activeBucket must return null for them.
import { ItemCardList, type ItemKind } from '../review/ItemCardList';
import { ItemPreview } from '../review/ItemPreview';
import { ReassignPopup } from '../review/ReassignPopup';
import { ShowInSourceModal } from '../review/ShowInSourceModal';
import { StandaloneCVReview } from '../review/StandaloneCVReview';
import { MissingFragmentsView } from '../review/MissingFragmentsView';
import { MISSING_FRAGMENTS_KEY } from '../review/SpecRail';
import { api } from '../../../../../services/api';

/**
 * Strip the leading heading BLOCK from a snippet before using it as
 * Show-in-source search text.
 *
 * Per user direction 2026-05-22:
 *   "AI generated headlines should never be featured in the search.
 *    These are headlines. the body of the text is what is imported
 *    from the document."
 *   "every tile has a headline that is not part of the text"
 *
 * The ai-service emits snippet text where the leading lines are spec-prompt
 * titles from the CSHSE template ("Describe the institution.", "Table of
 * Contents", etc) — these are headings, not the coordinator's response
 * body. The body — the part that should drive search — starts AFTER the
 * first paragraph break. Stripping just the first line (the previous fix)
 * left multi-line heading blocks partly intact.
 *
 * Rule: drop everything up to and including the first paragraph break
 * (a blank line / double newline). If no paragraph break exists (rare;
 * single-paragraph snippet), use as-is. If the body after stripping is
 * too short to be useful for matching (<60 chars), fall back to the full
 * snippet so we don't accidentally search on nothing.
 */
function stripCardHeading(snippet: string): string {
  const trimmed = (snippet || '').trim();
  if (!trimmed) return '';
  const para = trimmed.match(/\n\s*\n/);
  if (!para || para.index === undefined) return trimmed; // no paragraph break
  const body = trimmed.slice(para.index + para[0].length).trim();
  return body.length >= 60 ? body : trimmed;
}

export function ReviewStep(): JSX.Element {
  // CR-033 Phase 2c part 2 — standalone-CV mode short-circuits the
  // three-column workspace. The coordinator dropped just a CV.docx —
  // show the one-card Review with editable faculty name + spec dropdown.
  // The full + standalone variants live in two distinct child components
  // so React's Rules of Hooks aren't broken by a top-level early return.
  const standaloneCv = useAIImportStore((s) => s.standaloneCv);
  return standaloneCv ? <StandaloneCVReview /> : <FullReviewStep />;
}

function FullReviewStep(): JSX.Element {
  // CR-041 US-6 — when in batch mode, fetch each child's snapshot and
  // merge into the parent state. Runs once on mount, and again when
  // additional children finish (driven by batchSnapshot.completedCount).
  const batchId = useAIImportStore((s) => s.batchId);
  const batchSnapshotForReview = useAIImportStore((s) => s.batchSnapshot);
  const loadBatchChildren = useAIImportStore((s) => s.loadBatchChildren);
  React.useEffect(() => {
    if (batchId) {
      loadBatchChildren();
    }
  }, [batchId, batchSnapshotForReview?.completedCount, loadBatchChildren]);

  // CR-041 US-6 — source-file filter on merged Review.
  const reviewSourceFilter = useAIImportStore((s) => s.reviewSourceFilter);
  const setReviewSourceFilter = useAIImportStore((s) => s.setReviewSourceFilter);
  const rawBuckets = useAIImportStore((s) => s.buckets);
  const rawTags = useAIImportStore((s) => s.tags);
  const rawCvs = useAIImportStore((s) => s.cvs);
  const rawEvidenceDocs = useAIImportStore((s) => s.evidenceDocs);
  const rawIntroductions = useAIImportStore((s) => s.introductions);
  // Distinct source filenames for the dropdown — derived from any
  // bucket / tag / cv / evidenceDoc / intro item that carries a
  // sourceImportId. Empty in single-file mode.
  const sourceOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    const stamp = (it: any) => {
      if (it?.sourceImportId && it.sourceFilename) {
        m.set(it.sourceImportId, it.sourceFilename);
      }
    };
    for (const b of Object.values(rawBuckets)) {
      b.narratives.forEach(stamp);
      b.evidenceText.forEach(stamp);
      b.evidenceFiles.forEach(stamp);
    }
    rawTags.forEach(stamp);
    rawCvs.forEach(stamp);
    rawEvidenceDocs.forEach(stamp);
    for (const ib of Object.values(rawIntroductions)) ib.items.forEach(stamp);
    return [...m.entries()].map(([importId, filename]) => ({ importId, filename }));
  }, [rawBuckets, rawTags, rawCvs, rawEvidenceDocs, rawIntroductions]);

  // CR-041 US-6 — apply the source filter. When set, every item whose
  // sourceImportId !== filter is hidden from buckets / tags / cvs /
  // evidenceDocs / introductions. The unfiltered raw fields stay
  // available via rawBuckets etc for the dropdown population.
  const buckets = React.useMemo(() => {
    if (!reviewSourceFilter) return rawBuckets;
    const out: typeof rawBuckets = {};
    for (const [k, b] of Object.entries(rawBuckets)) {
      out[k] = {
        ...b,
        narratives: b.narratives.filter((it) => (it as any).sourceImportId === reviewSourceFilter),
        evidenceText: b.evidenceText.filter((it) => (it as any).sourceImportId === reviewSourceFilter),
        evidenceFiles: b.evidenceFiles.filter((it) => (it as any).sourceImportId === reviewSourceFilter)
      };
    }
    return out;
  }, [rawBuckets, reviewSourceFilter]);
  const tags = React.useMemo(
    () =>
      reviewSourceFilter
        ? rawTags.filter((t) => (t as any).sourceImportId === reviewSourceFilter)
        : rawTags,
    [rawTags, reviewSourceFilter]
  );
  // CR-040 Phase 3b — coverage report drives the "Missing from import"
  // SpecRail entry, the Parse-step stat carried forward into Review, and
  // the soft Apply gate. Defensive `|| null` because older imports may
  // not carry a report.
  const coverageReport = useAIImportStore((s) => s.coverageReport);
  // CR-039 — Introduction buckets + move-into-introduction action
  const introductions = React.useMemo(() => {
    if (!reviewSourceFilter) return rawIntroductions;
    const out: typeof rawIntroductions = {};
    for (const [k, ib] of Object.entries(rawIntroductions)) {
      out[k] = {
        ...ib,
        items: ib.items.filter((i) => (i as any).sourceImportId === reviewSourceFilter)
      };
    }
    return out;
  }, [rawIntroductions, reviewSourceFilter]);
  const moveItemToIntroduction = useAIImportStore((s) => s.moveItemToIntroduction);
  // CR-033 / CR-040 Phase 2c — detector outputs surfaced as rail entries.
  const cvs = React.useMemo(
    () =>
      reviewSourceFilter
        ? rawCvs.filter((c) => (c as any).sourceImportId === reviewSourceFilter)
        : rawCvs,
    [rawCvs, reviewSourceFilter]
  );
  const evidenceDocs = React.useMemo(
    () =>
      reviewSourceFilter
        ? rawEvidenceDocs.filter((e) => (e as any).sourceImportId === reviewSourceFilter)
        : rawEvidenceDocs,
    [rawEvidenceDocs, reviewSourceFilter]
  );
  const placeholderSections = useAIImportStore((s) => s.placeholderSections);
  const selectedSpecKey = useAIImportStore((s) => s.selectedSpecKey);
  const selectedSectionId = useAIImportStore((s) => s.selectedSectionId);
  const importId = useAIImportStore((s) => s.importId);
  const matrices = useAIImportStore((s) => s.matrices);
  const setStep = useAIImportStore((s) => s.setStep);
  const selectSpec = useAIImportStore((s) => s.selectSpec);
  const selectSection = useAIImportStore((s) => s.selectSection);
  const setMatrixRowAnchor = useAIImportStore((s) => s.setMatrixRowAnchor);
  const selectMatrixRow = useAIImportStore((s) => s.selectMatrixRow);

  // CR-024 / S2B.6 — when the coordinator picks a spec in the rail we
  // pre-position every matrix to that spec's row so it's already scrolled
  // into view if they later click "Matrices". This is intentionally a soft
  // pre-positioning (setMatrixRowAnchor) — not a view-switch (selectMatrixRow)
  // — because the spec rail click means "I want to look at this spec",
  // not "I want to look at the matrix".
  const findMatrixRowAnchorForSpec = useCallback(
    (specKey: string): string | null => {
      // specKey shape from SpecRail is "<std>.<spec>" (e.g. "13.a"). Matrix
      // row anchors are "matrix-{slug}-row-{std}-{spec}". Iterate matrices
      // until we find a matching cell; return the first hit (anchors are
      // matrix-scoped so two matrices' rows for the same spec are
      // independent — both will scroll because both consume the same
      // selectedMatrixRowAnchor, the MatricesView matches by suffix).
      const dot = specKey.indexOf('.');
      if (dot === -1) return null;
      const std = specKey.slice(0, dot);
      const spec = specKey.slice(dot + 1);
      for (const m of matrices) {
        const hit = m.cells.find((c) => c.std === std && c.spec === spec);
        if (hit?.rowAnchor) return hit.rowAnchor;
      }
      return null;
    },
    [matrices]
  );

  const setMatrixScrollSpec = useAIImportStore((s) => s.setMatrixScrollSpec);
  const handleSelectSpec = useCallback(
    (key: string) => {
      // For spec keys (not _matrices, _unplaced, _unwritten), pre-position
      // the matrices view if coverage exists. For the synthetic buckets we
      // leave the anchor alone.
      selectSpec(key);
      if (!key.startsWith('_')) {
        const anchor = findMatrixRowAnchorForSpec(key);
        if (anchor) setMatrixRowAnchor(anchor);
        // CR-024 Sprint 2B — broadcast the spec key so MatricesView can
        // scroll + flash the matching row in EVERY visible matrix
        // simultaneously, not just the first one our anchor lookup found.
        setMatrixScrollSpec(key);
      }
    },
    [selectSpec, setMatrixRowAnchor, setMatrixScrollSpec, findMatrixRowAnchorForSpec]
  );

  // Spec cards offer a "Matrix" button that switches the center pane to
  // the Matrices view scrolled to the row. Different from the soft
  // pre-positioning above — this is an explicit "show me the matrix" action.
  const handleJumpToMatrix = useCallback(
    (specKey: string) => {
      const anchor = findMatrixRowAnchorForSpec(specKey);
      if (anchor) selectMatrixRow(anchor);
    },
    [findMatrixRowAnchorForSpec, selectMatrixRow]
  );

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTargets, setReassignTargets] = useState<string[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceSectionId, setSourceSectionId] = useState<string | null>(null);
  const [sourceMatchText, setSourceMatchText] = useState('');
  // Correction-flow state — when set, the source modal opens in selection
  // mode targeting this (std, spec). Confirming the passage fires the
  // corrections API + adds a local bucket item so the spec card fills
  // immediately.
  const [correctionTarget, setCorrectionTarget] = useState<{
    std: string;
    spec: string;
  } | null>(null);

  // Per-card "approved" tracker — coordinator workflow signal. Items are
  // already applied as a set by Apply Step regardless of this flag; this
  // is here so the coordinator can see at a glance which items they've
  // explicitly reviewed. The card border + a green check badge update
  // off this set.
  //
  // CR-034 — persisted to Zustand `ai-import-storage` so a hard refresh
  // preserves the coordinator's review progress. Stored as an array of
  // ids (Set is not JSON-serializable); rehydrated into a Set for use.
  const approvedIdsArr = useAIImportStore((s) => s.approvedIds);
  const setApprovedIdsArr = useAIImportStore((s) => s.setApprovedIds);
  const approvedIds = useMemo(
    () => new Set(approvedIdsArr ?? []),
    [approvedIdsArr]
  );

  // CR-032 — which item is currently being edited in the right preview pane.
  // null means read-only. Set by handleEditStart (from a card's pencil),
  // cleared by handleEditCancel + handleEditSave.
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const toggleApproval = useCallback(
    (rowId: string) => {
      const next = new Set(approvedIds);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      setApprovedIdsArr(Array.from(next));
    },
    [approvedIds, setApprovedIdsArr]
  );
  const approveAll = useCallback(
    (rowIds: string[]) => {
      const next = new Set(approvedIds);
      for (const id of rowIds) next.add(id);
      setApprovedIdsArr(Array.from(next));
    },
    [approvedIds, setApprovedIdsArr]
  );
  const clearApprovals = useCallback(() => {
    setApprovedIdsArr([]);
  }, [setApprovedIdsArr]);

  // One-click apply — counts the items waiting to be applied so the
  // confirm dialog tells the coordinator exactly what's going to land in
  // the editor.
  const applyTotals = useMemo(() => {
    const t = { narratives: 0, evidenceText: 0, evidenceFiles: 0, matrixCells: 0 };
    for (const b of Object.values(buckets)) {
      t.narratives += b.narratives.length;
      t.evidenceText += b.evidenceText.length;
      t.evidenceFiles += b.evidenceFiles.length;
    }
    for (const m of matrices) t.matrixCells += (m.cells || []).length;
    return t;
  }, [buckets, matrices]);

  const apply = useAIImportStore((s) => s.apply);
  const status = useAIImportStore((s) => s.status);
  const isApplying = status === 'applying';
  const isApplied = status === 'applied' || status === 'finished';
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  // CR-040 Phase 3b — Apply is gated until every MissingFragment is
  // resolved (Discard or Reassign from the "Missing from import" rail
  // entry). resolvedMissingFragmentIds is persisted across refresh.
  const resolvedMissingFragmentIds = useAIImportStore(
    (s) => s.resolvedMissingFragmentIds
  );
  const unresolvedMissingFragments = React.useMemo(() => {
    const fragments = coverageReport?.missingFragments ?? [];
    const resolved = new Set(resolvedMissingFragmentIds);
    return fragments.filter((f) => !resolved.has(f.sectionId));
  }, [coverageReport, resolvedMissingFragmentIds]);
  const applyBlockedByMissing = unresolvedMissingFragments.length > 0;

  const handleOneClickApply = useCallback(async () => {
    setConfirmApplyOpen(false);
    await apply();
    // After apply lands, swing to the Apply step so the user sees the
    // success summary + counts. (Apply Step is now read-only post-finish.)
    setStep('apply');
  }, [apply, setStep]);

  const activeBucket =
    selectedSpecKey && !selectedSpecKey.startsWith('_')
      ? buckets[selectedSpecKey] || null
      : null;
  // Suppress unused-imports lint when the old key references are pruned.
  void UNPLACED_KEY;
  void UNWRITTEN_KEY;

  const unplacedTags = tags.filter((t) => !t.suggestedStd || !t.suggestedSpec);

  // --- mutating helpers (write back into the store) ---

  const moveItem = useCallback(
    (
      sectionId: string,
      from: { std: string; spec: string },
      to: { std: string; spec: string; kind: ItemKind | 'tag' | 'discard' }
    ) => {
      const fromKey = `${from.std}.${from.spec}`;
      const toKey = `${to.std}.${to.spec}`;
      const fromBucket = buckets[fromKey];
      if (!fromBucket) return;

      let payload: BucketItem | null = null;
      const remove = (list: BucketItem[]): BucketItem[] => {
        const found = list.find((i) => i.sectionId === sectionId);
        if (found) payload = found;
        return list.filter((i) => i.sectionId !== sectionId);
      };

      const newFromBucket = {
        ...fromBucket,
        narratives: remove(fromBucket.narratives),
        evidenceText: remove(fromBucket.evidenceText),
        evidenceFiles: remove(fromBucket.evidenceFiles)
      };
      if (!payload) return;

      const newBuckets = { ...buckets, [fromKey]: newFromBucket };

      if (to.kind === 'discard') {
        useAIImportStore.setState({ buckets: newBuckets, dirty: true });
        return;
      }

      if (to.kind === 'tag') {
        const newTag: Tag = {
          tagId: `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          sectionId,
          summary: (payload as BucketItem).heading,
          fullText: (payload as BucketItem).snippet,
          suggestedStd: to.std,
          suggestedSpec: to.spec,
          confidence: (payload as BucketItem).confidence,
          sourceHeading: (payload as BucketItem).heading,
          acceptState: (payload as BucketItem).acceptState,
          rationale: (payload as BucketItem).rationale
        };
        useAIImportStore.setState({
          buckets: newBuckets,
          tags: [...tags, newTag],
          dirty: true
        });
        return;
      }

      // BUG FIX 2026-05-21: when from === to (same spec, kind-flip),
      // we MUST start from newFromBucket — the version with the item
      // already removed from its old list. Reading buckets[toKey] here
      // would re-introduce the item under both lists, since the final
      // setState overwrites newFromBucket. That's why clicking the
      // "Evidence" chip on an item already in 1.a appeared to do nothing.
      const toBucket = (toKey === fromKey) ? newFromBucket : buckets[toKey];
      if (!toBucket) {
        // Reassign target doesn't exist (unexpected) — fall back to tag list.
        useAIImportStore.setState({ buckets: newBuckets, dirty: true });
        return;
      }
      const targetList =
        to.kind === 'text'
          ? 'narratives'
          : to.kind === 'evidenceText'
          ? 'evidenceText'
          : to.kind === 'file'
          ? 'evidenceFiles'
          : 'narratives';
      const updatedToBucket = {
        ...toBucket,
        [targetList]: [...toBucket[targetList], payload]
      };
      useAIImportStore.setState({
        buckets: { ...newBuckets, [toKey]: updatedToBucket },
        dirty: true
      });
    },
    [buckets, tags]
  );

  const handleChangeKind = useCallback(
    (sectionId: string, newKind: ItemKind | 'discard') => {
      if (!activeBucket) return;
      moveItem(
        sectionId,
        { std: activeBucket.standardCode, spec: activeBucket.specCode },
        { std: activeBucket.standardCode, spec: activeBucket.specCode, kind: newKind }
      );
    },
    [activeBucket, moveItem]
  );

  const handleBulkAction = useCallback(
    (
      action: 'to-tags' | 'to-file' | 'reassign',
      sectionIds: string[],
      target?: { std: string; spec: string }
    ) => {
      // CR-031 extension — when called with an explicit `target`, skip the
      // popup and perform the reassign directly. Used by the neighbor-
      // suggestion panel's "Move this item to X.Y" button.
      if (action === 'reassign' && target && activeBucket) {
        const from = { std: activeBucket.standardCode, spec: activeBucket.specCode };
        for (const sectionId of sectionIds) {
          // Preserve original kind (narrative vs evidenceText).
          const wasNarr = activeBucket.narratives.some((i) => i.sectionId === sectionId);
          const wasEv = activeBucket.evidenceText.some((i) => i.sectionId === sectionId);
          const kind: ItemKind = wasNarr ? 'text' : wasEv ? 'evidenceText' : 'file';
          moveItem(sectionId, from, { std: target.std, spec: target.spec, kind });
        }
        return;
      }
      if (action === 'reassign') {
        setReassignTargets(sectionIds);
        setReassignOpen(true);
        return;
      }
      if (!activeBucket) return;
      const from = { std: activeBucket.standardCode, spec: activeBucket.specCode };
      for (const sectionId of sectionIds) {
        moveItem(sectionId, from, {
          std: from.std,
          spec: from.spec,
          kind: action === 'to-tags' ? 'tag' : 'file'
        });
      }
    },
    [activeBucket, moveItem]
  );

  const handleReassignConfirm = useCallback(
    (std: string, spec: string) => {
      if (!activeBucket) {
        setReassignOpen(false);
        return;
      }
      const from = { std: activeBucket.standardCode, spec: activeBucket.specCode };
      for (const sectionId of reassignTargets) {
        // Preserve the original kind when reassigning across specs.
        const wasNarrative = activeBucket.narratives.some((i) => i.sectionId === sectionId);
        const wasEvText = activeBucket.evidenceText.some((i) => i.sectionId === sectionId);
        const kind: ItemKind = wasNarrative ? 'text' : wasEvText ? 'evidenceText' : 'file';
        moveItem(sectionId, from, { std, spec, kind });
      }
      setReassignOpen(false);
      setReassignTargets([]);
    },
    [activeBucket, moveItem, reassignTargets]
  );

  // CR-031 — promote an Unplaced tag into a spec bucket as a narrative.
  // Reads tags + buckets, builds a BucketItem from the tag fields,
  // appends to the target bucket's narratives, removes from tags,
  // marks dirty so the placement survives hard refresh.
  const handleAppendUnplacedToSpec = useCallback(
    (tagId: string, std: string, spec: string) => {
      const tag = tags.find((t) => t.tagId === tagId);
      if (!tag) return;
      const toKey = `${std}.${spec}`;
      const targetBucket = buckets[toKey];
      if (!targetBucket) return;
      const newItem: BucketItem = {
        sectionId: tag.sectionId,
        heading: tag.sourceHeading || tag.summary,
        snippet: tag.fullText,
        htmlSnippet: tag.htmlSnippet ?? null,
        wordCount: tag.fullText ? tag.fullText.split(/\s+/).length : 0,
        confidence: tag.confidence,
        acceptState: tag.acceptState,
        rationale: tag.rationale,
        byteOffsetStart: tag.byteOffsetStart
      };
      const updatedBucket = {
        ...targetBucket,
        narratives: [...targetBucket.narratives, newItem]
      };
      useAIImportStore.setState({
        buckets: { ...buckets, [toKey]: updatedBucket },
        tags: tags.filter((t) => t.tagId !== tagId),
        dirty: true
      });
    },
    [tags, buckets]
  );

  // CR-032 — wire the store edit actions through the preview pane.
  const editBucketItem = useAIImportStore((s) => s.editBucketItem);
  const editTagAction = useAIImportStore((s) => s.editTag);
  // CR-039 follow-on (UX feedback 2026-05-30) — edit + revert for
  // Introduction-bucket items (Document / Standard intros).
  const editIntroductionItem = useAIImportStore((s) => s.editIntroductionItem);
  const revertIntroductionItem = useAIImportStore((s) => s.revertIntroductionItem);
  const revertBucketItem = useAIImportStore((s) => s.revertBucketItem);
  const revertTagAction = useAIImportStore((s) => s.revertTag);

  const handleEditStart = useCallback(
    (sectionId: string) => {
      // Selecting + opening edit are two state mutations; do both.
      selectSection(sectionId);
      setEditingSectionId(sectionId);
    },
    [selectSection]
  );

  const handleEditCancel = useCallback(() => {
    setEditingSectionId(null);
  }, []);

  // The same Save handler covers both narratives/evidenceText in the active
  // bucket AND unplaced tags. We resolve which one based on whether the
  // sectionId belongs to a tag (Unplaced) or a bucket item (Review).
  // Helper — does this sectionId live in any Introduction bucket?
  // Used by the edit + revert handlers to route to the intro-bucket
  // store actions instead of the spec-bucket ones.
  const isIntroductionSection = useCallback(
    (sectionId: string): boolean => {
      if (!introductions) return false;
      for (const b of Object.values(introductions)) {
        if (b.items.some((i) => i.sectionId === sectionId)) return true;
      }
      return false;
    },
    [introductions]
  );

  const handleEditSave = useCallback(
    (sectionId: string, newText: string) => {
      const tag = tags.find((t) => t.sectionId === sectionId);
      if (tag) {
        editTagAction(tag.tagId, newText);
      } else if (isIntroductionSection(sectionId)) {
        // CR-039 follow-on — intro items live outside the per-spec
        // bucket; route to the intro-aware editor.
        editIntroductionItem(sectionId, newText);
      } else if (activeBucket) {
        const inNarr = activeBucket.narratives.some((i) => i.sectionId === sectionId);
        const kind: 'narratives' | 'evidenceText' = inNarr ? 'narratives' : 'evidenceText';
        const specKey = `${activeBucket.standardCode}.${activeBucket.specCode}`;
        editBucketItem(specKey, sectionId, kind, newText);
      }
      setEditingSectionId(null);
    },
    [tags, activeBucket, editTagAction, editBucketItem, isIntroductionSection, editIntroductionItem]
  );

  const handleEditRevert = useCallback(
    (sectionId: string) => {
      const tag = tags.find((t) => t.sectionId === sectionId);
      if (tag) {
        revertTagAction(tag.tagId);
        return;
      }
      if (isIntroductionSection(sectionId)) {
        revertIntroductionItem(sectionId);
        return;
      }
      if (!activeBucket) return;
      const inNarr = activeBucket.narratives.some((i) => i.sectionId === sectionId);
      const kind: 'narratives' | 'evidenceText' = inNarr ? 'narratives' : 'evidenceText';
      const specKey = `${activeBucket.standardCode}.${activeBucket.specCode}`;
      revertBucketItem(specKey, sectionId, kind);
    },
    [tags, activeBucket, revertTagAction, revertBucketItem, isIntroductionSection, revertIntroductionItem]
  );

  const handleSinglePreviewReassign = useCallback(
    (sectionId: string) => {
      setReassignTargets([sectionId]);
      setReassignOpen(true);
    },
    []
  );

  const handleShowInSource = useCallback(
    (sectionId: string) => {
      let matchText = '';
      if (activeBucket) {
        const inAny =
          activeBucket.narratives.find((i) => i.sectionId === sectionId) ||
          activeBucket.evidenceText.find((i) => i.sectionId === sectionId) ||
          activeBucket.evidenceFiles.find((i) => i.sectionId === sectionId);
        if (inAny) matchText = stripCardHeading(inAny.snippet);
      }
      if (!matchText) {
        const tag = tags.find((t) => t.sectionId === sectionId);
        if (tag) matchText = stripCardHeading(tag.fullText);
      }
      // CR-040 follow-on (2026-05-27) — Show-in-source bug fix.
      // CV cards and evidenceDoc cards aren't in buckets[] or tags[],
      // they live in their own top-level arrays. Without this branch,
      // the modal opened with matchText='' which falls below the
      // 20-char minimum in ShowInSourceModal and immediately renders
      // "This content is no longer in the current document version,
      // showing the document from the top." — exactly what the user
      // saw on the Stevenson document.
      if (!matchText) {
        const cv = cvs.find((c) => c.sectionId === sectionId);
        if (cv) {
          // For CVs, the faculty name is the most distinctive marker
          // in the source document — prepend it before the snippet so
          // the modal's fuzzy match has a strong anchor even if the
          // snippet was generated from a slightly different region of
          // the body than what now lives in the latest DocumentVersion.
          const headLine = cv.facultyName ? `${cv.facultyName}\n` : '';
          matchText = headLine + stripCardHeading(cv.snippet || '');
        }
      }
      if (!matchText) {
        const ed = evidenceDocs.find((d) => d.sectionId === sectionId);
        if (ed) {
          // For evidence docs (paper or syllabus), title is the most
          // distinctive marker; fall back to summary if title is short.
          const headLine = ed.title ? `${ed.title}\n` : '';
          matchText = headLine + stripCardHeading(ed.summary || '');
        }
      }
      setSourceSectionId(sectionId);
      setSourceMatchText(matchText);
      setSourceOpen(true);
    },
    [activeBucket, tags, cvs, evidenceDocs]
  );

  // Coordinator clicked "+ Add from source" on an empty spec card. Open the
  // source modal in selection mode targeting that (std, spec).
  const handleCorrectMissingSpec = useCallback((std: string, spec: string) => {
    setCorrectionTarget({ std, spec });
    setSourceOpen(true);
  }, []);

  // CR-039 Phase 2c part 2 — "+ Add from source" for an Introduction
  // bucket. Opens the same ShowInSourceModal in selection mode but
  // routes the confirmed text into the intro bucket instead of a spec.
  const [introTarget, setIntroTarget] = useState<string | null>(null);
  const setIntroductionsAction = useAIImportStore((s) => s.setIntroductions);
  const handleAddFromSourceForIntro = useCallback((introBucketKey: string) => {
    setIntroTarget(introBucketKey);
    setSourceOpen(true);
  }, []);
  const handleIntroSelectionConfirmed = useCallback(
    (text: string, location: { paragraphIndex?: number; html?: string }) => {
      if (!introTarget) return;
      const current = useAIImportStore.getState().introductions;
      const bucket = current[introTarget];
      if (!bucket) {
        setSourceOpen(false);
        setIntroTarget(null);
        return;
      }
      const localItem: BucketItem = {
        sectionId: `intro-correction-${Date.now().toString(36)}`,
        heading:
          introTarget === 'document'
            ? 'Document Introduction · coordinator add'
            : `Standard ${introTarget.replace('standard-', '')} Introduction · coordinator add`,
        snippet: text,
        htmlSnippet: location.html || null,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        confidence: 1.0,
        acceptState: 'auto_accept',
        rationale: 'Manually added by the coordinator from the source document.'
      };
      setIntroductionsAction({
        ...current,
        [introTarget]: {
          ...bucket,
          items: [...bucket.items, localItem]
        }
      });
      setSourceOpen(false);
      setIntroTarget(null);
    },
    [introTarget, setIntroductionsAction]
  );

  // User picked a passage in the source modal. Fire the corrections API +
  // append a synthetic BucketItem so the spec card fills immediately.
  const handleCorrectionConfirmed = useCallback(
    async (
      text: string,
      location: { paragraphIndex?: number; html?: string }
    ) => {
      if (!correctionTarget || !importId) return;
      const { std, spec } = correctionTarget;
      const key = `${std}.${spec}`;
      const existing = buckets[key];
      // Local optimistic update — the spec card fills with the new item.
      // Fix 2026-05-22: capture HTML when the selection crossed a <table>
      // or similar structure so the table doesn't flatten to one-line-
      // per-cell text on the spec card. ItemCard renders htmlSnippet
      // verbatim when present.
      const localItem: BucketItem = {
        sectionId: `correction-${Date.now().toString(36)}`,
        heading: `${std}.${spec} · coordinator correction`,
        snippet: text,
        htmlSnippet: location.html || null,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        confidence: 1.0,
        acceptState: 'auto_accept',
        rationale: 'Manually corrected by the coordinator from the source document.'
      };
      const nextBucket: SpecBucket = existing
        ? { ...existing, narratives: [...existing.narratives, localItem] }
        : {
            standardCode: std,
            specCode: spec,
            standardTitle: '',
            specPrompt: '',
            narratives: [localItem],
            evidenceText: [],
            evidenceFiles: [],
            matrixCells: [],
            coverageScore: null,
            coverageCovered: null,
            coverageGaps: [],
            coverageStrengths: []
          };
      useAIImportStore.setState({ buckets: { ...buckets, [key]: nextBucket }, dirty: true });
      setSourceOpen(false);
      setCorrectionTarget(null);
      try {
        await api.post(`/api/imports/${importId}/corrections`, {
          expectedStd: std,
          expectedSpec: spec,
          expectedSectionType: 'narrative_response',
          sourceText: text,
          sourceHeading: `${std}.${spec}`,
          correctionType: 'missed-by-matcher'
        });
      } catch (err) {
        // The local card stays filled — coordinator workflow isn't blocked
        // on the correction API. A reconciler can re-fire on next session.
        console.warn('correction POST failed:', err);
      }
    },
    [buckets, correctionTarget, importId]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review recommendations</h2>
          <p className="text-xs text-gray-500">
            {applyTotals.narratives} narratives · {applyTotals.evidenceText} evidence text ·
            {' '}{applyTotals.evidenceFiles} evidence files
            {applyTotals.matrixCells > 0 && <> · {applyTotals.matrixCells} matrix cells</>}
            {approvedIds.size > 0 && <> · {approvedIds.size} reviewed</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* CR-041 US-6 — source-file filter. Visible only when in
              batch mode (sourceOptions populated). Lets the PC scope
              SpecRail counts + visible cards to one source file. */}
          {sourceOptions.length > 0 && (
            <label className="flex items-center gap-1 text-xs text-gray-700">
              <span>Filter by source:</span>
              <select
                value={reviewSourceFilter ?? ''}
                onChange={(e) =>
                  setReviewSourceFilter(e.target.value || null)
                }
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
              >
                <option value="">All sources ({sourceOptions.length})</option>
                {sourceOptions.map((opt) => (
                  <option key={opt.importId} value={opt.importId}>
                    {opt.filename}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() => setStep('parse')}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ◂ Back
          </button>
          <button
            onClick={() => setStep(matrices.length > 0 ? 'matrix' : 'apply')}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            title="Walk through the matrix-column mapping and merge settings before applying"
          >
            Next: {matrices.length > 0 ? 'Matrix' : 'Apply'} ▸
          </button>
          <button
            onClick={() => setConfirmApplyOpen(true)}
            disabled={isApplying || isApplied || applyBlockedByMissing}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            title={
              applyBlockedByMissing
                ? `Apply blocked — ${unresolvedMissingFragments.length} missing fragment(s) need to be discarded or reassigned first`
                : 'Send all reviewed narratives, evidence, files, tags, and matrices straight to the standards editor'
            }
          >
            {isApplying ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Applying…</>
            ) : isApplied ? (
              <>✓ Applied</>
            ) : (
              <><Rocket className="h-4 w-4" aria-hidden /> Apply to editor</>
            )}
          </button>
        </div>
      </div>

      {/* One-click apply confirm dialog */}
      {confirmApplyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmApplyOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">Send everything to the editor?</h3>
            <p className="mt-2 text-sm text-gray-700">
              The following items will be written to the standards editor
              (Submission.narratives + SupportingEvidence + CurriculumMatrix).
              Existing content stays — new content is merged in.
            </p>
            <ul className="mt-3 space-y-1 rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <li>📝 {applyTotals.narratives} narratives</li>
              <li>📄 {applyTotals.evidenceText} supporting evidence text</li>
              <li>📎 {applyTotals.evidenceFiles} evidence files</li>
              {applyTotals.matrixCells > 0 && (
                <li>🔢 {applyTotals.matrixCells} matrix cells across {matrices.length} matrix{matrices.length === 1 ? '' : 'es'}</li>
              )}
              <li>🏷 {tags.length} unplaced items → Tag list</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              You can still review and edit everything inside the standards editor afterwards.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmApplyOpen(false)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleOneClickApply}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Rocket className="h-3.5 w-3.5" aria-hidden /> Confirm — send to editor
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <SpecRail
          buckets={buckets}
          tags={tags}
          placeholders={placeholderSections}
          matrices={matrices}
          selectedKey={selectedSpecKey}
          onSelect={handleSelectSpec}
          introductions={introductions}
          cvs={cvs}
          evidenceDocs={evidenceDocs}
          missingFragmentCount={coverageReport?.missingFragments?.length || 0}
          onAddFromSourceForIntro={handleAddFromSourceForIntro}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* CR-040 Phase 3b — when the rail's "Missing from import"
              entry is selected, swap the middle pane for the
              MissingFragmentsView that surfaces every unaccounted-for
              section with Discard + Reassign actions. Apply is gated
              on resolution. */}
          {selectedSpecKey === MISSING_FRAGMENTS_KEY ? (
            <MissingFragmentsView
              fragments={coverageReport?.missingFragments ?? []}
              resolvedIds={new Set(resolvedMissingFragmentIds)}
            />
          ) : (
            <ItemCardList
              selectedKey={selectedSpecKey}
              bucket={activeBucket}
              unplacedTags={unplacedTags}
              placeholders={placeholderSections}
              matrices={matrices}
              selectedSectionId={selectedSectionId}
              onSelect={selectSection}
              onBulkAction={handleBulkAction}
              onCorrectMissingSpec={handleCorrectMissingSpec}
              onChangeKind={handleChangeKind}
              approvedIds={approvedIds}
              onToggleApproval={toggleApproval}
              onApproveAll={approveAll}
              onClearApprovals={clearApprovals}
              onJumpToMatrix={handleJumpToMatrix}
              onAppendUnplacedToSpec={handleAppendUnplacedToSpec}
              onEditStart={handleEditStart}
              introductions={introductions}
              onMoveToIntroduction={moveItemToIntroduction}
              cvs={cvs}
              evidenceDocs={evidenceDocs}
            />
          )}
        </main>
        <ItemPreview
          bucket={activeBucket}
          selectedSectionId={selectedSectionId}
          tags={tags}
          cvs={cvs}
          evidenceDocs={evidenceDocs}
          introductions={introductions}
          onChangeKind={handleChangeKind}
          onReassign={handleSinglePreviewReassign}
          onShowInSource={handleShowInSource}
          editingSectionId={editingSectionId}
          onEditStart={handleEditStart}
          onEditSave={handleEditSave}
          onEditCancel={handleEditCancel}
          onEditRevert={handleEditRevert}
        />
      </div>

      <ReassignPopup
        open={reassignOpen}
        buckets={buckets}
        sectionIds={reassignTargets}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />
      <ShowInSourceModal
        open={sourceOpen}
        importId={importId}
        sectionId={sourceSectionId}
        matchText={sourceMatchText}
        onClose={() => {
          setSourceOpen(false);
          setCorrectionTarget(null);
          setIntroTarget(null);
        }}
        // Either a spec-correction OR an intro-add target is active.
        // The modal renders selection mode iff selectionTarget is set;
        // we synthesize a marker object for the intro path so the
        // modal opens in selection mode without further refactor.
        selectionTarget={
          correctionTarget ??
          (introTarget
            ? { std: '_intro', spec: introTarget }
            : null)
        }
        onSelectionConfirmed={
          correctionTarget
            ? handleCorrectionConfirmed
            : introTarget
              ? handleIntroSelectionConfirmed
              : undefined
        }
      />
    </div>
  );
}

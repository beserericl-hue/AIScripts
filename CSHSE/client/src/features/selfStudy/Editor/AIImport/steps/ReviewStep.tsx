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
import { ItemCardList, type ItemKind } from '../review/ItemCardList';
import { ItemPreview } from '../review/ItemPreview';
import { ReassignPopup } from '../review/ReassignPopup';
import { ShowInSourceModal } from '../review/ShowInSourceModal';
import { api } from '../../../../../services/api';

export function ReviewStep(): JSX.Element {
  const buckets = useAIImportStore((s) => s.buckets);
  const tags = useAIImportStore((s) => s.tags);
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

  const handleSelectSpec = useCallback(
    (key: string) => {
      // For spec keys (not _matrices, _unplaced, _unwritten), pre-position
      // the matrices view if coverage exists. For the synthetic buckets we
      // leave the anchor alone.
      selectSpec(key);
      if (!key.startsWith('_')) {
        const anchor = findMatrixRowAnchorForSpec(key);
        if (anchor) setMatrixRowAnchor(anchor);
      }
    },
    [selectSpec, setMatrixRowAnchor, findMatrixRowAnchorForSpec]
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
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const toggleApproval = useCallback((rowId: string) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);
  const approveAll = useCallback((rowIds: string[]) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      for (const id of rowIds) next.add(id);
      return next;
    });
  }, []);
  const clearApprovals = useCallback(() => {
    setApprovedIds(new Set());
  }, []);

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

  const handleOneClickApply = useCallback(async () => {
    setConfirmApplyOpen(false);
    await apply();
    // After apply lands, swing to the Apply step so the user sees the
    // success summary + counts. (Apply Step is now read-only post-finish.)
    setStep('apply');
  }, [apply, setStep]);

  const activeBucket =
    selectedSpecKey && selectedSpecKey !== UNPLACED_KEY && selectedSpecKey !== UNWRITTEN_KEY
      ? buckets[selectedSpecKey] || null
      : null;

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
    (action: 'to-tags' | 'to-file' | 'reassign', sectionIds: string[]) => {
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
        if (inAny) matchText = inAny.snippet;
      }
      if (!matchText) {
        const tag = tags.find((t) => t.sectionId === sectionId);
        if (tag) matchText = tag.fullText;
      }
      setSourceSectionId(sectionId);
      setSourceMatchText(matchText);
      setSourceOpen(true);
    },
    [activeBucket, tags]
  );

  // Coordinator clicked "+ Add from source" on an empty spec card. Open the
  // source modal in selection mode targeting that (std, spec).
  const handleCorrectMissingSpec = useCallback((std: string, spec: string) => {
    setCorrectionTarget({ std, spec });
    setSourceOpen(true);
  }, []);

  // User picked a passage in the source modal. Fire the corrections API +
  // append a synthetic BucketItem so the spec card fills immediately.
  const handleCorrectionConfirmed = useCallback(
    async (text: string, _location: { paragraphIndex?: number }) => {
      if (!correctionTarget || !importId) return;
      const { std, spec } = correctionTarget;
      const key = `${std}.${spec}`;
      const existing = buckets[key];
      // Local optimistic update — the spec card fills with the new item.
      const localItem: BucketItem = {
        sectionId: `correction-${Date.now().toString(36)}`,
        heading: `${std}.${spec} · coordinator correction`,
        snippet: text,
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
            disabled={isApplying || isApplied}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            title="Send all reviewed narratives, evidence, files, tags, and matrices straight to the standards editor"
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
        />
        <main className="flex flex-1 flex-col overflow-hidden">
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
          />
        </main>
        <ItemPreview
          bucket={activeBucket}
          selectedSectionId={selectedSectionId}
          tags={tags}
          onChangeKind={handleChangeKind}
          onReassign={handleSinglePreviewReassign}
          onShowInSource={handleShowInSource}
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
        }}
        selectionTarget={correctionTarget}
        onSelectionConfirmed={correctionTarget ? handleCorrectionConfirmed : undefined}
      />
    </div>
  );
}

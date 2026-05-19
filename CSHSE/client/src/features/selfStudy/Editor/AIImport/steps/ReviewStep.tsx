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
import React, { useCallback, useState } from 'react';
import { useAIImportStore, type Tag, type BucketItem } from '../../../../../store/aiImportStore';
import { SpecRail, UNPLACED_KEY, UNWRITTEN_KEY } from '../review/SpecRail';
import { ItemCardList, type ItemKind } from '../review/ItemCardList';
import { ItemPreview } from '../review/ItemPreview';
import { ReassignPopup } from '../review/ReassignPopup';
import { ShowInSourceModal } from '../review/ShowInSourceModal';

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

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTargets, setReassignTargets] = useState<string[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceSectionId, setSourceSectionId] = useState<string | null>(null);
  const [sourceMatchText, setSourceMatchText] = useState('');

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
        useAIImportStore.setState({ buckets: newBuckets });
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
          tags: [...tags, newTag]
        });
        return;
      }

      const toBucket = buckets[toKey];
      if (!toBucket) {
        // Reassign target doesn't exist (unexpected) — fall back to tag list.
        useAIImportStore.setState({ buckets: newBuckets });
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
        buckets: { ...newBuckets, [toKey]: updatedToBucket }
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h2 className="text-lg font-semibold text-gray-900">Review recommendations</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('parse')}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ◂ Back
          </button>
          <button
            onClick={() => setStep(matrices.length > 0 ? 'matrix' : 'apply')}
            className="rounded bg-cshse-600 px-3 py-1.5 text-sm text-white hover:bg-cshse-700"
          >
            {matrices.length > 0 ? 'Next: Matrix ▸' : 'Next: Apply ▸'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <SpecRail
          buckets={buckets}
          tags={tags}
          placeholders={placeholderSections}
          matrices={matrices}
          selectedKey={selectedSpecKey}
          onSelect={selectSpec}
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
        onClose={() => setSourceOpen(false)}
      />
    </div>
  );
}

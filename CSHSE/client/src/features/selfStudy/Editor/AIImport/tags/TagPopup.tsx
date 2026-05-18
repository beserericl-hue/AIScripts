/**
 * TagPopup — the click-to-resolve modal from UI spec §7.
 *
 * Lets the Coordinator pick a destination kind + (std, spec) + resolve.
 * Applies/Skips/Discards advance to the next tag in the filtered list.
 *
 * Keyboard:
 *   - ← / → move to prev / next tag (when present)
 *   - Esc closes
 *   - Focus is trapped inside the modal
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../../../../services/api';
import type { SpecBucket, Tag } from '../../../../../store/aiImportStore';
import { useAIImportStore } from '../../../../../store/aiImportStore';

export type TagResolution = 'apply' | 'skip' | 'discard';
export type TagKind = 'narrative' | 'evidenceText' | 'file' | 'matrix' | 'discard';

interface TagPopupProps {
  tag: Tag | null;
  prevTag?: Tag;
  nextTag?: Tag;
  buckets: Record<string, SpecBucket>;
  onClose: () => void;
  onNavigate: (tagId: string) => void;
  onResolve: (tagId: string, resolution: TagResolution) => void;
}

export function TagPopup({
  tag,
  prevTag,
  nextTag,
  buckets,
  onClose,
  onNavigate,
  onResolve
}: TagPopupProps): JSX.Element | null {
  const importId = useAIImportStore((s) => s.importId);
  const [kind, setKind] = useState<TagKind>('narrative');
  const [std, setStd] = useState<string>('');
  const [spec, setSpec] = useState<string>('');
  const [working, setWorking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Seed selection from the tag's suggestion when it opens.
  useEffect(() => {
    if (!tag) return;
    setStd(tag.suggestedStd || '');
    setSpec(tag.suggestedSpec || '');
    setKind('narrative');
  }, [tag?.tagId]);

  // Esc + arrow navigation.
  useEffect(() => {
    if (!tag) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && prevTag) {
        onNavigate(prevTag.tagId);
      } else if (e.key === 'ArrowRight' && nextTag) {
        onNavigate(nextTag.tagId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tag, prevTag, nextTag, onClose, onNavigate]);

  // Focus trap: bring focus to the modal on open.
  useEffect(() => {
    if (tag && containerRef.current) {
      containerRef.current.focus();
    }
  }, [tag?.tagId]);

  const stdOptions = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of Object.values(buckets)) {
      if (!map.has(b.standardCode)) map.set(b.standardCode, []);
      map.get(b.standardCode)!.push(b.specCode);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99))
      .map(([code, specs]) => ({ code, specs: [...new Set(specs)].sort() }));
  }, [buckets]);

  if (!tag) return null;

  const handleApply = async () => {
    if (kind !== 'discard' && (!std || !spec)) return;
    setWorking(true);
    try {
      if (kind === 'discard') {
        onResolve(tag.tagId, 'discard');
        return;
      }
      // Single-item Apply via the existing /apply-ai endpoint. Server is
      // idempotent on the idempotencyKey, so a retry is safe.
      if (importId) {
        const payload =
          kind === 'narrative'
            ? { narratives: { [std]: { [spec]: { content: tag.fullText, mode: 'merge' } } } }
            : kind === 'evidenceText'
            ? { supportingEvidenceText: { [std]: { [spec]: { text: tag.fullText, mode: 'merge' } } } }
            : { supportingEvidenceFiles: [{ std, spec, sectionId: tag.sectionId, title: tag.summary, snippet: tag.fullText }] };
        await api.post(`/api/imports/${importId}/apply-ai`, {
          ...payload,
          importTags: [],
          placeholderSections: [],
          globalMergeMode: 'merge',
          idempotencyKey: `tag-${tag.tagId}-${Date.now()}`
        });
      }
      onResolve(tag.tagId, 'apply');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-lg bg-white shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id="tag-popup-title" className="text-base font-semibold text-gray-900">
            Tag {tag.tagId.slice(0, 12)} — {tag.summary.slice(0, 60)}
            {tag.summary.length > 60 ? '…' : ''}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 p-4">
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-semibold text-gray-700">Source</div>
              <div className="text-gray-600">{tag.sourceHeading}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-700">Confidence</div>
              <div className="text-gray-600">{tag.confidence.toFixed(2)}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-700">AI suggestion</div>
              <div className="text-gray-600">
                {tag.suggestedStd && tag.suggestedSpec
                  ? `Std ${tag.suggestedStd} · Spec ${tag.suggestedSpec}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-700">AI reasoning</div>
              <div className="text-gray-600">{tag.rationale}</div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="font-semibold text-gray-700">Full text</div>
            <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 font-mono text-gray-800">
              {tag.fullText}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <fieldset className="space-y-1.5" role="radiogroup" aria-label="Destination kind">
            <legend className="text-xs font-semibold text-gray-700">Place this content as:</legend>
            {(
              [
                { value: 'narrative', label: 'Narrative' },
                { value: 'evidenceText', label: 'Supporting evidence text' },
                { value: 'file', label: 'Supporting evidence file' },
                { value: 'discard', label: 'Discard' }
              ] as const
            ).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tag-kind"
                  value={opt.value}
                  checked={kind === opt.value}
                  onChange={() => setKind(opt.value)}
                  className="text-cshse-600 focus:ring-cshse-500"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>

          {kind !== 'discard' && (
            <div className="mt-3 flex gap-3 text-xs">
              <label className="flex flex-1 items-center gap-2">
                <span className="text-gray-600">Standard:</span>
                <select
                  value={std}
                  onChange={(e) => {
                    setStd(e.target.value);
                    setSpec('');
                  }}
                  className="flex-1 rounded border border-gray-300 bg-white px-2 py-1"
                >
                  <option value="">—</option>
                  {stdOptions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 items-center gap-2">
                <span className="text-gray-600">Spec:</span>
                <select
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  disabled={!std}
                  className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 disabled:bg-gray-50"
                >
                  <option value="">—</option>
                  {(stdOptions.find((s) => s.code === std)?.specs || []).map((sp) => (
                    <option key={sp} value={sp}>
                      {std}.{sp}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
          <button
            disabled={!prevTag}
            onClick={() => prevTag && onNavigate(prevTag.tagId)}
            className="flex items-center gap-1 rounded px-2 py-1 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => onResolve(tag.tagId, 'skip')}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50"
            >
              Skip
            </button>
            <button
              onClick={handleApply}
              disabled={working || (kind !== 'discard' && (!std || !spec))}
              className="rounded bg-cshse-600 px-3 py-1.5 text-white hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {working ? 'Working…' : kind === 'discard' ? 'Discard' : 'Apply ▸'}
            </button>
          </div>

          <button
            disabled={!nextTag}
            onClick={() => nextTag && onNavigate(nextTag.tagId)}
            className="flex items-center gap-1 rounded px-2 py-1 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

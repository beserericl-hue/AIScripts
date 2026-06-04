/**
 * MoveTextModal — "move part of this card into another subspec".
 *
 * The parser sometimes drops a whole Standard's prose into its first subspec.
 * This modal renders the card's content in a selectable area; the coordinator
 * highlights the text that belongs elsewhere, picks the destination Standard +
 * Substandard, and clicks Move. The selection is split off the source and added
 * as a new item in the target spec (persisted via moveSelectionToSpec).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Move, X } from 'lucide-react';
import { useStandardsCatalog } from './useStandardsCatalog';
import { splitSelection } from './splitSelection';

export interface MoveTextModalProps {
  /** The HTML to render + split (the card's htmlSnippet, or its snippet text). */
  html: string;
  /** Where this card currently lives, to exclude it from the destination list. */
  currentStd?: string;
  currentSpec?: string;
  onCancel: () => void;
  onMove: (args: {
    movedHtml: string;
    remainderHtml: string;
    targetStd: string;
    targetSpec: string;
  }) => void;
}

export function MoveTextModal({
  html,
  currentStd,
  currentSpec,
  onCancel,
  onMove,
}: MoveTextModalProps): JSX.Element {
  const { standards, error } = useStandardsCatalog();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [targetStd, setTargetStd] = useState('');
  const [targetSpec, setTargetSpec] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [warn, setWarn] = useState<string | null>(null);

  const specOptions = useMemo(
    () => standards.find((s) => s.std === targetStd)?.specsForStd ?? [],
    [standards, targetStd]
  );

  // Track the current selection so the Move button can enable/disable and show
  // a preview of what will move.
  const onSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    const container = bodyRef.current;
    if (!sel || sel.rangeCount === 0 || !container) {
      setSelectedText('');
      return;
    }
    const range = sel.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      setSelectedText('');
      return;
    }
    setSelectedText(sel.toString().trim());
  }, []);

  const handleMove = useCallback(() => {
    setWarn(null);
    const container = bodyRef.current;
    const sel = window.getSelection();
    if (!container || !sel || sel.rangeCount === 0) {
      setWarn('Select the text you want to move first.');
      return;
    }
    const result = splitSelection(container, sel.getRangeAt(0));
    if (!result) {
      setWarn('Select some text inside the box below first.');
      return;
    }
    if (!targetStd || !targetSpec) {
      setWarn('Pick a destination Standard and Substandard.');
      return;
    }
    onMove({
      movedHtml: result.movedHtml,
      remainderHtml: result.remainderHtml,
      targetStd,
      targetSpec,
    });
  }, [onMove, targetStd, targetSpec]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Move text to another subspec"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Move className="h-4 w-4 text-cshse-700" aria-hidden /> Move text to another subspec
            </h3>
            <p className="text-xs text-gray-500">
              Highlight the text that belongs elsewhere, pick where it goes, then Move.
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {/* Selectable content */}
          <div
            ref={bodyRef}
            data-testid="move-text-body"
            onMouseUp={onSelectionChange}
            onKeyUp={onSelectionChange}
            className="ai-html-snippet prose prose-sm max-w-none cursor-text select-text rounded border border-gray-200 bg-gray-50 p-3 text-gray-800"
            // Same trust model as the card itself (our own parser output).
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          <div className="mb-2 text-xs text-gray-600" data-testid="move-text-selection">
            {selectedText ? (
              <>
                Will move:{' '}
                <span className="rounded bg-amber-50 px-1 font-medium text-amber-800">
                  {selectedText.length > 90 ? `${selectedText.slice(0, 90)}…` : selectedText}
                </span>
              </>
            ) : (
              <span className="text-gray-400">No text selected yet.</span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="move-std" className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Destination Standard
              </label>
              <select
                id="move-std"
                data-testid="move-text-std"
                value={targetStd}
                onChange={(e) => {
                  setTargetStd(e.target.value);
                  setTargetSpec('');
                }}
                className="mt-0.5 rounded border border-gray-300 px-2 py-1 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
              >
                <option value="">— standard —</option>
                {standards.map((s) => (
                  <option key={s.std} value={s.std}>
                    {s.std} — {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="move-spec" className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Destination Substandard
              </label>
              <select
                id="move-spec"
                data-testid="move-text-spec"
                value={targetSpec}
                onChange={(e) => setTargetSpec(e.target.value)}
                disabled={!targetStd}
                className="mt-0.5 rounded border border-gray-300 px-2 py-1 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500 disabled:bg-gray-100"
              >
                <option value="">— substandard —</option>
                {specOptions
                  .filter((opt) => !(targetStd === currentStd && opt.spec === currentSpec))
                  .map((opt) => (
                    <option key={opt.spec} value={opt.spec}>
                      {targetStd}.{opt.spec}
                      {opt.title ? ` — ${opt.title}` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <button
              onClick={handleMove}
              data-testid="move-text-confirm"
              disabled={!selectedText || !targetStd || !targetSpec}
              className="inline-flex items-center gap-1.5 rounded-md bg-cshse-600 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Move className="h-4 w-4" aria-hidden /> Move selection
            </button>
          </div>
          {warn && <p className="mt-2 text-xs text-amber-700">{warn}</p>}
          {error && (
            <p className="mt-2 text-xs text-amber-700">
              Couldn{"'"}t load the standards list ({error}).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

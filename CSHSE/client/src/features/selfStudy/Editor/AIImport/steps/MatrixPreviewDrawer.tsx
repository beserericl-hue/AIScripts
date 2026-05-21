/**
 * Matrix verify-in-context preview drawer (CR-026 / S2B.8).
 *
 * Slides in from the right when the coordinator clicks an AI suggestion.
 * Shows the full matrix table for the affected matrix with the AI's
 * suggested column mapping applied **locally** (not persisted), and
 * the affected column header amber-highlighted + flashed for 1.5s.
 * The coordinator reads the row in context of its neighbors and then
 * Accepts / Rejects / Edits manually.
 *
 * This drawer is the verification gate that CR-025 (S2B.7) ships
 * behind. Without it the AI silently persists potentially-wrong column
 * mappings that distort every row using that column.
 */
import React, { useEffect, useRef } from 'react';
import { X, Check, AlertTriangle, Edit3 } from 'lucide-react';

export interface PreviewSuggestion {
  matrixSlug: string;
  matrixName: string;
  columnIndex: number;
  columnCount: number;
  suggestedCourse: string | null;
  confidence: number;
  rationale: string;
  // Source-DOCX header for this column if mammoth gave us one.
  sourceHeader: string | null;
  // Headers indexed by column — we use these to render the table head
  // with the AI suggestion swapped into the affected column locally.
  columnHeaders: string[];
  // Current assignments by columnIndex — assigned values for other columns
  // are shown as-is; the affected column shows the AI suggestion.
  assignments: Record<number, string>;
  // Cells keyed by `${std}.${spec}|${columnIndex}` for fast lookup
  cellsByPos: Map<string, { codeRaw?: string }>;
  // Spec keys in document order
  rowKeys: string[];
}

interface MatrixPreviewDrawerProps {
  open: boolean;
  suggestion: PreviewSuggestion | null;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEditManually: () => void;
}

export function MatrixPreviewDrawer({
  open,
  suggestion,
  onClose,
  onAccept,
  onReject,
  onEditManually
}: MatrixPreviewDrawerProps): JSX.Element | null {
  const tableRef = useRef<HTMLDivElement>(null);
  const flashHeaderRef = useRef<HTMLTableCellElement>(null);

  // Flash the affected column header for 1.5s on open
  useEffect(() => {
    if (!open || !flashHeaderRef.current) return;
    const el = flashHeaderRef.current;
    el.classList.add('matrix-preview-flash');
    const t = setTimeout(() => {
      el.classList.remove('matrix-preview-flash');
    }, 1500);
    return () => clearTimeout(t);
  }, [open, suggestion?.columnIndex, suggestion?.matrixSlug]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !suggestion) return null;

  const confidencePct = Math.round(suggestion.confidence * 100);
  const band =
    suggestion.confidence >= 0.85
      ? { cls: 'bg-green-100 text-green-800', icon: '🟢', label: 'high confidence' }
      : suggestion.confidence >= 0.5
      ? { cls: 'bg-amber-100 text-amber-800', icon: '🟡', label: 'medium confidence' }
      : suggestion.confidence > 0
      ? { cls: 'bg-red-100 text-red-800', icon: '🔴', label: 'low confidence' }
      : { cls: 'bg-gray-100 text-gray-600', icon: '·', label: 'no signal' };

  return (
    <>
      {/* Overlay — click closes (preserves the side-panel-not-modal decision) */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="matrix-preview-title"
        className="fixed right-0 top-0 z-50 flex h-full w-[640px] max-w-[calc(100vw-2rem)] flex-col border-l border-gray-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
          <div className="min-w-0">
            <h2 id="matrix-preview-title" className="truncate text-base font-semibold text-gray-900">
              Verify: {suggestion.matrixName}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Column {suggestion.columnIndex + 1} of {suggestion.columnCount} ·
              {' '}AI suggests <strong>{suggestion.suggestedCourse || '(no signal)'}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* Why-this rationale */}
        <div className="border-b border-gray-200 bg-purple-50 px-5 py-3 text-sm">
          <details open>
            <summary className="cursor-pointer text-xs font-medium text-purple-800">
              Why this? Show AI rationale
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-gray-700">
              {suggestion.rationale || '(no rationale provided)'}
            </p>
            <p className="mt-2">
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${band.cls}`}>
                <span aria-hidden>{band.icon}</span>
                {confidencePct}% — {band.label}
              </span>
              {suggestion.sourceHeader && (
                <span className="ml-2 truncate font-mono text-[10px] text-gray-500">
                  source header: "{suggestion.sourceHeader}"
                </span>
              )}
            </p>
          </details>
        </div>

        {/* Table preview with the suggestion applied locally to this column */}
        <div ref={tableRef} className="flex-1 overflow-auto p-3">
          <style>{`
            .matrix-preview-flash {
              outline: 3px solid #f59e0b !important;
              outline-offset: 1px;
              background-color: #fef3c7 !important;
              transition: outline-color 0.4s ease, background-color 0.4s ease;
            }
          `}</style>
          {suggestion.suggestedCourse === null && (
            <div className="mb-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                The AI couldn't infer a course for this column. Use "Edit manually" to type
                the course code from your catalog.
              </span>
            </div>
          )}
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="border-b border-gray-200 px-2 py-1.5 text-left align-bottom">
                  <div className="text-[10px] font-normal text-gray-400">Spec</div>
                </th>
                {Array.from({ length: suggestion.columnCount }, (_, idx) => {
                  const isAffected = idx === suggestion.columnIndex;
                  const value = isAffected
                    ? suggestion.suggestedCourse || suggestion.sourceHeader || `Col ${idx + 1}`
                    : suggestion.assignments[idx] || suggestion.columnHeaders[idx] || `Col ${idx + 1}`;
                  return (
                    <th
                      key={idx}
                      ref={isAffected ? flashHeaderRef : undefined}
                      className={`border-b border-gray-200 px-2 py-1.5 text-left align-bottom ${
                        isAffected ? 'font-semibold text-amber-900' : ''
                      }`}
                    >
                      <div className="text-[10px] font-normal text-gray-400">Col {idx + 1}</div>
                      <div>{value}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {suggestion.rowKeys.map((rk) => (
                <tr key={rk} className="border-t border-gray-100 even:bg-gray-50/50">
                  <td className="whitespace-nowrap px-2 py-1 font-mono font-medium text-gray-800">
                    {rk}
                  </td>
                  {Array.from({ length: suggestion.columnCount }, (_, idx) => {
                    // wire format uses 1-based columnIndex
                    const cell =
                      suggestion.cellsByPos.get(`${rk}|${idx + 1}`) ||
                      suggestion.cellsByPos.get(`${rk}|${idx}`);
                    const isAffected = idx === suggestion.columnIndex;
                    return (
                      <td
                        key={idx}
                        className={`px-2 py-1 font-mono text-gray-700 ${
                          isAffected ? 'bg-amber-50' : ''
                        }`}
                      >
                        {cell?.codeRaw || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {suggestion.rowKeys.length === 0 && (
                <tr>
                  <td colSpan={suggestion.columnCount + 1} className="px-2 py-4 text-center text-xs text-gray-500">
                    No spec rows extracted for this matrix.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            onClick={onEditManually}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden />
            Edit manually
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Reject
            </button>
            <button
              onClick={onAccept}
              disabled={!suggestion.suggestedCourse}
              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Accept
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

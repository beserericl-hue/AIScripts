/**
 * Matrix step — CR-029 rewrite.
 *
 * One row at a time, verify-or-remove. No column dropdowns, no AI
 * confidence pills, no per-row edit menus. The previous version was
 * called "one of the most confusing screens" by a 40-year-experience
 * software engineer; everything was deleted and replaced with the
 * simplest possible form.
 *
 * Per row the coordinator sees:
 *   - The spec code + spec title from the row in the source document
 *   - The course codes for that row (resolved to course names where the
 *     AI inference figured it out; otherwise "Column N")
 *   - The exact source-document table row, scrolled to + highlighted
 *   - Two buttons: "Keep this row" / "Remove this row"
 *
 * That's it. Plus Prev/Next and a single bulk "Keep all" button.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Check, X, ChevronLeft, ChevronRight, SkipForward, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';
import { api } from '../../../../../services/api';

interface MatrixCell {
  std?: string;
  spec?: string | null;
  standardCode?: string;
  specCode?: string | null;
  specPrompt?: string;
  rowAnchor?: string;
  columnIndex?: number;
  columnHeader?: string;
  codeRaw?: string;
  contentTypes?: string[];
  depth?: string | null;
}

interface MatrixBlock {
  matrixId: string;
  name?: string;
  title?: string;
  columnCount?: number;
  columnHeaders?: string[];
  cells?: MatrixCell[];
  htmlSnippet?: string;
}

interface MatrixRow {
  matrixId: string;
  matrixName: string;
  std: string;
  spec: string;
  specPrompt: string;
  rowAnchor: string;
  cells: MatrixCell[];
  // The <tr>...</tr> HTML fragment from the source-document table for
  // this row, extracted from the matrix's htmlSnippet.
  sourceRowHtml: string | null;
  columnHeaders: string[];
}

// ----------------------------------------------------------- helpers

function getStd(c: MatrixCell): string {
  return c.std ?? c.standardCode ?? '?';
}
function getSpec(c: MatrixCell): string {
  return c.spec ?? c.specCode ?? '?';
}

/**
 * Pull the source-document <tr>...</tr> for a given row anchor out of the
 * matrix's htmlSnippet. Returns null if we can't find a matching <tr>.
 *
 * Implemented with a regex rather than DOMParser to keep the work simple
 * and avoid mounting an extra DOM document per render. The htmlSnippet
 * comes from the Python extractor with `id="matrix-..."` already injected
 * on each data <tr>, so we just grep for that id.
 */
function extractSourceRow(htmlSnippet: string | undefined, rowAnchor: string): string | null {
  if (!htmlSnippet || !rowAnchor) return null;
  // Match <tr ... id="rowAnchor" ...>...</tr> across multiple lines.
  // Anchor IDs are simple ASCII so we can safely embed them in a regex.
  const esc = rowAnchor.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`<tr[^>]*\\bid=["']${esc}["'][^>]*>([\\s\\S]*?)<\\/tr>`, 'i');
  const m = htmlSnippet.match(re);
  return m ? m[0] : null;
}

/**
 * Best-effort table-header extraction so we can render the cell columns
 * with their original headings above the source-row fragment.
 */
function extractTableHeader(htmlSnippet: string | undefined): string | null {
  if (!htmlSnippet) return null;
  // Grab the first <thead> if present; otherwise the first <tr>.
  const theadMatch = htmlSnippet.match(/<thead[^>]*>[\s\S]*?<\/thead>/i);
  if (theadMatch) return theadMatch[0];
  const firstTr = htmlSnippet.match(/<tr[^>]*>[\s\S]*?<\/tr>/i);
  return firstTr ? `<thead>${firstTr[0]}</thead>` : null;
}

// ----------------------------------------------------------- component

export function MatrixStep(): JSX.Element {
  const matrices = useAIImportStore((s) => s.matrices) as MatrixBlock[];
  const setStep = useAIImportStore((s) => s.setStep);

  // Flatten every matrix into a single ordered list of rows. Each row is
  // identified by (matrixId, rowAnchor); cells inside the row come from
  // the matrix's cells array.
  const allRows: MatrixRow[] = useMemo(() => {
    const out: MatrixRow[] = [];
    for (const m of matrices) {
      // Group cells by row (same std.spec inside the matrix = same row).
      const byRow = new Map<string, MatrixCell[]>();
      for (const c of m.cells || []) {
        const key = `${getStd(c)}.${getSpec(c)}`;
        if (!byRow.has(key)) byRow.set(key, []);
        byRow.get(key)!.push(c);
      }
      for (const [key, cellsOnRow] of byRow.entries()) {
        const first = cellsOnRow[0];
        const rowAnchor =
          first.rowAnchor ||
          `matrix-${m.matrixId}-row-${getStd(first)}-${getSpec(first)}`;
        out.push({
          matrixId: m.matrixId,
          matrixName: m.name || m.title || m.matrixId,
          std: getStd(first),
          spec: getSpec(first),
          specPrompt: first.specPrompt || '',
          rowAnchor,
          cells: cellsOnRow,
          sourceRowHtml: extractSourceRow(m.htmlSnippet, rowAnchor),
          columnHeaders: m.columnHeaders || [],
        });
      }
    }
    return out;
  }, [matrices]);

  // Verdicts per row. "keep" persists into apply(); "remove" drops the
  // row from the matrices payload. "pending" = not yet decided.
  type Verdict = 'pending' | 'keep' | 'remove';
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(() => {
    const init: Record<string, Verdict> = {};
    for (const r of allRows) init[`${r.matrixId}|${r.rowAnchor}`] = 'pending';
    return init;
  });

  // Re-seed verdicts when matrices change (re-import). Keep prior decisions
  // for rows the coordinator already touched.
  useEffect(() => {
    setVerdicts((prev) => {
      const next: Record<string, Verdict> = { ...prev };
      for (const r of allRows) {
        const k = `${r.matrixId}|${r.rowAnchor}`;
        if (next[k] === undefined) next[k] = 'pending';
      }
      return next;
    });
  }, [allRows]);

  const [cursor, setCursor] = useState(0);
  const currentRow = allRows[cursor] || null;

  const decidedCount = useMemo(
    () =>
      Object.values(verdicts).filter((v) => v === 'keep' || v === 'remove').length,
    [verdicts]
  );
  const keptCount = useMemo(
    () => Object.values(verdicts).filter((v) => v === 'keep').length,
    [verdicts]
  );

  const setVerdict = useCallback(
    (key: string, v: Verdict) => {
      setVerdicts((prev) => ({ ...prev, [key]: v }));
    },
    []
  );

  const keepAll = useCallback(() => {
    setVerdicts((prev) => {
      const next = { ...prev };
      for (const r of allRows) next[`${r.matrixId}|${r.rowAnchor}`] = 'keep';
      return next;
    });
  }, [allRows]);

  const skipMatrix = useCallback(() => {
    setVerdicts((prev) => {
      const next = { ...prev };
      for (const r of allRows) next[`${r.matrixId}|${r.rowAnchor}`] = 'remove';
      return next;
    });
  }, [allRows]);

  // Auto-advance cursor to the first pending row when a verdict is set,
  // so the coordinator's flow is keep → next → keep → next without
  // needing to click Next.
  const decideAndAdvance = useCallback(
    (v: Verdict) => {
      if (!currentRow) return;
      const key = `${currentRow.matrixId}|${currentRow.rowAnchor}`;
      setVerdict(key, v);
      // Find next pending row.
      let i = cursor + 1;
      while (i < allRows.length) {
        const nk = `${allRows[i].matrixId}|${allRows[i].rowAnchor}`;
        if (verdicts[nk] === 'pending' || verdicts[nk] === undefined) {
          setCursor(i);
          return;
        }
        i++;
      }
      // No pending rows left - leave cursor at current (or end).
      setCursor(Math.min(cursor + 1, allRows.length - 1));
    },
    [currentRow, cursor, allRows, verdicts, setVerdict]
  );

  // Write the verdicts into the store before moving to Apply. The store's
  // apply() reads matrixRowEdits which uses the same kind: 'remove' shape
  // as before; we set it on every removed row.
  const removeMatrixRow = useAIImportStore((s) => s.removeMatrixRow);
  const restoreMatrixRow = useAIImportStore((s) => s.restoreMatrixRow);
  const retagMatrixRow = useAIImportStore((s) => s.retagMatrixRow);
  const importId = useAIImportStore((s) => s.importId);

  // CR-030 — subspec inference state per row. Keyed by `${matrixId}|${rowAnchor}`
  // so re-mounting the step doesn't lose suggestions the coordinator has
  // already requested.
  type SubspecSuggestion = {
    suggestedSpec: string | null;
    confidence: number;
    rationale: string;
    candidateSpecs?: Array<{ code: string; text: string }>;
  };
  const [subspecSuggestions, setSubspecSuggestions] = useState<
    Record<string, SubspecSuggestion>
  >({});
  const [subspecInferring, setSubspecInferring] = useState<Record<string, boolean>>({});
  const [subspecError, setSubspecError] = useState<string | null>(null);

  const requestSubspecInference = useCallback(
    async (row: MatrixRow) => {
      if (!importId) return;
      const key = `${row.matrixId}|${row.rowAnchor}`;
      setSubspecInferring((s) => ({ ...s, [key]: true }));
      setSubspecError(null);
      try {
        const { data } = await api.post<SubspecSuggestion>(
          `/api/imports/${importId}/matrix/infer-row-spec`,
          {
            rowPrompt: row.specPrompt,
            standardCode: row.std
          }
        );
        setSubspecSuggestions((s) => ({ ...s, [key]: data }));
      } catch (err: any) {
        setSubspecError(err?.response?.data?.error || err?.message || 'AI suggestion failed');
      } finally {
        setSubspecInferring((s) => ({ ...s, [key]: false }));
      }
    },
    [importId]
  );

  const acceptSubspecSuggestion = useCallback(
    (row: MatrixRow, spec: string) => {
      retagMatrixRow(row.matrixId, row.rowAnchor, row.std, spec);
      // Refresh the row's spec locally so the UI re-renders without the '?'.
      // (allRows is derived from store.matrices; the retag store-action sets
      //  matrixRowEdits, and at apply() time the cells get re-tagged. For
      //  immediate visual feedback we also mutate the local snapshot here.)
      row.spec = spec;
    },
    [retagMatrixRow]
  );

  const handleNextStep = useCallback(() => {
    for (const r of allRows) {
      const k = `${r.matrixId}|${r.rowAnchor}`;
      const v = verdicts[k] ?? 'pending';
      if (v === 'remove') {
        removeMatrixRow(r.matrixId, r.rowAnchor);
      } else {
        // Restore clears any prior remove (idempotent for fresh runs).
        restoreMatrixRow(r.matrixId, r.rowAnchor);
      }
    }
    setStep('apply');
  }, [allRows, verdicts, removeMatrixRow, restoreMatrixRow, setStep]);

  // -------------------------------------------------------- render

  const tableHeaderHtml = useMemo(
    () => (currentRow ? extractTableHeader(matrices.find((m) => m.matrixId === currentRow.matrixId)?.htmlSnippet) : null),
    [currentRow, matrices]
  );

  const flashRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flashRef.current) return;
    flashRef.current.classList.add('matrix-row-flash');
    const t = setTimeout(() => flashRef.current?.classList.remove('matrix-row-flash'), 1200);
    return () => clearTimeout(t);
  }, [cursor]);

  if (allRows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Curriculum matrix</h2>
            <div className="text-xs text-gray-500">No matrix rows were found in your document.</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep('review')}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              ◂ Back
            </button>
            <button
              onClick={() => setStep('apply')}
              className="rounded bg-cshse-600 px-3 py-1.5 text-sm text-white hover:bg-cshse-700"
            >
              Next: Apply ▸
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          If your program uses a curriculum matrix, you can fill it in later from the Curriculum Matrix tab.
        </div>
      </div>
    );
  }

  const verdictForCurrent = currentRow
    ? verdicts[`${currentRow.matrixId}|${currentRow.rowAnchor}`] ?? 'pending'
    : 'pending';

  return (
    <div className="flex h-full flex-col">
      <style>{`
        .matrix-row-flash {
          animation: matrix-row-flash-anim 1.2s ease;
        }
        @keyframes matrix-row-flash-anim {
          0% { background-color: #fef3c7; }
          100% { background-color: transparent; }
        }
        .matrix-source-table table {
          border-collapse: collapse;
          width: 100%;
          font-size: 12px;
        }
        .matrix-source-table td,
        .matrix-source-table th {
          border: 1px solid #d1d5db;
          padding: 4px 6px;
          vertical-align: top;
        }
        .matrix-source-table th {
          background: #f9fafb;
          font-weight: 600;
          text-align: left;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Check the matrix rows we found
          </h2>
          <div className="text-xs text-gray-500">
            {allRows.length} row{allRows.length === 1 ? '' : 's'} from {matrices.length} matrix{matrices.length === 1 ? '' : 'es'} ·
            {' '}{decidedCount} of {allRows.length} reviewed ·
            {' '}{keptCount} keep
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('review')}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ◂ Back
          </button>
          <button
            onClick={handleNextStep}
            className="rounded bg-cshse-600 px-3 py-1.5 text-sm text-white hover:bg-cshse-700"
          >
            Next: Apply ▸
          </button>
        </div>
      </div>

      {/* Plain-language explanation */}
      <div className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm text-blue-900">
        <p>
          We found these rows in your curriculum matrix. For each row, we show you the row from your original document.
          {' '}Click <strong>Keep</strong> if it looks right, or <strong>Remove</strong> if it doesn't belong.
        </p>
        <p className="mt-1 text-xs text-blue-800">
          In a hurry? Click <strong>Keep all</strong> below to accept every row at once and move on.
        </p>
      </div>

      {/* Bulk shortcuts */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={keepAll}
            className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800 hover:bg-emerald-100"
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Keep all rows
          </button>
          <button
            onClick={skipMatrix}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            <SkipForward className="h-3 w-3" aria-hidden /> Skip the whole matrix
          </button>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <button
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
            disabled={cursor === 0}
            className="rounded p-1 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous row"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="font-mono">
            Row {cursor + 1} of {allRows.length}
          </span>
          <button
            onClick={() => setCursor((c) => Math.min(allRows.length - 1, c + 1))}
            disabled={cursor === allRows.length - 1}
            className="rounded p-1 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next row"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* The one-row card */}
      <div ref={flashRef} className="flex-1 overflow-auto px-6 py-4">
        {currentRow && (
          <>
            <div className="mb-3">
              <div className="text-xs text-gray-500">
                {currentRow.matrixName}
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                <span className="font-mono">Spec {currentRow.std}.{currentRow.spec}</span>
                {currentRow.specPrompt && (
                  <span className="ml-2 text-gray-700">— {currentRow.specPrompt}</span>
                )}
              </h3>
              {/* CR-030 — when the subspec is unknown ('?'), offer to let
                  the AI suggest one. The suggestion reads the Handbook
                  spec definitions for the known standard + the row prompt
                  via Claude Haiku. The coordinator confirms or rejects. */}
              {currentRow.spec === '?' && (() => {
                const key = `${currentRow.matrixId}|${currentRow.rowAnchor}`;
                const sug = subspecSuggestions[key];
                const inferring = !!subspecInferring[key];
                return (
                  <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-700" aria-hidden />
                      <span className="font-medium text-purple-900">
                        Standard {currentRow.std} is known; subspec is not.
                      </span>
                      {!sug && (
                        <button
                          type="button"
                          onClick={() => requestSubspecInference(currentRow)}
                          disabled={inferring}
                          className="ml-auto inline-flex items-center gap-1 rounded border border-purple-400 bg-white px-2 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-50"
                        >
                          {inferring ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : (
                            <Sparkles className="h-3 w-3" aria-hidden />
                          )}
                          {inferring ? 'Asking AI…' : 'Suggest subspec'}
                        </button>
                      )}
                    </div>
                    {subspecError && !sug && (
                      <div className="mt-2 text-xs text-red-700">{subspecError}</div>
                    )}
                    {sug && (
                      <div className="mt-2 space-y-2">
                        {sug.suggestedSpec ? (
                          <>
                            <div className="text-sm text-purple-900">
                              AI suggests: <strong className="font-mono">{currentRow.std}.{sug.suggestedSpec}</strong>
                              <span className="ml-2 rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-900">
                                {Math.round(sug.confidence * 100)}% confident
                              </span>
                            </div>
                            {sug.rationale && (
                              <div className="text-xs leading-relaxed text-gray-700">{sug.rationale}</div>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => acceptSubspecSuggestion(currentRow, sug.suggestedSpec!)}
                                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                <Check className="h-3 w-3" aria-hidden />
                                Use {currentRow.std}.{sug.suggestedSpec}
                              </button>
                              <button
                                type="button"
                                onClick={() => requestSubspecInference(currentRow)}
                                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                Re-ask
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-700">
                            AI couldn't confidently pick a subspec.
                            {sug.rationale && ` ${sug.rationale}`}
                          </div>
                        )}
                        {sug.candidateSpecs && sug.candidateSpecs.length > 0 && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-purple-700">
                              Show all {sug.candidateSpecs.length} candidate subspecs for Standard {currentRow.std}
                            </summary>
                            <ul className="mt-1 ml-4 list-disc space-y-1 text-gray-700">
                              {sug.candidateSpecs.map((c) => (
                                <li key={c.code}>
                                  <button
                                    type="button"
                                    onClick={() => acceptSubspecSuggestion(currentRow, c.code)}
                                    className="font-mono text-purple-700 underline hover:text-purple-900"
                                  >
                                    {currentRow.std}.{c.code}
                                  </button>
                                  : {c.text}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Course-coverage codes we read for this row
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                {currentRow.cells.map((c, i) => {
                  const colHeader =
                    c.columnHeader ||
                    currentRow.columnHeaders[(c.columnIndex ?? 1) - 1] ||
                    `Column ${c.columnIndex ?? i + 1}`;
                  return (
                    <div key={`${c.columnIndex}-${i}`} className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">{colHeader}:</span>
                      <span className="font-mono font-medium text-gray-900">{c.codeRaw}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[11px] text-gray-500">
                Codes: <span className="font-mono">I</span> Introduction · <span className="font-mono">T</span> Theory ·
                {' '}<span className="font-mono">K</span> Knowledge · <span className="font-mono">S</span> Skills ·
                {' '}<span className="font-mono">L/M/H</span> low/medium/high depth.
              </div>
            </div>

            {/* Source-document row in context */}
            <div className="mb-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Here's the row in your original document
              </div>
              {currentRow.sourceRowHtml ? (
                <div className="overflow-x-auto rounded border-2 border-amber-300 bg-amber-50/30 p-2">
                  <div className="matrix-source-table">
                    <table>
                      {tableHeaderHtml && (
                        <thead dangerouslySetInnerHTML={{ __html: tableHeaderHtml.replace(/<\/?thead[^>]*>/g, '') }} />
                      )}
                      <tbody
                        dangerouslySetInnerHTML={{ __html: currentRow.sourceRowHtml }}
                      />
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  We couldn't find this row in the original document. This usually means the AI guessed wrong;
                  recommend clicking <strong>Remove this row</strong> below.
                </div>
              )}
            </div>

            {/* CR-035 — passive coordinator confirmation: Keep writes this
                row's cells into the Curriculum Matrix at the row's
                resolved (std.spec). Only shown when we have a real spec
                (not '?'), so the unresolved-subspec case still drives the
                coordinator through the AI suggestion flow above. */}
            {currentRow && currentRow.spec !== '?' && verdictForCurrent === 'pending' && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
                <Check className="mr-1 inline h-3 w-3" aria-hidden /> Keeping this row will populate
                <strong className="ml-1 font-mono">Curriculum Matrix → Spec {currentRow.std}.{currentRow.spec}</strong>
                {' '}with the cells above. View it on the <strong>Curriculum Matrix</strong> tab after Apply.
              </div>
            )}

            {/* Verdict buttons */}
            <div className="flex items-center justify-center gap-3 py-2">
              {verdictForCurrent === 'pending' ? (
                <>
                  <button
                    onClick={() => decideAndAdvance('keep')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <Check className="h-4 w-4" aria-hidden /> Keep this row
                  </button>
                  <button
                    onClick={() => decideAndAdvance('remove')}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" aria-hidden /> Remove this row
                  </button>
                </>
              ) : verdictForCurrent === 'keep' ? (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                    <Check className="h-3.5 w-3.5" aria-hidden /> Kept
                  </span>
                  <button
                    onClick={() => decideAndAdvance('remove')}
                    className="text-xs text-gray-500 underline hover:text-gray-700"
                  >
                    Change to remove
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                    <X className="h-3.5 w-3.5" aria-hidden /> Removed
                  </span>
                  <button
                    onClick={() => decideAndAdvance('keep')}
                    className="text-xs text-gray-500 underline hover:text-gray-700"
                  >
                    Change to keep
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

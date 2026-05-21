/**
 * Step 4 — Matrix (sub-sprint 1.d).
 *
 * Purpose: the AI matrix extractor knows the cell codes per
 * ``(spec, columnIndex)`` but doesn't always know which COURSE each
 * column represents — mammoth's DOCX→HTML conversion strips header
 * formatting in many institutional self-studies, so ``columnHeaders``
 * arrives empty. This step asks the coordinator to map every "Col N"
 * to a row in the institution's ProgramCourses catalog (or to skip
 * the matrix entirely). When confirmed, the cells are persisted to
 * ``Submission.curriculumMatrices[]`` with real ``courseId`` references
 * and the Curriculum Matrix tab renders them with course names.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Info, Grid3X3, Check, SkipForward, Sparkles, Loader2 } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';
import { api } from '../../../../../services/api';
import { CourseCatalogCombo, type ProgramCourse } from '../matrix/CourseCatalogCombo';

interface ColumnSuggestion {
  columnIndex: number;
  suggestedCourse: string | null;
  confidence: number;
  rationale: string;
}

interface InferenceResponse {
  matrixSlug: string;
  suggestions: ColumnSuggestion[];
}

function confidenceBand(c: number): { dot: string; label: string; cls: string } {
  if (c >= 0.85) return { dot: '🟢', label: 'high', cls: 'bg-green-100 text-green-800' };
  if (c >= 0.5) return { dot: '🟡', label: 'medium', cls: 'bg-amber-100 text-amber-800' };
  if (c > 0) return { dot: '🔴', label: 'low', cls: 'bg-red-100 text-red-800' };
  return { dot: '·', label: 'no signal', cls: 'bg-gray-100 text-gray-600' };
}

interface MatrixBlock {
  matrixId: string;
  // New wire format (matrix/wire_format.py): `name`, `columnHeaders[]`,
  // `columnCount`, cells with `std`/`spec`/`columnIndex`/`codeRaw`. We also
  // accept legacy aliases (`title`, `standardCode`/`specCode`, `col`) so
  // older snapshots stored in Mongo continue to render.
  name?: string;
  title?: string;
  columnCount?: number;
  columnHeaders?: string[];
  cells?: any[];
  htmlSnippet?: string;
  rowsMatched?: number;
}

export function MatrixStep(): JSX.Element {
  const matrices = useAIImportStore((s) => s.matrices) as MatrixBlock[];
  const submissionId = useAIImportStore((s) => s.submissionId);
  const importId = useAIImportStore((s) => s.importId);
  const setStep = useAIImportStore((s) => s.setStep);

  const [columnAssignments, setColumnAssignments] = useState<Record<string, Record<number, string>>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  // CR-025 — AI suggestions per matrix: { [matrixSlug]: { [colIdx]: ColumnSuggestion } }
  const [suggestionsByMatrix, setSuggestionsByMatrix] = useState<
    Record<string, Record<number, ColumnSuggestion>>
  >({});
  const [inferring, setInferring] = useState<Record<string, boolean>>({});
  const [inferenceError, setInferenceError] = useState<string | null>(null);

  const runInferenceForMatrix = useCallback(
    async (matrixSlug: string) => {
      if (!importId) return;
      setInferring((s) => ({ ...s, [matrixSlug]: true }));
      setInferenceError(null);
      try {
        const { data } = await api.post<InferenceResponse>(
          `/api/imports/${importId}/matrix/infer-columns`,
          { matrixSlug }
        );
        const byIdx: Record<number, ColumnSuggestion> = {};
        for (const s of data.suggestions || []) byIdx[s.columnIndex] = s;
        setSuggestionsByMatrix((prev) => ({ ...prev, [matrixSlug]: byIdx }));
      } catch (err: any) {
        setInferenceError(err?.response?.data?.error || err?.message || 'AI inference failed');
      } finally {
        setInferring((s) => ({ ...s, [matrixSlug]: false }));
      }
    },
    [importId]
  );

  // Auto-run inference for every matrix on first mount so the dropdowns
  // arrive pre-filled. The coordinator can re-run per matrix via the
  // toolbar button.
  useEffect(() => {
    if (!importId) return;
    for (const m of matrices) {
      const slug = m.matrixId;
      // skip already-inferred matrices (in case of a remount)
      if (suggestionsByMatrix[slug] || inferring[slug]) continue;
      void runInferenceForMatrix(slug);
    }
    // We intentionally only depend on importId + matrices length — running
    // inference once per matrix per session is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId, matrices.length]);

  // Forward a coordinator confirmation back to the server so it persists in
  // the per-institution Qdrant collection. Fire-and-forget — UI continues
  // regardless of the server response.
  const recordConfirmation = useCallback(
    (matrixSlug: string, columnIndex: number, course: string, priorConfidence: number) => {
      if (!importId || !course) return;
      api
        .post(`/api/imports/${importId}/matrix/confirm-column`, {
          matrixSlug,
          columnIndex,
          course,
          priorConfidence
        })
        .catch((err) => {
          // Don't surface — the local assignment already worked.
          console.warn('[matrix-confirm] persist failed', err?.message || err);
        });
    },
    [importId]
  );

  const acceptAllGreenForMatrix = useCallback(
    (matrixSlug: string) => {
      const suggestions = suggestionsByMatrix[matrixSlug] || {};
      const next: Record<number, string> = { ...(columnAssignments[matrixSlug] || {}) };
      for (const [idxStr, s] of Object.entries(suggestions)) {
        const idx = Number(idxStr);
        if (s.suggestedCourse && s.confidence >= 0.85) {
          next[idx] = s.suggestedCourse;
          recordConfirmation(matrixSlug, idx, s.suggestedCourse, s.confidence);
        }
      }
      setColumnAssignments((prev) => ({ ...prev, [matrixSlug]: next }));
    },
    [suggestionsByMatrix, columnAssignments, recordConfirmation]
  );

  // Derive column counts even if the matrix payload doesn't include
  // explicit column metadata (use max column index across cells).
  const columnsFor = (m: MatrixBlock): number => {
    if (typeof m.columnCount === 'number' && m.columnCount > 0) return m.columnCount;
    if (Array.isArray(m.columnHeaders) && m.columnHeaders.length > 0) return m.columnHeaders.length;
    const cells = m.cells || [];
    if (cells.length === 0) return 0;
    return cells.reduce(
      (max: number, c: any) => Math.max(max, ((c?.columnIndex ?? c?.col ?? 0)) + 1),
      0
    );
  };

  // Pull the std/spec marker off a cell, preferring the new wire format and
  // falling back to the legacy field names.
  const rowKeyFor = (c: any): string => {
    const std = c?.std ?? c?.standardCode ?? '?';
    const spec = c?.spec ?? c?.specCode ?? '?';
    return `${std}.${spec}`;
  };

  // Counts for the Apply CTA — coordinator can always move forward; we just
  // surface how many columns they've named vs. how many are still placeholders.
  const totalsByMatrix = useMemo(() => {
    return matrices.map((m) => {
      const colCount = columnsFor(m);
      const assignments = columnAssignments[m.matrixId] || {};
      const namedCount = Array.from({ length: colCount }, (_, i) => i).filter(
        (idx) => !!assignments[idx]
      ).length;
      return {
        matrixId: m.matrixId,
        colCount,
        namedCount,
        skipped: !!skipped[m.matrixId],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrices, columnAssignments, skipped]);

  const totalNamed = totalsByMatrix.reduce((s, t) => s + t.namedCount, 0);
  const totalColumns = totalsByMatrix
    .filter((t) => !t.skipped)
    .reduce((s, t) => s + t.colCount, 0);

  const handleAssign = (matrixId: string, columnIdx: number, course: ProgramCourse | null) => {
    setColumnAssignments((prev) => ({
      ...prev,
      [matrixId]: {
        ...prev[matrixId],
        [columnIdx]: course?.courseCode || ''
      }
    }));
    // CR-025 — persist confirmation back to the per-institution Qdrant
    // collection so the next import for this institution gets it right.
    // Treat AI accept (course matches an AI suggestion) and manual override
    // identically; the only differentiator is priorConfidence.
    if (course?.courseCode) {
      const suggestion = suggestionsByMatrix[matrixId]?.[columnIdx];
      const isAccept =
        suggestion?.suggestedCourse?.toLowerCase().trim() ===
        course.courseCode.toLowerCase().trim();
      recordConfirmation(
        matrixId,
        columnIdx,
        course.courseCode,
        isAccept ? suggestion!.confidence : 1.0 // manual override = explicit high-confidence
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Curriculum matrix — map columns to your courses</h2>
          {matrices.length > 0 && (
            <div className="text-xs text-gray-500">
              {matrices.length} matrix{matrices.length === 1 ? '' : 'es'} detected · {totalNamed} of {totalColumns} columns named
            </div>
          )}
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

      {matrices.length > 0 && (
        <div className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">What you're seeing</p>
              <p className="mt-1 text-xs leading-relaxed">
                The AI extracted every filled cell of the curriculum matrices from your document but
                couldn't always read the <em>course name</em> in each column header (mammoth strips merged-cell
                formatting). The table below shows the raw extraction — each row is one spec, each column is
                position 1, 2, 3 …, cells hold the coverage code (I/T/K/S = content, L/M/H = depth).
                <br />
                <strong>Your job here:</strong> pick which course your catalog calls "Col 1", "Col 2" … in the
                dropdowns above each column. Skip the whole matrix if you'd rather fix it later in the
                Curriculum Matrix tab.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {matrices.length === 0 && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No curriculum matrices were detected in this document. If your program uses one,
            upload it via the Curriculum Matrix tab instead.
          </div>
        )}

        {matrices.map((m) => {
          const colCount = columnsFor(m);
          const isSkipped = !!skipped[m.matrixId];
          const cellsByPos = new Map<string, any>();
          for (const c of m.cells || []) {
            const r = rowKeyFor(c);
            const col = c?.columnIndex ?? c?.col ?? 0;
            cellsByPos.set(`${r}|${col}`, c);
          }
          // Preserve document order (sort by first appearance) so the
          // matrix rows render in the same order as in the source DOCX.
          const rowOrder: string[] = [];
          const seen = new Set<string>();
          for (const c of m.cells || []) {
            const k = rowKeyFor(c);
            if (!seen.has(k)) {
              seen.add(k);
              rowOrder.push(k);
            }
          }
          const rowKeys = rowOrder;
          const headers = Array.isArray(m.columnHeaders) ? m.columnHeaders : [];

          return (
            <section key={m.matrixId} className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    <Grid3X3 className="h-4 w-4 text-cshse-700" aria-hidden />
                    {m.name || m.title || `Matrix block ${m.matrixId}`}
                  </h3>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {colCount} columns · {(m.cells || []).length} filled cells · {rowKeys.length} specs
                    {typeof m.rowsMatched === 'number' && ` · ${m.rowsMatched} rows matched the template`}
                  </div>
                  {headers.length === 0 && !isSkipped && (
                    <p className="mt-2 max-w-2xl rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      The source DOCX's column headers couldn't be read (Stevenson's matrix has merged
                      header cells that mammoth can't decode as text). The form below shows "Col 1, Col 2 …"
                      — open your source DOCX in Word side-by-side to see which course belongs in each
                      position, or click <strong>Skip</strong> and fill the matrix manually from the
                      Curriculum Matrix tab.
                    </p>
                  )}
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={isSkipped}
                    onChange={(e) => setSkipped((s) => ({ ...s, [m.matrixId]: e.target.checked }))}
                    className="rounded text-cshse-600 focus:ring-cshse-500"
                  />
                  <SkipForward className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                  Skip this matrix
                </label>
              </div>

              {!isSkipped && colCount > 0 && submissionId && (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-600">
                      Map each matrix column to a course in your program catalog.
                      {headers.length > 0 && (
                        <> Source-DOCX headers shown below each input as a hint.</>
                      )}
                      {' '}AI suggestions pre-fill with a confidence indicator;
                      <strong> click <em>Accept all green</em></strong> to take every ≥0.85
                      suggestion in one click, then review yellow/red individually.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runInferenceForMatrix(m.matrixId)}
                        disabled={!!inferring[m.matrixId]}
                        title="Re-ask the AI to suggest courses for these columns"
                        className="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                      >
                        {inferring[m.matrixId] ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="h-3 w-3" aria-hidden />
                        )}
                        {inferring[m.matrixId] ? 'Inferring…' : 'Run AI column inference'}
                      </button>
                      <button
                        onClick={() => acceptAllGreenForMatrix(m.matrixId)}
                        disabled={
                          !suggestionsByMatrix[m.matrixId] ||
                          !Object.values(suggestionsByMatrix[m.matrixId] || {}).some(
                            (s) => s.suggestedCourse && s.confidence >= 0.85
                          )
                        }
                        title="Accept every column suggestion with confidence ≥ 0.85"
                        className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" aria-hidden />
                        Accept all green
                      </button>
                    </div>
                  </div>
                  {inferenceError && (
                    <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      AI inference: {inferenceError} — falls back to manual entry.
                    </div>
                  )}
                  <div
                    className="mb-2 grid gap-2"
                    style={{ gridTemplateColumns: `100px repeat(${colCount}, minmax(160px, 1fr))` }}
                  >
                    <div className="text-xs uppercase tracking-wide text-gray-500">Course</div>
                    {Array.from({ length: colCount }, (_, idx) => {
                      const sourceHeader = headers[idx] || '';
                      const suggestion = suggestionsByMatrix[m.matrixId]?.[idx];
                      const assigned = (columnAssignments[m.matrixId] || {})[idx];
                      // CR-025 — pre-fill the dropdown's `value` with the AI
                      // suggestion when the coordinator hasn't already
                      // assigned. This is the "AI auto-pre-fill" the
                      // verify-in-context CR-026 flow gates on.
                      const effectiveValue =
                        assigned || (suggestion?.suggestedCourse ?? null);
                      const band = suggestion ? confidenceBand(suggestion.confidence) : null;
                      // Cells use 1-based columnIndex (Python wire format); the
                      // form uses 0-based indices internally.
                      return (
                        <div key={idx} className="flex flex-col gap-0.5">
                          <CourseCatalogCombo
                            submissionId={submissionId}
                            value={effectiveValue}
                            onChange={(course) => handleAssign(m.matrixId, idx, course)}
                            placeholder={suggestion?.suggestedCourse || sourceHeader || `Col ${idx + 1}`}
                          />
                          {suggestion && (
                            <span
                              className={`flex items-center gap-1 truncate rounded px-1 text-[10px] font-medium ${band?.cls || ''}`}
                              title={suggestion.rationale || 'no rationale'}
                            >
                              <span aria-hidden>{band?.dot}</span>
                              {suggestion.suggestedCourse
                                ? `AI: ${suggestion.suggestedCourse} (${Math.round(suggestion.confidence * 100)}%)`
                                : `AI: ${band?.label || 'no signal'}`}
                            </span>
                          )}
                          {sourceHeader && (
                            <span
                              className="truncate font-mono text-[10px] text-gray-400"
                              title={sourceHeader}
                            >
                              source: {sourceHeader}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {rowKeys.length > 0 && (
                    <>
                      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Cell-code legend:</span>
                        <span><span className="font-mono">I</span> Introduction</span>
                        <span><span className="font-mono">T</span> Theory</span>
                        <span><span className="font-mono">K</span> Knowledge</span>
                        <span><span className="font-mono">S</span> Skills</span>
                        <span className="text-gray-400">·</span>
                        <span><span className="font-mono">L</span> Low / <span className="font-mono">M</span> Medium / <span className="font-mono">H</span> High depth</span>
                      </div>
                      <p className="mt-2 text-xs italic text-gray-500">
                        Extracted cells — read only. The text/codes below come straight from your DOCX;
                        all you do here is name the column-headers above.
                      </p>
                      <div className="mt-2 max-h-[28rem] overflow-auto rounded border border-gray-200">
                        {/* Sticky matrix-name banner — stays visible as the
                            coordinator scrolls through the 75 spec rows so
                            they never lose track of which matrix they're
                            looking at. Sits above the sticky thead. */}
                        <div className="sticky top-0 z-20 border-b border-gray-200 bg-cshse-50 px-3 py-1.5 text-xs font-semibold text-cshse-800">
                          {m.name || m.title || m.matrixId}
                          {' '}
                          <span className="font-normal text-cshse-700">
                            · {rowKeys.length} specs · {colCount} columns
                          </span>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="sticky top-[28px] z-10 bg-gray-50">
                            <tr>
                              <th className="border-b border-gray-200 px-2 py-1.5 text-left">Spec</th>
                              {Array.from({ length: colCount }, (_, idx) => {
                                const assigned = (columnAssignments[m.matrixId] || {})[idx];
                                const sourceHeader = headers[idx] || '';
                                const colNum = `Col ${idx + 1}`;
                                const label = assigned || sourceHeader || colNum;
                                const tooltip = assigned
                                  ? `Column ${idx + 1} → ${assigned}${sourceHeader ? ` (source: ${sourceHeader})` : ''}`
                                  : sourceHeader
                                  ? `Column ${idx + 1} — source header "${sourceHeader}" — not yet mapped to a catalog course`
                                  : `Column ${idx + 1} — no source header captured; please map a course above`;
                                return (
                                  <th
                                    key={idx}
                                    className="border-b border-gray-200 px-2 py-1.5 text-left align-bottom"
                                    title={tooltip}
                                  >
                                    <div className="text-[10px] font-normal text-gray-400">{colNum}</div>
                                    <div>{label}</div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {rowKeys.map((rk) => (
                              <tr
                                key={rk as string}
                                className="border-t border-gray-100 even:bg-gray-50/50"
                                title={`${m.name || m.matrixId} · spec ${rk}`}
                              >
                                <td className="whitespace-nowrap px-2 py-1 font-mono font-medium text-gray-800">
                                  {rk as string}
                                </td>
                                {Array.from({ length: colCount }, (_, idx) => {
                                  // The wire format uses 1-based columnIndex
                                  // (column 0 is the prompt cell). Try both
                                  // (legacy 0-based) for safety.
                                  const cell =
                                    cellsByPos.get(`${rk}|${idx + 1}`) ||
                                    cellsByPos.get(`${rk}|${idx}`);
                                  const assigned = (columnAssignments[m.matrixId] || {})[idx];
                                  const colLabel = assigned || headers[idx] || `Col ${idx + 1}`;
                                  return (
                                    <td
                                      key={idx}
                                      className="px-2 py-1 font-mono text-gray-700"
                                      title={`${m.name || m.matrixId} · ${rk} · ${colLabel}${cell?.codeRaw ? ` = ${cell.codeRaw}` : ''}`}
                                    >
                                      {cell?.codeRaw || cell?.value || ''}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {m.htmlSnippet && (
                    <details className="mt-4 rounded border border-gray-200">
                      <summary className="cursor-pointer bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                        Show original source-document table (for visual reference)
                      </summary>
                      <div
                        className="ai-html-snippet max-h-[24rem] overflow-auto p-3 text-xs leading-relaxed text-gray-800"
                        // Source HTML originated from our own Python extractor with
                        // row anchors baked in — same trust model as DocumentViewer.
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: m.htmlSnippet }}
                      />
                    </details>
                  )}
                </>
              )}

              {isSkipped && (
                <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  This matrix will be left un-applied. You can populate it later from the Curriculum
                  Matrix tab in the standards editor.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Step 4 — Matrix (sub-sprint 1.d).
 *
 * Confirms the course-name-per-column mapping for each detected matrix
 * block. Cells are read-only (locked in at Step 3); this step is solely
 * for picking which course each column represents. Course dropdowns
 * are seeded from the per-institution programCourses catalog and the
 * Coordinator can create new ones inline.
 */
import React, { useState, useMemo } from 'react';
import { useAIImportStore } from '../../../../../store/aiImportStore';
import { CourseCatalogCombo, type ProgramCourse } from '../matrix/CourseCatalogCombo';

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
}

export function MatrixStep(): JSX.Element {
  const matrices = useAIImportStore((s) => s.matrices) as MatrixBlock[];
  const submissionId = useAIImportStore((s) => s.submissionId);
  const setStep = useAIImportStore((s) => s.setStep);

  const [columnAssignments, setColumnAssignments] = useState<Record<string, Record<number, string>>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

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

  const allReady = useMemo(() => {
    return matrices.every((m) => {
      if (skipped[m.matrixId]) return true;
      const colCount = columnsFor(m);
      if (colCount === 0) return true;
      const assignments = columnAssignments[m.matrixId] || {};
      return Array.from({ length: colCount }, (_, i) => i).every((idx) => !!assignments[idx]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrices, columnAssignments, skipped]);

  const handleAssign = (matrixId: string, columnIdx: number, course: ProgramCourse | null) => {
    setColumnAssignments((prev) => ({
      ...prev,
      [matrixId]: {
        ...prev[matrixId],
        [columnIdx]: course?.courseCode || ''
      }
    }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h2 className="text-lg font-semibold text-gray-900">Matrix review</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('review')}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ◂ Back
          </button>
          <button
            onClick={() => setStep('apply')}
            disabled={!allReady}
            className="rounded bg-cshse-600 px-3 py-1.5 text-sm text-white hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Next: Apply ▸
          </button>
        </div>
      </div>

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
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {m.name || m.title || `Matrix block ${m.matrixId}`}
                  </h3>
                  <div className="text-xs text-gray-500">
                    {colCount} columns, {(m.cells || []).length} cells, {rowKeys.length} specs
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={isSkipped}
                    onChange={(e) => setSkipped((s) => ({ ...s, [m.matrixId]: e.target.checked }))}
                    className="rounded text-cshse-600 focus:ring-cshse-500"
                  />
                  Skip this matrix
                </label>
              </div>

              {!isSkipped && colCount > 0 && submissionId && (
                <>
                  <p className="mb-3 text-xs text-gray-600">
                    Map each matrix column to a course in your program catalog.
                    {headers.length > 0 && (
                      <> The original source-DOCX headers are shown below each input as a hint.</>
                    )}
                  </p>
                  <div
                    className="mb-2 grid gap-2"
                    style={{ gridTemplateColumns: `100px repeat(${colCount}, minmax(160px, 1fr))` }}
                  >
                    <div className="text-xs uppercase tracking-wide text-gray-500">Course</div>
                    {Array.from({ length: colCount }, (_, idx) => {
                      const sourceHeader = headers[idx] || '';
                      // Cells use 1-based columnIndex (Python wire format); the
                      // form uses 0-based indices internally.
                      return (
                        <div key={idx} className="flex flex-col gap-0.5">
                          <CourseCatalogCombo
                            submissionId={submissionId}
                            value={(columnAssignments[m.matrixId] || {})[idx] || null}
                            onChange={(course) => handleAssign(m.matrixId, idx, course)}
                            placeholder={sourceHeader || `Col ${idx + 1}`}
                          />
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
                    <div className="mt-4 max-h-[28rem] overflow-auto rounded border border-gray-100">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Spec</th>
                            {Array.from({ length: colCount }, (_, idx) => (
                              <th key={idx} className="px-2 py-1.5 text-left">
                                {headers[idx] || `Col ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rowKeys.map((rk) => (
                            <tr key={rk as string} className="border-t border-gray-100">
                              <td className="whitespace-nowrap px-2 py-1 font-mono text-gray-700">{rk as string}</td>
                              {Array.from({ length: colCount }, (_, idx) => {
                                // The wire format uses 1-based columnIndex
                                // (column 0 is the prompt cell). Try both
                                // (legacy 0-based) for safety.
                                const cell =
                                  cellsByPos.get(`${rk}|${idx + 1}`) ||
                                  cellsByPos.get(`${rk}|${idx}`);
                                return (
                                  <td key={idx} className="px-2 py-1 text-gray-600">
                                    {cell?.codeRaw || cell?.value || ''}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

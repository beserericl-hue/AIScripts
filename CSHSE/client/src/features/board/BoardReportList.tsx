import { useMemo, useState } from 'react';
import { Download, Eye, Search } from 'lucide-react';
import { BoardReportRow, LEVEL_LABEL, RECOMMENDATION_LABEL, STATUS_LABEL } from './boardApi';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Presentational list of completed Lead Reader Reports for the CSHSE Board:
 * institution, program, level, completed date, recommendation — with Open
 * (read-only view) and Word / PDF download. No edit controls.
 */
export function BoardReportList({
  reports,
  onOpen,
  onDownload,
}: {
  reports: BoardReportRow[];
  onOpen: (row: BoardReportRow) => void;
  onDownload: (row: BoardReportRow, format: 'docx' | 'pdf') => void;
}): JSX.Element {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return reports;
    return reports.filter(
      (r) => r.institutionName.toLowerCase().includes(t) || r.programName.toLowerCase().includes(t)
    );
  }, [reports, q]);

  if (reports.length === 0) {
    return (
      <p data-testid="board-reports-empty" className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        No completed Lead Reader Reports yet. A report appears here once the lead reader sends the review to the board.
      </p>
    );
  }

  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by institution or program"
          aria-label="Filter by institution or program"
          data-testid="board-reports-filter"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm" data-testid="board-reports-table">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Institution</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Lead reader recommendation</th>
              <th className="px-4 py-3 text-right">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <tr key={r.submissionId} data-testid={`board-report-row-${r.submissionId}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{r.institutionName}</td>
                <td className="px-4 py-3 text-gray-700">{r.programName}</td>
                <td className="px-4 py-3 text-gray-700">{LEVEL_LABEL[r.programLevel] || r.programLevel || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(r.completedAt)}</td>
                <td className="px-4 py-3 text-gray-700">
                  <div>{RECOMMENDATION_LABEL[r.recommendation] || 'Not recorded'}</div>
                  <div className="text-xs text-gray-500">{STATUS_LABEL[r.status] || r.status}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(r)}
                      data-testid={`board-open-${r.submissionId}`}
                      className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
                    >
                      <Eye className="h-3.5 w-3.5" /> Open
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(r, 'docx')}
                      data-testid={`board-docx-${r.submissionId}`}
                      title="Download as a Word document"
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-3.5 w-3.5" /> Word
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(r, 'pdf')}
                      data-testid={`board-pdf-${r.submissionId}`}
                      title="Download as a PDF"
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  No reports match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BoardReportList;

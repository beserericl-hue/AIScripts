import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Landmark, Loader2 } from 'lucide-react';
import { BoardReportList } from './BoardReportList';
import { downloadBoardReport, fetchBoardReports, BoardReportRow } from './boardApi';

/**
 * CSHSE Board landing page — every COMPLETED Lead Reader Report across all
 * institutions, read-only, with open + Word / PDF download.
 */
export function BoardDashboard(): JSX.Element {
  const navigate = useNavigate();
  const [dlError, setDlError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['board-lead-reader-reports'], queryFn: fetchBoardReports });

  const onDownload = async (row: BoardReportRow, format: 'docx' | 'pdf') => {
    setDlError(null);
    try {
      await downloadBoardReport(row.submissionId, format, row.institutionName);
    } catch (e: any) {
      setDlError(`Download failed${e?.response?.status ? ` (${e.response.status})` : ''}.`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6" data-testid="board-dashboard">
      <div className="mb-5 flex items-center gap-3">
        <Landmark className="h-8 w-8 text-teal-700" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Completed Lead Reader Reports</h1>
          <p className="text-sm text-gray-500">
            CSHSE Board · read-only. Reports appear once the lead reader sends the review to the board.
          </p>
        </div>
      </div>
      {dlError && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{dlError}</p>
      )}
      {query.isLoading ? (
        <div className="flex items-center gap-2 p-6 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
        </div>
      ) : query.error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not load the Lead Reader Reports.
        </p>
      ) : (
        <BoardReportList
          reports={query.data || []}
          onOpen={(r) => navigate(`/board/lead-reader-reports/${r.submissionId}`)}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}

export default BoardDashboard;

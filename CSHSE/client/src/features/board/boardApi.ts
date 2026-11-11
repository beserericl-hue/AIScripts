import { api } from '../../services/api';

// CSHSE Board — read-only access to COMPLETED Lead Reader Reports (a report is
// completed once the lead reader sends the review to the board, i.e. the
// submission is review_complete, or after the board decision).

export interface BoardReportRow {
  submissionId: string;
  submissionCode?: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  type?: string;
  status: string;
  recommendation: string;
  decisionOutcome: string | null;
  completedAt: string | null;
  hasAuthoredReport: boolean;
}

export const LEVEL_LABEL: Record<string, string> = {
  associate: 'Associate',
  bachelors: 'Baccalaureate',
  masters: "Master's",
};

export const RECOMMENDATION_LABEL: Record<string, string> = {
  accredit_no_conditions: 'Accreditation with no conditions',
  conditional: 'Conditional accreditation',
  deny: 'Deny accreditation',
  hold: 'Hold a decision',
};

export const STATUS_LABEL: Record<string, string> = {
  review_complete: 'Awaiting board decision',
  compliant: 'Board decision: accredited',
  non_compliant: 'Board decision: not accredited',
};

export async function fetchBoardReports(): Promise<BoardReportRow[]> {
  const r = await api.get('/api/board/lead-reader-reports');
  return (r.data?.reports || []) as BoardReportRow[];
}

/** Download the completed Lead Reader Report (Word / PDF) as a file. */
export async function downloadBoardReport(
  submissionId: string,
  format: 'docx' | 'pdf',
  institutionName?: string
): Promise<void> {
  const resp = await api.get(
    `/api/board/lead-reader-reports/${submissionId}/download?format=${format}`,
    { responseType: 'blob' }
  );
  const blob = new Blob([resp.data], {
    type: resp.headers['content-type'] || (format === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = String(institutionName || 'Lead-Reader-Report').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  a.download = `LeadReaderReport-${safe || 'report'}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

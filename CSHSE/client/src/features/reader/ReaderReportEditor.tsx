import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, Save, Check, Loader2, Download } from 'lucide-react';
import { api } from '../../services/api';

interface ReportRow {
  code: string;
  title: string;
  aiMark: 'compliant' | 'noncompliant' | null;
  aiComment: string;
  readerMark: 'compliant' | 'noncompliant' | '';
  readerComment: string;
}
interface ReportData {
  institutionName: string;
  programName: string;
  levelTitle: string;
  standards: ReportRow[];
  recommendation: string;
  updatedAt: string | null;
}

export function ReaderReportEditor(): JSX.Element {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['reader-report-data', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/reports/submission/${submissionId}/reader-report-data`);
      return r.data as ReportData;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data) {
      setRows(query.data.standards);
      setRecommendation(query.data.recommendation || '');
      setSavedAt(query.data.updatedAt);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await api.put(`/api/reports/submission/${submissionId}/reader-report-data`, {
        rows: rows.map((r) => ({ standardCode: r.code, mark: r.readerMark, comment: r.readerComment })),
        recommendation,
      });
      return r.data as { updatedAt: string };
    },
    onSuccess: (d) => setSavedAt(d.updatedAt),
  });

  const setRow = (code: string, patch: Partial<ReportRow>) =>
    setRows((rs) => rs.map((r) => (r.code === code ? { ...r, ...patch } : r)));

  const [dlError, setDlError] = useState<string | null>(null);
  const downloadGenerated = async (fmt: 'pdf' | 'docx') => {
    setDlError(null);
    try {
      // Save first so the download reflects the reader's latest edits, then
      // stream the official template filled with their marks/comments.
      await save.mutateAsync().catch(() => {});
      const resp = await api.get(
        `/api/reports/submission/${submissionId}/reader-report/download?format=${fmt}`,
        { responseType: 'blob' }
      );
      const blob = new Blob([resp.data], {
        type: resp.headers['content-type'] || (fmt === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Reader-Report.${fmt}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setDlError(`Download failed${e?.response?.status ? ` (${e.response.status})` : ''}.`);
    }
  };

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /><span>Loading Reader Report…</span>
      </div>
    );
  }
  if (query.error) {
    const status = (query.error as any)?.response?.status;
    return (
      <div className="mx-auto max-w-3xl p-6">
        <button onClick={() => navigate(`/self-study/${submissionId}`)} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" /> <span>Back to Self-Study</span>
        </button>
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {status === 403 ? 'Only an assigned reader or lead reader can open this Reader Report.' : 'Could not load the Reader Report.'}
        </div>
      </div>
    );
  }

  const data = query.data!;
  return (
    <div data-testid="reader-report-editor" className="mx-auto max-w-4xl p-6">
      {/* Header + nav back to the self-study editor */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <button
            data-testid="reader-report-back"
            onClick={() => navigate(`/self-study/${submissionId}`)}
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" /> <span>Back to Self-Study (view &amp; comment)</span>
          </button>
          <h1 className="text-xl font-semibold text-slate-900">Reader Report — {data.levelTitle}</h1>
          <p className="text-sm text-slate-600">{data.institutionName} · {data.programName}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />Saved</span>}
          <button onClick={() => downloadGenerated('pdf')} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50" title="Download PDF"><Download className="h-4 w-4" />PDF</button>
          <button onClick={() => downloadGenerated('docx')} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50" title="Download editable Word"><Download className="h-4 w-4" />Word</button>
          <button
            data-testid="reader-report-save"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
      {dlError && <p className="mb-2 text-sm text-red-600">{dlError}</p>}

      <p className="mb-4 text-sm text-slate-500">
        Each standard is pre-filled from the AI draft. Adjust the compliance mark and comments, then Save.
        Use “Back to Self-Study” to read the narratives and add inline comments.
      </p>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.code} data-testid={`rr-row-${r.code}`} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Standard {r.code}: {r.title}</h2>
              <div className="flex items-center gap-2 text-sm">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="radio" name={`mark-${r.code}`} checked={r.readerMark === 'compliant'} onChange={() => setRow(r.code, { readerMark: 'compliant' })} className="text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-emerald-700">Compliant</span>
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="radio" name={`mark-${r.code}`} checked={r.readerMark === 'noncompliant'} onChange={() => setRow(r.code, { readerMark: 'noncompliant' })} className="text-red-600 focus:ring-red-500" />
                  <span className="text-red-700">Non-Compliant</span>
                </label>
                {r.readerMark && (
                  <button onClick={() => setRow(r.code, { readerMark: '' })} className="text-xs text-slate-400 hover:text-slate-600" title="Clear mark">clear</button>
                )}
              </div>
            </div>

            {/* AI assessment — read-only tag so the reader can see the AI's
                per-spec verdicts/comments while writing their own. */}
            {r.aiComment && (
              <details className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900" open>
                <summary className="cursor-pointer font-semibold text-amber-800">
                  AI assessment{r.aiMark ? ` — ${r.aiMark === 'compliant' ? 'Compliant' : 'Non-Compliant'}` : ''}
                </summary>
                <div className="mt-1 whitespace-pre-wrap text-amber-900">{r.aiComment}</div>
              </details>
            )}

            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`rr-comment-${r.code}`}>Your comments</label>
            <textarea
              id={`rr-comment-${r.code}`}
              data-testid={`rr-comment-${r.code}`}
              value={r.readerComment}
              onChange={(e) => setRow(r.code, { readerComment: e.target.value })}
              placeholder="Note missing information or the reason for a non-compliant decision."
              rows={3}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Recommendation to the Council</h2>
        <textarea
          data-testid="rr-recommendation"
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          placeholder="Overall recommendation (e.g. accreditation with no conditions / conditional / deny / hold) and rationale."
          rows={4}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={() => navigate(`/self-study/${submissionId}`)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Back to Self-Study
        </button>
        <button data-testid="reader-report-save-2" onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Reader Report
        </button>
      </div>
    </div>
  );
}

export default ReaderReportEditor;

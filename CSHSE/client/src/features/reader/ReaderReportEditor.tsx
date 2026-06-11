import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, Save, Check, Loader2, Download, Eye, X } from 'lucide-react';
import { api } from '../../services/api';

interface ReportSpec {
  specCode: string;
  specTitle: string;
  narrativeHtml: string;
  evidenceHtml: string;
  verdict?: string;
}
interface ReportRow {
  code: string;
  title: string;
  aiMark: 'compliant' | 'noncompliant' | null;
  aiComment: string;
  readerMark: 'compliant' | 'noncompliant' | '';
  readerComment: string;
  specs: ReportSpec[];
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
  const [viewHtml, setViewHtml] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const openViewer = async () => {
    setDlError(null);
    setViewLoading(true);
    try {
      await save.mutateAsync().catch(() => {});
      const r = await api.get(`/api/reports/submission/${submissionId}/reader-report/download?format=html`);
      setViewHtml(r.data?.html || '<p>(empty report)</p>');
    } catch {
      setDlError('Could not load the formatted view.');
    } finally {
      setViewLoading(false);
    }
  };
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
  // Rendered-content styling for narrative + supporting evidence (matches the
  // reader review row: real tables/lists/links at a readable size).
  const proseCls =
    'prose prose-sm max-w-none text-slate-800 ' +
    '[&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
    '[&_table]:border-collapse [&_table]:w-full [&_table]:my-2 ' +
    '[&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top ' +
    '[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold ' +
    '[&_a]:text-teal-700 [&_a]:underline';
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
          {/* View the filled official template FORMATTED in the browser (no Word). */}
          <button
            data-testid="reader-report-view"
            onClick={openViewer}
            disabled={viewLoading}
            className="inline-flex items-center gap-1 rounded border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-sm text-teal-800 hover:bg-teal-100 disabled:opacity-60"
            title="View the filled template, formatted, in the browser"
          >
            {viewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}View
          </button>
          {/* The official CSHSE reader-report template IS a Word document — the
              download is that template, filled with the reader's checklist +
              comments. */}
          <button
            data-testid="reader-report-download"
            onClick={() => downloadGenerated('docx')}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            title="Download the official CSHSE template (Word), filled with your marks and comments"
          >
            <Download className="h-4 w-4" />Download template (Word)
          </button>
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
        For each standard: click the AI assessment tag to see the AI's view, read the narrative and
        supporting evidence below it, then set the Compliant/Non-Compliant check and write your comments. Save when done.
        Use “Back to Self-Study” to add inline comments on the text.
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

            {/* AI assessment — a TAG you click to reveal the AI's per-spec
                verdicts (collapsed by default), like the self-study editor. */}
            {r.aiComment && (
              <details data-testid={`rr-ai-${r.code}`} className="mb-3 rounded-lg border border-amber-200 bg-amber-50">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 rounded-lg">
                  ⓘ AI assessment{r.aiMark ? ` — ${r.aiMark === 'compliant' ? 'Compliant' : 'Non-Compliant'}` : ''} <span className="font-normal text-amber-600">(click to view)</span>
                </summary>
                <div className="border-t border-amber-200 px-3 py-2 text-xs whitespace-pre-wrap text-amber-900">{r.aiComment}</div>
              </details>
            )}

            {/* The self-study itself — each spec's narrative + supporting evidence,
                so the reader reads and assesses in one place. */}
            {r.specs.map((sp) => (
              <div key={sp.specCode} className="mb-3 rounded border border-slate-100 bg-slate-50 p-3">
                <h3 className="mb-1 text-sm font-semibold text-slate-700">{r.code}.{sp.specCode} {sp.specTitle}</h3>
                {sp.narrativeHtml ? (
                  <div className={proseCls} dangerouslySetInnerHTML={{ __html: sp.narrativeHtml }} />
                ) : (
                  <p className="text-sm italic text-slate-400">No narrative submitted.</p>
                )}
                {sp.evidenceHtml ? (
                  <>
                    <p className="mt-2 text-xs font-semibold text-slate-500">Supporting evidence</p>
                    <div className={`${proseCls} rounded border border-slate-200 bg-white p-2`} dangerouslySetInnerHTML={{ __html: sp.evidenceHtml }} />
                  </>
                ) : null}
              </div>
            ))}

            {/* Reader's comments — the checklist mark is the Compliant/Non-Compliant
                control at the top of this section. */}
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`rr-comment-${r.code}`}>Your comments for Standard {r.code}</label>
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

      {/* Formatted viewer — the filled OFFICIAL template, converted to HTML and
          shown in the browser (tables/checklist + comments), no Word needed. */}
      {viewHtml != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewHtml(null)}>
          <div data-testid="reader-report-viewer" className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="text-base font-semibold text-slate-900">Reader Report — official template (formatted)</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadGenerated('docx')} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Word</button>
                <button onClick={() => setViewHtml(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-6">
              <div
                className={`${proseCls} [&_table]:w-full`}
                dangerouslySetInnerHTML={{ __html: viewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReaderReportEditor;

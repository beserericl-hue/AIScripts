import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, Save, Check, Loader2, Download, Eye, X, FileText, BookOpen, Grid3X3, FolderOpen, ClipboardList, Users, Lock, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

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
  completedAt?: string | null;
  readonly?: boolean;
  reviewerId?: string;
  reviewerName?: string;
}
interface ReaderReportListItem {
  reviewerId: string;
  reviewerName: string;
  role: string;
  isSelf: boolean;
  completedAt: string | null;
  updatedAt: string | null;
  started: boolean;
  viewable: boolean;
}

export function ReaderReportEditor(): JSX.Element {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewReviewerId = searchParams.get('reviewerId') || '';
  const effectiveRole = useAuthStore((s) => s.getEffectiveRole());
  const isLeadOrAdmin = effectiveRole === 'lead_reader' || effectiveRole === 'admin';

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['reader-report-data', submissionId, viewReviewerId],
    queryFn: async () => {
      const qs = viewReviewerId ? `?reviewerId=${encodeURIComponent(viewReviewerId)}` : '';
      const r = await api.get(`/api/reports/submission/${submissionId}/reader-report-data${qs}`);
      return r.data as ReportData;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  // Read-only when a lead reader / admin is viewing ANOTHER reviewer's report.
  const readonly = !!query.data?.readonly;

  useEffect(() => {
    if (query.data) {
      setRows(query.data.standards);
      setRecommendation(query.data.recommendation || '');
      setSavedAt(query.data.updatedAt);
      setCompletedAt(query.data.completedAt || null);
    }
  }, [query.data]);

  // The lead reader's roster of all readers' reports for this submission.
  const listQuery = useQuery({
    queryKey: ['reader-reports-list', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/reports/submission/${submissionId}/reader-reports`);
      return (r.data?.reports || []) as ReaderReportListItem[];
    },
    enabled: !!submissionId && isLeadOrAdmin,
    refetchOnWindowFocus: false,
  });

  const save = useMutation({
    mutationFn: async (opts?: { completed?: boolean }) => {
      const body: any = {
        rows: rows.map((r) => ({ standardCode: r.code, mark: r.readerMark, comment: r.readerComment })),
        recommendation,
      };
      if (opts && typeof opts.completed === 'boolean') body.completed = opts.completed;
      const r = await api.put(`/api/reports/submission/${submissionId}/reader-report-data`, body);
      return r.data as { updatedAt: string; completedAt: string | null };
    },
    onSuccess: (d) => {
      setSavedAt(d.updatedAt);
      setCompletedAt(d.completedAt ?? completedAt);
      if (isLeadOrAdmin) listQuery.refetch();
    },
  });

  const setRow = (code: string, patch: Partial<ReportRow>) =>
    setRows((rs) => rs.map((r) => (r.code === code ? { ...r, ...patch } : r)));

  const [dlError, setDlError] = useState<string | null>(null);
  const [viewHtml, setViewHtml] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const reviewerParam = viewReviewerId ? `&reviewerId=${encodeURIComponent(viewReviewerId)}` : '';
  const openViewer = async () => {
    setDlError(null);
    setViewLoading(true);
    try {
      // Persist the latest edits first — but only for your OWN report.
      if (!readonly) await save.mutateAsync(undefined).catch(() => {});
      const r = await api.get(`/api/reports/submission/${submissionId}/reader-report/download?format=html${reviewerParam}`);
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
      // stream the official template filled with their marks/comments. Only
      // save your own report; when viewing another reader's, just download it.
      if (!readonly) await save.mutateAsync(undefined).catch(() => {});
      const resp = await api.get(
        `/api/reports/submission/${submissionId}/reader-report/download?format=${fmt}${reviewerParam}`,
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
  // Match the self-study editor's reading size (prose-base) — readers said the
  // smaller text was hard to read.
  const proseCls =
    'prose prose-base max-w-none text-slate-800 ' +
    '[&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
    '[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 ' +
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
          {readonly ? (
            <p data-testid="rr-readonly-banner" className="mt-1 inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              <Lock className="h-3.5 w-3.5" />
              Viewing {data.reviewerName || 'another reader'}’s report (read-only)
              {completedAt && <span className="text-slate-500">· completed {new Date(completedAt).toLocaleDateString()}</span>}
            </p>
          ) : completedAt ? (
            <p data-testid="rr-completed-badge" className="mt-1 inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed {new Date(completedAt).toLocaleDateString()} — visible to the lead reader
            </p>
          ) : null}
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
          {!readonly && (
            <button
              data-testid="reader-report-save"
              onClick={() => save.mutate(undefined)}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          )}
          {/* Completion gate: marking complete makes this report visible to the
              lead reader. Re-open to keep editing. Only on your OWN report. */}
          {!readonly && (
            completedAt ? (
              <button
                data-testid="reader-report-reopen"
                onClick={() => save.mutate({ completed: false })}
                disabled={save.isPending}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                title="Re-open this report for further editing (hides it from the lead reader until re-completed)"
              >
                Re-open
              </button>
            ) : (
              <button
                data-testid="reader-report-complete"
                onClick={() => save.mutate({ completed: true })}
                disabled={save.isPending}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                title="Mark this report complete so the lead reader can review it"
              >
                <CheckCircle2 className="h-4 w-4" />Mark complete
              </button>
            )
          )}
          {readonly && (
            <button
              data-testid="reader-report-back-to-mine"
              onClick={() => { const n = new URLSearchParams(searchParams); n.delete('reviewerId'); setSearchParams(n, { replace: true }); }}
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />Back to my report
            </button>
          )}
        </div>
      </div>
      {/* Top menu: jump straight to any part of the self-study without losing
          your place. The Reader Report is the active tab here; the others
          deep-link into the self-study editor's matching section. */}
      <nav data-testid="reader-report-nav" className="mb-4 flex flex-col gap-1">
        <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Self-Study</span>
        <div className="flex flex-wrap items-center gap-1">
          <button
            data-testid="rr-nav-introduction"
            onClick={() => navigate(`/self-study/${submissionId}?view=introduction`)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100"
          >
            <FileText className="h-4 w-4 flex-shrink-0" />Introduction
          </button>
          <button
            data-testid="rr-nav-standards"
            onClick={() => navigate(`/self-study/${submissionId}?view=standards`)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100"
          >
            <BookOpen className="h-4 w-4 flex-shrink-0" />Standards
          </button>
          <button
            data-testid="rr-nav-curriculum"
            onClick={() => navigate(`/self-study/${submissionId}?view=curriculum`)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100"
          >
            <Grid3X3 className="h-4 w-4 flex-shrink-0" />Curriculum Matrix
          </button>
          <button
            data-testid="rr-nav-files"
            onClick={() => navigate(`/self-study/${submissionId}?view=files`)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100"
          >
            <FolderOpen className="h-4 w-4 flex-shrink-0" />Supporting File Library
          </button>
          <span
            aria-current="page"
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap border border-amber-300 bg-amber-100 text-amber-800"
          >
            <ClipboardList className="h-4 w-4 flex-shrink-0" />Reader Report
          </span>
        </div>
      </nav>

      {/* Lead reader / admin: oversee every reader's report. Each reader's report
          becomes openable here once that reader marks it complete. */}
      {isLeadOrAdmin && (
        <details data-testid="rr-all-reports" open className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-indigo-900">
            <Users className="h-4 w-4" /> All reader reports
            {listQuery.data && (
              <span className="font-normal text-indigo-600">
                · {listQuery.data.filter((x) => x.completedAt).length} of {listQuery.data.length} complete
              </span>
            )}
          </summary>
          <div className="border-t border-indigo-200 p-3">
            {listQuery.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-indigo-700"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
            ) : (listQuery.data || []).length === 0 ? (
              <p className="text-sm text-indigo-700">No readers are assigned to this submission yet.</p>
            ) : (
              <ul className="divide-y divide-indigo-100">
                {(listQuery.data || []).map((it) => {
                  const active = it.reviewerId === (query.data?.reviewerId || '') && (!!viewReviewerId ? it.reviewerId === viewReviewerId : it.isSelf);
                  return (
                    <li key={it.reviewerId} data-testid={`rr-reviewer-${it.reviewerId}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {it.reviewerName}
                          {it.isSelf && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                          {it.role === 'lead_reader' && <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] uppercase text-slate-600">lead</span>}
                        </p>
                        <p className="text-xs">
                          {it.completedAt ? (
                            <span className="text-emerald-700">✓ Completed {new Date(it.completedAt).toLocaleDateString()}</span>
                          ) : it.started ? (
                            <span className="text-amber-700">In progress (not yet completed)</span>
                          ) : (
                            <span className="text-slate-400">Not started</span>
                          )}
                        </p>
                      </div>
                      {it.isSelf ? (
                        <span className="text-xs text-slate-500">{active ? 'Viewing' : ''}</span>
                      ) : it.viewable ? (
                        <button
                          data-testid={`rr-view-reviewer-${it.reviewerId}`}
                          onClick={() => { const n = new URLSearchParams(searchParams); n.set('reviewerId', it.reviewerId); setSearchParams(n, { replace: true }); }}
                          className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs ${active ? 'border-indigo-400 bg-indigo-100 text-indigo-800' : 'border-slate-300 text-slate-700 hover:bg-white'}`}
                        >
                          <Eye className="h-3.5 w-3.5" />{active ? 'Viewing' : 'View report'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Visible once the reader marks it complete"><Lock className="h-3.5 w-3.5" />Locked</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </details>
      )}

      {dlError && <p className="mb-2 text-sm text-red-600">{dlError}</p>}

      <p className="mb-4 text-sm text-slate-500">
        For each standard: click the AI assessment tag to see the AI's view, read the narrative and
        supporting evidence below it, then set the Compliant/Non-Compliant check and write your comments. Save when done.
        Use “Back to Self-Study” to add inline comments on the text.
      </p>

      {/* The official CSHSE compliance-checklist TABLE, embedded inline so the
          reader fills the template right on this page. It binds to the SAME row
          state as the per-standard sections below, so a mark/comment set in
          either place stays in sync — and it is exactly what the downloaded
          Word template ("Download template") gets filled with. */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Compliance checklist — official template</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table data-testid="rr-checklist-table" className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Standard</th>
                <th className="w-24 border border-slate-300 px-2 py-2 text-center font-semibold text-emerald-700">Compliant</th>
                <th className="w-28 border border-slate-300 px-2 py-2 text-center font-semibold text-red-700">Non-Compliant</th>
                <th className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Reader’s comments</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} data-testid={`rr-check-${r.code}`} className="align-top">
                  <td className="border border-slate-300 px-3 py-2">
                    <a href={`#rr-row-${r.code}`} className="font-medium text-slate-800 hover:text-teal-700">Standard {r.code}</a>
                    <div className="text-xs text-slate-500">{r.title}</div>
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      data-testid={`rr-check-c-${r.code}`}
                      disabled={readonly}
                      checked={r.readerMark === 'compliant'}
                      onChange={() => setRow(r.code, { readerMark: r.readerMark === 'compliant' ? '' : 'compliant' })}
                      className="h-4 w-4 text-emerald-600 disabled:opacity-60"
                      aria-label={`Standard ${r.code} compliant`}
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      data-testid={`rr-check-n-${r.code}`}
                      disabled={readonly}
                      checked={r.readerMark === 'noncompliant'}
                      onChange={() => setRow(r.code, { readerMark: r.readerMark === 'noncompliant' ? '' : 'noncompliant' })}
                      className="h-4 w-4 text-red-600 disabled:opacity-60"
                      aria-label={`Standard ${r.code} non-compliant`}
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-1">
                    <textarea
                      value={r.readerComment}
                      readOnly={readonly}
                      onChange={(e) => setRow(r.code, { readerComment: e.target.value })}
                      rows={2}
                      placeholder="Comments…"
                      className={`w-full resize-y rounded border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-300 ${readonly ? 'bg-slate-50' : ''}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-500">Check Compliant or Non-Compliant and add comments per standard. The detailed narrative + evidence for each standard is below.</p>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.code} id={`rr-row-${r.code}`} data-testid={`rr-row-${r.code}`} className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Standard {r.code}: {r.title}</h2>
              <div className="flex items-center gap-2 text-sm">
                <label className={`inline-flex items-center gap-1 ${readonly ? '' : 'cursor-pointer'}`}>
                  <input type="radio" disabled={readonly} name={`mark-${r.code}`} checked={r.readerMark === 'compliant'} onChange={() => setRow(r.code, { readerMark: 'compliant' })} className="text-emerald-600 focus:ring-emerald-500 disabled:opacity-60" />
                  <span className="text-emerald-700">Compliant</span>
                </label>
                <label className={`inline-flex items-center gap-1 ${readonly ? '' : 'cursor-pointer'}`}>
                  <input type="radio" disabled={readonly} name={`mark-${r.code}`} checked={r.readerMark === 'noncompliant'} onChange={() => setRow(r.code, { readerMark: 'noncompliant' })} className="text-red-600 focus:ring-red-500 disabled:opacity-60" />
                  <span className="text-red-700">Non-Compliant</span>
                </label>
                {!readonly && r.readerMark && (
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
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`rr-comment-${r.code}`}>
              {readonly ? `${data.reviewerName || 'Reader'}’s comments for Standard ${r.code}` : `Your comments for Standard ${r.code}`}
            </label>
            <textarea
              id={`rr-comment-${r.code}`}
              data-testid={`rr-comment-${r.code}`}
              value={r.readerComment}
              onChange={(e) => setRow(r.code, { readerComment: e.target.value })}
              readOnly={readonly}
              placeholder="Note missing information or the reason for a non-compliant decision."
              rows={3}
              className={`w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300 ${readonly ? 'bg-slate-50' : ''}`}
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
          readOnly={readonly}
          placeholder="Overall recommendation (e.g. accreditation with no conditions / conditional / deny / hold) and rationale."
          rows={4}
          className={`w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300 ${readonly ? 'bg-slate-50' : ''}`}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={() => navigate(`/self-study/${submissionId}`)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Back to Self-Study
        </button>
        {!readonly && (
          <>
            <button data-testid="reader-report-save-2" onClick={() => save.mutate(undefined)} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Reader Report
            </button>
            {!completedAt && (
              <button data-testid="reader-report-complete-2" onClick={() => save.mutate({ completed: true })} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> Mark complete
              </button>
            )}
          </>
        )}
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

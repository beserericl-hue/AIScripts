import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, Save, Check, Loader2, Download, Eye, X, FileText, BookOpen, Grid3X3, FolderOpen, ClipboardList, Users, Lock, CheckCircle2, MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { FormattedCommentable } from './FormattedCommentable';
import { AllCommentsDrawer } from './AllCommentsDrawer';
import { CommentNavigation } from '../comments';

interface ReportSpec {
  specCode: string;
  specTitle: string;
  narrativeHtml: string;
  evidenceHtml: string;
  verdict?: string;
  aiMark: 'compliant' | 'noncompliant' | null;
  evidenceCount?: number;
  // The reader's per-specification checklist mark + comment (the official
  // template captures these per spec, next to each specification).
  readerMark: 'compliant' | 'noncompliant' | '';
  readerComment: string;
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
type AcceptanceVote = 'accept' | 'conditional' | 'deny' | 'hold' | '';
interface ReportData {
  institutionName: string;
  programName: string;
  levelTitle: string;
  standards: ReportRow[];
  recommendation: string;
  acceptanceVote?: AcceptanceVote;
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
  acceptanceVote?: AcceptanceVote;
}
const VOTE_OPTIONS: { value: Exclude<AcceptanceVote, ''>; label: string; cls: string }[] = [
  { value: 'accept', label: 'Accept', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { value: 'conditional', label: 'Conditional', cls: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'deny', label: 'Deny', cls: 'border-red-300 bg-red-50 text-red-800' },
  { value: 'hold', label: 'Hold', cls: 'border-slate-300 bg-slate-50 text-slate-700' },
];
const voteLabel = (v?: AcceptanceVote) => VOTE_OPTIONS.find((o) => o.value === v)?.label || '—';

export function ReaderReportEditor(): JSX.Element {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewReviewerId = searchParams.get('reviewerId') || '';
  const effectiveRole = useAuthStore((s) => s.getEffectiveRole());
  const effectiveUser = useAuthStore((s) => s.getEffectiveUser());
  const currentUserId = (effectiveUser as any)?.id || (effectiveUser as any)?._id || '';
  const isLeadOrAdmin = effectiveRole === 'lead_reader' || effectiveRole === 'admin';

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [acceptanceVote, setAcceptanceVote] = useState<AcceptanceVote>('');
  const [commentPage, setCommentPage] = useState(1);
  const [commentsOpen, setCommentsOpen] = useState(true);
  // The comment the reader navigated to (next/prev or from the chat window).
  // Used to FLASH the highlighted text it anchors to (inside the table).
  const [highlightComment, setHighlightComment] = useState<{ std: string; spec?: string; commentId: string } | null>(null);

  // All comments for the submission (one shared query — same key as the chat
  // drawer, so react-query dedupes) → per-spec comments for the inline markers.
  type FullComment = { _id: string; standardCode: string; specCode?: string; selectedText?: string; selectionStart?: number; selectionEnd?: number };
  const allCommentsQuery = useQuery({
    queryKey: ['comments-all', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/comments?limit=500`);
      return r.data as { comments: FullComment[] };
    },
    enabled: !!submissionId && !!currentUserId,
    refetchOnWindowFocus: false,
  });
  // Group comments by spec ONCE per data change, so each spec's array keeps a
  // stable reference across renders (otherwise FormattedCommentable re-marks the
  // DOM every render, making the page churn / elements "unstable").
  const EMPTY_COMMENTS = useMemo<FullComment[]>(() => [], []);
  const commentsBySpec = useMemo(() => {
    const m = new Map<string, FullComment[]>();
    for (const c of (allCommentsQuery.data?.comments || [])) {
      const k = `${c.standardCode}.${c.specCode || ''}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [allCommentsQuery.data]);
  const commentsForSpec = (std: string, spec: string): FullComment[] =>
    commentsBySpec.get(`${std}.${spec}`) || EMPTY_COMMENTS;
  const refreshComments = () => { allCommentsQuery.refetch(); };

  // Jump to a comment: scroll to its spec, then to the inline marker on the
  // selected text (inside the table) and flash it so the link points AT the text.
  const navigateToComment = (std: string, spec?: string, commentId?: string) => {
    const specEl = document.getElementById(`rr-spec-${std}-${spec || ''}`);
    if (specEl) specEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (commentId) {
      setHighlightComment({ std, spec, commentId });
      setTimeout(() => {
        const m = document.getElementById(`comment-marker-${commentId}`);
        if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
      setTimeout(() => setHighlightComment((h) => (h && h.commentId === commentId ? null : h)), 3500);
    }
  };
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
      setAcceptanceVote(query.data.acceptanceVote || '');
      setSavedAt(query.data.updatedAt);
      setCompletedAt(query.data.completedAt || null);
    }
  }, [query.data]);

  // The lead reader's roster of all readers' reports for this submission.
  const listQuery = useQuery({
    queryKey: ['reader-reports-list', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/reports/submission/${submissionId}/reader-reports`);
      return r.data as { reports: ReaderReportListItem[]; tally: Record<string, number> };
    },
    enabled: !!submissionId && isLeadOrAdmin,
    refetchOnWindowFocus: false,
  });
  const roster = listQuery.data?.reports || [];
  const tally = listQuery.data?.tally || { accept: 0, conditional: 0, deny: 0, hold: 0 };

  // Per-spec 0–3 rubric Score (same model as the self-study reviewer score).
  // When viewing another reviewer's report, show THEIR scores (read-only).
  const scoresQuery = useQuery({
    queryKey: ['scores', submissionId, viewReviewerId],
    queryFn: async () => {
      const qs = viewReviewerId ? `?reviewerId=${encodeURIComponent(viewReviewerId)}` : '';
      const r = await api.get(`/api/submissions/${submissionId}/scores${qs}`);
      return (r.data?.scores || []) as { standardCode: string; specCode: string; score: number }[];
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });
  const scoreFor = (std: string, spec: string): number | undefined =>
    (scoresQuery.data || []).find((s) => s.standardCode === std && s.specCode === spec)?.score;
  const saveScore = useMutation({
    mutationFn: async ({ std, spec, score }: { std: string; spec: string; score: number | null }) => {
      if (score === null) {
        await api.delete(`/api/submissions/${submissionId}/scores`, { data: { standardCode: std, specCode: spec } });
      } else {
        await api.put(`/api/submissions/${submissionId}/scores`, { standardCode: std, specCode: spec, score });
      }
    },
    onSuccess: () => scoresQuery.refetch(),
  });

  const save = useMutation({
    mutationFn: async (opts?: { completed?: boolean }) => {
      // Persist the checklist PER SPECIFICATION (one row per spec).
      const specRows = rows.flatMap((r) =>
        r.specs.map((sp) => ({ standardCode: r.code, specCode: sp.specCode, mark: sp.readerMark, comment: sp.readerComment }))
      );
      const body: any = { rows: specRows, recommendation, acceptanceVote };
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

  // Autosave: any edit marks the form dirty; a debounced effect persists it so
  // the reader never loses checklist marks/comments by forgetting to hit Save.
  const dirtyRef = useRef(false);
  const setRow = (code: string, patch: Partial<ReportRow>) => {
    dirtyRef.current = true;
    setRows((rs) => rs.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  };
  // Patch a single specification's checklist (mark/comment).
  const setSpec = (code: string, specCode: string, patch: Partial<ReportSpec>) => {
    dirtyRef.current = true;
    setRows((rs) => rs.map((r) =>
      r.code === code
        ? { ...r, specs: r.specs.map((sp) => (sp.specCode === specCode ? { ...sp, ...patch } : sp)) }
        : r
    ));
  };
  const setRecommendationDirty = (v: string) => { dirtyRef.current = true; setRecommendation(v); };

  useEffect(() => {
    if (readonly || !dirtyRef.current) return;
    const t = setTimeout(() => {
      if (dirtyRef.current && !save.isPending) { dirtyRef.current = false; save.mutate(undefined); }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, recommendation, readonly]);

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
    <div className="flex w-full flex-wrap items-start gap-6 px-4">
    <div data-testid="reader-report-editor" className="min-w-0 flex-1 py-6">
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
          {/* Toggle the "All comments" chat window docked on the right. */}
          <button
            data-testid="reader-report-comments-toggle"
            onClick={() => setCommentsOpen((v) => !v)}
            className={`inline-flex items-center gap-1 rounded border px-2.5 py-1.5 text-sm ${commentsOpen ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            title="Show or hide the all-comments chat window"
          >
            <MessageSquare className="h-4 w-4" />Comments
          </button>
          {/* View the COMPLETED report (official template filled with the
              reader's marks + comments) formatted in the browser. */}
          <button
            data-testid="reader-report-view"
            onClick={openViewer}
            disabled={viewLoading}
            className="inline-flex items-center gap-1 rounded border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-sm text-teal-800 hover:bg-teal-100 disabled:opacity-60"
            title="View your completed Reader Report (your marks + comments in the official template)"
          >
            {viewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}View report
          </button>
          {/* Download the COMPLETED report — the official template filled with
              the reader's checklist marks + comments (not a blank template). */}
          <button
            data-testid="reader-report-download"
            onClick={() => downloadGenerated('docx')}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            title="Download your completed Reader Report (your marks + comments filled into the official template)"
          >
            <Download className="h-4 w-4" />Download report (Word)
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
                · {roster.filter((x) => x.completedAt).length} of {roster.length} complete
              </span>
            )}
          </summary>
          <div className="border-t border-indigo-200 p-3">
            {/* The acceptance poll — tally of completed readers' votes. */}
            <div data-testid="rr-vote-tally" className="mb-3 flex flex-wrap gap-2">
              {VOTE_OPTIONS.map((o) => (
                <span key={o.value} className={`rounded-full border px-3 py-1 text-xs font-medium ${o.cls}`}>
                  {o.label}: <strong>{tally[o.value] || 0}</strong>
                </span>
              ))}
            </div>
            {listQuery.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-indigo-700"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
            ) : roster.length === 0 ? (
              <p className="text-sm text-indigo-700">No readers are assigned to this submission yet.</p>
            ) : (
              <ul className="divide-y divide-indigo-100">
                {roster.map((it) => {
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
                          {it.completedAt && it.acceptanceVote && (
                            <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 ring-1 ring-slate-200">Vote: {voteLabel(it.acceptanceVote)}</span>
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
        For each specification: click the AI assessment tag to see the AI's view, read the narrative and
        supporting evidence, fill the checklist (Compliant / Non-Compliant + Score) and add comments by
        selecting text. Your work autosaves; jump between comments with the navigator below.
      </p>

      {/* Comment navigator (prev/next across every specification). */}
      {currentUserId && (
        <div className="mb-4">
          <CommentNavigation
            submissionId={submissionId}
            currentPage={commentPage}
            onPageChange={setCommentPage}
            onNavigateToComment={navigateToComment}
          />
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.code} id={`rr-row-${r.code}`} data-testid={`rr-row-${r.code}`} className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Standard {r.code}: {r.title}</h2>

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

            {/* Each specification: its narrative + supporting evidence, with the
                official reader-report checklist (Compliant / Non-Compliant /
                Reader's Comments) right beside it — matching the template. */}
            {r.specs.map((sp) => (
              <div key={sp.specCode} id={`rr-spec-${r.code}-${sp.specCode}`} className="mb-4 scroll-mt-4 rounded border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-700">
                  <span className="rounded bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">{r.code}.{sp.specCode}</span>
                  <span>{sp.specTitle}</span>
                </h3>
                {/* Two columns: the specification's text on the LEFT, the reader's
                    checklist pinned ALONGSIDE on the RIGHT (sticky, so it stays in
                    view while reading the narrative + evidence). Stacks on narrow
                    screens. */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 lg:flex-1">
                    {/* FORMATTED narrative + evidence (tables/lists/links intact),
                        AND commentable in place: select text inside the table to
                        add a comment; commented text is highlighted right there,
                        so the marker/link sits ON the selected data, not on a tag
                        outside the table. */}
                    {(sp.narrativeHtml || sp.evidenceHtml) ? (
                      currentUserId ? (
                        <FormattedCommentable
                          submissionId={submissionId}
                          standardCode={r.code}
                          specCode={sp.specCode}
                          html={`${sp.narrativeHtml || ''}${sp.evidenceHtml ? `<p class="rr-evidence-label">Supporting evidence</p>${sp.evidenceHtml}` : ''}`}
                          comments={commentsForSpec(r.code, sp.specCode)}
                          currentUserRole={effectiveRole as any}
                          proseClassName={proseCls}
                          onCommentAdded={refreshComments}
                          highlightCommentId={highlightComment && highlightComment.std === r.code && highlightComment.spec === sp.specCode ? highlightComment.commentId : null}
                        />
                      ) : (
                        <div className={proseCls} dangerouslySetInnerHTML={{ __html: `${sp.narrativeHtml || ''}${sp.evidenceHtml || ''}` }} />
                      )
                    ) : (
                      <p className="text-sm italic text-slate-400">No narrative submitted.</p>
                    )}
                  </div>

                  {/* Checklist sidebar for THIS specification. */}
                  <div className="lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
                    <div data-testid={`rr-check-${r.code}-${sp.specCode}`} className="rounded-lg border-2 border-teal-300 bg-white shadow-sm">
                      <div className="rounded-t-md bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
                        Reader’s checklist — Specification {r.code}.{sp.specCode}
                      </div>
                      <div className="space-y-3 p-3">
                        <div className="flex items-center gap-5">
                          <label className={`inline-flex items-center gap-1.5 ${readonly ? '' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              data-testid={`rr-c-${r.code}-${sp.specCode}`}
                              disabled={readonly}
                              checked={sp.readerMark === 'compliant'}
                              onChange={() => setSpec(r.code, sp.specCode, { readerMark: sp.readerMark === 'compliant' ? '' : 'compliant' })}
                              className="h-4 w-4 text-emerald-600 disabled:opacity-60"
                              aria-label={`${r.code}.${sp.specCode} compliant`}
                            />
                            <span className="text-sm font-semibold text-emerald-700">Compliant</span>
                          </label>
                          <label className={`inline-flex items-center gap-1.5 ${readonly ? '' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              data-testid={`rr-n-${r.code}-${sp.specCode}`}
                              disabled={readonly}
                              checked={sp.readerMark === 'noncompliant'}
                              onChange={() => setSpec(r.code, sp.specCode, { readerMark: sp.readerMark === 'noncompliant' ? '' : 'noncompliant' })}
                              className="h-4 w-4 text-red-600 disabled:opacity-60"
                              aria-label={`${r.code}.${sp.specCode} non-compliant`}
                            />
                            <span className="text-sm font-semibold text-red-700">Non-Compliant</span>
                          </label>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor={`rr-comment-${r.code}-${sp.specCode}`}>
                            Reader’s Comments
                          </label>
                          <textarea
                            id={`rr-comment-${r.code}-${sp.specCode}`}
                            data-testid={`rr-comment-${r.code}-${sp.specCode}`}
                            value={sp.readerComment}
                            readOnly={readonly}
                            onChange={(e) => setSpec(r.code, sp.specCode, { readerComment: e.target.value })}
                            placeholder="Note missing information or the reason for a non-compliant decision; note strengths."
                            rows={5}
                            className={`w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-300 ${readonly ? 'bg-slate-50' : ''}`}
                          />
                        </div>
                        {/* Jump straight to this spec's files/links in the library
                            (CVs / syllabi / projects included) or the matrix. */}
                        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                          {(sp.evidenceCount || 0) > 0 && (
                            <button
                              data-testid={`rr-files-${r.code}-${sp.specCode}`}
                              onClick={() => navigate(`/self-study/${submissionId}?view=files&std=${r.code}&spec=${sp.specCode}`)}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                              title="Open this specification's files and links in the Supporting File Library"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />Files ({sp.evidenceCount})
                            </button>
                          )}
                          <button
                            data-testid={`rr-matrix-${r.code}-${sp.specCode}`}
                            onClick={() => navigate(`/self-study/${submissionId}?view=curriculum&std=${r.code}&spec=${sp.specCode}`)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            title="View this specification in the Curriculum Matrix"
                          >
                            <Grid3X3 className="h-3.5 w-3.5" />Matrix
                          </button>
                        </div>
                        {/* 0–3 rubric Score (same as the self-study reviewer score). */}
                        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2">
                          <span className="text-xs font-semibold text-slate-600">Score</span>
                          {(['-', 0, 1, 2, 3] as const).map((v) => {
                            const cur = scoreFor(r.code, sp.specCode);
                            const isClear = v === '-';
                            const active = !isClear && cur === v;
                            return (
                              <button
                                key={String(v)}
                                data-testid={`rr-score-${r.code}-${sp.specCode}-${v}`}
                                disabled={readonly || saveScore.isPending}
                                onClick={() => saveScore.mutate({ std: r.code, spec: sp.specCode, score: isClear ? null : (v as number) })}
                                className={`h-6 w-6 rounded text-xs font-semibold disabled:opacity-50 ${active ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                title={isClear ? 'Clear score' : `Score ${v}`}
                              >
                                {v}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Acceptance vote — the poll the lead reader tallies across readers. */}
      <div data-testid="rr-vote" className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Your vote on acceptance</h2>
        <div className="flex flex-wrap gap-2">
          {VOTE_OPTIONS.map((o) => {
            const active = acceptanceVote === o.value;
            return (
              <button
                key={o.value}
                data-testid={`rr-vote-${o.value}`}
                disabled={readonly}
                onClick={() => { dirtyRef.current = true; setAcceptanceVote(active ? '' : o.value); }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${active ? o.cls + ' ring-2 ring-offset-1' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">Recorded with your report; visible to the lead reader once you mark it complete.</p>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Recommendation to the Council</h2>
        <textarea
          data-testid="rr-recommendation"
          value={recommendation}
          onChange={(e) => setRecommendationDirty(e.target.value)}
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
              <h3 className="text-base font-semibold text-slate-900">Completed Reader Report (your marks + comments)</h3>
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

    {/* The "Chat window and all comments" — every comment from reader 1,
        reader 2 and the lead reader — as a sidebar COLUMN (like the self-study
        comment sidebar), not a floating overlay. Wraps below on narrow screens
        so it always stays on a visible part of the screen. */}
    {currentUserId && commentsOpen && (
      <div className="w-full shrink-0 py-6 lg:w-96">
        <AllCommentsDrawer
          submissionId={submissionId}
          currentUserRole={effectiveRole as any}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          onJump={navigateToComment}
        />
      </div>
    )}
    </div>
  );
}

export default ReaderReportEditor;

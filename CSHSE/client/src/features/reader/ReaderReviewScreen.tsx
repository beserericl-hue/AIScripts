import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Loader2, ChevronLeft, MessageSquare, Download } from 'lucide-react';
import { ReaderSpecRow } from './ReaderSpecRow';
import type { ScoreValue } from './Score4LevelSelector';
import { useOnceHint } from '../tour/useOnceHint';
import { t } from '../../i18n/strings';

// ---------------------------------------------------------------------------
// S3.2 — Reader review screen. Walks every (standard, spec) of the
// submission and mounts a ReaderSpecRow for each. The reader sees the
// PC's narrative, the AI verdict from CR-049, and the override/score
// affordances all in one scroll.
// ---------------------------------------------------------------------------

interface SubmissionPayload {
  _id: string;
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  status: string;
  narratives?: Record<string, Record<string, { content?: string; supportingEvidenceText?: string }>>;
  // getSubmission flattens the narratives Map into this array (the Map itself
  // does NOT serialize, so `narratives` comes back empty — read from here).
  narrativeContent?: Array<{ standardCode: string; specCode: string; content?: string; supportingEvidenceText?: string }>;
  standardsStatus?: Record<string, { excluded?: boolean; excludedReason?: string }>;
}

interface ReaderScores {
  // server returns: { scores: [{ standardCode, specCode, score, ... }] }
  scores: Array<{ standardCode: string; specCode: string; score: number }>;
}

export interface StandardSpec {
  code: string;
  specifications: Array<{ code: string }>;
}

export interface ReaderReviewScreenViewProps {
  submission: SubmissionPayload | null;
  standards: StandardSpec[];
  scoresByKey: Record<string, ScoreValue>;
  /** CR-009 follow-on / S11.3 — lead reader's Final score per spec, read-only. */
  finalScoresByKey?: Record<string, ScoreValue>;
  reportFiles?: { pdf?: { id: string; name: string }; docx?: { id: string; name: string } };
  canScore: boolean;
  canOverride: boolean;
  isLoading: boolean;
  error?: string | null;
}

export function ReaderReviewScreenView({
  submission,
  standards,
  scoresByKey,
  finalScoresByKey = {},
  reportFiles,
  canScore,
  canOverride,
  isLoading,
  error,
}: ReaderReviewScreenViewProps): JSX.Element {
  const downloadReport = React.useCallback(async (evidenceId: string, fileName: string) => {
    if (!submission) return;
    try {
      const resp = await api.get(
        `/api/submissions/${submission._id}/evidence/${evidenceId}/download`,
        { responseType: 'blob' }
      );
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName || 'Reader-Report';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      /* non-fatal — the button just no-ops if the file isn't ready */
    }
  }, [submission]);
  if (isLoading) {
    return (
      <div data-testid="reader-review-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading submission…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="reader-review-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load submission: {error}
      </div>
    );
  }
  if (!submission) {
    return (
      <div data-testid="reader-review-empty" className="m-6 rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        Submission not found.
      </div>
    );
  }

  // Build a per-spec narrative lookup from the flattened array.
  const narrativeByKey: Record<string, { content?: string; supportingEvidenceText?: string }> = {};
  for (const n of submission.narrativeContent || []) {
    narrativeByKey[`${n.standardCode}_${n.specCode}`] = { content: n.content, supportingEvidenceText: n.supportingEvidenceText };
  }

  return (
    <div data-testid="reader-review-screen" className="mx-auto max-w-4xl p-6">
      <Link to="/reader" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span>Back to review queue</span>
      </Link>
      <header className="mb-4 flex items-start justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{submission.institutionName}</h1>
          <p className="text-sm text-slate-600">
            {submission.programName} <span className="text-slate-400">·</span>{' '}
            <span className="uppercase">{submission.programLevel}</span> <span className="text-slate-400">·</span>{' '}
            {submission.submissionId}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Reader Report — download the compiled self-study + AI verdicts
              (official CSHSE template). DOCX is editable; PDF is the snapshot. */}
          {reportFiles?.pdf && (
            <button
              type="button"
              data-testid="reader-report-pdf"
              onClick={() => downloadReport(reportFiles.pdf!.id, reportFiles.pdf!.name)}
              className="inline-flex items-center gap-1 rounded border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-100"
              title="Download the Reader Report (PDF)"
            >
              <Download className="h-4 w-4" aria-hidden />
              <span>Reader Report (PDF)</span>
            </button>
          )}
          {reportFiles?.docx && (
            <button
              type="button"
              data-testid="reader-report-docx"
              onClick={() => downloadReport(reportFiles.docx!.id, reportFiles.docx!.name)}
              className="inline-flex items-center gap-1 rounded border border-teal-300 bg-white px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50"
              title="Download the editable Reader Report (Word)"
            >
              <Download className="h-4 w-4" aria-hidden />
              <span>Word (editable)</span>
            </button>
          )}
          {/* CR-010 / S12.2 — Messages reachable from the reader workspace. */}
          <Link
            to={`/messages/${submission._id}`}
            data-testid="reader-messages-link"
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
            <span>Messages</span>
          </Link>
        </div>
      </header>

      <div className="space-y-4">
        {standards.map((std) => (
          <div key={std.code}>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Standard {std.code}</h2>
            <div className="space-y-2">
              {std.specifications.map((spec) => {
                const key = `${std.code}_${spec.code}`;
                const status = submission.standardsStatus?.[key];
                // Prefer the flattened narrativeContent array (the nested
                // `narratives` Map doesn't serialize and comes back empty).
                const narrative = narrativeByKey[key] || submission.narratives?.[std.code]?.[spec.code];
                return (
                  <ReaderSpecRow
                    key={key}
                    submissionId={submission._id}
                    standardCode={std.code}
                    specCode={spec.code}
                    narrativeHtml={narrative?.content}
                    evidenceText={narrative?.supportingEvidenceText}
                    excluded={status?.excluded === true}
                    excludedReason={status?.excludedReason}
                    canScore={canScore && !status?.excluded}
                    canOverride={canOverride && !status?.excluded}
                    initialScore={(scoresByKey[key] ?? null) as ScoreValue | null}
                    finalScore={(finalScoresByKey[key] ?? null) as ScoreValue | null}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ReaderReviewScreenProps {
  /** Role of the current viewer; controls capability flags. */
  userRole: 'reader' | 'lead_reader' | 'admin' | 'program_coordinator' | undefined;
}

export function ReaderReviewScreen({ userRole }: ReaderReviewScreenProps): JSX.Element {
  const { submissionId = '' } = useParams<{ submissionId: string }>();

  const submissionQuery = useQuery({
    queryKey: ['reader-submission', submissionId],
    queryFn: async () => {
      // getSubmission spreads the submission at the top level of the
      // response (not under `submission`), so read it directly.
      const r = await api.get(`/api/submissions/${submissionId}`);
      return r.data as SubmissionPayload;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  // Standards + specifications — the SAME source the PC editor uses
  // (`/api/standards` returns the CSHSE-defined 21 standards with their specs
  // directly). The old `/api/specs?status=active` path returned Spec documents
  // WITHOUT a `.standards` array (only standardsCount) and picked specs[0]
  // (the Master's set), so `standards` came back empty and the reader screen
  // rendered a blank body below the header.
  const specsQuery = useQuery({
    queryKey: ['standards'],
    queryFn: async () => {
      const r = await api.get('/api/standards');
      const raw = Array.isArray(r.data) ? r.data : (r.data?.standards || []);
      return raw.map((s: any) => ({
        code: String(s.code ?? s.standardCode),
        specifications: (s.specifications || []).map((sp: any) => ({ code: String(sp.code ?? sp.specCode) })),
      })) as StandardSpec[];
    },
    refetchOnWindowFocus: false,
  });

  // Reader Report files (PDF + editable DOCX) from the Supporting File Library,
  // so the reader can download/view them right from the review screen.
  const reportQuery = useQuery({
    queryKey: ['reader-report-files', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/evidence`);
      const items: any[] = r.data?.evidence || r.data?.items || (Array.isArray(r.data) ? r.data : []);
      const pick = (tag: string) => {
        const it = items.find((i) => (i.tags || []).includes(tag));
        return it ? { id: it._id as string, name: (it.file?.originalName as string) || 'Reader Report' } : undefined;
      };
      return { pdf: pick('reader-report:pdf'), docx: pick('reader-report:docx') };
    },
    enabled: !!submissionId,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const scoresQuery = useQuery({
    queryKey: ['reader-scores', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/scores`);
      return r.data as ReaderScores;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  // CR-009 follow-on / S11.3 — the lead reader's Final score per spec, shown
  // read-only to readers (transparency default). Peers' raw votes are NOT
  // returned by this endpoint.
  const finalScoresQuery = useQuery({
    queryKey: ['reader-final-scores', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/final-scores`);
      return (r.data?.rows || []) as Array<{ standardCode: string; specCode: string; finalScore: number }>;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
    // A reader without an active assignment 403s here — never surface that
    // as a page-level error; the chips just stay hidden.
    retry: false,
  });

  const scoresByKey: Record<string, ScoreValue> = {};
  for (const s of scoresQuery.data?.scores || []) {
    scoresByKey[`${s.standardCode}_${s.specCode}`] = s.score as ScoreValue;
  }

  const finalScoresByKey: Record<string, ScoreValue> = {};
  for (const f of finalScoresQuery.data || []) {
    finalScoresByKey[`${f.standardCode}_${f.specCode}`] = f.finalScore as ScoreValue;
  }

  const canScore = userRole === 'reader' || userRole === 'lead_reader';
  const canOverride = canScore || userRole === 'admin';

  // CR-052 / S12.3 — first time a reader can score on this screen, nudge them
  // on what the 0-3 scale means, anchored to the first spec's score selector.
  const { fireOnce } = useOnceHint();
  const standards = specsQuery.data ?? [];
  const firstSpec = standards[0]?.specifications?.[0];
  const firstAnchorId = firstSpec ? `score-selector-${standards[0].code}-${firstSpec.code}` : undefined;
  React.useEffect(() => {
    if (!canScore || !submissionQuery.data || !firstAnchorId) return;
    fireOnce({
      id: 'reader-first-score',
      message: t('hint.reader.firstScore'),
      targetId: firstAnchorId,
    });
  }, [canScore, submissionQuery.data, firstAnchorId, fireOnce]);

  const isLoading = submissionQuery.isLoading || specsQuery.isLoading;
  const error = submissionQuery.error
    ? (submissionQuery.error as Error).message
    : specsQuery.error
      ? (specsQuery.error as Error).message
      : null;

  return (
    <ReaderReviewScreenView
      submission={submissionQuery.data ?? null}
      standards={standards}
      scoresByKey={scoresByKey}
      finalScoresByKey={finalScoresByKey}
      reportFiles={reportQuery.data}
      canScore={canScore}
      canOverride={canOverride}
      isLoading={isLoading}
      error={error}
    />
  );
}

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Loader2, ChevronLeft, MessageSquare } from 'lucide-react';
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
  canScore,
  canOverride,
  isLoading,
  error,
}: ReaderReviewScreenViewProps): JSX.Element {
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
        {/* CR-010 / S12.2 — Messages reachable from the reader workspace. */}
        <Link
          to={`/messages/${submission._id}`}
          data-testid="reader-messages-link"
          className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          <span>Messages</span>
        </Link>
      </header>

      <div className="space-y-4">
        {standards.map((std) => (
          <div key={std.code}>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Standard {std.code}</h2>
            <div className="space-y-2">
              {std.specifications.map((spec) => {
                const key = `${std.code}_${spec.code}`;
                const status = submission.standardsStatus?.[key];
                const narrative = submission.narratives?.[std.code]?.[spec.code];
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

  // Active spec list — reuses the existing /api/specs?status=active endpoint
  // the rest of the app uses (returns the CSHSE-defined standards + their
  // specifications).
  const specsQuery = useQuery({
    queryKey: ['active-specs'],
    queryFn: async () => {
      const r = await api.get('/api/specs', { params: { status: 'active' } });
      // The Spec model carries .standards; normalize to {code, specifications}.
      const spec = r.data?.specs?.[0];
      const raw = spec?.standards || [];
      return raw.map((s: any) => ({
        code: String(s.code ?? s.standardCode),
        specifications: (s.specifications || []).map((sp: any) => ({ code: String(sp.code ?? sp.specCode) })),
      })) as StandardSpec[];
    },
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
      canScore={canScore}
      canOverride={canOverride}
      isLoading={isLoading}
      error={error}
    />
  );
}

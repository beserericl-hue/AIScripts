import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Ban } from 'lucide-react';
import { Score4LevelSelector, type ScoreValue } from './Score4LevelSelector';
import { ReaderOverrideControl, type OverrideVerdict } from './ReaderOverrideControl';

// ---------------------------------------------------------------------------
// S3.2 + S3.4 — Per-spec review surface.
//
// One row composes:
//   - The spec's narrative + supporting-evidence text (read-only summary).
//   - The CR-049 AI verdict + rationale + per-link "needs-human-review"
//     warnings (the reader can open the link in a new tab to inspect).
//   - The reader's 0-3 score (CR-003) — persists to `Score` per reviewer.
//   - The reader's override of the AI verdict (CR-049 Phase 4b) — closes
//     the learning loop by sending the section_eval_override to Qdrant.
//
// Excluded (N/A) specs (CR-050) render an "intentionally omitted" chip
// and skip the AI verdict / score affordances.
// ---------------------------------------------------------------------------

const VERDICT_META = {
  pass: { label: 'Pass', cls: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle2 },
  needs_improvement: {
    label: 'Needs improvement',
    cls: 'bg-amber-100 text-amber-800 border-amber-300',
    Icon: AlertTriangle,
  },
  fail: { label: 'Fail', cls: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
} as const;

export interface SpecEvaluationLite {
  verdict?: OverrideVerdict;
  rationale?: string;
  feedback?: string;
  readerOverridden?: boolean;
  // The reader-report links surfaced by CR-049 — only "needs review"
  // links matter at this layer (the reader opens them manually).
  linksNeedingReview?: string[];
}

export interface ReaderSpecRowViewProps {
  standardCode: string;
  specCode: string;
  narrativeHtml?: string;
  evidenceText?: string;
  evaluation?: SpecEvaluationLite | null;
  excluded?: boolean;
  excludedReason?: string;
  score: ScoreValue | null;
  onScoreChange: (next: ScoreValue) => void;
  scoreSaving?: boolean;
  canScore: boolean;
  canOverride: boolean;
  submissionId: string;
}

export function ReaderSpecRowView(props: ReaderSpecRowViewProps): JSX.Element {
  const {
    standardCode,
    specCode,
    narrativeHtml,
    evidenceText,
    evaluation,
    excluded,
    excludedReason,
    score,
    onScoreChange,
    scoreSaving,
    canScore,
    canOverride,
    submissionId,
  } = props;
  const verdict = evaluation?.verdict;
  const meta = verdict ? VERDICT_META[verdict] : null;

  return (
    <section
      data-testid={`reader-spec-row-${standardCode}-${specCode}`}
      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Standard {standardCode}.{specCode}
        </h3>
        {excluded ? (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            <Ban className="h-3 w-3" aria-hidden />
            <span>Marked Not Applicable</span>
          </span>
        ) : meta ? (
          <span className={['inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs', meta.cls].join(' ')}>
            <meta.Icon className="h-3 w-3" aria-hidden />
            <span>{meta.label}</span>
            {evaluation?.readerOverridden ? <span className="ml-1 opacity-70">(reader)</span> : null}
          </span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Not yet evaluated</span>
        )}
      </header>

      {excluded ? (
        <p className="text-sm text-slate-600">
          {excludedReason ? excludedReason : 'The program coordinator marked this spec not applicable.'}
        </p>
      ) : (
        <>
          {narrativeHtml ? (
            <div
              data-testid="reader-narrative"
              className="prose prose-sm max-w-none rounded border border-slate-100 bg-slate-50 p-2 text-slate-800"
              dangerouslySetInnerHTML={{ __html: narrativeHtml }}
            />
          ) : (
            <p className="text-xs italic text-slate-500">No narrative submitted.</p>
          )}
          {evidenceText ? (
            <p className="mt-2 text-xs text-slate-600">
              <span className="font-medium">Supporting evidence:</span> {evidenceText}
            </p>
          ) : null}
          {evaluation?.rationale ? (
            <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700">
              <span className="font-medium">AI rationale: </span>
              {evaluation.rationale}
            </p>
          ) : null}
          {evaluation?.linksNeedingReview?.length ? (
            <div data-testid="reader-link-review" className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs">
              <p className="mb-1 font-medium text-amber-900">Links that need your human review:</p>
              <ul className="space-y-0.5">
                {evaluation.linksNeedingReview.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-amber-800 underline hover:text-amber-900"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canScore ? (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-slate-700">Your compliance score</p>
              <Score4LevelSelector value={score} onChange={onScoreChange} saving={scoreSaving} />
            </div>
          ) : null}

          {canOverride ? (
            <div className="mt-3">
              <ReaderOverrideControl
                submissionId={submissionId}
                standardCode={standardCode}
                specCode={specCode}
                current={evaluation?.verdict ?? null}
                readerOverridden={!!evaluation?.readerOverridden}
                canOverride
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export interface ReaderSpecRowProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  narrativeHtml?: string;
  evidenceText?: string;
  excluded?: boolean;
  excludedReason?: string;
  /** Reader-side capability flags. PC viewers get neither. */
  canScore: boolean;
  canOverride: boolean;
  /** Initial score the reader has previously persisted; null if unscored. */
  initialScore: ScoreValue | null;
}

export function ReaderSpecRow(props: ReaderSpecRowProps): JSX.Element {
  const { submissionId, standardCode, specCode } = props;
  const qc = useQueryClient();
  const [score, setScore] = React.useState<ScoreValue | null>(props.initialScore);

  // Hydrate score if the parent props reset (different spec, score cleared).
  React.useEffect(() => {
    setScore(props.initialScore);
  }, [props.initialScore]);

  const evalQuery = useQuery({
    queryKey: ['spec-evaluation', submissionId, standardCode, specCode],
    queryFn: async () => {
      const r = await api.get(
        `/api/submissions/${submissionId}/standards/${standardCode}/specs/${specCode}/evaluation`
      );
      return (r.data?.evaluation ?? null) as SpecEvaluationLite | null;
    },
    enabled: !props.excluded,
    refetchOnWindowFocus: false,
  });

  const scoreMutation = useMutation({
    mutationFn: async (next: ScoreValue) => {
      return api.put(`/api/submissions/${submissionId}/scores`, {
        standardCode,
        specCode,
        score: next,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reader-scores', submissionId] });
    },
  });

  const handleScoreChange = (next: ScoreValue) => {
    setScore(next);
    scoreMutation.mutate(next);
  };

  return (
    <ReaderSpecRowView
      standardCode={standardCode}
      specCode={specCode}
      submissionId={submissionId}
      narrativeHtml={props.narrativeHtml}
      evidenceText={props.evidenceText}
      excluded={props.excluded}
      excludedReason={props.excludedReason}
      evaluation={evalQuery.data ?? null}
      score={score}
      onScoreChange={handleScoreChange}
      scoreSaving={scoreMutation.isPending}
      canScore={props.canScore}
      canOverride={props.canOverride}
    />
  );
}

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Ban, Sparkles } from 'lucide-react';
import { Score4LevelSelector, type ScoreValue } from './Score4LevelSelector';
import { ReaderOverrideControl, type OverrideVerdict } from './ReaderOverrideControl';
import { EvidenceRecommendations } from './EvidenceRecommendations';

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
  /** CR-009 follow-on / S11.3 — lead reader's Final score; null if unset. */
  finalScore?: ScoreValue | null;
  submissionId: string;
}

// CR-003 / CR-009 — shared 0-3 rubric labels for the read-only Final chip.
const SCORE_LABELS: Record<number, string> = {
  0: 'Non-compliant',
  1: 'Partial',
  2: 'Largely compliant',
  3: 'Fully compliant',
};

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
    finalScore,
    submissionId,
  } = props;
  const verdict = evaluation?.verdict;
  const meta = verdict ? VERDICT_META[verdict] : null;

  // Shared rendered-content styling — matches the PC self-study editor's reading
  // size (prose-base) and renders tables/links with structure instead of a wall
  // of raw HTML.
  const proseCls =
    'prose prose-base max-w-none text-slate-800 ' +
    '[&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
    '[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 ' +
    '[&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top ' +
    '[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold ' +
    '[&_a]:text-teal-700 [&_a]:underline';

  return (
    <section
      data-testid={`reader-spec-row-${standardCode}-${specCode}`}
      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
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
              className={`rounded border border-slate-100 bg-slate-50 p-3 ${proseCls}`}
              dangerouslySetInnerHTML={{ __html: narrativeHtml }}
            />
          ) : (
            <p className="text-sm italic text-slate-500">No narrative submitted.</p>
          )}
          {evidenceText ? (
            <div data-testid="reader-evidence" className="mt-3">
              <p className="mb-1 text-sm font-semibold text-slate-700">Supporting evidence</p>
              {/* Program-authored HTML (same trust model as the narrative) —
                  render it, don't print the tags. */}
              <div
                className={`rounded border border-slate-100 bg-white p-3 ${proseCls}`}
                dangerouslySetInnerHTML={{ __html: evidenceText }}
              />
            </div>
          ) : null}
          {evaluation?.rationale ? (
            <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-700">
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
              <Score4LevelSelector
                value={score}
                onChange={onScoreChange}
                saving={scoreSaving}
                anchorId={`score-selector-${standardCode}-${specCode}`}
              />
            </div>
          ) : null}

          {/* CR-009 follow-on / S11.3 — read-only Final score the lead reader
              set on this spec. Transparency default: readers see the Final
              verdict (not their peers' individual votes). */}
          {finalScore !== null && finalScore !== undefined ? (
            <div
              data-testid={`reader-final-score-${standardCode}-${specCode}`}
              className="mt-3 inline-flex items-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-900"
            >
              <span className="font-medium">Lead reader final score:</span>
              <span className="rounded bg-white px-1.5 py-0.5 font-semibold">
                {finalScore} — {SCORE_LABELS[finalScore] ?? 'Unknown'}
              </span>
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

          {/* CR-018 Sprint 4.1 finish — lazy reader-side evidence
              recommendations. Reader expands the panel; the request
              only fires once they ask. Renders "No recommendations
              available." on 502 / empty so the row stays calm if
              ai-service or Qdrant is unavailable. */}
          <EvidenceRecommendationsPanel
            submissionId={submissionId}
            standardCode={standardCode}
            specCode={specCode}
          />
        </>
      )}
    </section>
  );
}

interface EvidenceRecommendationsPanelProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
}

function EvidenceRecommendationsPanel({
  submissionId,
  standardCode,
  specCode,
}: EvidenceRecommendationsPanelProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid={`evrec-toggle-${standardCode}-${specCode}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-800 hover:bg-indigo-50"
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        <span>{open ? 'Hide recommended evidence' : 'Show recommended evidence'}</span>
      </button>
      {open && (
        <EvidenceRecommendations
          submissionId={submissionId}
          standardCode={standardCode}
          specCode={specCode}
          enabled={open}
        />
      )}
    </div>
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
  /** CR-009 follow-on / S11.3 — lead reader's Final score, read-only. */
  finalScore?: ScoreValue | null;
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
      finalScore={props.finalScore ?? null}
    />
  );
}

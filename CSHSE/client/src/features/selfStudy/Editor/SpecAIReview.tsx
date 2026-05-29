import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { CheckCircle2, AlertTriangle, XCircle, Sparkles, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-049 Phase 3 — "AI Review" panel for the selected spec in the Self-Study
// editor. Shows the latest AI verdict (pass / needs improvement / fail) +
// rationale + improvement suggestions, with a "Run AI Review" button (PC).
// Pure view (SpecAIReviewView) is unit-tested; the container wires queries.
// ---------------------------------------------------------------------------

export interface SpecEvaluation {
  status?: string;
  verdict?: 'pass' | 'needs_improvement' | 'fail';
  rationale?: string;
  feedback?: string;
  missingElements?: string[];
  criteriaCoverage?: Array<{ criterion: string; met: boolean; note?: string }>;
}

const VERDICT_META: Record<
  string,
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  pass: { label: 'Pass', cls: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle2 },
  needs_improvement: {
    label: 'Needs improvement',
    cls: 'bg-amber-100 text-amber-800 border-amber-300',
    Icon: AlertTriangle,
  },
  fail: { label: 'Fail', cls: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
};

export function SpecAIReviewView({
  evaluation,
  isLoading,
  isEvaluating,
  canEvaluate,
  onEvaluate,
}: {
  evaluation: SpecEvaluation | null;
  isLoading: boolean;
  isEvaluating: boolean;
  canEvaluate: boolean;
  onEvaluate: () => void;
}): JSX.Element {
  const verdict = evaluation?.verdict;
  const meta = verdict ? VERDICT_META[verdict] : null;
  const suggestions = evaluation?.missingElements ?? [];

  return (
    <section
      data-testid="spec-ai-review"
      className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-gray-900">AI Review</h3>
          {meta && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
              <meta.Icon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
          )}
        </div>
        {canEvaluate && (
          <button
            type="button"
            onClick={onEvaluate}
            disabled={isEvaluating}
            data-testid="run-ai-review"
            className="flex items-center gap-1.5 rounded-md border border-primary-300 px-3 py-1 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isEvaluating ? 'Reviewing…' : 'Run AI Review'}
          </button>
        )}
      </div>

      <div className="mt-3 text-sm">
        {isLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : !evaluation || !verdict ? (
          <p className="text-gray-500">
            Not yet reviewed. {canEvaluate ? 'Run an AI review to check this section against the reader criteria.' : ''}
          </p>
        ) : (
          <div className="space-y-3">
            {evaluation.rationale && (
              <p className="text-gray-700 whitespace-pre-wrap">{evaluation.rationale}</p>
            )}
            {suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Suggestions to improve
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {evaluation.criteriaCoverage && evaluation.criteriaCoverage.length > 0 && (
              <ul className="space-y-1">
                {evaluation.criteriaCoverage.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    {c.met ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <span>
                      {c.criterion}
                      {c.note ? <span className="text-gray-500"> — {c.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function SpecAIReview({
  submissionId,
  standardCode,
  specCode,
  canEvaluate,
}: {
  submissionId: string;
  standardCode: string;
  specCode: string;
  canEvaluate: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const key = ['spec-evaluation', submissionId, standardCode, specCode];

  const { data, isLoading } = useQuery<SpecEvaluation | null>({
    queryKey: key,
    queryFn: async () => {
      const res = await api.get(
        `/api/submissions/${submissionId}/standards/${standardCode}/specs/${specCode}/evaluation`
      );
      return res.data?.evaluation ?? null;
    },
  });

  const evaluate = useMutation({
    mutationFn: async () => {
      const res = await api.post(
        `/api/submissions/${submissionId}/standards/${standardCode}/specs/${specCode}/evaluate`
      );
      return res.data?.evaluation ?? null;
    },
    onSuccess: (evaluation) => {
      queryClient.setQueryData(key, evaluation);
    },
  });

  return (
    <SpecAIReviewView
      evaluation={data ?? null}
      isLoading={isLoading}
      isEvaluating={evaluate.isPending}
      canEvaluate={canEvaluate}
      onEvaluate={() => evaluate.mutate()}
    />
  );
}

export default SpecAIReview;

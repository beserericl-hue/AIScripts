import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

// ---------------------------------------------------------------------------
// CR-018 / Sprint 4.1 finish — reader-side evidence recommendations.
//
// Mounts under each ReaderSpecRow when the reader clicks "Show
// recommended evidence." Fetches the top-K chunks from the per-env
// `cshse_evidence_{env}` Qdrant collection via the new server endpoint
// (which scopes by institutionId + submissionId — the cross-institution
// isolation audit Gap 2 boundary).
//
// Fail-softs: if the server returns 502 (ai-service / Qdrant down), the
// reader sees a single small line "No recommendations available." with
// no scary error. If no chunks come back, same message.
// ---------------------------------------------------------------------------

export interface EvidenceChunk {
  score: number;
  chunkId?: string;
  payload?: Record<string, unknown> | null;
}

export interface EvidenceRecommendationsViewProps {
  chunks: EvidenceChunk[];
  isLoading: boolean;
  error?: string | null;
}

function previewText(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '(no preview)';
  const text =
    (payload.text as string | undefined) ||
    (payload.snippet as string | undefined) ||
    (payload.body as string | undefined) ||
    '';
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

function sourceLabel(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '';
  return (
    (payload.filename as string | undefined) ||
    (payload.documentTitle as string | undefined) ||
    (payload.source as string | undefined) ||
    ''
  );
}

export function EvidenceRecommendationsView({
  chunks,
  isLoading,
  error,
}: EvidenceRecommendationsViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="evrec-loading" className="flex items-center gap-2 p-2 text-xs text-slate-600">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        <span>Looking for related evidence…</span>
      </div>
    );
  }
  if (error || chunks.length === 0) {
    return (
      <p data-testid="evrec-empty" className="px-2 py-1 text-xs text-slate-500">
        No recommendations available.
      </p>
    );
  }
  return (
    <div data-testid="evrec" className="mt-2 rounded border border-indigo-100 bg-indigo-50/40 p-2">
      <header className="mb-1 flex items-center gap-1 text-xs font-medium text-indigo-900">
        <Sparkles className="h-3 w-3" aria-hidden />
        <span>Related evidence ({chunks.length})</span>
      </header>
      <ul className="space-y-1">
        {chunks.map((c, i) => {
          const src = sourceLabel(c.payload);
          return (
            <li
              key={c.chunkId ?? `ev-${i}`}
              data-testid={`evrec-chunk-${i}`}
              className="rounded border border-indigo-100 bg-white px-2 py-1 text-xs"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] text-indigo-700">
                  match {Math.round(c.score * 100)}%
                </span>
                {src && <span className="text-[10px] text-slate-500">· {src}</span>}
              </div>
              <p className="mt-1 text-slate-800">{previewText(c.payload)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface EvidenceRecommendationsProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  /** Lazy-fetch: only fires when this is true. */
  enabled: boolean;
  topK?: number;
}

export function EvidenceRecommendations({
  submissionId,
  standardCode,
  specCode,
  enabled,
  topK = 5,
}: EvidenceRecommendationsProps): JSX.Element {
  const query = useQuery({
    queryKey: ['evidence-recommendations', submissionId, standardCode, specCode, topK],
    queryFn: async () => {
      const r = await api.get(
        `/api/submissions/${submissionId}/specs/${standardCode}/${specCode}/evidence-recommendations`,
        { params: { topK } }
      );
      return (r.data?.chunks || []) as EvidenceChunk[];
    },
    enabled: !!submissionId && enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return (
    <EvidenceRecommendationsView
      chunks={query.data || []}
      isLoading={query.isLoading}
      error={query.error ? (query.error as Error).message : null}
    />
  );
}

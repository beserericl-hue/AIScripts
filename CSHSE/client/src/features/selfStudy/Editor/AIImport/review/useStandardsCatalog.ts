/**
 * useStandardsCatalog — one shared fetch of the CSHSE standards catalog for
 * the Review wizard's spec-assignment dropdowns (CV rail + Evidence-Docs rail).
 *
 * The Review surface renders many cards, each with a Standard + Spec dropdown.
 * Fetching `/api/standards` per card would be wasteful, so this module caches
 * the in-flight promise + the parsed result at module scope: the first hook to
 * mount triggers the fetch, every other hook reuses it. The shape matches what
 * StandaloneCVReview already consumes (std / title / specsForStd).
 */
import { useEffect, useState } from 'react';
import { api } from '../../../../../services/api';

export type SpecOption = {
  std: string;
  title: string;
  specsForStd: Array<{ spec: string; title: string }>;
};

let _cache: SpecOption[] | null = null;
let _inflight: Promise<SpecOption[]> | null = null;

function fetchCatalog(): Promise<SpecOption[]> {
  if (_cache) return Promise.resolve(_cache);
  if (_inflight) return _inflight;
  _inflight = api
    .get('/api/standards')
    .then((res) => {
      const parsed: SpecOption[] = (res.data || []).map((s: any) => ({
        std: s.code,
        title: s.title,
        specsForStd: (s.specifications || []).map((spec: any) => ({
          spec: spec.code,
          title: spec.title || ''
        }))
      }));
      _cache = parsed;
      return parsed;
    })
    .finally(() => {
      _inflight = null;
    });
  return _inflight;
}

export function useStandardsCatalog(): {
  standards: SpecOption[];
  error: string | null;
} {
  const [standards, setStandards] = useState<SpecOption[]>(_cache ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (_cache) {
      setStandards(_cache);
      return;
    }
    let cancelled = false;
    fetchCatalog()
      .then((parsed) => {
        if (!cancelled) setStandards(parsed);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'failed to load standards');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { standards, error };
}

/** Test seam — reset the module cache between unit tests. */
export function __resetStandardsCatalogCache(): void {
  _cache = null;
  _inflight = null;
}

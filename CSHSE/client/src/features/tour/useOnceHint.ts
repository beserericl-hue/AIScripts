import React from 'react';
import { useHint, Hint } from './HintProvider';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 9.3 — first-time-only hint wrapper.
//
// HintProvider is pure in-memory and dedupes only within a session. Some
// per-feature nudges should fire the FIRST time a user reaches a feature and
// never again, even across reloads. This wraps useHint() with a localStorage
// "seen" ledger keyed by hint id. Storage is fail-soft (private mode / quota
// throws are swallowed) — worst case the hint shows again, never a crash.
// ---------------------------------------------------------------------------

const SEEN_PREFIX = 'cshse:hint-seen:';

export function hintSeenKey(id: string): string {
  return `${SEEN_PREFIX}${id}`;
}

export function hasSeenHint(id: string): boolean {
  try {
    return window.localStorage.getItem(hintSeenKey(id)) === '1';
  } catch {
    return false;
  }
}

export function markHintSeen(id: string): void {
  try {
    window.localStorage.setItem(hintSeenKey(id), '1');
  } catch {
    /* storage unavailable — fail soft */
  }
}

export interface UseOnceHint {
  /** Show the hint once ever (per browser); no-op if already seen. */
  fireOnce: (hint: Hint) => void;
  /** Clear the "seen" mark so the hint can fire again (used by tests/dev). */
  reset: (id: string) => void;
}

export function useOnceHint(): UseOnceHint {
  const { showHint } = useHint();

  const fireOnce = React.useCallback(
    (hint: Hint) => {
      if (hasSeenHint(hint.id)) return;
      markHintSeen(hint.id);
      showHint(hint);
    },
    [showHint]
  );

  const reset = React.useCallback((id: string) => {
    try {
      window.localStorage.removeItem(hintSeenKey(id));
    } catch {
      /* fail soft */
    }
  }, []);

  return { fireOnce, reset };
}

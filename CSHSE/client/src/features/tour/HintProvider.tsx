import React from 'react';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — HintProvider.
//
// Programmatic transient nudges (~tooltips) anchored to UI elements by
// DOM id. Pure in-memory; never persisted. Independent of TourProvider —
// can be mounted alone for features that just want hints.
//
// Public surface (via useHint()):
//   showHint(hint)   — dedupes by id (no-op if a hint with that id is
//                      already active).
//   dismissHint(id)  — removes from the active list.
//   hasHint(id)      — boolean.
//   getHint(id)      — Hint | undefined.
//
// A `<HintLayer />` consumes `activeHints` and renders one `<HintBalloon>`
// per hint, anchored to `getElementById(targetId)`. See HintLayer.tsx.
// ---------------------------------------------------------------------------

export interface Hint {
  id: string;
  message: string;
  /** Id of the DOM element the balloon visually anchors to. */
  targetId?: string;
}

export interface HintContextValue {
  activeHints: Hint[];
  showHint: (hint: Hint) => void;
  dismissHint: (id: string) => void;
  hasHint: (id: string) => boolean;
  getHint: (id: string) => Hint | undefined;
}

const HintContext = React.createContext<HintContextValue | null>(null);

export interface HintProviderProps {
  children: React.ReactNode;
}

export function HintProvider({ children }: HintProviderProps): JSX.Element {
  const [activeHints, setActiveHints] = React.useState<Hint[]>([]);

  const hasHint = React.useCallback(
    (id: string) => activeHints.some((h) => h.id === id),
    [activeHints]
  );

  const getHint = React.useCallback(
    (id: string) => activeHints.find((h) => h.id === id),
    [activeHints]
  );

  const showHint = React.useCallback((hint: Hint) => {
    setActiveHints((prev) => {
      if (prev.some((h) => h.id === hint.id)) return prev; // dedup
      return [...prev, hint];
    });
  }, []);

  const dismissHint = React.useCallback((id: string) => {
    setActiveHints((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const value: HintContextValue = React.useMemo(
    () => ({ activeHints, showHint, dismissHint, hasHint, getHint }),
    [activeHints, showHint, dismissHint, hasHint, getHint]
  );

  return <HintContext.Provider value={value}>{children}</HintContext.Provider>;
}

export function useHint(): HintContextValue {
  const ctx = React.useContext(HintContext);
  if (!ctx) {
    throw new Error('useHint() must be used within a <HintProvider>');
  }
  return ctx;
}

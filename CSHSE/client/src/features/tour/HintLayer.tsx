import React from 'react';
import { useHint } from './HintProvider';
import { HintBalloon } from './HintBalloon';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — HintLayer.
//
// Walks `activeHints` from the HintProvider context and renders one
// HintBalloon per hint. Positions each balloon next to its `targetId`
// element via getBoundingClientRect (falls back to a centered overlay
// when the target is missing or unmounted).
//
// Re-measures positions on window resize so the balloon tracks layout
// shifts. Lightweight pure-DOM positioning; no portal library.
// ---------------------------------------------------------------------------

interface AnchoredPosition {
  top: number;
  left: number;
}

function measureTarget(targetId?: string): AnchoredPosition | null {
  if (!targetId) return null;
  const el = document.getElementById(targetId);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  // Position the balloon just below the target, left-aligned to it.
  // Caller clamps to viewport via inline maxWidth (see HintBalloon).
  return {
    top: rect.bottom + 8,
    left: Math.max(8, rect.left),
  };
}

export function HintLayer(): JSX.Element | null {
  const { activeHints, dismissHint } = useHint();
  // Recompute positions on resize so the balloons follow the target.
  const [_tick, setTick] = React.useState(0);
  React.useEffect(() => {
    function onResize() {
      setTick((n) => n + 1);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, []);

  if (activeHints.length === 0) return null;

  return (
    <div data-testid="hint-layer" className="pointer-events-none fixed inset-0">
      {activeHints.map((hint) => {
        const measured = measureTarget(hint.targetId);
        const positionStyle: React.CSSProperties = measured
          ? { position: 'fixed', top: measured.top, left: measured.left }
          : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
        return (
          <HintBalloon
            key={hint.id}
            hint={hint}
            onDismiss={dismissHint}
            positionStyle={positionStyle}
          />
        );
      })}
    </div>
  );
}

import React from 'react';
import { X } from 'lucide-react';
import { TOUR_THEME } from './tourTheme';
import { t } from '../../i18n/strings';
import type { Hint } from './HintProvider';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — HintBalloon.
//
// Pure visual component:
//   - 300ms enter / exit transitions
//   - auto-dismiss after 8s (clears the timer on unmount)
//   - click-outside dismisses
//   - role="status" + aria-live="polite" for accessibility
//
// Position is computed by the parent (HintLayer) and passed as inline
// styles so the balloon stays anchored to the target's bounding box.
// ---------------------------------------------------------------------------

const AUTO_DISMISS_MS = 8000;

export interface HintBalloonProps {
  hint: Hint;
  onDismiss: (id: string) => void;
  /** Absolute viewport-positioned style (top/left/width/etc.). */
  positionStyle: React.CSSProperties;
}

export function HintBalloon({ hint, onDismiss, positionStyle }: HintBalloonProps): JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [entered, setEntered] = React.useState(false);

  // Trigger CSS-transition fade-in on mount.
  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Auto-dismiss after 8s.
  React.useEffect(() => {
    const id = window.setTimeout(() => onDismiss(hint.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [hint.id, onDismiss]);

  // Click outside dismisses. The handler runs on the document so it
  // catches clicks anywhere off the balloon. Same pattern as the cog
  // dropdown in Layout.tsx:66-73.
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onDismiss(hint.id);
      }
    }
    // Listen on the next tick so the click that opened the hint doesn't
    // immediately dismiss it.
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handle);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handle);
    };
  }, [hint.id, onDismiss]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      data-testid={`hint-balloon-${hint.id}`}
      style={{
        ...positionStyle,
        zIndex: TOUR_THEME.zIndex,
        transition: 'opacity 300ms ease-out, transform 300ms ease-out',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(-4px)',
      }}
      className="pointer-events-auto max-w-xs rounded-md border border-slate-200 bg-white p-3 shadow-lg"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-xs leading-snug text-slate-800">{hint.message}</p>
        <button
          type="button"
          data-testid={`hint-dismiss-${hint.id}`}
          onClick={() => onDismiss(hint.id)}
          aria-label={t('toast.dismiss')}
          className="rounded p-0.5 text-slate-500 hover:bg-black/5 hover:text-slate-700"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

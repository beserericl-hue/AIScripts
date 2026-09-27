/**
 * HoverTooltip — a reliable hover/focus tooltip that actually shows.
 *
 * The coverage dots in the SpecRail used a native `title` attribute. Native
 * titles are unreliable: they sit on a tiny emoji nested inside a <button> that
 * carries its OWN title (the parent's tip wins), they only appear after a long
 * OS delay, and a short mouseover often shows nothing at all — coordinators
 * reported the coverage tooltip simply "not displaying". This renders the tip as
 * a real element, portaled to <body> so the rail's `overflow-auto` can't clip
 * it, positioned against the trigger's bounding box, shown immediately on
 * mouseenter/focus and dismissed on mouseleave/blur/Escape.
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_WIDTH = 320;

export function HoverTooltip({
  text,
  children,
  className,
  testId,
  coverageState,
}: {
  /** Multi-line tip text ('\n' honoured via whitespace-pre-line). */
  text: string;
  children: ReactNode;
  className?: string;
  testId?: string;
  /** Mirrored to data-coverage-state on the trigger (kept for tests/telemetry). */
  coverageState?: string;
}): JSX.Element {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(
      8,
      Math.min(r.left + r.width / 2 - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8),
    );
    // Prefer below the dot; flip above when there isn't room.
    const below = r.bottom + 160 < window.innerHeight;
    const top = below ? r.bottom + 6 : r.top - 6;
    setPos({ top, left, below });
  }, []);

  const open = useCallback(() => place(), [place]);
  const close = useCallback(() => setPos(null), []);

  // Reposition on scroll/resize while open so the tip tracks the dot.
  useLayoutEffect(() => {
    if (!pos) return;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [pos, place]);

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      className={className}
      data-testid={testId}
      data-coverage-state={coverageState}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            data-testid={testId ? `${testId}-tip` : undefined}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: TOOLTIP_WIDTH,
              transform: pos.below ? undefined : 'translateY(-100%)',
              zIndex: 2000,
            }}
            className="pointer-events-none whitespace-pre-line rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-xl"
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  );
}

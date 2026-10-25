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
 *
 * Sticky-tip fix (Kennesaw, Oct 2026): a mouse click used to FOCUS the dot, and
 * focus kept the tip open — clicking elsewhere on non-focusable page areas (Safari)
 * left it up, and returning to the window re-fired focus and popped it back. Now a
 * click never focuses the dot, focus opens the tip only for keyboard users, and
 * any outside press, window switch, scroll or Escape closes it.
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
  // Set while a pointer press is in progress so the focus it causes is ignored.
  const pointerDown = useRef(false);

  // While open: close on any press outside the dot, a window switch, a scroll
  // (the dot moved out from under the pointer) or Escape anywhere. A keyboard-
  // focused dot keeps its tip through a scroll (tabbing to an off-screen dot
  // scrolls it into view) and the tip follows it.
  const isOpen = pos !== null;
  useLayoutEffect(() => {
    if (!isOpen) return;
    const onPress = (e: Event) => {
      if (!triggerRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('mousedown', onPress, true);
    document.addEventListener('touchstart', onPress, true);
    document.addEventListener('keydown', onKey);
    const onScroll = () => {
      if (document.activeElement === triggerRef.current) place();
      else close();
    };
    window.addEventListener('blur', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('mousedown', onPress, true);
      document.removeEventListener('touchstart', onPress, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen, close, place]);

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      className={className}
      data-testid={testId}
      data-coverage-state={coverageState}
      onMouseEnter={open}
      onMouseLeave={close}
      onMouseDown={(e) => {
        // A click should not leave the dot focused (focus would pin the tip).
        pointerDown.current = true;
        e.preventDefault();
      }}
      onMouseUp={() => {
        pointerDown.current = false;
      }}
      onFocus={() => {
        if (!pointerDown.current) open();
      }}
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

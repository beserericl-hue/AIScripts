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
 * any outside press or Escape closes it.
 *
 * Readable-tip follow-up (Kennesaw, Oct 2026): long explanations ran off the
 * screen and scrolling to read them closed the tip. The tip now opens on the side
 * with more room, caps its height to that room and scrolls inside itself; the
 * pointer can move from the dot onto the tip; and CLICKING the dot pins the tip
 * open (with a close button) until an outside press, Escape or the close button.
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_WIDTH = 340;
const EDGE = 8;
/** Grace period for moving the pointer from the dot onto the tip. */
const LEAVE_DELAY_MS = 250;

type Pos = { top: number; left: number; below: boolean; maxHeight: number };

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
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [pinned, setPinned] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while a pointer press is in progress so the focus it causes is ignored.
  const pointerDown = useRef(false);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(
      EDGE,
      Math.min(r.left + r.width / 2 - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - EDGE),
    );
    // Open on the side with more room and cap the height to it; long text
    // scrolls inside the tip instead of running off the screen.
    const spaceBelow = window.innerHeight - r.bottom - EDGE - 6;
    const spaceAbove = r.top - EDGE - 6;
    const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    const top = below ? r.bottom + 6 : r.top - 6;
    setPos({ top, left, below, maxHeight: Math.max(120, below ? spaceBelow : spaceAbove) });
  }, []);

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const open = useCallback(() => {
    cancelLeave();
    place();
  }, [cancelLeave, place]);
  const close = useCallback(() => {
    cancelLeave();
    setPinned(false);
    setPos(null);
  }, [cancelLeave]);
  const scheduleLeave = useCallback(() => {
    if (pinned) return;
    cancelLeave();
    leaveTimer.current = setTimeout(() => setPos(null), LEAVE_DELAY_MS);
  }, [pinned, cancelLeave]);

  // While open: close on any press outside the dot and the tip, or Escape
  // anywhere. Scrolling inside the tip is reading, never a reason to close; a
  // page scroll moves a pinned or keyboard-focused tip with its dot and closes
  // a plain hover tip (the dot moved out from under the pointer).
  const isOpen = pos !== null;
  useLayoutEffect(() => {
    if (!isOpen) return;
    // A window/document scroll has a non-element target — never "inside".
    const inside = (t: EventTarget | null) =>
      t instanceof Node && !!(triggerRef.current?.contains(t) || tipRef.current?.contains(t));
    const onPress = (e: Event) => {
      if (!inside(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = (e: Event) => {
      if (inside(e.target)) return;
      if (pinned || document.activeElement === triggerRef.current) place();
      else close();
    };
    const onBlur = () => {
      if (!pinned) close();
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('mousedown', onPress, true);
    document.addEventListener('touchstart', onPress, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('mousedown', onPress, true);
      document.removeEventListener('touchstart', onPress, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen, pinned, close, place]);

  useLayoutEffect(() => cancelLeave, [cancelLeave]);

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      className={className}
      data-testid={testId}
      data-coverage-state={coverageState}
      onMouseEnter={open}
      onMouseLeave={scheduleLeave}
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
      onBlur={() => {
        if (!pinned) close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Click pins the tip open so a long explanation can be read at leisure;
        // a second click on the dot closes it.
        if (pinned) close();
        else {
          open();
          setPinned(true);
        }
      }}
    >
      {children}
      {pos &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            data-testid={testId ? `${testId}-tip` : undefined}
            data-pinned={pinned ? 'true' : 'false'}
            onMouseEnter={cancelLeave}
            onMouseLeave={scheduleLeave}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: TOOLTIP_WIDTH,
              maxHeight: pos.maxHeight,
              transform: pos.below ? undefined : 'translateY(-100%)',
              zIndex: 2000,
            }}
            className="overflow-y-auto overscroll-contain whitespace-pre-line rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-xl"
          >
            {pinned && (
              <button
                type="button"
                data-testid={testId ? `${testId}-tip-close` : undefined}
                aria-label="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                className="float-right -mr-1 ml-2 rounded px-1.5 text-sm leading-5 text-gray-300 hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            )}
            {text}
            {!pinned && (
              <span className="mt-1.5 block text-[10px] text-gray-400">Click the dot to keep this open.</span>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

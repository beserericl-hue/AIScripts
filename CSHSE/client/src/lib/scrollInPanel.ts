/**
 * Bring `el` into view by scrolling ONLY its real scroll panels
 * (overflow-y auto/scroll), innermost first.
 *
 * Element.scrollIntoView() also scrolls ancestors marked overflow:hidden — and
 * the app shell is an `h-screen overflow-hidden` frame. Scrolling it pushes the
 * header / tabs off the top with no scrollbar to bring them back (Review looked
 * "stuck": no way to navigate). Never use scrollIntoView inside the app shell.
 */
export function scrollInPanel(
  el: Element | null | undefined,
  opts: { block?: 'start' | 'center' | 'nearest'; margin?: number } = {}
): void {
  if (!el) return;
  const { block = 'start', margin = 12 } = opts;
  let a: HTMLElement | null = (el as HTMLElement).parentElement;
  while (a && a !== document.body && a !== document.documentElement) {
    const oy = getComputedStyle(a).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight + 1) {
      // Re-measured per panel: inner panels move first (instantly), so each
      // outer panel sees the element's real position.
      const er = el.getBoundingClientRect();
      const ar = a.getBoundingClientRect();
      let delta = 0;
      if (block === 'start') delta = er.top - ar.top - margin;
      else if (block === 'center') delta = er.top + er.height / 2 - (ar.top + ar.height / 2);
      else if (er.top < ar.top + margin) delta = er.top - ar.top - margin;
      else if (er.bottom > ar.bottom - margin) delta = Math.min(er.bottom - ar.bottom + margin, er.top - ar.top - margin);
      if (Math.abs(delta) > 1) a.scrollTop += delta;
    }
    a = a.parentElement;
  }
}

/** Overflow-hidden app frames must never stay scrolled; put them back at 0. */
export function resetHiddenFrames(from: Element | null | undefined): void {
  let a: HTMLElement | null = (from as HTMLElement | null) || null;
  while (a) {
    if (getComputedStyle(a).overflowY === 'hidden' && a.scrollTop) a.scrollTop = 0;
    a = a.parentElement;
  }
}

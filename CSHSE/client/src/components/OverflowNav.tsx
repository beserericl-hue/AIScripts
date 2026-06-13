import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface OverflowNavItem {
  name: string;
  key: string;
}

interface OverflowNavProps<T extends OverflowNavItem> {
  items: T[];
  renderItem: (item: T, inMenu: boolean) => React.ReactNode;
}

/**
 * A horizontal nav that NEVER overflows: it measures how many items fit in the
 * available width and tucks the rest into a "More ▾" dropdown. Re-measures on
 * resize so it re-adjusts to the browser size.
 */
export function OverflowNav<T extends OverflowNavItem>({ items, renderItem }: OverflowNavProps<T>): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const meas = measureRef.current;
    if (!wrap || !meas) return;
    const GAP = 8;
    const MORE = 110; // reserve room for the "More ▾" button when overflowing
    const recompute = () => {
      const kids = Array.from(meas.children) as HTMLElement[];
      const avail = wrap.clientWidth;
      let used = 0;
      let n = 0;
      for (let i = 0; i < kids.length; i++) {
        used += kids[i].offsetWidth + GAP;
        const moreNeeded = i < kids.length - 1; // if items remain after i, reserve More
        if (used + (moreNeeded ? MORE : 0) <= avail) n++;
        else break;
      }
      setVisibleCount(Math.max(0, Math.min(items.length, n)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [items]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      {/* Off-screen measuring layer — always holds every item at full size. */}
      <div ref={measureRef} aria-hidden className="invisible pointer-events-none absolute left-0 top-0 -z-10 flex items-center gap-2 whitespace-nowrap">
        {items.map((it) => <div key={it.key}>{renderItem(it, false)}</div>)}
      </div>
      {/* Visible layer. */}
      <div className="flex items-center gap-2">
        {visible.map((it) => <React.Fragment key={it.key}>{renderItem(it, false)}</React.Fragment>)}
        {overflow.length > 0 && (
          <div ref={moreRef} className="relative">
            <button
              data-testid="nav-more"
              onClick={() => setMenuOpen((v) => !v)}
              className="nav-tab nav-tab-inactive flex items-center gap-1"
              title="More"
            >
              More <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div data-testid="nav-more-menu" className="absolute right-0 z-40 mt-1 min-w-[12rem] rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
                {overflow.map((it) => (
                  <div key={it.key} onClick={() => setMenuOpen(false)} className="rounded hover:bg-gray-50">
                    {renderItem(it, true)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OverflowNav;

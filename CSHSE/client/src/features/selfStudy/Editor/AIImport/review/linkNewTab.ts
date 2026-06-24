import type { MouseEvent } from 'react';

/**
 * Delegated click handler for any container that renders imported/source HTML.
 * Clicking a hyperlink opens it in a NEW tab instead of navigating the current
 * one (which would replace the editor / review screen). Non-link clicks bubble
 * normally (so card selection still works).
 */
export function openLinksInNewTab(e: MouseEvent): void {
  const a = (e.target as HTMLElement | null)?.closest('a');
  const href = a?.getAttribute('href');
  if (href && !href.startsWith('#')) {
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  }
}

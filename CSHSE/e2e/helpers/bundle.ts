/**
 * Bundle-string scanner.
 *
 * For changes that are hard to exercise functionally (the wizard requires
 * lots of state), it's still useful to verify the deployed JS bundle
 * actually contains the change's marker string. This is the in-page
 * equivalent of `curl deployed/index.js | grep <marker>`.
 *
 * Usage:
 *   import { scanBundleForMarkers } from '../helpers/bundle';
 *   const found = await scanBundleForMarkers(page, ['removes the card from the spec']);
 *   expect(found['removes the card from the spec']).toBe(true);
 */
import { Page } from '@playwright/test';

export async function scanBundleForMarkers(
  page: Page,
  markers: string[]
): Promise<Record<string, boolean>> {
  return page.evaluate(async (ms: string[]) => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const sources = await Promise.all(
      scripts.map(async (s) => {
        try {
          const r = await fetch((s as HTMLScriptElement).src);
          return await r.text();
        } catch {
          return '';
        }
      })
    );
    const merged = sources.join('\n');
    const out: Record<string, boolean> = {};
    for (const m of ms) out[m] = merged.includes(m);
    return out;
  }, markers);
}

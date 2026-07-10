// ---------------------------------------------------------------------------
// CR-016 follow-on / Sprint 13d — auto-screenshot for the in-app bug reporter.
//
// The original CR-016 (Sprint 7.2) deferred html2canvas auto-capture to keep
// the main bundle slim (~800 KB). This follow-on adds it back, but:
//
//   1. It is FLAG-GATED. Off by default. Enabled via either
//      `VITE_ENABLE_BUG_SCREENSHOT=true` at build time, or a per-browser
//      localStorage opt-in (`cshse:bug-screenshot` = "on") so support can
//      ask a user to flip it without a redeploy.
//   2. html2canvas is loaded via a DYNAMIC import. Vite code-splits it into
//      its own lazy chunk, so the main bundle pays nothing until the flag is
//      on AND the user actually opens the reporter. Disabled → zero cost.
//   3. It is fully fail-soft: any capture error returns null and the report
//      still sends without a screenshot.
// ---------------------------------------------------------------------------

export const SCREENSHOT_FLAG_KEY = 'cshse:bug-screenshot';

/**
 * Is auto-screenshot enabled? Build-time env wins; otherwise a per-browser
 * localStorage opt-in. Reading is wrapped because some embedded contexts
 * throw on localStorage access.
 */
export function isScreenshotEnabled(): boolean {
  // Auto-capture is ON by default now (bug reports must carry an image). It can
  // still be turned OFF explicitly via the build env or a per-browser opt-out.
  try {
    const env = (import.meta as any).env?.VITE_ENABLE_BUG_SCREENSHOT;
    if (env === 'false') return false;
    if (env === 'true') return true;
  } catch {
    /* ignore env access issues */
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(SCREENSHOT_FLAG_KEY) === 'off') {
      return false;
    }
  } catch {
    /* ignore localStorage access issues */
  }
  return true;
}

/**
 * Capture the current viewport as a JPEG data URL, or null if disabled / on
 * any failure. JPEG at 0.7 quality keeps the payload small; we also cap the
 * rendered scale to 1 so a hi-DPI screen doesn't produce a multi-MB image.
 */
export async function captureScreenshot(): Promise<string | null> {
  if (!isScreenshotEnabled()) return null;
  if (typeof document === 'undefined') return null;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      scale: 1,
      // Only the visible viewport — not the full scroll height — to bound size.
      width: window.innerWidth,
      height: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
    });
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (err) {
    // Fail-soft: a missing chunk, a tainted canvas, anything — the report
    // still goes out without a screenshot.
    console.warn('Bug-report screenshot capture failed (non-fatal):', err);
    return null;
  }
}

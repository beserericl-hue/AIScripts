/**
 * CR-016 follow-on / Sprint 13d — flag gating for the bug-reporter
 * auto-screenshot. The heavy html2canvas import must never load while the
 * flag is off, so `captureScreenshot()` short-circuits to null and
 * `isScreenshotEnabled()` reads the localStorage opt-in.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isScreenshotEnabled,
  captureScreenshot,
  SCREENSHOT_FLAG_KEY,
} from './bugReporterScreenshot';

beforeEach(() => {
  try {
    localStorage.removeItem(SCREENSHOT_FLAG_KEY);
  } catch {
    /* ignore */
  }
});

describe('bugReporterScreenshot flag gating', () => {
  // Auto-capture is now ON by default (bug reports must carry an image); it is
  // OPT-OUT via localStorage `cshse:bug-screenshot` = "off" (or build env
  // VITE_ENABLE_BUG_SCREENSHOT=false).
  it('is enabled by default', () => {
    expect(isScreenshotEnabled()).toBe(true);
  });

  it('captureScreenshot resolves to null when explicitly disabled (never imports html2canvas)', async () => {
    localStorage.setItem(SCREENSHOT_FLAG_KEY, 'off');
    expect(await captureScreenshot()).toBeNull();
  });

  it('localStorage "off" opt-out flips the flag off', () => {
    localStorage.setItem(SCREENSHOT_FLAG_KEY, 'off');
    expect(isScreenshotEnabled()).toBe(false);
  });

  it('a non-"off" localStorage value keeps it enabled', () => {
    localStorage.setItem(SCREENSHOT_FLAG_KEY, 'yes');
    expect(isScreenshotEnabled()).toBe(true);
  });
});

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
  it('is disabled by default', () => {
    expect(isScreenshotEnabled()).toBe(false);
  });

  it('captureScreenshot resolves to null when disabled (never imports html2canvas)', async () => {
    expect(await captureScreenshot()).toBeNull();
  });

  it('localStorage opt-in flips the flag on', () => {
    localStorage.setItem(SCREENSHOT_FLAG_KEY, 'on');
    expect(isScreenshotEnabled()).toBe(true);
  });

  it('a non-"on" localStorage value keeps it disabled', () => {
    localStorage.setItem(SCREENSHOT_FLAG_KEY, 'yes');
    expect(isScreenshotEnabled()).toBe(false);
  });
});

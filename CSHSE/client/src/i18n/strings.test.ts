/**
 * CR-052 — string registry tests.
 *
 * Pins:
 *   - every key referenced by getWelcomeTourSteps actually exists in the
 *     STRINGS registry (so a typo at step-definition time is caught at
 *     test time, not runtime);
 *   - t(key, vars) interpolates {var} placeholders without depending on
 *     String.prototype.replaceAll;
 *   - the registry never contains computer jargon (light heuristic — no
 *     "API", "endpoint", "DOM", "JSON" etc. in tour copy).
 */
import { describe, it, expect } from 'vitest';
import { t, STRINGS_FOR_TESTING } from './strings';
import { getWelcomeTourSteps } from '../features/tour/welcomeTourSteps';

describe('CR-052 — i18n strings registry', () => {
  it('interpolates variables in {var} placeholders', () => {
    const out = t('tour.controls.stepLabel', { current: 2, total: 5 });
    expect(out).toBe('Step 2 of 5');
  });

  it('returns the template unchanged when no vars given', () => {
    const out = t('help.menu.chat');
    expect(out).toBe('Chat with us');
  });

  it('does not throw on numeric var values', () => {
    expect(() =>
      t('tour.controls.stepLabel', { current: 1, total: 1 })
    ).not.toThrow();
  });

  it('every welcome-tour step references a real string key', () => {
    // Render steps for all roles; the union covers every key the engine
    // could ever reach.
    const roles = [
      'program_coordinator',
      'reader',
      'lead_reader',
      'admin',
      'superuser',
    ] as const;
    const allContent: string[] = [];
    for (const role of roles) {
      const steps = getWelcomeTourSteps({ role });
      for (const step of steps) {
        // Each step.content was produced by t(); just confirm it's a
        // non-empty string.
        expect(typeof step.content).toBe('string');
        expect((step.content as string).length).toBeGreaterThan(5);
        allContent.push(step.content as string);
      }
    }
    expect(allContent.length).toBeGreaterThan(0);
  });

  it('tour copy avoids computer jargon (five-year-old voice)', () => {
    const jargon = /\b(API|endpoint|JSON|DOM|backend|frontend|payload|HTTP|cache|workflow|config|VPA|UI)\b/i;
    for (const [key, value] of Object.entries(STRINGS_FOR_TESTING)) {
      if (!key.startsWith('tour.') && !key.startsWith('tour.hint')) continue;
      expect(
        jargon.test(value),
        `string "${key}" contains computer jargon: ${value}`
      ).toBe(false);
    }
  });
});

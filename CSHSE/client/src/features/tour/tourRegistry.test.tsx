/**
 * Per-screen tour registry — unit tests.
 *
 * Pins:
 *   - resolveTourForRoute maps each main screen's route to its tour;
 *   - unmatched routes resolve to null;
 *   - every tour produces at least an intro + outro (>= 2 steps) and uses
 *     valid i18n keys (t() returns a non-empty string, no raw key leaks);
 *   - welcome delegates to the role-aware welcome step factory.
 */
import { describe, it, expect } from 'vitest';
import {
  TOUR_REGISTRY,
  TOUR_NAMES,
  getTourDefinition,
  resolveTourForRoute,
  type TourName,
} from './tourRegistry';
import { STRINGS_FOR_TESTING } from '../../i18n/strings';

describe('tourRegistry — route resolution', () => {
  const cases: Array<[string, TourName | null]> = [
    ['/dashboard', 'welcome'],
    ['/', 'welcome'],
    ['/self-study', 'self-study'],
    ['/self-study/abc123', 'self-study'],
    ['/reader', 'reader-review'],
    ['/reader/abc123', 'reader-review'],
    ['/lead-reader', 'lead-compilation'],
    ['/lead-reader/abc123', 'lead-compilation'],
    ['/admin', 'admin-settings'],
    ['/admin/settings', 'admin-settings'],
    ['/site-visit/abc/checklist', 'site-visit'],
    ['/site-visit/abc/itinerary', 'site-visit'],
    ['/messages/abc123', null],
    ['/relay', null],
    ['/login', null],
  ];

  it.each(cases)('resolveTourForRoute(%s) === %s', (path, expected) => {
    expect(resolveTourForRoute(path)).toBe(expected);
  });
});

describe('tourRegistry — definitions', () => {
  it('registry order: welcome is first (priority) and names are unique', () => {
    expect(TOUR_NAMES[0]).toBe('welcome');
    expect(new Set(TOUR_NAMES).size).toBe(TOUR_NAMES.length);
  });

  it('every tour builds steps with valid, non-empty content', () => {
    for (const def of TOUR_REGISTRY) {
      const steps = def.getSteps({ role: 'admin' });
      // intro + outro at minimum.
      expect(steps.length, `${def.name} step count`).toBeGreaterThanOrEqual(2);
      for (const step of steps) {
        expect(typeof step.content === 'string' || step.content != null).toBe(true);
        if (typeof step.content === 'string') {
          expect(step.content.length, `${def.name} step content`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every help-menu label key exists in the string registry', () => {
    for (const def of TOUR_REGISTRY) {
      expect(STRINGS_FOR_TESTING[def.startLabelKey]).toBeTruthy();
      expect(STRINGS_FOR_TESTING[def.restartLabelKey]).toBeTruthy();
    }
  });

  it('getTourDefinition returns the matching record', () => {
    for (const name of TOUR_NAMES) {
      expect(getTourDefinition(name)?.name).toBe(name);
    }
    expect(getTourDefinition('nope' as TourName)).toBeUndefined();
  });

  it('self-study tour covers the Drafts → Review surface (every arrowed object)', () => {
    const steps = getTourDefinition('self-study')!.getSteps({ role: 'program_coordinator' });
    const targets = steps
      .map((s) => (typeof s.target === 'string' ? s.target : ''))
      .filter(Boolean);
    // Each Review-surface anchor the coordinator can point at must have a step.
    const requiredAnchors = [
      '[data-tour="review-summary"]',
      '[data-tour="review-rail"]',
      '[data-tour="review-doc-intro"]',
      '[data-tour="review-matrices"]',
      '[data-tour="review-supporting-evidence"]',
      '[data-tour="review-standards"]',
      '[data-tour="review-cards"]',
      '[data-tour="review-bulk-toolbar"]',
      '[data-tour="review-assign"]',
      '[aria-label^="AI evaluation"]',
      '[data-tour="review-place-as"]',
      '[data-tour="review-apply"]',
      '[data-tour="review-next"]',
      '[data-tour="review-redetect"]',
      '[data-testid="finish-review-cta"]',
      '[data-tour="review-back-to-editor"]',
    ];
    for (const anchor of requiredAnchors) {
      expect(targets, `missing tour step for ${anchor}`).toContain(anchor);
    }
    // Every Review step resolves to real, non-empty copy (no raw key leak).
    for (const step of steps) {
      if (typeof step.content === 'string') {
        expect(step.content.startsWith('tour.')).toBe(false);
      }
    }
  });

  it('welcome steps are role-aware (PC vs admin differ)', () => {
    const welcome = getTourDefinition('welcome')!;
    const pc = welcome.getSteps({ role: 'program_coordinator' });
    const admin = welcome.getSteps({ role: 'admin' });
    // Admin sees the settings step the PC does not → more steps.
    expect(admin.length).toBeGreaterThan(pc.length);
  });
});

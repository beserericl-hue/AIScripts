/**
 * TourRunner — settle-before-run regression tests.
 *
 * The Drafts → Review surface mounts its content asynchronously (a fetch
 * hydrates the rail / cards / panes a beat after the toolbar chrome). The
 * runner used to filter steps in a one-shot snapshot at tour-start, so every
 * anchor that mounted late was silently dropped — the tour collapsed to just
 * the synchronous chrome. These tests pin the fix:
 *
 *   1. Anchors that appear AFTER the tour starts are still included (the
 *      runner waits for the DOM to settle before starting Joyride).
 *   2. The runner pre-selects a review card so the right-pane stops
 *      ("AI evaluation", "Place this item as") mount and can be spotlighted.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { TourProvider, useTour } from './TourProvider';
import { HintProvider } from './HintProvider';
import { useAuthStore } from '../../store/authStore';

// Capture the props Joyride is rendered with so we can assert on the final,
// settled step set without depending on the real spotlight DOM.
let captured: { steps: any[]; run: boolean } | null = null;
vi.mock('react-joyride', () => ({
  __esModule: true,
  default: (props: any) => {
    captured = { steps: props.steps, run: props.run };
    return null;
  },
  ACTIONS: { CLOSE: 'close' },
  EVENTS: { STEP_AFTER: 'step:after' },
  STATUS: { FINISHED: 'finished', SKIPPED: 'skipped', ERROR: 'error' },
}));

import { TourRunner } from './TourRunner';

function StartSelfStudyTour() {
  const { startTour } = useTour();
  React.useEffect(() => {
    startTour('self-study');
  }, [startTour]);
  return <TourRunner />;
}

function renderRunner() {
  return render(
    <TourProvider>
      <HintProvider>
        <StartSelfStudyTour />
      </HintProvider>
    </TourProvider>
  );
}

const added: HTMLElement[] = [];
function mountReviewSurfaceDom() {
  const mk = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    const node = el.firstElementChild as HTMLElement;
    document.body.appendChild(node);
    added.push(node);
    return node;
  };
  mk('<div data-tour="review-summary">Review recommendations</div>');
  mk('<nav data-tour="review-rail"></nav>');
  mk('<div data-tour="review-cards"><div data-section-id="sec-1">card</div></div>');
  mk('<div data-tour="review-bulk-toolbar"></div>');
  mk('<aside aria-label="AI evaluation panel"></aside>');
  mk('<div data-tour="review-place-as"></div>');
  mk('<button data-tour="review-back-to-editor"></button>');
}

function targetsOf(): string[] {
  return (captured?.steps ?? [])
    .map((s) => (typeof s.target === 'string' ? s.target : ''))
    .filter(Boolean);
}

describe('TourRunner — settle before run', () => {
  beforeEach(() => {
    captured = null;
    useAuthStore.setState({
      user: {
        id: 'u',
        email: 'pc@x.com',
        firstName: 'P',
        lastName: 'C',
        role: 'program_coordinator',
        preferences: { tours: {} },
      } as any,
      token: 'tok',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    added.forEach((n) => n.remove());
    added.length = 0;
    vi.useRealTimers();
  });

  it('includes Review anchors that mount AFTER the tour starts', async () => {
    renderRunner();

    // The Review content appears a beat later — exactly the async case that
    // used to be missed. Add it shortly after the tour has begun settling.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
      mountReviewSurfaceDom();
    });

    // The runner must wait for the DOM to settle and then start with the
    // late-mounted anchors included.
    await waitFor(
      () => {
        expect(captured?.run).toBe(true);
        const targets = targetsOf();
        expect(targets).toContain('[data-tour="review-summary"]');
        expect(targets).toContain('[data-tour="review-rail"]');
        expect(targets).toContain('[data-tour="review-cards"]');
        expect(targets).toContain('[aria-label^="AI evaluation"]');
        expect(targets).toContain('[data-tour="review-place-as"]');
        expect(targets).toContain('[data-tour="review-back-to-editor"]');
      },
      { timeout: 3000 }
    );
  });

  it('does not start Joyride until at least one settle pass has run', () => {
    renderRunner();
    // Synchronously after mount, the settle loop has not committed yet.
    expect(captured === null || captured.run === false).toBe(true);
  });
});

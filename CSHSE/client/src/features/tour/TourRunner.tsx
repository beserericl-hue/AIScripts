import React from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { CallBackProps, Step } from 'react-joyride';
import { useTour } from './TourProvider';
import { useHint } from './HintProvider';
import { CshseTooltip } from './CshseTooltip';
import { TOUR_TARGET_IDS, type Role } from './welcomeTourSteps';
import { getTourDefinition } from './tourRegistry';
import { TOUR_THEME } from './tourTheme';
import { useAuthStore } from '../../store/authStore';
import { t } from '../../i18n/strings';

// ---------------------------------------------------------------------------
// CR-052 follow-on — TourRunner (generic, multi-tour Joyride host).
//
// Replaces the welcome-only <WelcomeTour>. Renders react-joyride for
// WHICHEVER tour is active, pulling its role-aware steps from the registry.
//   - status === FINISHED → completeTour(name) + (if wasAutoStarted) the
//     post-completion hint anchored to the Help button.
//   - status === SKIPPED, or action === CLOSE → skipTour(name) + same hint.
//   - status === ERROR → endTour (a target couldn't be resolved).
//
// Anchored steps whose target isn't currently in the DOM are dropped before
// Joyride sees them. That keeps a tour robust across a screen's sub-states
// (queue vs. detail, checklist vs. itinerary) and means an author can list
// generously without risking a stuck spotlight. Center/body steps always
// survive the filter.
//
// Body scroll is locked while a tour runs and restored on exit OR mid-tour
// unmount (capture-and-restore so an explicitly-set overflow stays
// consistent).
// ---------------------------------------------------------------------------

/** Keep `body`/center steps; keep anchored steps only if the element exists. */
function filterStepsToPresentTargets(steps: Step[]): Step[] {
  if (typeof document === 'undefined') return steps;
  return steps.filter((step) => {
    const target = step.target;
    if (typeof target !== 'string') return true; // HTMLElement target — trust it
    if (target === 'body') return true;
    try {
      return document.querySelector(target) != null;
    } catch {
      // Malformed selector — drop it rather than throw.
      return false;
    }
  });
}

export function TourRunner(): JSX.Element | null {
  const { activeTour, wasAutoStarted, completeTour, skipTour, endTour } = useTour();
  const { showHint } = useHint();
  const user = useAuthStore((s) => s.user);
  const isSuperuser = useAuthStore((s) => s.isSuperuser);

  // Resolve viewer role for step filtering. Superuser sees every step.
  const role: Role = isSuperuser()
    ? 'superuser'
    : ((user?.role as Role | undefined) ?? 'program_coordinator');

  // Steps are resolved by a settle loop (below), NOT a one-shot snapshot.
  // Several screens — most notably the Drafts → Review surface — mount their
  // content asynchronously (a fetch hydrates the rail, cards, and panes a beat
  // after the toolbar chrome). A single synchronous filter at tour-start would
  // see only the chrome and silently drop every late-mounting anchor, leaving
  // a stub tour. So we poll until the present-target set stabilizes (or a hard
  // cap elapses) and only THEN start Joyride with the full, settled set.
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [run, setRun] = React.useState(false);

  React.useEffect(() => {
    if (!activeTour) {
      setSteps([]);
      setRun(false);
      return;
    }
    const def = getTourDefinition(activeTour);
    if (!def) {
      setSteps([]);
      setRun(false);
      return;
    }
    const allSteps = def.getSteps({ role });

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let prevCount = -1;
    let stableTicks = 0;
    const startedAt = Date.now();
    const MAX_WAIT_MS = 2000;
    const POLL_MS = 100;

    // Pre-select the first review card (if the Review surface is open and no
    // item is selected yet) so the right-pane stops — "AI evaluation" and
    // "Place this item as / Reassign" — actually mount and can be spotlighted.
    // Clicking the card runs the same selectSection path the user would.
    const ensureReviewItemSelected = () => {
      if (typeof document === 'undefined') return;
      const railPresent = document.querySelector('[data-tour="review-rail"]');
      if (!railPresent) return; // not on the Review surface — nothing to do
      const placeAsPresent = document.querySelector('[data-tour="review-place-as"]');
      if (placeAsPresent) return; // an item is already selected
      const firstCard = document.querySelector(
        '[data-tour="review-cards"] [data-section-id]'
      ) as HTMLElement | null;
      firstCard?.click();
    };

    const commit = () => {
      if (cancelled) return;
      setSteps(filterStepsToPresentTargets(allSteps));
      setRun(true);
    };

    const tick = () => {
      if (cancelled) return;
      ensureReviewItemSelected();
      const filtered = filterStepsToPresentTargets(allSteps);
      if (filtered.length === prevCount) stableTicks += 1;
      else stableTicks = 0;
      prevCount = filtered.length;
      const elapsed = Date.now() - startedAt;
      // Commit once the present-target count holds steady across two polls, or
      // the hard cap is hit (so a perpetually-absent anchor never hangs start).
      if (stableTicks >= 2 || elapsed >= MAX_WAIT_MS) {
        commit();
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeTour, role]);

  // Body-scroll lock — captured original on mount, restored on unmount or
  // whenever activeTour goes back to null.
  React.useEffect(() => {
    if (!activeTour) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeTour]);

  const onCallback = React.useCallback(
    async (data: CallBackProps) => {
      const { status, action, type } = data;
      const name = activeTour;
      if (!name) return;

      const isFinished = status === STATUS.FINISHED;
      const isSkipped = status === STATUS.SKIPPED;
      const isClosed = action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER;

      if (isFinished || isSkipped || isClosed) {
        const shouldHint = wasAutoStarted;
        if (isFinished) {
          await completeTour(name);
        } else {
          await skipTour(name);
        }
        if (shouldHint) {
          showHint({
            id: 'welcome-tour-completed',
            message: t('tour.hint.afterComplete'),
            targetId: TOUR_TARGET_IDS.help,
          });
        }
        return;
      }

      // Joyride's STATUS.ERROR fires if a spotlight target can't be
      // resolved. Close cleanly instead of leaving the tour stuck.
      if (status === STATUS.ERROR) {
        endTour();
      }
    },
    [activeTour, wasAutoStarted, completeTour, skipTour, showHint, endTour]
  );

  if (!activeTour) return null;
  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      hideCloseButton
      disableOverlayClose
      disableScrolling
      callback={onCallback}
      tooltipComponent={CshseTooltip as any}
      styles={{
        options: {
          arrowColor: '#ffffff',
          primaryColor: TOUR_THEME.primary,
          overlayColor: TOUR_THEME.overlay,
          textColor: TOUR_THEME.text,
          zIndex: TOUR_THEME.zIndex,
        },
      }}
    />
  );
}

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

  const steps = React.useMemo(() => {
    if (!activeTour) return [];
    const def = getTourDefinition(activeTour);
    if (!def) return [];
    return filterStepsToPresentTargets(def.getSteps({ role }));
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
  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run
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

import React from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { CallBackProps } from 'react-joyride';
import { useTour } from './TourProvider';
import { useHint } from './HintProvider';
import { CshseTooltip } from './CshseTooltip';
import { getWelcomeTourSteps, TOUR_TARGET_IDS, Role } from './welcomeTourSteps';
import { TOUR_THEME } from './tourTheme';
import { useAuthStore } from '../../store/authStore';
import { t } from '../../i18n/strings';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — WelcomeTour.
//
// Mounts `react-joyride` and bridges its callback into our TourProvider:
//   - status === FINISHED → completeTour('welcome') + (if wasAutoStarted)
//     fire the post-completion hint anchored to the Help button.
//   - status === SKIPPED, or action === CLOSE → skipTour('welcome') + same hint.
//
// Body scroll is locked while the tour is running (overlay covers the
// viewport) and restored on exit OR on mid-tour unmount. The pre-mount
// overflow is captured so we restore the original value, not "" — a page
// that explicitly set overflow stays consistent.
// ---------------------------------------------------------------------------

export function WelcomeTour(): JSX.Element | null {
  const { activeTour, wasAutoStarted, completeTour, skipTour, endTour } = useTour();
  const { showHint } = useHint();
  const user = useAuthStore((s) => s.user);
  const isSuperuser = useAuthStore((s) => s.isSuperuser);

  // Resolve viewer role for step filtering. Superuser sees every step
  // (we keep their role mapping as 'superuser' for transparency).
  const role: Role = isSuperuser()
    ? 'superuser'
    : ((user?.role as Role | undefined) ?? 'program_coordinator');

  const steps = React.useMemo(
    () => (activeTour === 'welcome' ? getWelcomeTourSteps({ role }) : []),
    [activeTour, role]
  );

  // Body-scroll lock — captured original on mount, restored on unmount
  // or whenever activeTour goes back to null. The capture-and-restore
  // pattern lets us survive a mid-tour unmount cleanly.
  React.useEffect(() => {
    if (activeTour !== 'welcome') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeTour]);

  const onCallback = React.useCallback(
    async (data: CallBackProps) => {
      const { status, action, type } = data;
      const isFinished = status === STATUS.FINISHED;
      const isSkipped = status === STATUS.SKIPPED;
      const isClosed = action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER;

      if (isFinished) {
        const shouldHint = wasAutoStarted;
        await completeTour('welcome');
        if (shouldHint) {
          showHint({
            id: 'welcome-tour-completed',
            message: t('tour.hint.afterComplete'),
            targetId: TOUR_TARGET_IDS.help,
          });
        }
        return;
      }

      if (isSkipped || isClosed) {
        const shouldHint = wasAutoStarted;
        await skipTour('welcome');
        if (shouldHint) {
          showHint({
            id: 'welcome-tour-completed',
            message: t('tour.hint.afterComplete'),
            targetId: TOUR_TARGET_IDS.help,
          });
        }
        return;
      }

      // Defensive: Joyride's STATUS.ERROR fires if the spotlight target
      // can't be resolved. Close cleanly instead of leaving the tour
      // stuck on an invisible step.
      if (status === STATUS.ERROR) {
        endTour();
      }
    },
    [wasAutoStarted, completeTour, skipTour, showHint, endTour]
  );

  if (activeTour !== 'welcome') return null;
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

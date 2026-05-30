import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTour } from './TourProvider';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — Welcome-tour auto-start.
//
// Effect-only component (renders nothing). On mount + when the location
// changes, checks `shouldAutoStartWelcomeTour(pathname)` from the provider.
// If the predicate says yes:
//   - if not already on /dashboard, navigate there once;
//   - once on /dashboard, fire startTour('welcome', { autoStarted: true }).
//
// The latch (`hasFiredRef`) ensures the tour fires at most once per page
// load, so a tour-skip + immediate revisit doesn't re-fire while the
// server persistence is in flight.
// ---------------------------------------------------------------------------

const HOME_ROUTE = '/dashboard';

export function WelcomeTourAutoStart(): null {
  const { activeTour, startTour, shouldAutoStartWelcomeTour } = useTour();
  const location = useLocation();
  const navigate = useNavigate();
  const hasFiredRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (hasFiredRef.current) return;
    if (activeTour) return; // tour already running
    if (!shouldAutoStartWelcomeTour(location.pathname)) return;

    if (location.pathname !== HOME_ROUTE) {
      navigate(HOME_ROUTE, { replace: true });
      return; // wait for the next render at /dashboard
    }

    hasFiredRef.current = true;
    // Defer to next paint so /dashboard's data-tour-step anchors are in
    // the DOM before Joyride tries to spotlight them.
    const id = window.setTimeout(() => {
      startTour('welcome', { autoStarted: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [activeTour, location.pathname, navigate, shouldAutoStartWelcomeTour, startTour]);

  return null;
}

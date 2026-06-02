import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTour } from './TourProvider';
import type { TourName } from './tourRegistry';

// ---------------------------------------------------------------------------
// CR-052 follow-on — TourAutoStart (generic, multi-tour).
//
// Replaces the welcome-only <WelcomeTourAutoStart>. Effect-only component
// (renders nothing). On mount + every location change, asks the provider
// which tour (if any) should auto-start for the current viewer + path via
// `resolveAutoStartTour`.
//
//   - Welcome is the global first-run tour and lives on /dashboard. If the
//     resolver returns 'welcome' but we're elsewhere, redirect home once;
//     the next render at /dashboard fires it.
//   - Per-screen tours start in place (no redirect) the first time the user
//     visits that screen, and only if they haven't seen that screen's tour.
//
// `firedRef` tracks which tours we've already auto-fired THIS page load, so
// navigating between screens auto-starts each screen's own tour exactly
// once, and a skip + immediate revisit doesn't re-fire while the server
// persistence is still in flight. Cross-session de-duplication is handled
// by the persisted `preferences.tours` flags (read inside the resolver).
// ---------------------------------------------------------------------------

const HOME_ROUTE = '/dashboard';

export function TourAutoStart(): null {
  const { activeTour, startTour, resolveAutoStartTour } = useTour();
  const location = useLocation();
  const navigate = useNavigate();
  const firedRef = React.useRef<Set<TourName>>(new Set());

  React.useEffect(() => {
    if (activeTour) return; // a tour is already running

    const tour = resolveAutoStartTour(location.pathname);
    if (!tour) return;
    if (firedRef.current.has(tour)) return;

    // Welcome runs on /dashboard — send the user home first if needed so
    // its anchors are mounted before Joyride spotlights them.
    if (tour === 'welcome' && location.pathname !== HOME_ROUTE) {
      navigate(HOME_ROUTE, { replace: true });
      return; // wait for the next render at /dashboard
    }

    firedRef.current.add(tour);
    // Defer to next paint so the screen's data anchors are in the DOM
    // before the runner filters + Joyride mounts.
    const id = window.setTimeout(() => {
      startTour(tour, { autoStarted: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [activeTour, location.pathname, navigate, resolveAutoStartTour, startTour]);

  return null;
}

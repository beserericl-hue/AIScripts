import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { t } from '../../i18n/strings';
import {
  TOUR_NAMES,
  TOUR_REGISTRY,
  resolveTourForRoute as resolveTourForRouteFromRegistry,
  type TourName,
} from './tourRegistry';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 (+ per-screen follow-on) — TourProvider.
//
// State semantics:
//   - `activeTour`, `wasAutoStarted`, `isLoading` are in-memory React state.
//   - `tourStatus` is derived from the authenticated user's
//     `preferences.tours` blob (CR-052 server schema), so completion
//     follows the user across devices. Each tour in the registry tracks
//     its OWN completion flag — finishing the welcome tour does not mark
//     the self-study tour seen, and vice-versa.
//   - `completeTour` / `skipTour` go through `authStore.updatePreferences`
//     which already does optimistic-update + server-merge + rollback per
//     the CR-045 pattern. On rollback we surface a toast and close the
//     tour cleanly — no UI strand.
//   - This provider is intentionally decoupled from HintProvider; callers
//     that want a post-completion hint pass an `onCompletionHint` callback
//     to <TourRunner> rather than reaching into the hint context here.
// ---------------------------------------------------------------------------

export type { TourName };

export const TOUR_EXCLUDED_ROUTES: ReadonlyArray<string> = [
  '/login',
  '/accept-invitation',
  '/impersonate',
];

export interface TourContextValue {
  activeTour: TourName | null;
  tourStatus: Record<TourName, boolean>;
  isLoading: boolean;
  wasAutoStarted: boolean;
  startTour: (name: TourName, opts?: { autoStarted?: boolean }) => void;
  endTour: () => void;
  completeTour: (name: TourName) => Promise<void>;
  skipTour: (name: TourName) => Promise<void>;
  /**
   * Pure predicate (safe to call any number of times). Returns true only
   * when the welcome tour should auto-start for the current viewer on
   * the current path. (Kept for the welcome-tour redirect behaviour.)
   */
  shouldAutoStartWelcomeTour: (pathname: string) => boolean;
  /**
   * Which tour, if any, OWNS the current route — used by the help menu to
   * offer "Show me around this screen". Pure lookup, independent of
   * completion state.
   */
  resolveTourForRoute: (pathname: string) => TourName | null;
  /**
   * Which tour, if any, should AUTO-START for the current viewer on this
   * path right now — accounts for auth, the preferences blob, excluded
   * routes, and per-tour completion. Welcome takes priority as the global
   * first-run tour; otherwise the route's own tour (when unseen).
   */
  resolveAutoStartTour: (pathname: string) => TourName | null;
}

const TourContext = React.createContext<TourContextValue | null>(null);

export interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps): JSX.Element {
  const [activeTour, setActiveTour] = React.useState<TourName | null>(null);
  const [wasAutoStarted, setWasAutoStarted] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // Read tour status off the authStore. We deliberately do NOT memoize
  // the selector inside zustand so this re-renders whenever the user
  // blob changes.
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updatePreferences = useAuthStore((s) => s.updatePreferences);

  const tourStatus: Record<TourName, boolean> = React.useMemo(() => {
    const raw = (user?.preferences?.tours ?? {}) as Record<string, boolean>;
    const out = {} as Record<TourName, boolean>;
    for (const name of TOUR_NAMES) {
      out[name] = raw[name] === true;
    }
    return out;
  }, [user?.preferences?.tours]);

  const startTour = React.useCallback(
    (name: TourName, opts?: { autoStarted?: boolean }) => {
      setActiveTour(name);
      setWasAutoStarted(Boolean(opts?.autoStarted));
    },
    []
  );

  const endTour = React.useCallback(() => {
    setActiveTour(null);
    setWasAutoStarted(false);
  }, []);

  const persistTour = React.useCallback(
    async (name: TourName) => {
      setIsLoading(true);
      try {
        await updatePreferences({ tours: { [name]: true } as Record<string, boolean> });
      } catch (err) {
        // updatePreferences is itself wrapped in a try/catch that rolls
        // back the optimistic local state. Surface the failure via toast
        // and continue so the tour still closes.
        useToastStore.getState().push(t('tour.errors.persistFailed'), 'error');
        // Re-throw so callers can see the failure if they care.
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [updatePreferences]
  );

  const completeTour = React.useCallback(
    async (name: TourName) => {
      setActiveTour(null);
      try {
        await persistTour(name);
      } catch {
        // Swallow — already toasted.
      } finally {
        setWasAutoStarted(false);
      }
    },
    [persistTour]
  );

  const skipTour = React.useCallback(
    async (name: TourName) => {
      setActiveTour(null);
      try {
        await persistTour(name);
      } catch {
        // Swallow — already toasted.
      } finally {
        setWasAutoStarted(false);
      }
    },
    [persistTour]
  );

  const shouldAutoStartWelcomeTour = React.useCallback(
    (pathname: string): boolean => {
      if (!isAuthenticated) return false;
      if (!user) return false;
      // User exists but preferences haven't loaded yet — bail out
      // silently so we don't crash on a partial profile (acceptance #11).
      if (user.preferences === undefined) return false;
      if (tourStatus.welcome) return false;
      if (TOUR_EXCLUDED_ROUTES.includes(pathname)) return false;
      return true;
    },
    [isAuthenticated, user, tourStatus.welcome]
  );

  const resolveTourForRoute = React.useCallback(
    (pathname: string): TourName | null => resolveTourForRouteFromRegistry(pathname),
    []
  );

  const resolveAutoStartTour = React.useCallback(
    (pathname: string): TourName | null => {
      if (!isAuthenticated) return null;
      if (!user) return null;
      // Partial profile — preferences haven't loaded yet. Bail silently.
      if (user.preferences === undefined) return null;
      if (TOUR_EXCLUDED_ROUTES.includes(pathname)) return null;
      // Welcome is the global first-run tour and takes priority everywhere
      // (the auto-start component redirects to /dashboard to run it).
      if (!tourStatus.welcome) return 'welcome';
      // Otherwise: the tour that owns this screen, if the user hasn't seen
      // it yet and it opts into auto-start.
      const owner = TOUR_REGISTRY.find(
        (d) => d.name !== 'welcome' && d.autoStart && d.matchRoute(pathname)
      );
      if (owner && !tourStatus[owner.name]) return owner.name;
      return null;
    },
    [isAuthenticated, user, tourStatus]
  );

  const value: TourContextValue = React.useMemo(
    () => ({
      activeTour,
      tourStatus,
      isLoading,
      wasAutoStarted,
      startTour,
      endTour,
      completeTour,
      skipTour,
      shouldAutoStartWelcomeTour,
      resolveTourForRoute,
      resolveAutoStartTour,
    }),
    [
      activeTour,
      tourStatus,
      isLoading,
      wasAutoStarted,
      startTour,
      endTour,
      completeTour,
      skipTour,
      shouldAutoStartWelcomeTour,
      resolveTourForRoute,
      resolveAutoStartTour,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = React.useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour() must be used within a <TourProvider>');
  }
  return ctx;
}

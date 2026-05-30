/**
 * CR-052 — TourProvider unit tests.
 *
 * Pins:
 *   - tourStatus derives from useAuthStore().user.preferences.tours;
 *   - startTour / endTour update activeTour + wasAutoStarted;
 *   - completeTour + skipTour call updatePreferences with the right
 *     merged shape (NEVER overwrites siblings) and close the tour;
 *   - persistence failure surfaces a toast and closes cleanly (no UI
 *     strand);
 *   - shouldAutoStartWelcomeTour returns false on excluded routes /
 *     unauthenticated / partial profile / already-completed states.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { TourProvider, useTour, TOUR_EXCLUDED_ROUTES } from './TourProvider';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TourProvider>{children}</TourProvider>
);

function setUser(
  partial: Partial<
    NonNullable<ReturnType<typeof useAuthStore.getState>['user']>
  > | null
) {
  useAuthStore.setState({
    user: partial as any,
    token: 'tok',
    isAuthenticated: !!partial,
    isLoading: false,
  });
}

describe('CR-052 — TourProvider', () => {
  beforeEach(() => {
    useToastStore.setState({ items: [] });
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    vi.restoreAllMocks();
  });

  it('tourStatus.welcome reflects user.preferences.tours', () => {
    setUser({
      id: 'u',
      email: 'x@y.com',
      firstName: 'X',
      lastName: 'Y',
      role: 'program_coordinator',
      preferences: { hideLegacyImporter: true, tours: { welcome: true } },
    });
    const { result } = renderHook(() => useTour(), { wrapper });
    expect(result.current.tourStatus.welcome).toBe(true);
  });

  it('tourStatus.welcome is false when preferences.tours is absent', () => {
    setUser({
      id: 'u',
      email: 'x@y.com',
      firstName: 'X',
      lastName: 'Y',
      role: 'reader',
      preferences: { hideLegacyImporter: true },
    });
    const { result } = renderHook(() => useTour(), { wrapper });
    expect(result.current.tourStatus.welcome).toBe(false);
  });

  it('startTour sets activeTour and wasAutoStarted; endTour clears them', () => {
    const { result } = renderHook(() => useTour(), { wrapper });
    act(() => result.current.startTour('welcome', { autoStarted: true }));
    expect(result.current.activeTour).toBe('welcome');
    expect(result.current.wasAutoStarted).toBe(true);
    act(() => result.current.endTour());
    expect(result.current.activeTour).toBeNull();
    expect(result.current.wasAutoStarted).toBe(false);
  });

  it('completeTour calls updatePreferences with a MERGE-safe tours patch', async () => {
    const updatePrefs = vi.fn().mockResolvedValue(undefined);
    setUser({
      id: 'u',
      email: 'x@y.com',
      firstName: 'X',
      lastName: 'Y',
      role: 'admin',
      preferences: { hideLegacyImporter: false, tours: { other: true } },
    });
    useAuthStore.setState({ updatePreferences: updatePrefs as any });

    const { result } = renderHook(() => useTour(), { wrapper });
    act(() => result.current.startTour('welcome', { autoStarted: false }));
    await act(async () => {
      await result.current.completeTour('welcome');
    });

    expect(updatePrefs).toHaveBeenCalledTimes(1);
    expect(updatePrefs).toHaveBeenCalledWith({ tours: { welcome: true } });
    // The patch shape is a PARTIAL — the authStore merges with existing
    // tours, preserving `other: true`. Pinned separately in
    // authStore.preferences merging contract (server test).
    expect(result.current.activeTour).toBeNull();
  });

  it('skipTour also persists and closes', async () => {
    const updatePrefs = vi.fn().mockResolvedValue(undefined);
    setUser({
      id: 'u',
      email: 'x@y.com',
      firstName: 'X',
      lastName: 'Y',
      role: 'reader',
      preferences: { hideLegacyImporter: true },
    });
    useAuthStore.setState({ updatePreferences: updatePrefs as any });

    const { result } = renderHook(() => useTour(), { wrapper });
    act(() => result.current.startTour('welcome'));
    await act(async () => {
      await result.current.skipTour('welcome');
    });
    expect(updatePrefs).toHaveBeenCalledWith({ tours: { welcome: true } });
    expect(result.current.activeTour).toBeNull();
  });

  it('persistence failure surfaces a toast and closes cleanly', async () => {
    const updatePrefs = vi.fn().mockRejectedValue(new Error('boom'));
    setUser({
      id: 'u',
      email: 'x@y.com',
      firstName: 'X',
      lastName: 'Y',
      role: 'lead_reader',
      preferences: { hideLegacyImporter: true },
    });
    useAuthStore.setState({ updatePreferences: updatePrefs as any });

    const { result } = renderHook(() => useTour(), { wrapper });
    act(() => result.current.startTour('welcome'));
    await act(async () => {
      await result.current.completeTour('welcome');
    });

    expect(result.current.activeTour).toBeNull();
    await waitFor(() => {
      expect(useToastStore.getState().items.length).toBeGreaterThan(0);
    });
    expect(useToastStore.getState().items[0].variant).toBe('error');
  });

  describe('shouldAutoStartWelcomeTour', () => {
    it('returns false when unauthenticated', () => {
      setUser(null);
      const { result } = renderHook(() => useTour(), { wrapper });
      expect(result.current.shouldAutoStartWelcomeTour('/dashboard')).toBe(false);
    });

    it('returns false when user has no preferences blob yet (partial profile)', () => {
      setUser({
        id: 'u',
        email: 'x@y.com',
        firstName: 'X',
        lastName: 'Y',
        role: 'program_coordinator',
      });
      const { result } = renderHook(() => useTour(), { wrapper });
      expect(result.current.shouldAutoStartWelcomeTour('/dashboard')).toBe(false);
    });

    it('returns false when already completed', () => {
      setUser({
        id: 'u',
        email: 'x@y.com',
        firstName: 'X',
        lastName: 'Y',
        role: 'program_coordinator',
        preferences: { hideLegacyImporter: true, tours: { welcome: true } },
      });
      const { result } = renderHook(() => useTour(), { wrapper });
      expect(result.current.shouldAutoStartWelcomeTour('/dashboard')).toBe(false);
    });

    it('returns false on excluded routes', () => {
      setUser({
        id: 'u',
        email: 'x@y.com',
        firstName: 'X',
        lastName: 'Y',
        role: 'program_coordinator',
        preferences: { hideLegacyImporter: true },
      });
      const { result } = renderHook(() => useTour(), { wrapper });
      for (const route of TOUR_EXCLUDED_ROUTES) {
        expect(result.current.shouldAutoStartWelcomeTour(route)).toBe(false);
      }
    });

    it('returns true on /dashboard for a fresh authenticated user', () => {
      setUser({
        id: 'u',
        email: 'x@y.com',
        firstName: 'X',
        lastName: 'Y',
        role: 'program_coordinator',
        preferences: { hideLegacyImporter: true },
      });
      const { result } = renderHook(() => useTour(), { wrapper });
      expect(result.current.shouldAutoStartWelcomeTour('/dashboard')).toBe(true);
    });
  });
});

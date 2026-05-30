/**
 * CR-052 — HintProvider unit tests.
 *
 * Pins:
 *   - showHint dedups by id (no-op if a hint with that id is already active);
 *   - dismissHint removes; hasHint/getHint reflect state;
 *   - the provider is independent (no TourProvider required);
 *   - useHint throws when used outside the provider (developer-error
 *     contract).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, act, renderHook } from '@testing-library/react';
import { HintProvider, useHint } from './HintProvider';

describe('CR-052 — HintProvider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <HintProvider>{children}</HintProvider>
  );

  it('starts with no active hints', () => {
    const { result } = renderHook(() => useHint(), { wrapper });
    expect(result.current.activeHints).toEqual([]);
    expect(result.current.hasHint('any')).toBe(false);
    expect(result.current.getHint('any')).toBeUndefined();
  });

  it('showHint adds a hint; dismissHint removes it', () => {
    const { result } = renderHook(() => useHint(), { wrapper });
    act(() => {
      result.current.showHint({ id: 'a', message: 'hello', targetId: 't' });
    });
    expect(result.current.activeHints.length).toBe(1);
    expect(result.current.hasHint('a')).toBe(true);
    expect(result.current.getHint('a')?.message).toBe('hello');

    act(() => {
      result.current.dismissHint('a');
    });
    expect(result.current.activeHints.length).toBe(0);
    expect(result.current.hasHint('a')).toBe(false);
  });

  it('dedupes showHint by id (second call is a no-op)', () => {
    const { result } = renderHook(() => useHint(), { wrapper });
    act(() => {
      result.current.showHint({ id: 'a', message: 'first' });
    });
    act(() => {
      result.current.showHint({ id: 'a', message: 'second' });
    });
    expect(result.current.activeHints.length).toBe(1);
    // First message wins (dedup never replaces, only blocks).
    expect(result.current.getHint('a')?.message).toBe('first');
  });

  it('allows two hints with different ids simultaneously', () => {
    const { result } = renderHook(() => useHint(), { wrapper });
    act(() => {
      result.current.showHint({ id: 'a', message: 'first' });
      result.current.showHint({ id: 'b', message: 'second' });
    });
    expect(result.current.activeHints.map((h) => h.id).sort()).toEqual(['a', 'b']);
  });

  it('useHint throws outside the provider', () => {
    // Suppress the React error logging for this case.
    const original = console.error;
    console.error = () => {};
    try {
      function BareConsumer() {
        useHint();
        return null;
      }
      expect(() => render(<BareConsumer />)).toThrow(/within a <HintProvider>/);
    } finally {
      console.error = original;
    }
  });

  it('is independent of TourProvider (no tour context needed)', () => {
    // Render HintProvider WITHOUT TourProvider — must work normally.
    const { result } = renderHook(() => useHint(), { wrapper });
    act(() => result.current.showHint({ id: 'independence', message: 'ok' }));
    expect(result.current.hasHint('independence')).toBe(true);
  });
});

/**
 * CR-052 / Sprint 9.3 — useOnceHint unit tests.
 *
 * Pins:
 *   - fireOnce shows the hint the first time and marks it seen;
 *   - a second fireOnce (after the first) is a no-op even in a fresh render
 *     (persistence survives remount via localStorage);
 *   - reset() clears the ledger so the hint can fire again;
 *   - storage failures fail soft (no throw, hint still shows).
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { HintProvider, useHint } from './HintProvider';
import { useOnceHint, hasSeenHint, hintSeenKey } from './useOnceHint';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HintProvider>{children}</HintProvider>
);

// Combined hook so a single render exposes both the once-wrapper and the
// underlying hint state we want to assert on.
function useBoth() {
  return { once: useOnceHint(), hint: useHint() };
}

describe('CR-052 — useOnceHint', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires the hint the first time and records it as seen', () => {
    const { result } = renderHook(() => useBoth(), { wrapper });
    act(() => {
      result.current.once.fireOnce({ id: 'feat-x', message: 'hi', targetId: 't' });
    });
    expect(result.current.hint.hasHint('feat-x')).toBe(true);
    expect(hasSeenHint('feat-x')).toBe(true);
    expect(window.localStorage.getItem(hintSeenKey('feat-x'))).toBe('1');
  });

  it('does not fire again once seen — even after a remount', () => {
    const first = renderHook(() => useBoth(), { wrapper });
    act(() => {
      first.result.current.once.fireOnce({ id: 'feat-y', message: 'hi' });
    });
    expect(first.result.current.hint.hasHint('feat-y')).toBe(true);
    first.unmount();

    // Fresh provider (simulates a reload): the in-memory hint list is empty
    // but the localStorage ledger persists, so fireOnce stays a no-op.
    const second = renderHook(() => useBoth(), { wrapper });
    expect(second.result.current.hint.hasHint('feat-y')).toBe(false);
    act(() => {
      second.result.current.once.fireOnce({ id: 'feat-y', message: 'hi again' });
    });
    expect(second.result.current.hint.hasHint('feat-y')).toBe(false);
  });

  it('reset clears the ledger so the hint can fire again', () => {
    const { result } = renderHook(() => useBoth(), { wrapper });
    act(() => result.current.once.fireOnce({ id: 'feat-z', message: 'hi' }));
    expect(hasSeenHint('feat-z')).toBe(true);

    act(() => {
      result.current.once.reset('feat-z');
      result.current.hint.dismissHint('feat-z');
    });
    expect(hasSeenHint('feat-z')).toBe(false);

    act(() => result.current.once.fireOnce({ id: 'feat-z', message: 'again' }));
    expect(result.current.hint.hasHint('feat-z')).toBe(true);
  });

  it('fails soft when localStorage.getItem throws (still shows the hint)', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useBoth(), { wrapper });
    act(() => {
      result.current.once.fireOnce({ id: 'feat-soft', message: 'hi' });
    });
    // getItem throwing → hasSeenHint returns false → hint shows.
    expect(result.current.hint.hasHint('feat-soft')).toBe(true);
  });
});

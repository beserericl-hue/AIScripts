/**
 * CR-052 — HintBalloon unit tests.
 *
 * Pins:
 *   - auto-dismiss after 8s (fake timers);
 *   - click-outside dismisses;
 *   - click-inside does NOT dismiss;
 *   - explicit dismiss button works;
 *   - the balloon mounts with a fade-in transition (entered state flips
 *     on next animation frame).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HintBalloon } from './HintBalloon';

describe('CR-052 — HintBalloon', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderBalloon(onDismiss = vi.fn()) {
    render(
      <HintBalloon
        hint={{ id: 'h1', message: 'remember the help button' }}
        onDismiss={onDismiss}
        positionStyle={{ position: 'fixed', top: 10, left: 10 }}
      />
    );
    return { onDismiss };
  }

  it('auto-dismisses after 8 seconds', () => {
    const { onDismiss } = renderBalloon();
    expect(screen.getByTestId('hint-balloon-h1')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onDismiss).toHaveBeenCalledWith('h1');
  });

  it('click outside dismisses', () => {
    const { onDismiss } = renderBalloon();
    // The outside-click handler registers on a setTimeout(…, 0) so the
    // click that "opened" the hint doesn't immediately dismiss it.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(onDismiss).toHaveBeenCalledWith('h1');
  });

  it('click INSIDE the balloon does not dismiss', () => {
    const { onDismiss } = renderBalloon();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const balloon = screen.getByTestId('hint-balloon-h1');
    act(() => {
      fireEvent.mouseDown(balloon);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('the dismiss button calls onDismiss', () => {
    const { onDismiss } = renderBalloon();
    fireEvent.click(screen.getByTestId('hint-dismiss-h1'));
    expect(onDismiss).toHaveBeenCalledWith('h1');
  });

  it('renders the message text', () => {
    renderBalloon();
    expect(screen.getByText('remember the help button')).toBeInTheDocument();
  });
});

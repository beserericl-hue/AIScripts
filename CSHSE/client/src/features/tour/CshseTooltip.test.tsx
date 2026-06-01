/**
 * CR-052 — CshseTooltip unit tests.
 *
 * Pins the progress-bar math + the role of each button slot. The
 * tooltip is the only place that knows about the per-step Back/Skip/
 * Next/Finish semantics; if any of these silently flip, the user sees
 * the wrong affordance at the wrong moment.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CshseTooltip } from './CshseTooltip';

function makeProps(overrides: Partial<any> = {}) {
  const back = vi.fn();
  const close = vi.fn();
  const primary = vi.fn();
  const skip = vi.fn();
  return {
    backProps: { 'aria-label': 'back', onClick: back } as any,
    closeProps: { 'aria-label': 'close', onClick: close } as any,
    primaryProps: { 'aria-label': 'primary', onClick: primary } as any,
    skipProps: { 'aria-label': 'skip', onClick: skip } as any,
    tooltipProps: { 'data-test': 'wrap' } as any,
    step: { target: 'body', content: 'Hello there.' } as any,
    continuous: true,
    index: 0,
    size: 3,
    isLastStep: false,
    handlers: { back, close, primary, skip },
    ...overrides,
  };
}

describe('CR-052 — CshseTooltip', () => {
  it('renders the step content', () => {
    const p = makeProps();
    render(<CshseTooltip {...p} />);
    expect(screen.getByTestId('tour-tooltip-content')).toHaveTextContent('Hello there.');
  });

  it('progress fill width is ((index + 1) / size) * 100%', () => {
    const p = makeProps({ index: 2, size: 5 });
    render(<CshseTooltip {...p} />);
    const fill = screen.getByTestId('tour-tooltip-progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('60%');
  });

  it('Back is hidden on the first step (index === 0)', () => {
    render(<CshseTooltip {...makeProps({ index: 0 })} />);
    expect(screen.queryByTestId('tour-tooltip-back')).not.toBeInTheDocument();
  });

  it('Back is visible after the first step', () => {
    render(<CshseTooltip {...makeProps({ index: 1, size: 3 })} />);
    expect(screen.getByTestId('tour-tooltip-back')).toBeInTheDocument();
  });

  it('Skip is hidden on the last step', () => {
    render(<CshseTooltip {...makeProps({ index: 2, size: 3, isLastStep: true })} />);
    expect(screen.queryByTestId('tour-tooltip-skip')).not.toBeInTheDocument();
  });

  it('primary button reads "Next →" on a middle step and "Finish" on the last', () => {
    const { rerender } = render(
      <CshseTooltip {...makeProps({ index: 1, size: 3, isLastStep: false })} />
    );
    expect(screen.getByTestId('tour-tooltip-primary')).toHaveTextContent('Next →');
    rerender(
      <CshseTooltip {...makeProps({ index: 2, size: 3, isLastStep: true })} />
    );
    expect(screen.getByTestId('tour-tooltip-primary')).toHaveTextContent('Finish');
  });

  it('each button fires its prop handler when clicked', () => {
    const p = makeProps({ index: 1, size: 3, isLastStep: false });
    render(<CshseTooltip {...p} />);
    fireEvent.click(screen.getByTestId('tour-tooltip-back'));
    fireEvent.click(screen.getByTestId('tour-tooltip-skip'));
    fireEvent.click(screen.getByTestId('tour-tooltip-primary'));
    expect(p.handlers.back).toHaveBeenCalled();
    expect(p.handlers.skip).toHaveBeenCalled();
    expect(p.handlers.primary).toHaveBeenCalled();
  });

  it('step label reads "Step {current} of {total}"', () => {
    render(<CshseTooltip {...makeProps({ index: 0, size: 4 })} />);
    expect(screen.getByTestId('tour-tooltip-step-label')).toHaveTextContent('Step 1 of 4');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HoverTooltip } from './HoverTooltip';

describe('<HoverTooltip />', () => {
  it('shows the tip on mouseenter and hides on mouseleave', () => {
    render(
      <HoverTooltip text={'🔴 Gap — only 35% met.\nWhat still needs work:\n•  No evaluation process'} testId="dot">
        <span>🔴</span>
      </HoverTooltip>,
    );
    // Not shown until hovered — this is the bug we fixed (native title never
    // reliably displayed).
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('dot'));
    const tip = screen.getByRole('tooltip');
    expect(tip).toBeInTheDocument();
    expect(tip).toHaveTextContent(/Gap/);
    expect(tip).toHaveTextContent(/No evaluation process/);

    fireEvent.mouseLeave(screen.getByTestId('dot'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('also shows on keyboard focus and hides on Escape', () => {
    render(
      <HoverTooltip text="focus tip" testId="dot">
        <span>🟡</span>
      </HoverTooltip>,
    );
    fireEvent.focus(screen.getByTestId('dot'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('focus tip');
    fireEvent.keyDown(screen.getByTestId('dot'), { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('mirrors coverage state onto the trigger', () => {
    render(
      <HoverTooltip text="t" testId="dot" coverageState="gap">
        <span>🔴</span>
      </HoverTooltip>,
    );
    expect(screen.getByTestId('dot')).toHaveAttribute('data-coverage-state', 'gap');
  });
});

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

  // Sticky-tip regression (Kennesaw, Oct 2026)
  const openByHover = () => {
    render(
      <div>
        <HoverTooltip text="sticky tip" testId="dot"><span>🟢</span></HoverTooltip>
        <p data-testid="elsewhere">editor text</p>
      </div>,
    );
    fireEvent.mouseEnter(screen.getByTestId('dot'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  };

  it('closes when the user clicks anywhere else on the page', () => {
    openByHover();
    fireEvent.mouseDown(screen.getByTestId('elsewhere'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes when the window loses focus, on scroll, and on Escape pressed anywhere', () => {
    openByHover();
    fireEvent.blur(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('dot'));
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('dot'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('a mouse click does not pin the tip open via focus', () => {
    openByHover();
    const dot = screen.getByTestId('dot');
    const md = fireEvent.mouseDown(dot);
    expect(md).toBe(false); // default prevented → the dot is not focused by the click
    fireEvent.focus(dot); // even if focus arrives during the press…
    fireEvent.mouseUp(dot);
    fireEvent.mouseLeave(dot);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(); // …leaving closes it
  });

  it('pressing inside the dot does not close it', () => {
    openByHover();
    fireEvent.mouseDown(screen.getByTestId('dot'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});

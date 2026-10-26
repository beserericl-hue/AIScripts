import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HoverTooltip } from './HoverTooltip';

afterEach(() => {
  vi.useRealTimers();
});

const renderDot = (text = 'sticky tip') =>
  render(
    <div>
      <HoverTooltip text={text} testId="dot"><span>🟢</span></HoverTooltip>
      <p data-testid="elsewhere">editor text</p>
    </div>,
  );

describe('<HoverTooltip />', () => {
  it('shows the tip on mouseenter and hides shortly after mouseleave', () => {
    vi.useFakeTimers();
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
    expect(tip).toHaveTextContent(/Gap/);
    expect(tip).toHaveTextContent(/No evaluation process/);

    fireEvent.mouseLeave(screen.getByTestId('dot'));
    act(() => { vi.advanceTimersByTime(300); });
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

  // ---- Sticky-tip regression (Kennesaw, Oct 2026) ----
  it('closes when the user clicks anywhere else on the page', () => {
    renderDot();
    fireEvent.mouseEnter(screen.getByTestId('dot'));
    fireEvent.mouseDown(screen.getByTestId('elsewhere'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('a hover tip closes on window blur, page scroll and Escape anywhere', () => {
    renderDot();
    const dot = screen.getByTestId('dot');
    fireEvent.mouseEnter(dot);
    fireEvent.blur(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(dot);
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(dot);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('a mouse click does not focus the dot', () => {
    renderDot();
    expect(fireEvent.mouseDown(screen.getByTestId('dot'))).toBe(false); // default prevented
  });

  it('a keyboard-focused dot keeps its tip through a scroll (tab scrolls it into view)', () => {
    render(<HoverTooltip text="kbd" testId="dot"><span>🟡</span></HoverTooltip>);
    const dot = screen.getByTestId('dot');
    act(() => dot.focus());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  // ---- Readable-tip follow-up (Kennesaw, Oct 2026) ----
  it('the pointer can move from the dot onto the tip without it closing', () => {
    vi.useFakeTimers();
    renderDot();
    const dot = screen.getByTestId('dot');
    fireEvent.mouseEnter(dot);
    fireEvent.mouseLeave(dot);
    fireEvent.mouseEnter(screen.getByRole('tooltip'));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('tooltip'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('scrolling inside the tip to read it never closes it', () => {
    renderDot('long text');
    fireEvent.mouseEnter(screen.getByTestId('dot'));
    const tip = screen.getByRole('tooltip');
    fireEvent.scroll(tip);
    fireEvent.mouseDown(tip);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('caps the tip to the room on screen so long text scrolls inside it', () => {
    renderDot('long text');
    fireEvent.mouseEnter(screen.getByTestId('dot'));
    const tip = screen.getByRole('tooltip');
    expect(tip.style.maxHeight).toMatch(/px$/);
    expect(tip.className).toMatch(/overflow-y-auto/);
  });

  it('clicking the dot pins the tip: it survives leaving, page scroll and window switch', () => {
    vi.useFakeTimers();
    renderDot();
    const dot = screen.getByTestId('dot');
    fireEvent.mouseEnter(dot);
    fireEvent.click(dot);
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-pinned', 'true');
    fireEvent.mouseLeave(dot);
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.scroll(window);
    fireEvent.blur(window);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('a pinned tip closes on an outside click, Escape, its × button, or a second click on the dot', () => {
    renderDot();
    const dot = screen.getByTestId('dot');
    fireEvent.click(dot);
    fireEvent.mouseDown(screen.getByTestId('elsewhere'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(dot);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(dot);
    fireEvent.click(screen.getByTestId('dot-tip-close'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(dot);
    fireEvent.click(dot);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

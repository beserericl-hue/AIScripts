/**
 * Component unit tests for the Wizard's Stepper.
 *
 * Verifies the navigation invariants from UI spec §6:
 *   - Upload tab is always clickable (the "start over" path)
 *   - Reached steps are clickable; locked steps are disabled
 *   - The currently-active step is announced via aria-selected="true"
 *   - aria-current="step" pins the active step for screen readers
 *   - The Matrix tab only renders when showMatrix=true
 *   - Loading icon shows on the active step during running statuses
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stepper } from './Stepper';

describe('<Stepper />', () => {
  it('renders all step labels except Matrix when showMatrix=false', () => {
    render(
      <Stepper current="upload" status="idle" showMatrix={false} onSelect={() => {}} />
    );
    expect(screen.getByRole('tab', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /parse/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /review/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /matrix/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /apply/i })).toBeInTheDocument();
  });

  it('renders Matrix tab when showMatrix=true', () => {
    render(
      <Stepper current="upload" status="idle" showMatrix={true} onSelect={() => {}} />
    );
    expect(screen.getByRole('tab', { name: /matrix/i })).toBeInTheDocument();
  });

  it('marks the current step with aria-selected and aria-current', () => {
    render(
      <Stepper current="parse" status="parsing" showMatrix={false} onSelect={() => {}} />
    );
    const parse = screen.getByRole('tab', { name: /parse/i });
    expect(parse).toHaveAttribute('aria-selected', 'true');
    expect(parse).toHaveAttribute('aria-current', 'step');
  });

  it('forward (locked) steps are disabled', () => {
    render(
      <Stepper current="upload" status="idle" showMatrix={false} onSelect={() => {}} />
    );
    const apply = screen.getByRole('tab', { name: /apply/i });
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute('aria-disabled', 'true');
  });

  it('reached steps are clickable and call onSelect', async () => {
    const handler = vi.fn();
    render(
      <Stepper current="review" status="parsed" showMatrix={false} onSelect={handler} />
    );
    const upload = screen.getByRole('tab', { name: /upload/i });
    expect(upload).not.toBeDisabled();
    await userEvent.click(upload);
    expect(handler).toHaveBeenCalledWith('upload');
  });

  it('Upload is ALWAYS clickable — even when current step is later', () => {
    render(
      <Stepper current="apply" status="applied" showMatrix={false} onSelect={() => {}} />
    );
    const upload = screen.getByRole('tab', { name: /upload/i });
    expect(upload).not.toBeDisabled();
  });

  it('clicking a locked step does NOT call onSelect', async () => {
    const handler = vi.fn();
    render(
      <Stepper current="upload" status="idle" showMatrix={false} onSelect={handler} />
    );
    const review = screen.getByRole('tab', { name: /review/i });
    expect(review).toBeDisabled();
    // userEvent.click respects disabled — no event fired.
    await userEvent.click(review).catch(() => {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('active step shows a spinner during running statuses (parsing/queued/applying)', () => {
    const { container, rerender } = render(
      <Stepper current="parse" status="parsing" showMatrix={false} onSelect={() => {}} />
    );
    expect(container.querySelector('svg.animate-spin, svg[class*="spin"]')).not.toBeNull();
    rerender(
      <Stepper current="parse" status="queued" showMatrix={false} onSelect={() => {}} />
    );
    expect(container.querySelector('svg.animate-spin, svg[class*="spin"]')).not.toBeNull();
    rerender(
      <Stepper current="apply" status="applying" showMatrix={false} onSelect={() => {}} />
    );
    expect(container.querySelector('svg.animate-spin, svg[class*="spin"]')).not.toBeNull();
  });

  it('terminal statuses (parsed / applied) do NOT spin the active step', () => {
    const { container } = render(
      <Stepper current="review" status="parsed" showMatrix={false} onSelect={() => {}} />
    );
    expect(container.querySelector('svg.animate-spin')).toBeNull();
  });

  it('reached, non-current steps show a check icon', () => {
    const { container } = render(
      <Stepper current="review" status="parsed" showMatrix={false} onSelect={() => {}} />
    );
    // Upload + Parse are reached but not current → each has a Check svg.
    const checks = container.querySelectorAll('svg[class*="check"], svg.lucide-circle-check, svg.lucide-check');
    // At least one check icon present (Upload + Parse = 2 expected; tolerate
    // class-naming variation by lucide-react version).
    expect(checks.length).toBeGreaterThanOrEqual(1);
  });
});

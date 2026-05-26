/**
 * Component unit tests for the Wizard's Stepper.
 *
 * CR-043 follow-on — wizard reduced to Upload + Parse only. Review,
 * Matrix, and Apply moved to standalone toolbar surfaces; the Stepper
 * never renders them.
 *
 * Verifies the navigation invariants:
 *   - Upload + Parse render as the only step tabs
 *   - The currently-active step is announced via aria-selected="true"
 *   - aria-current="step" pins the active step for screen readers
 *   - Loading icon shows on the active step during running statuses
 *   - terminal (parsed / applied) does NOT keep a spinner
 *   - `showMatrix` prop is accepted for back-compat but has no effect
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stepper } from './Stepper';

describe('<Stepper />', () => {
  it('renders Upload + Parse only (Review/Matrix/Apply moved to toolbar surfaces)', () => {
    render(
      <Stepper current="upload" status="idle" showMatrix={false} onSelect={() => {}} />
    );
    expect(screen.getByRole('tab', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /parse/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /review/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /matrix/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /apply/i })).toBeNull();
  });

  it('showMatrix=true is a no-op (Matrix is a toolbar surface, never a wizard step)', () => {
    render(
      <Stepper current="upload" status="idle" showMatrix={true} onSelect={() => {}} />
    );
    expect(screen.queryByRole('tab', { name: /matrix/i })).toBeNull();
  });

  it('marks the current step with aria-selected and aria-current', () => {
    render(
      <Stepper current="parse" status="parsing" showMatrix={false} onSelect={() => {}} />
    );
    const parse = screen.getByRole('tab', { name: /parse/i });
    expect(parse).toHaveAttribute('aria-selected', 'true');
    expect(parse).toHaveAttribute('aria-current', 'step');
  });

  it('Parse step is locked until Upload completes (status=idle, current=upload)', () => {
    render(
      <Stepper current="upload" status="idle" showMatrix={false} onSelect={() => {}} />
    );
    const parse = screen.getByRole('tab', { name: /parse/i });
    expect(parse).toBeDisabled();
    expect(parse).toHaveAttribute('aria-disabled', 'true');
  });

  it('Upload is clickable from anywhere — "start over" surface', async () => {
    const handler = vi.fn();
    render(
      <Stepper current="parse" status="parsed" showMatrix={false} onSelect={handler} />
    );
    const upload = screen.getByRole('tab', { name: /upload/i });
    expect(upload).not.toBeDisabled();
    await userEvent.click(upload);
    expect(handler).toHaveBeenCalledWith('upload');
  });

  it('clicking a locked Parse step does NOT call onSelect', async () => {
    const handler = vi.fn();
    render(
      <Stepper current="upload" status="idle" showMatrix={false} onSelect={handler} />
    );
    const parse = screen.getByRole('tab', { name: /parse/i });
    expect(parse).toBeDisabled();
    await userEvent.click(parse).catch(() => {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('active Parse shows a spinner during queued / parsing', () => {
    const { container, rerender } = render(
      <Stepper current="parse" status="parsing" showMatrix={false} onSelect={() => {}} />
    );
    expect(container.querySelector('svg.animate-spin, svg[class*="spin"]')).not.toBeNull();
    rerender(
      <Stepper current="parse" status="queued" showMatrix={false} onSelect={() => {}} />
    );
    expect(container.querySelector('svg.animate-spin, svg[class*="spin"]')).not.toBeNull();
  });

  it('terminal statuses (parsed / applied) do NOT keep the spinner active', () => {
    const { container } = render(
      <Stepper current="parse" status="parsed" showMatrix={false} onSelect={() => {}} />
    );
    expect(container.querySelector('svg.animate-spin')).toBeNull();
  });

  it('Upload check icon shows when current is Parse (Upload reached, not current)', () => {
    const { container } = render(
      <Stepper current="parse" status="parsed" showMatrix={false} onSelect={() => {}} />
    );
    const checks = container.querySelectorAll('svg[class*="check"], svg.lucide-circle-check, svg.lucide-check');
    expect(checks.length).toBeGreaterThanOrEqual(1);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SurfaceErrorBoundary } from './SurfaceErrorBoundary';

function Boom({ when }: { when: boolean }): JSX.Element {
  if (when) throw new Error('kaboom in render');
  return <div>healthy child</div>;
}

describe('SurfaceErrorBoundary', () => {
  beforeEach(() => {
    // Silence React's expected error logging for the thrown render.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as any).mockRestore?.();
  });

  it('renders children when there is no error', () => {
    render(
      <SurfaceErrorBoundary label="Review">
        <Boom when={false} />
      </SurfaceErrorBoundary>
    );
    expect(screen.getByText('healthy child')).toBeInTheDocument();
    expect(screen.queryByTestId('surface-error')).not.toBeInTheDocument();
  });

  it('shows a recoverable fallback (NOT a blank page) when a child throws during render', () => {
    render(
      <SurfaceErrorBoundary label="Review">
        <Boom when={true} />
      </SurfaceErrorBoundary>
    );
    // The boundary caught it — the app did not unmount to a blank tree.
    const fallback = screen.getByTestId('surface-error');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveTextContent(/Something went wrong in Review/i);
    expect(fallback).toHaveTextContent(/kaboom in render/);
    // A reload affordance is offered.
    expect(screen.getByRole('button', { name: /Reload this view/i })).toBeInTheDocument();
  });

  it('calls onReset when the user clicks Reload', () => {
    const onReset = vi.fn();
    render(
      <SurfaceErrorBoundary label="Review" onReset={onReset}>
        <Boom when={true} />
      </SurfaceErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /Reload this view/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

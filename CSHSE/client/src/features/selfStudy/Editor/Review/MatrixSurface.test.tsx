/**
 * Component unit test for CR-043 MatrixSurface.
 *
 * Parallel coverage to ReviewSurface.test.tsx — the surface mounts
 * MatrixStep, propagates submissionId to the store, hydrates persisted
 * matrix state on mount + on prop changes, renders the "Matrix (CR-043)"
 * heading the E2E tests assert against, and wires the close callback.
 *
 * We stub MatrixStep so the test isolates the surface's own contract
 * (no course-catalog fetches, no matrix bucket-card tree).
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAIImportStore } from '../../../../store/aiImportStore';

vi.mock('../AIImport/steps/MatrixStep', () => ({
  MatrixStep: () => <div data-testid="matrix-step-stub">[MatrixStep]</div>,
}));

import { MatrixSurface } from './MatrixSurface';

describe('<MatrixSurface />', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
  });

  it("renders the 'Matrix (CR-043)' heading and the embedded MatrixStep", () => {
    render(<MatrixSurface submissionId="sub-1" onClose={() => {}} />);
    expect(
      screen.getByRole('heading', { name: /Matrix \(CR-043\)/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('matrix-step-stub')).toBeInTheDocument();
  });

  it('renders a Back to editor button that fires the onClose callback', async () => {
    const onClose = vi.fn();
    render(<MatrixSurface submissionId="sub-1" onClose={onClose} />);
    const btn = screen.getByRole('button', { name: /back to editor/i });
    await userEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sets submissionId on the store on mount', () => {
    render(<MatrixSurface submissionId="sub-mount-id" onClose={() => {}} />);
    expect(useAIImportStore.getState().submissionId).toBe('sub-mount-id');
  });

  it('calls loadPersistedReviewState on mount', () => {
    const spy = vi.spyOn(useAIImportStore.getState(), 'loadPersistedReviewState')
      .mockResolvedValue(undefined);
    render(<MatrixSurface submissionId="sub-1" onClose={() => {}} />);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('re-fires loadPersistedReviewState when submissionId prop changes', () => {
    const spy = vi.spyOn(useAIImportStore.getState(), 'loadPersistedReviewState')
      .mockResolvedValue(undefined);
    const { rerender } = render(
      <MatrixSurface submissionId="sub-1" onClose={() => {}} />
    );
    expect(spy).toHaveBeenCalledTimes(1);
    rerender(<MatrixSurface submissionId="sub-2" onClose={() => {}} />);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(useAIImportStore.getState().submissionId).toBe('sub-2');
    spy.mockRestore();
  });
});

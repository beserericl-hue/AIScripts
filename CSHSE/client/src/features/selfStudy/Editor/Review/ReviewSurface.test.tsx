/**
 * Component unit test for CR-043 ReviewSurface.
 *
 * The surface itself is thin — it sets submissionId on the store,
 * fires loadPersistedReviewState, renders the "Review" header
 * + a Back-to-editor close button, and embeds the larger ReviewStep
 * component. We mock ReviewStep so the test isolates the surface's
 * own contract:
 *   - submissionId propagates to the store
 *   - loadPersistedReviewState is called on mount + when submissionId changes
 *   - the close callback fires on click
 *   - the heading is the canonical 'Review' string that the
 *     E2E tests assert against (engineering CR-NNN identifiers are
 *     intentionally not exposed to end users)
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAIImportStore } from '../../../../store/aiImportStore';

// Stub ReviewStep — the surface's job is to mount it, not render it.
// Keeps the test focused on the surface's own responsibilities and
// avoids dragging in the entire bucket-card UI tree.
vi.mock('../AIImport/steps/ReviewStep', () => ({
  ReviewStep: () => <div data-testid="review-step-stub">[ReviewStep]</div>,
}));

import { ReviewSurface } from './ReviewSurface';

describe('<ReviewSurface />', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
  });

  it("renders the 'Review' heading and the embedded ReviewStep", () => {
    render(<ReviewSurface submissionId="sub-1" onClose={() => {}} />);
    expect(
      screen.getByRole('heading', { name: /^Review$/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('review-step-stub')).toBeInTheDocument();
  });

  it('renders a Back to editor button that fires the onClose callback', async () => {
    const onClose = vi.fn();
    render(<ReviewSurface submissionId="sub-1" onClose={onClose} />);
    const btn = screen.getByRole('button', { name: /back to editor/i });
    await userEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sets submissionId on the store on mount', () => {
    render(<ReviewSurface submissionId="sub-mount-id" onClose={() => {}} />);
    expect(useAIImportStore.getState().submissionId).toBe('sub-mount-id');
  });

  it('calls loadPersistedReviewState on mount', () => {
    const spy = vi.spyOn(useAIImportStore.getState(), 'loadPersistedReviewState')
      .mockResolvedValue(undefined);
    render(<ReviewSurface submissionId="sub-1" onClose={() => {}} />);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('re-fires loadPersistedReviewState when submissionId prop changes', () => {
    const spy = vi.spyOn(useAIImportStore.getState(), 'loadPersistedReviewState')
      .mockResolvedValue(undefined);
    const { rerender } = render(
      <ReviewSurface submissionId="sub-1" onClose={() => {}} />
    );
    expect(spy).toHaveBeenCalledTimes(1);
    rerender(<ReviewSurface submissionId="sub-2" onClose={() => {}} />);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(useAIImportStore.getState().submissionId).toBe('sub-2');
    spy.mockRestore();
  });
});

/**
 * CR-050 — SpecNotApplicableView unit tests (pure presentational view).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpecNotApplicableView } from './SpecNotApplicable';

const baseHandlers = {
  setReason: vi.fn(),
  onMark: vi.fn(),
  onClear: vi.fn(),
};

describe('SpecNotApplicableView', () => {
  it('renders the mark-N/A affordance when not excluded', () => {
    render(
      <SpecNotApplicableView
        excluded={false}
        reason=""
        disabled={false}
        isSaving={false}
        {...baseHandlers}
      />
    );
    expect(screen.getByText(/This spec does not apply/i)).toBeInTheDocument();
    expect(screen.getByTestId('spec-na-mark')).toBeEnabled();
  });

  it('fires onMark when the Mark button is clicked', () => {
    const onMark = vi.fn();
    render(
      <SpecNotApplicableView
        excluded={false}
        reason="No PhD faculty"
        disabled={false}
        isSaving={false}
        setReason={vi.fn()}
        onMark={onMark}
        onClear={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('spec-na-mark'));
    expect(onMark).toHaveBeenCalledOnce();
  });

  it('renders the "Marked Not Applicable" chip + reason when excluded', () => {
    render(
      <SpecNotApplicableView
        excluded
        excludedReason="No PhD faculty applicable to bachelors."
        reason=""
        disabled={false}
        isSaving={false}
        {...baseHandlers}
      />
    );
    expect(screen.getByText(/Marked Not Applicable/i)).toBeInTheDocument();
    expect(screen.getByText(/PhD faculty/i)).toBeInTheDocument();
  });

  it('fires onClear from the Restore button when excluded', () => {
    const onClear = vi.fn();
    render(
      <SpecNotApplicableView
        excluded
        excludedReason="x"
        reason=""
        disabled={false}
        isSaving={false}
        setReason={vi.fn()}
        onMark={vi.fn()}
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByText(/Restore/i));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('disables Mark + reason input when disabled / saving', () => {
    render(
      <SpecNotApplicableView
        excluded={false}
        reason=""
        disabled
        isSaving={false}
        {...baseHandlers}
      />
    );
    expect(screen.getByTestId('spec-na-mark')).toBeDisabled();
    expect(screen.getByTestId('spec-na-reason')).toBeDisabled();
  });
});

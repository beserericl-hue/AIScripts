/**
 * CR-008 / S2A.2 — FinalSubmitModal unit tests.
 * Pins the preflight contract: errors render as Go-to rows; warnings
 * render but don't block; Submit is disabled when preflight has errors
 * or while preflight is loading.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinalSubmitModal, type PreflightResult } from './FinalSubmitModal';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  validated: 50,
  total: 50,
  busy: false,
};

const emptyPreflight: PreflightResult = {
  submitDisabled: false,
  errors: [],
  warnings: [],
  counts: { totalSpecs: 50, passed: 50, excluded: 0, satisfied: 50, missing: 0 },
};

describe('FinalSubmitModal — pre-existing behavior', () => {
  it('does not render when open=false', () => {
    render(<FinalSubmitModal {...baseProps} open={false} />);
    expect(screen.queryByText(/Submit Self-Study/i)).not.toBeInTheDocument();
  });

  it('renders the validated count', () => {
    render(<FinalSubmitModal {...baseProps} preflight={emptyPreflight} />);
    expect(screen.getByText(/50 \/ 50/)).toBeInTheDocument();
  });

  it('fires onConfirm with the submission note', async () => {
    const onConfirm = vi.fn();
    render(<FinalSubmitModal {...baseProps} onConfirm={onConfirm} preflight={emptyPreflight} />);
    fireEvent.change(screen.getByLabelText(/Submission note/i), {
      target: { value: 'PC note  ' },
    });
    fireEvent.click(screen.getByTestId('final-submit-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('PC note');
  });
});

describe('FinalSubmitModal — CR-008 preflight', () => {
  it('renders the preflight loading indicator while pending', () => {
    render(<FinalSubmitModal {...baseProps} preflightLoading preflight={null} />);
    expect(screen.getByText(/Running pre-submission checks/i)).toBeInTheDocument();
    expect(screen.getByTestId('final-submit-confirm')).toBeDisabled();
  });

  it('disables Submit when preflight has errors', () => {
    const preflight: PreflightResult = {
      submitDisabled: true,
      errors: [
        { code: 'NARRATIVE_MISSING', message: 'Std 1.a needs a narrative.', standardCode: '1', specCode: 'a' },
        { code: 'NOT_EVALUATED', message: 'Std 2.a needs evaluation.', standardCode: '2', specCode: 'a' },
      ],
      warnings: [],
      counts: { totalSpecs: 50, passed: 48, excluded: 0, satisfied: 48, missing: 2 },
    };
    render(<FinalSubmitModal {...baseProps} preflight={preflight} />);
    expect(screen.getByTestId('preflight-errors')).toBeInTheDocument();
    expect(screen.getByText(/Std 1.a needs a narrative/i)).toBeInTheDocument();
    expect(screen.getByTestId('final-submit-confirm')).toBeDisabled();
  });

  it('"Go to" button on each error calls onGoToSpec with standard + spec codes', () => {
    const onGoToSpec = vi.fn();
    const preflight: PreflightResult = {
      submitDisabled: true,
      errors: [{ code: 'NARRATIVE_MISSING', message: 'x', standardCode: '3', specCode: 'b' }],
      warnings: [],
      counts: { totalSpecs: 1, passed: 0, excluded: 0, satisfied: 0, missing: 1 },
    };
    render(<FinalSubmitModal {...baseProps} preflight={preflight} onGoToSpec={onGoToSpec} />);
    fireEvent.click(screen.getByTestId('preflight-goto-3-b'));
    expect(onGoToSpec).toHaveBeenCalledWith('3', 'b');
  });

  it('renders warnings without disabling Submit', () => {
    const preflight: PreflightResult = {
      submitDisabled: false,
      errors: [],
      warnings: [{ code: 'MANY_EXCLUDED', message: '15 of 50 specs are N/A.' }],
      counts: { totalSpecs: 50, passed: 35, excluded: 15, satisfied: 50, missing: 0 },
    };
    render(<FinalSubmitModal {...baseProps} preflight={preflight} />);
    expect(screen.getByTestId('preflight-warnings')).toBeInTheDocument();
    expect(screen.getByText(/15 of 50 specs are N\/A/i)).toBeInTheDocument();
    expect(screen.getByTestId('final-submit-confirm')).toBeEnabled();
  });

  it('Submit is enabled when preflight is empty (no errors, no warnings)', () => {
    render(<FinalSubmitModal {...baseProps} preflight={emptyPreflight} />);
    expect(screen.getByTestId('final-submit-confirm')).toBeEnabled();
  });
});

/**
 * CR-049 S3.4 — ReaderOverrideView unit tests (pure presentational).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderOverrideView } from './ReaderOverrideControl';

const baseProps = {
  current: 'fail' as const,
  draft: null,
  setDraft: vi.fn(),
  note: '',
  setNote: vi.fn(),
  onSubmit: vi.fn(),
};

describe('ReaderOverrideView', () => {
  it('renders the three verdict choices', () => {
    render(<ReaderOverrideView {...baseProps} />);
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Needs improvement')).toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });

  it('marks the draft as the selected radio (not the current)', () => {
    render(<ReaderOverrideView {...baseProps} current="fail" draft="pass" />);
    expect(screen.getByTestId('override-verdict-pass').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('override-verdict-fail').getAttribute('aria-checked')).toBe('false');
  });

  it('Save is disabled when no draft is picked', () => {
    render(<ReaderOverrideView {...baseProps} draft={null} />);
    expect(screen.getByTestId('override-submit')).toBeDisabled();
  });

  it('Save is disabled when draft equals current (no change to save)', () => {
    render(<ReaderOverrideView {...baseProps} current="pass" draft="pass" />);
    expect(screen.getByTestId('override-submit')).toBeDisabled();
  });

  it('Save fires onSubmit when draft differs from current', () => {
    const onSubmit = vi.fn();
    render(<ReaderOverrideView {...baseProps} current="fail" draft="pass" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('override-submit'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('shows the "Reader-overridden" chip when the verdict already came from a reader', () => {
    render(<ReaderOverrideView {...baseProps} readerOverridden />);
    expect(screen.getByTestId('override-status-chip')).toBeInTheDocument();
  });

  it('disables everything when saving', () => {
    render(<ReaderOverrideView {...baseProps} draft="pass" saving />);
    expect(screen.getByTestId('override-verdict-pass')).toBeDisabled();
    expect(screen.getByTestId('override-note')).toBeDisabled();
    expect(screen.getByTestId('override-submit')).toBeDisabled();
  });
});

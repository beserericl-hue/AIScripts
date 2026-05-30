/**
 * CR-003 / S3.2 — Score4LevelSelector unit tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Score4LevelSelector } from './Score4LevelSelector';

describe('Score4LevelSelector', () => {
  it('renders all four levels with labels and short helper text', () => {
    render(<Score4LevelSelector value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Non')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Largely')).toBeInTheDocument();
    expect(screen.getByText('Fully')).toBeInTheDocument();
    expect(screen.getByText(/Not met/i)).toBeInTheDocument();
    expect(screen.getByText(/Fully met/i)).toBeInTheDocument();
  });

  it('marks the current value as the selected radio', () => {
    render(<Score4LevelSelector value={2} onChange={vi.fn()} />);
    expect(screen.getByTestId('score-2').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('score-0').getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<Score4LevelSelector value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('score-1'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('disables all buttons when disabled or saving', () => {
    const { rerender } = render(<Score4LevelSelector value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByTestId('score-0')).toBeDisabled();
    rerender(<Score4LevelSelector value={null} onChange={vi.fn()} saving />);
    expect(screen.getByTestId('score-3')).toBeDisabled();
  });
});

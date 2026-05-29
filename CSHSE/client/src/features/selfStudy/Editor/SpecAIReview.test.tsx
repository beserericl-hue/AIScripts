/**
 * CR-049 Phase 3 — SpecAIReviewView unit tests (pure presentational view).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpecAIReviewView, type SpecEvaluation } from './SpecAIReview';

const base = {
  isLoading: false,
  isEvaluating: false,
  canEvaluate: true,
  onEvaluate: vi.fn(),
};

describe('SpecAIReviewView', () => {
  it('renders the empty state when not yet reviewed', () => {
    render(<SpecAIReviewView {...base} evaluation={null} />);
    expect(screen.getByText(/Not yet reviewed/i)).toBeInTheDocument();
  });

  it('renders a Pass verdict + rationale', () => {
    const evaluation: SpecEvaluation = { verdict: 'pass', rationale: 'Meets the criteria fully.' };
    render(<SpecAIReviewView {...base} evaluation={evaluation} />);
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Meets the criteria fully.')).toBeInTheDocument();
  });

  it('renders a Needs improvement verdict + suggestions', () => {
    const evaluation: SpecEvaluation = {
      verdict: 'needs_improvement',
      rationale: 'Partial.',
      missingElements: ['Add evidence of regional accreditation', 'Cite the catalog'],
    };
    render(<SpecAIReviewView {...base} evaluation={evaluation} />);
    expect(screen.getByText('Needs improvement')).toBeInTheDocument();
    expect(screen.getByText('Add evidence of regional accreditation')).toBeInTheDocument();
    expect(screen.getByText('Cite the catalog')).toBeInTheDocument();
  });

  it('renders a Fail verdict + criteria coverage', () => {
    const evaluation: SpecEvaluation = {
      verdict: 'fail',
      rationale: 'Missing.',
      criteriaCoverage: [{ criterion: 'Regional accreditation', met: false, note: 'no mention' }],
    };
    render(<SpecAIReviewView {...base} evaluation={evaluation} />);
    expect(screen.getByText('Fail')).toBeInTheDocument();
    expect(screen.getByText(/Regional accreditation/)).toBeInTheDocument();
  });

  it('fires onEvaluate when Run AI Review is clicked', () => {
    const onEvaluate = vi.fn();
    render(<SpecAIReviewView {...base} evaluation={null} onEvaluate={onEvaluate} />);
    fireEvent.click(screen.getByTestId('run-ai-review'));
    expect(onEvaluate).toHaveBeenCalledOnce();
  });

  it('hides the Run button when canEvaluate is false (reader/read-only)', () => {
    render(<SpecAIReviewView {...base} canEvaluate={false} evaluation={{ verdict: 'pass', rationale: 'ok' }} />);
    expect(screen.queryByTestId('run-ai-review')).not.toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument(); // verdict still visible to readers
  });

  it('disables the button + shows Reviewing… while evaluating', () => {
    render(<SpecAIReviewView {...base} isEvaluating evaluation={null} />);
    const btn = screen.getByTestId('run-ai-review') as HTMLButtonElement;
    expect(btn).toBeDisabled();
    expect(screen.getByText('Reviewing…')).toBeInTheDocument();
  });
});

/**
 * CR-045 — PhaseIndicator unit tests.
 *
 * The strip is the wizard's progress bar: four chips
 * (Import / Drafts / Self-Study / Submit), the chip matching the
 * current view is highlighted, badges show the drafts count +
 * validation progress, and each chip jumps to its phase.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhaseIndicator } from './PhaseIndicator';

const baseProps = {
  activeView: 'standards' as const,
  setActiveView: vi.fn(),
  draftsCount: 0,
  validated: 0,
  totalSpecs: 0,
  onSubmitClick: vi.fn(),
};

describe('<PhaseIndicator />', () => {
  it('renders all four phase chips in order', () => {
    render(<PhaseIndicator {...baseProps} />);
    expect(screen.getByRole('button', { name: /1\. Import/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2\. Drafts/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\. Self-Study/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4\. Submit/ })).toBeInTheDocument();
  });

  it('marks the Self-Study chip active when activeView is a self-study view', () => {
    render(<PhaseIndicator {...baseProps} activeView="curriculum" />);
    const chip = screen.getByRole('button', { name: /3\. Self-Study/ });
    expect(chip).toHaveAttribute('data-active', 'true');
    expect(chip).toHaveAttribute('aria-current', 'step');
  });

  it('marks the Import chip active when in the ai-import view', () => {
    render(<PhaseIndicator {...baseProps} activeView="ai-import" />);
    expect(screen.getByRole('button', { name: /1\. Import/ })).toHaveAttribute('data-active', 'true');
  });

  it('marks the Drafts chip active for review-surface and matrix-surface', () => {
    const { rerender } = render(<PhaseIndicator {...baseProps} activeView="review-surface" />);
    expect(screen.getByRole('button', { name: /2\. Drafts/ })).toHaveAttribute('data-active', 'true');
    rerender(<PhaseIndicator {...baseProps} activeView="matrix-surface" />);
    expect(screen.getByRole('button', { name: /2\. Drafts/ })).toHaveAttribute('data-active', 'true');
  });

  it('marks the Self-Study chip active for the new introduction view', () => {
    render(<PhaseIndicator {...baseProps} activeView="introduction" />);
    expect(screen.getByRole('button', { name: /3\. Self-Study/ })).toHaveAttribute('data-active', 'true');
  });

  it('shows the drafts count badge only when > 0', () => {
    const { rerender } = render(<PhaseIndicator {...baseProps} draftsCount={0} />);
    // No badge → chip text is exactly the label (icon svg contributes no text).
    expect(screen.getByRole('button', { name: /2\. Drafts/ }).textContent).toBe('2. Drafts');
    rerender(<PhaseIndicator {...baseProps} draftsCount={15} />);
    expect(screen.getByRole('button', { name: /2\. Drafts/ })).toHaveTextContent('15');
  });

  it('shows the validation X/Y badge on the Self-Study chip', () => {
    render(<PhaseIndicator {...baseProps} validated={1} totalSpecs={83} />);
    expect(screen.getByRole('button', { name: /3\. Self-Study/ })).toHaveTextContent('1/83');
  });

  it('jumps to the canonical view on chip click', async () => {
    const setActiveView = vi.fn();
    render(<PhaseIndicator {...baseProps} setActiveView={setActiveView} />);
    await userEvent.click(screen.getByRole('button', { name: /1\. Import/ }));
    expect(setActiveView).toHaveBeenCalledWith('ai-import');
    await userEvent.click(screen.getByRole('button', { name: /2\. Drafts/ }));
    expect(setActiveView).toHaveBeenCalledWith('review-surface');
    await userEvent.click(screen.getByRole('button', { name: /3\. Self-Study/ }));
    expect(setActiveView).toHaveBeenCalledWith('standards');
  });

  it('fires onSubmitClick (not setActiveView to a view) for the Submit chip', async () => {
    const onSubmitClick = vi.fn();
    render(<PhaseIndicator {...baseProps} onSubmitClick={onSubmitClick} />);
    await userEvent.click(screen.getByRole('button', { name: /4\. Submit/ }));
    expect(onSubmitClick).toHaveBeenCalledTimes(1);
  });
});

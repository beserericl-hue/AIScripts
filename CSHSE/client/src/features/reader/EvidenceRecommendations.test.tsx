/**
 * CR-018 / Sprint 4.1 finish — EvidenceRecommendationsView unit tests.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceRecommendationsView } from './EvidenceRecommendations';
import type { EvidenceChunk } from './EvidenceRecommendations';

const sample: EvidenceChunk[] = [
  { score: 0.91, chunkId: 'c1', payload: { text: 'The org chart lists named roles.', filename: 'org-chart.pdf' } },
  { score: 0.71, chunkId: 'c2', payload: { snippet: 'Mission statement: …' } },
];

describe('EvidenceRecommendationsView', () => {
  it('renders the loading state', () => {
    render(<EvidenceRecommendationsView chunks={[]} isLoading />);
    expect(screen.getByTestId('evrec-loading')).toBeInTheDocument();
  });

  it('renders "No recommendations available." on error', () => {
    render(<EvidenceRecommendationsView chunks={[]} isLoading={false} error="boom" />);
    expect(screen.getByTestId('evrec-empty')).toBeInTheDocument();
  });

  it('renders "No recommendations available." when chunks empty', () => {
    render(<EvidenceRecommendationsView chunks={[]} isLoading={false} />);
    expect(screen.getByTestId('evrec-empty')).toBeInTheDocument();
  });

  it('renders one row per chunk with match-% and source label', () => {
    render(<EvidenceRecommendationsView chunks={sample} isLoading={false} />);
    expect(screen.getByTestId('evrec')).toBeInTheDocument();
    expect(screen.getByTestId('evrec-chunk-0')).toHaveTextContent(/match 91%/);
    expect(screen.getByTestId('evrec-chunk-0')).toHaveTextContent(/org-chart\.pdf/);
    expect(screen.getByTestId('evrec-chunk-0')).toHaveTextContent(/named roles/);
    expect(screen.getByTestId('evrec-chunk-1')).toHaveTextContent(/match 71%/);
    expect(screen.getByTestId('evrec-chunk-1')).toHaveTextContent(/Mission statement/);
  });

  it('truncates long text to ~220 chars + ellipsis', () => {
    const long = 'x'.repeat(500);
    render(<EvidenceRecommendationsView chunks={[{ score: 0.5, payload: { text: long } }]} isLoading={false} />);
    const row = screen.getByTestId('evrec-chunk-0');
    expect(row.textContent || '').toMatch(/…/);
    expect((row.textContent || '').length).toBeLessThan(360);
  });
});

/**
 * CR-009 / Sprint 5.1 — LeadReaderDashboardView unit tests (pure view).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LeadReaderDashboardView } from './LeadReaderDashboard';

function wrap(children: React.ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const sample = [
  { _id: 's1', submissionId: '2026-001', institutionName: 'Sample U', programName: 'HS', programLevel: 'bachelors', status: 'review_complete' },
  { _id: 's2', submissionId: '2026-002', institutionName: 'Other U', programName: 'HS', programLevel: 'masters', status: 'under_review' },
];

describe('LeadReaderDashboardView', () => {
  it('renders the loading state', () => {
    render(wrap(<LeadReaderDashboardView submissions={[]} isLoading />));
    expect(screen.getByTestId('lead-dashboard-loading')).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    render(wrap(<LeadReaderDashboardView submissions={[]} isLoading={false} />));
    expect(screen.getByTestId('lead-dashboard-empty')).toBeInTheDocument();
  });

  it('renders one row per submission, linked to /lead-reader/:id', () => {
    render(wrap(<LeadReaderDashboardView submissions={sample} isLoading={false} />));
    const item = screen.getByTestId('lead-submission-s1');
    expect(item).toHaveAttribute('href', '/lead-reader/s1');
    expect(screen.getByTestId('lead-submission-s2')).toHaveAttribute('href', '/lead-reader/s2');
  });

  it('shows the status label for known statuses', () => {
    render(wrap(<LeadReaderDashboardView submissions={sample} isLoading={false} />));
    expect(screen.getByText(/Review complete/)).toBeInTheDocument();
    expect(screen.getByText('Under review')).toBeInTheDocument();
  });
});

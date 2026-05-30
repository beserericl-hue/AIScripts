/**
 * S3.1 — ReaderDashboardView unit tests.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReaderDashboardView } from './ReaderDashboard';

const sample = [
  {
    _id: 'a',
    submissionId: '2026-001',
    institutionName: 'Stevenson University',
    programName: 'Human Services',
    programLevel: 'bachelors',
    status: 'under_review',
    createdAt: '2026-05-01T00:00:00Z',
  },
  {
    _id: 'b',
    submissionId: '2026-002',
    institutionName: 'Kennesaw State',
    programName: 'Human Services',
    programLevel: 'masters',
    status: 'submitted',
    createdAt: '2026-05-02T00:00:00Z',
  },
];

function wrap(children: React.ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('ReaderDashboardView', () => {
  it('renders the loading state', () => {
    render(wrap(<ReaderDashboardView submissions={[]} isLoading />));
    expect(screen.getByTestId('reader-dashboard-loading')).toBeInTheDocument();
  });

  it('renders an empty state when no submissions are returned', () => {
    render(wrap(<ReaderDashboardView submissions={[]} isLoading={false} />));
    expect(screen.getByTestId('reader-dashboard-empty')).toBeInTheDocument();
  });

  it('renders one row per submission with institution + program + level + status', () => {
    render(wrap(<ReaderDashboardView submissions={sample as any} isLoading={false} />));
    expect(screen.getByText('Stevenson University')).toBeInTheDocument();
    // Both submissions are "Human Services" — count matches instead of a single getByText.
    expect(screen.getAllByText(/Human Services/).length).toBe(2);
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getByText('Submitted — awaiting assignment')).toBeInTheDocument();
    expect(screen.getByTestId('reader-submission-a')).toHaveAttribute('href', '/reader/a');
    expect(screen.getByTestId('reader-submission-b')).toHaveAttribute('href', '/reader/b');
  });

  it('renders an error banner if the query failed', () => {
    render(wrap(<ReaderDashboardView submissions={[]} isLoading={false} error="boom" />));
    expect(screen.getByTestId('reader-dashboard-error')).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});

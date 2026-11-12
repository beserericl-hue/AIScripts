import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SiteVisitLinks, canOpenChecklist, siteVisitSubmissionId } from './SiteVisitLinks';

const r = (role: string) =>
  render(
    <MemoryRouter>
      <SiteVisitLinks submissionId="s1" role={role} />
    </MemoryRouter>
  );

describe('SiteVisitLinks', () => {
  it('POSITIVE: lead reader / admin / reader get checklist + itinerary links to the right routes', () => {
    for (const role of ['lead_reader', 'admin', 'reader']) {
      const { unmount } = r(role);
      expect(screen.getByTestId('site-visit-checklist-link-s1')).toHaveAttribute('href', '/site-visit/s1/checklist');
      expect(screen.getByTestId('site-visit-itinerary-link-s1')).toHaveAttribute('href', '/site-visit/s1/itinerary');
      unmount();
    }
  });
  it('NEGATIVE: a program coordinator gets the itinerary only (the checklist 403s for PCs)', () => {
    r('program_coordinator');
    expect(screen.queryByTestId('site-visit-checklist-link-s1')).not.toBeInTheDocument();
    expect(screen.getByTestId('site-visit-itinerary-link-s1')).toBeInTheDocument();
    expect(canOpenChecklist('program_coordinator')).toBe(false);
    expect(canOpenChecklist('board')).toBe(false);
  });
  it('renders nothing without a submission id; resolves populated ids', () => {
    const { container } = render(<MemoryRouter><SiteVisitLinks submissionId="" role="admin" /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
    expect(siteVisitSubmissionId({ _id: 'abc' })).toBe('abc');
    expect(siteVisitSubmissionId('xyz')).toBe('xyz');
  });
});

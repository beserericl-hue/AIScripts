import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw-server';
import { ReaderSelfStudyPanel } from './ReaderSelfStudyPanel';

const progress = { introMarked: 1, introTotal: 2, specsMarked: 3, specsTotal: 4, totalMarked: 4, total: 6, completedAt: null, acceptanceVote: '' };
const item = (id: string, assignmentType: 'reader' | 'lead_reader') => ({
  _id: id, institutionName: `Inst ${id}`, programName: 'HS', programLevel: 'associate', status: 'submitted', submittedAt: null, assignmentType, progress,
});

describe('ReaderSelfStudyPanel — site-visit entry points', () => {
  it('POSITIVE: the lead reader\'s row links to the checklist + itinerary; NEGATIVE: a plain reader row does not', async () => {
    server.use(http.get(/\/api\/reports\/reader-dashboard$/, () => HttpResponse.json({ items: [item('lead1', 'lead_reader'), item('read1', 'reader')] })));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ReaderSelfStudyPanel />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('site-visit-checklist-link-lead1')).toHaveAttribute('href', '/site-visit/lead1/checklist');
    expect(screen.getByTestId('site-visit-itinerary-link-lead1')).toHaveAttribute('href', '/site-visit/lead1/itinerary');
    expect(screen.queryByTestId('site-visit-links-read1')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw-server';
import { ReaderSelfStudyPanel } from './ReaderSelfStudyPanel';

describe('Reader dashboard row: Messages entry point', () => {
  it('opens the Messages screen for that self-study', async () => {
    server.use(
      http.get(/\/reports\/reader-dashboard$/, () =>
        HttpResponse.json({ items: [{ _id: 'sub1', institutionName: 'Anne Arundel Community College', programName: 'Self-Study', programLevel: 'associate', status: 'submitted', submittedAt: null, assignmentType: 'reader', progress: { introMarked: 1, introTotal: 2, specsMarked: 3, specsTotal: 4, total: 4, marked: 4 } }] })
      )
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<ReaderSelfStudyPanel />} />
            <Route path="/messages/:id" element={<div data-testid="messages-route">messages</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByTestId('reader-open-messages-sub1'));
    expect(screen.getByTestId('messages-route')).toBeInTheDocument();
  });
});

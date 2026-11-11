/**
 * CSHSE board decision (Nov 2026, via Lauri): "Remove the Curriculum Matrix and
 * any reference to the Matrix including in the Reader Checklist Boxes for each
 * standard." The Reader Report's per-specification checklist box keeps its
 * Files menu but has NO Matrix button, the top navigation has no Curriculum
 * Matrix tab, and the screen never calls a matrix endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '../../services/api';
import { ReaderReportEditor } from './ReaderReportEditor';

const reportData = {
  institutionName: 'Test U',
  programName: 'Human Services',
  levelTitle: 'Bachelor',
  recommendation: '',
  acceptanceVote: '',
  updatedAt: null,
  completedAt: null,
  standards: [
    {
      code: '11',
      title: 'Curriculum',
      aiMark: null,
      aiComment: '',
      readerMark: '',
      readerComment: '',
      specs: [
        {
          specCode: 'a',
          specTitle: 'Knowledge of the human services field',
          narrativeHtml: '<p>Our curriculum covers the field.</p>',
          evidenceHtml: '',
          aiMark: null,
          readerMark: '',
          readerComment: '',
        },
      ],
    },
  ],
};

function mount() {
  (api.get as any).mockImplementation((url: string) => {
    if (url.includes('/reader-report-data')) return Promise.resolve({ data: reportData });
    if (url.includes('/reader-reports')) return Promise.resolve({ data: { reports: [] } });
    if (url.includes('/evidence')) return Promise.resolve({ data: { evidence: [] } });
    if (url.includes('/comments')) return Promise.resolve({ data: { comments: [] } });
    return Promise.resolve({ data: {} });
  });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/reader-report/sub1']}>
        <Routes>
          <Route path="/reader-report/:submissionId" element={<ReaderReportEditor />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  (api.get as any).mockReset();
});

describe('Reader Report — no curriculum matrix in the checklist boxes', () => {
  it('a specification checklist box has its Files menu but no Matrix button', async () => {
    mount();
    const box = await screen.findByTestId('rr-check-11-a');
    // The box still offers the spec's linked files...
    expect(within(box).getByTestId('rr-files-11-a')).toBeTruthy();
    // ...but nothing that opens a curriculum matrix.
    expect(screen.queryByTestId('rr-matrix-11-a')).toBeNull();
    expect(document.querySelector('[data-testid^="rr-matrix-"]')).toBeNull();
    expect(within(box).queryByRole('button', { name: /matrix/i })).toBeNull();
    expect(within(box).queryByText(/matrix/i)).toBeNull();
  });

  it('has no Curriculum Matrix navigation tab and calls no matrix endpoint', async () => {
    mount();
    await screen.findByTestId('rr-check-11-a');
    expect(screen.queryByTestId('rr-nav-curriculum')).toBeNull();
    expect(screen.queryByRole('button', { name: /curriculum matrix/i })).toBeNull();
    for (const c of (api.get as any).mock.calls) expect(String(c[0])).not.toMatch(/matri/i);
  });
});

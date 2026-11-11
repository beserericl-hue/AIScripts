/**
 * CSHSE board decision (Nov 2026, via Lauri): the Curriculum Matrix is removed
 * from the self-study — no "Curriculum Matrix" tab, no "Matrix" drafts surface,
 * no "Matrix · 11.a" / "Open curriculum matrix" buttons, no ?view=matrix deep
 * link, and no matrix endpoint calls from the editor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '../../../services/api';
import { SelfStudyEditor } from './SelfStudyEditor';
import { useAIImportStore } from '../../../store/aiImportStore';

const standards = [
  { code: '2', title: 'Program Philosophy', part: 'I', specifications: [{ code: 'e', title: 'Curriculum' }] },
  { code: '11', title: 'Curriculum', part: 'II', specifications: [{ code: 'a', title: 'History' }] },
];
const submission = {
  _id: 'sub1',
  submissionId: 'sub1',
  programName: 'Human Services',
  programLevel: 'bachelors',
  status: 'in_progress',
  narratives: [],
  standardsStatus: {},
  institutionId: 'inst1',
};

function mount(initialPath = '/self-study/sub1') {
  window.history.replaceState({}, '', initialPath);
  (api.get as any).mockImplementation((url: string) => {
    if (url.includes('/api/standards')) return Promise.resolve({ data: standards });
    if (/\/api\/submissions\/sub1$/.test(url)) return Promise.resolve({ data: submission });
    if (url.includes('/evidence')) return Promise.resolve({ data: { evidence: [] } });
    if (url.includes('/comments')) return Promise.resolve({ data: { comments: [], counts: {} } });
    if (url.includes('/review')) return Promise.resolve({ data: { aiReviewState: null } });
    if (url.includes('/spec-parts')) return Promise.resolve({ data: { parts: {}, approvals: {} } });
    return Promise.resolve({ data: {} });
  });
  (api.post as any).mockResolvedValue({ data: {} });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[initialPath]}>
        <SelfStudyEditor submissionId="sub1" userRole="program_coordinator" userId="u1" userName="PC" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  (api.get as any).mockReset();
  (api.post as any).mockReset();
  useAIImportStore.getState().reset();
});

describe('SelfStudyEditor — no curriculum matrix', () => {
  it('the navigation has no Curriculum Matrix tab, no Matrix drafts surface and no matrix buttons', async () => {
    mount();
    await waitFor(() => expect(document.querySelector('[data-tour="ss-tab-standards"]')).toBeTruthy());
    // Open a curriculum standard (11), where the old "Matrix · 11.a" jump lived.
    const std11 = await screen.findAllByText('Standard 11');
    fireEvent.click(std11[0]);
    await waitFor(() => expect(screen.getAllByText(/Standard 11/).length).toBeGreaterThan(0));
    // Self-study tabs: Introduction / Standards / Supporting File Library only.
    expect(document.querySelector('[data-tour="ss-tab-introduction"]')).toBeTruthy();
    expect(document.querySelector('[data-tour="ss-tab-files"]')).toBeTruthy();
    expect(document.querySelector('[data-tour="ss-tab-curriculum"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /curriculum matrix/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^\s*matrix/i })).toBeNull();
    expect(screen.queryByTestId('view-in-matrix')).toBeNull();
    expect(screen.queryByText(/matrix/i)).toBeNull();
    for (const c of (api.get as any).mock.calls) expect(String(c[0])).not.toMatch(/matri/i);
  });

  it('a legacy ?view=matrix deep link does not open a matrix view', async () => {
    mount('/self-study/sub1?view=matrix');
    await waitFor(() => expect(document.querySelector('[data-tour="ss-tab-standards"]')).toBeTruthy());
    expect(screen.queryByText(/curriculum matrix/i)).toBeNull();
    expect(screen.queryByTestId('view-in-matrix')).toBeNull();
    for (const c of (api.get as any).mock.calls) expect(String(c[0])).not.toMatch(/matri/i);
  });
});

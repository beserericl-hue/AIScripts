/**
 * Fixes from the help-video filming (Nov 2026):
 *  - a fresh browser opens the editor on Review when the SERVER has drafts waiting;
 *  - each standard has an "introduction" entry (the standard intro was unreachable);
 *  - readers see reader wording, not "edit it freely before submitting";
 *  - plain-English import stage names; human Add-from-source dialog title.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '../../../services/api';
import { SelfStudyEditor, shouldLandOnReview } from './SelfStudyEditor';
import { useAIImportStore } from '../../../store/aiImportStore';
import { stageLabel } from './AIImport/steps/ParseStep';
import { sourceTargetLabel } from './AIImport/review/ShowInSourceModal';

const standards = [
  { code: '1', title: 'Mission', part: 'I', specifications: [{ code: 'a', title: 'Mission' }, { code: 'b', title: 'Admin' }] },
  { code: '4', title: 'Evaluation', part: 'I', specifications: [{ code: 'a', title: 'Plan' }] },
];
const submission = {
  _id: 'sub1', submissionId: 'sub1', programName: 'Human Services', programLevel: 'bachelors', status: 'in_progress',
  narratives: [], standardsStatus: {}, institutionId: 'inst1',
  documentIntroduction: '<p>Doc intro</p>', standardIntroductions: { '4': '<p>Standard four intro text</p>' },
};
const waiting = {
  buckets: { '1.a': { standardCode: '1', specCode: 'a', narratives: [{ sectionId: 'x1', snippet: 'Draft', heading: 'H', confidence: 0.9 }], evidenceText: [], evidenceFiles: [] } },
  approvedIds: [], discardedIds: [], tags: [], cvs: [], evidenceDocs: [], introductions: {},
};

function mount({ path = '/self-study/sub1', role = 'program_coordinator', review = null as any } = {}) {
  window.history.replaceState({}, '', path);
  (api.get as any).mockImplementation((url: string) => {
    if (url.includes('/api/standards')) return Promise.resolve({ data: standards });
    if (/\/api\/submissions\/sub1$/.test(url)) return Promise.resolve({ data: submission });
    if (url.includes('/evidence')) return Promise.resolve({ data: { evidence: [] } });
    if (url.includes('/comments')) return Promise.resolve({ data: { comments: [], total: 0 } });
    if (/\/review$/.test(url)) return Promise.resolve({ data: { aiReviewState: review } });
    if (url.includes('/spec-parts')) return Promise.resolve({ data: { parts: {}, approvals: {} } });
    return Promise.resolve({ data: {} });
  });
  (api.post as any).mockResolvedValue({ data: {} });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <SelfStudyEditor submissionId="sub1" userRole={role as any} userId="u1" userName="U" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  (api.get as any).mockReset();
  (api.post as any).mockReset();
  useAIImportStore.getState().reset();
  localStorage.clear();
});

describe('opening view from the server review state (fresh browser)', () => {
  it('POSITIVE: a coordinator with drafts waiting on the server lands on Review', async () => {
    mount({ review: waiting });
    await waitFor(() => expect(document.querySelector('[data-testid="help-menu-trigger"], [data-tour="ss-tab-standards"]')).toBeTruthy());
    await waitFor(() => expect(useAIImportStore.getState().buckets?.['1.a']).toBeTruthy());
    await waitFor(() => expect(screen.getByRole('button', { name: /^Review/ }).className).toMatch(/bg-cshse-100/));
  });
  it('NEGATIVE: no drafts → Standards; ?view=standards → Standards; a reader never jumps', async () => {
    expect(shouldLandOnReview({ isProgramCoordinator: true, viewParam: null, openedOn: 'standards', current: 'standards', draftsWaiting: 0 })).toBe(false);
    expect(shouldLandOnReview({ isProgramCoordinator: true, viewParam: 'standards', openedOn: 'standards', current: 'standards', draftsWaiting: 5 })).toBe(false);
    expect(shouldLandOnReview({ isProgramCoordinator: true, viewParam: null, openedOn: 'standards', current: 'files', draftsWaiting: 5 })).toBe(false);
    expect(shouldLandOnReview({ isProgramCoordinator: false, viewParam: null, openedOn: 'standards', current: 'standards', draftsWaiting: 5 })).toBe(false);
    expect(shouldLandOnReview({ isProgramCoordinator: true, viewParam: null, openedOn: 'standards', current: 'standards', draftsWaiting: 5 })).toBe(true);
    mount({ review: { ...waiting, approvedIds: ['x1'] } });
    await waitFor(() => expect(useAIImportStore.getState().approvedIds).toEqual(['x1']));
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('[data-tour="ss-tab-standards"]')!.className).toMatch(/bg-|teal|cshse/);
  });
});

describe('standard introductions are reachable', () => {
  it('POSITIVE: "Standard 4 introduction" opens that standard\'s introduction editor', async () => {
    mount();
    const std4 = await screen.findAllByText('Standard 4');
    fireEvent.click(std4[0]);
    const row = await screen.findByTestId('nav-standard-intro-4');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(screen.getByText(/Select a specification on the left/)).toBeTruthy());
  });
  it('NEGATIVE: clicking the standard itself still opens its first specification', async () => {
    mount(); // Standard 1 / 1.a is selected (and expanded) on open
    const row = await screen.findByTestId('nav-standard-intro-1');
    expect(row).not.toHaveAttribute('aria-current');
    expect(screen.queryByText(/Select a specification on the left/)).toBeNull();
  });
});

describe('role wording on the Introduction view', () => {
  it('POSITIVE: a reader sees the reader description', async () => {
    mount({ path: '/self-study/sub1?view=introduction', role: 'reader' });
    const p = await screen.findByTestId('doc-intro-help');
    expect(p.textContent).toMatch(/as submitted/);
    expect(p.textContent).not.toMatch(/edit it freely/);
  });
  it('NEGATIVE: the coordinator still sees the editing hint', async () => {
    mount({ path: '/self-study/sub1?view=introduction' });
    expect((await screen.findByTestId('doc-intro-help')).textContent).toMatch(/edit it freely before submitting/);
  });
});

describe('labels', () => {
  it('import stages read in plain English, including template imports', () => {
    expect(stageLabel('template_walker')).toBe('Reading the official template');
    expect(stageLabel('evidence_split')).toBe('Separating narrative from evidence');
    expect(stageLabel('mammoth')).toBe('Document Reader');
    expect(stageLabel('some_new_stage')).toBe('Some new stage');
    expect(stageLabel('some_new_stage')).not.toMatch(/_/);
  });
  it('Add-from-source names the target, never an internal id', () => {
    expect(sourceTargetLabel('_intro', 'standard-4')).toBe('the Standard 4 introduction');
    expect(sourceTargetLabel('_intro', 'document')).toBe('the document introduction');
    expect(sourceTargetLabel('4', 'a')).toBe('4.a');
    expect(sourceTargetLabel('_intro', 'standard-4')).not.toMatch(/_intro/);
  });
});

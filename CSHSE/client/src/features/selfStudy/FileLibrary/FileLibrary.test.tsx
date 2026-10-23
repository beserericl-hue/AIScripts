/**
 * File Library — every file counted in a Standard's badge must be listed.
 * Files filed on the Standard itself (no sub-spec) were counted but never
 * drawn (Kennesaw, Oct 2026: "19 files" with only 7 visible).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
import { api } from '../../../services/api';
import { FileLibrary } from './FileLibrary';

const ev = (name: string, standardCode?: string, specCode?: string) => ({
  _id: name, standardCode, specCode, evidenceType: 'file', title: name, file: { originalName: name, size: 1000 }, createdAt: '2026-10-20T00:00:00Z', tags: [],
});
const standards = [
  { code: '4', title: 'Program Evaluation', part: 'I', specifications: [{ code: 'a', title: 'Evaluation plan' }, { code: 'c', title: 'Outcomes' }] },
];
const evidence = [
  ev('APPENDIX IV 9 Alumni Survey Data.pdf', '4', 'c'),
  ev('APPENDIX IV 13 Learning Contract.pdf', '4'),
  ev('Old phantom.pdf', '4', 'z'),
];

beforeEach(() => {
  (api.get as any).mockReset();
  (api.get as any).mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/standards') ? standards : { evidence } }));
});

const ui = () => render(<QueryClientProvider client={new QueryClient()}><FileLibrary submissionId="s1" /></QueryClientProvider>);

describe('FileLibrary — standard-level files', () => {
  it('lists files filed on the Standard itself and under unknown sub-specs, not just known sub-specs', async () => {
    ui();
    await waitFor(() => expect(screen.getByText('3 files')).toBeTruthy());
    fireEvent.click(screen.getByText('Standard 4'));
    expect(screen.getByText('APPENDIX IV 9 Alumni Survey Data.pdf')).toBeTruthy();
    expect(screen.getByText('APPENDIX IV 13 Learning Contract.pdf')).toBeTruthy();
    expect(screen.getByText('Whole standard (no sub-specification)')).toBeTruthy();
    expect(screen.getByText('Old phantom.pdf')).toBeTruthy();
  });

  it('a standard-level file is not shown as Unassigned', async () => {
    ui();
    await waitFor(() => expect(screen.getByText('3 files')).toBeTruthy());
    expect(screen.queryByText(/Imported files awaiting a Standard/)).toBeNull();
  });
});

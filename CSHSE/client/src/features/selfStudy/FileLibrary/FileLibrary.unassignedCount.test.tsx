/**
 * The "Unassigned" chip and the Unassigned group must count the same files —
 * the ones that block submit (server: unassignedEvidenceFilter). Generated
 * Reader Report files and curriculum matrices have no Standard but are not
 * unassigned; on Stevenson dev the chip said 55 while the group said 57.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
import { api } from '../../../services/api';
import { FileLibrary, EXCLUDED_MATRIX_TAG, isUnassignedFile } from './FileLibrary';

const standards = [{ code: '1', title: 'Mission', part: 'I', specifications: [{ code: 'a', title: 'Mission' }] }];
const f = (id: string, extra: any = {}) => ({ _id: id, evidenceType: 'file', title: id, file: { originalName: `${id}.pdf`, size: 10 }, createdAt: '2026-11-01T00:00:00Z', tags: [], ...extra });
const evidence = [
  f('u1'), f('u2'), f('u3'),
  f('rr-pdf', { tags: ['ai-import', 'reader-report', 'reader-report:pdf'] }),
  f('rr-docx', { tags: ['ai-import', 'reader-report', 'reader-report:docx'] }),
  f('mx', { tags: [EXCLUDED_MATRIX_TAG] }),
  f('filed', { standardCode: '1', specCode: 'a' }),
];

function mount() {
  (api.get as any).mockImplementation((url: string) => Promise.resolve({ data: String(url).includes('/standards') ? standards : { evidence } }));
  return render(<QueryClientProvider client={new QueryClient()}><FileLibrary submissionId="s1" /></QueryClientProvider>);
}
beforeEach(() => (api.get as any).mockReset());

describe('FileLibrary — one definition of "unassigned"', () => {
  it('POSITIVE: chip and Unassigned group both count 3 (not the 2 reader reports or the matrix)', async () => {
    mount();
    const group = await screen.findByTestId('file-library-unassigned');
    expect(within(group).getByText(/^3 files$/)).toBeTruthy();
    expect(screen.getByTestId('file-filter-unassigned').textContent).toBe('Unassigned3');
    // generated reader reports have their own section
    const rr = screen.getByTestId('file-library-reader-reports');
    expect(within(rr).getByText(/^2 files$/)).toBeTruthy();
    fireEvent.click(within(rr).getByText('Generated reader reports'));
    expect(await screen.findByTestId('file-row-rr-pdf')).toBeTruthy();
  });

  it('NEGATIVE: reader reports, matrices, deleted and filed files are never unassigned', () => {
    expect(isUnassignedFile({ tags: ['reader-report', 'reader-report:pdf'] })).toBe(false);
    expect(isUnassignedFile({ tags: [EXCLUDED_MATRIX_TAG] })).toBe(false);
    expect(isUnassignedFile({ isDeleted: true })).toBe(false);
    expect(isUnassignedFile({ standardCode: '1' })).toBe(false);
    expect(isUnassignedFile({ tags: [] })).toBe(true);
  });
});

/**
 * CSHSE board decision (Nov 2026): the curriculum matrix is not part of the
 * self-study. A matrix file stays in the File Library, but the server tags it
 * 'excluded:curriculum-matrix' and leaves it unassigned. The library must label
 * it clearly and offer NO Assign / AI / Use Recommended actions for it, and it
 * must not be counted as an unassigned file — while a normal unassigned file
 * keeps all of those actions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
import { api } from '../../../services/api';
import { FileLibrary, EXCLUDED_MATRIX_TAG, EXCLUDED_MATRIX_LABEL } from './FileLibrary';

const standards = [
  { code: '2', title: 'Program Philosophy', part: 'I', specifications: [{ code: 'e', title: 'Curriculum' }] },
];
const aiPick = { kind: 'evidence', standardCode: '2', specCode: 'e', confidence: 0.9, reason: 'mentions the program' };
const excludedFile = {
  _id: 'mx1', evidenceType: 'file', title: 'Matrix.docx',
  file: { originalName: 'HSR Curriculum Map.docx', size: 1000 },
  createdAt: '2026-10-20T00:00:00Z',
  tags: [EXCLUDED_MATRIX_TAG],
  // Even if a stale AI placement is on the record, it must not be offered.
  metadata: { aiPlacement: aiPick },
};
const normalFile = {
  _id: 'n1', evidenceType: 'file', title: 'Handbook.pdf',
  file: { originalName: 'Student Handbook.pdf', size: 1000 },
  createdAt: '2026-10-20T00:00:00Z',
  tags: [],
  metadata: { aiPlacement: aiPick },
};

function mount(evidence: any[]) {
  (api.get as any).mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/standards') ? standards : { evidence } }));
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <FileLibrary submissionId="s1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  (api.get as any).mockReset();
});

describe('FileLibrary — files excluded from the self-study (curriculum matrix)', () => {
  it('labels an excluded matrix file and offers no Assign / AI actions for it', async () => {
    mount([excludedFile]);
    const section = await screen.findByTestId('file-library-excluded');
    // Not counted as an Unassigned file (no Unassigned group, no Use Recommended).
    expect(screen.queryByTestId('file-library-unassigned')).toBeNull();
    expect(screen.queryByTestId('use-recommended')).toBeNull();
    expect(screen.queryByTestId('file-filter-unassigned')?.textContent || '').toMatch(/0/);
    fireEvent.click(within(section).getByText('Not part of the self-study'));
    const row = await screen.findByTestId('file-row-mx1');
    expect(within(row).getByText('HSR Curriculum Map.docx')).toBeTruthy();
    expect(within(row).getByTestId('excluded-label-mx1').textContent).toBe(EXCLUDED_MATRIX_LABEL);
    expect(within(row).queryByText('Assign to Standard')).toBeNull();
    expect(within(row).queryByText('Change Standard')).toBeNull();
    expect(within(row).queryByTestId('ai-pick-mx1')).toBeNull();
    expect(within(row).queryByTestId('ai-accept-mx1')).toBeNull();
    expect(within(row).queryByText(/AI suggests/)).toBeNull();
    // Still downloadable / deletable from the library.
    expect(within(row).getByText('Delete')).toBeTruthy();
  });

  it('a normal unassigned file still has Assign + AI actions, and Use Recommended does not count the matrix file', async () => {
    mount([excludedFile, normalFile]);
    const unassigned = await screen.findByTestId('file-library-unassigned');
    // Only the normal file is counted.
    expect(within(unassigned).getByText('1 file')).toBeTruthy();
    expect(screen.getByTestId('use-recommended').textContent).toMatch(/Use Recommended \(1\)/);
    fireEvent.click(within(unassigned).getByText('Unassigned'));
    const row = await screen.findByTestId('file-row-n1');
    expect(within(row).getByText('Assign to Standard')).toBeTruthy();
    expect(within(row).getByTestId('ai-pick-n1')).toBeTruthy();
    expect(within(row).getByTestId('ai-accept-n1')).toBeTruthy();
    expect(within(row).queryByText(EXCLUDED_MATRIX_LABEL)).toBeNull();
    // The matrix file is not listed among the unassigned files.
    expect(within(unassigned).queryByText('HSR Curriculum Map.docx')).toBeNull();
    // ...and lives in its own excluded section.
    await waitFor(() => expect(screen.getByTestId('file-library-excluded')).toBeTruthy());
  });
});

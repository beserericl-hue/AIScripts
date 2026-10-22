/**
 * Import file panel — several files at once must never silently keep only the
 * first one (Kennesaw, Oct 2026). Multi-file goes through the placing bulk
 * importer and every file's placement is listed; a single file keeps the
 * preview-and-paste flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('../../../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from '../../../services/api';
import { ImportFilePanel } from './ImportFilePanel';
import { BulkUploadResults, placementLabel } from './BulkUploadResults';

const ui = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <ImportFilePanel submissionId="sub1" standardCode="1" specCode="a" canPasteNarrative={false} narrativeTargetLabel="" onPasteNarrative={() => {}} onClose={() => {}} readOnly={false} />
  </QueryClientProvider>
);
const pdf = (n: string) => new File(['%PDF'], n, { type: 'application/pdf' });

const post = api.post as unknown as ReturnType<typeof vi.fn>;
const get = api.get as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => { post.mockReset(); get.mockReset(); get.mockResolvedValue({ data: { previewable: false } }); });

describe('ImportFilePanel — multiple files', () => {
  it('sends ALL selected files to the bulk importer and lists each placement', async () => {
    post.mockResolvedValue({ data: { ok: true, count: 2, added: [
      { fileName: 'APPENDIX IV 9 Alumni Survey Data.pdf', placedStd: '4', placedSpec: 'c' },
      { fileName: 'Budget.pdf', placedStd: null, resolvedStd: '9', resolvedSpec: 'a' },
    ], skipped: [{ fileName: 'setup.exe', reason: 'File type not supported' }] } });
    ui();
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [pdf('APPENDIX IV 9 Alumni Survey Data.pdf'), pdf('Budget.pdf')] } });
    await waitFor(() => expect(screen.getByTestId('bulk-upload-results')).toBeTruthy());
    expect(post).toHaveBeenCalledTimes(1);
    const [url, form] = post.mock.calls[0];
    expect(url).toBe('/api/submissions/sub1/review/bulk-evidence');
    expect((form as FormData).getAll('files').map((f: any) => f.name)).toEqual(['APPENDIX IV 9 Alumni Survey Data.pdf', 'Budget.pdf']);
    expect(screen.getByTestId('bulk-upload-placement-0').textContent).toBe('Filed under Standard 4.c');
    expect(screen.getByTestId('bulk-upload-placement-1').textContent).toBe('Suggested 9.a — confirm in Review');
    expect(screen.getByTestId('bulk-upload-placement-2').textContent).toBe('Not uploaded — File type not supported');
  });

  it('a .url shortcut alone also goes to the bulk importer (becomes a link)', async () => {
    post.mockResolvedValue({ data: { ok: true, count: 1, added: [{ fileName: 'APPENDIX IV 18 Syllabi Links.url', placedStd: '4' }], skipped: [] } });
    ui();
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [new File(['[InternetShortcut]\nURL=https://x.edu'], 'APPENDIX IV 18 Syllabi Links.url')] } });
    await waitFor(() => expect(screen.getByTestId('bulk-upload-placement-0').textContent).toBe('Filed under Standard 4'));
    expect(post.mock.calls[0][0]).toMatch(/review\/bulk-evidence$/);
  });

  it('a single file still goes to the open spec (preview-and-paste flow)', async () => {
    post.mockResolvedValue({ data: { evidence: { _id: 'e1', file: { originalName: 'One.pdf' } } } });
    ui();
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [pdf('One.pdf')] } });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, form] = post.mock.calls[0];
    expect(url).toBe('/api/submissions/sub1/evidence/upload');
    expect(`${(form as FormData).get('standardCode')}.${(form as FormData).get('specCode')}`).toBe('1.a');
    expect(screen.queryByTestId('bulk-upload-results')).toBeNull();
  });

  it('a whole-batch rejection shows the error, not a silent success', async () => {
    post.mockRejectedValue({ response: { data: { error: 'None of the selected files can be uploaded.' } } });
    ui();
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [pdf('a.exe'), pdf('b.exe')] } });
    await waitFor(() => expect(screen.getByText(/None of the selected files can be uploaded/)).toBeTruthy());
  });
});

describe('placementLabel', () => {
  it('describes each outcome', () => {
    expect(placementLabel({ fileName: 'a', duplicateOf: 'x', placedStd: '4', placedSpec: 'c' }).text).toBe('Already uploaded · Standard 4.c');
    expect(placementLabel({ fileName: 'a' }).text).toBe('Unassigned — choose a Standard');
    expect(placementLabel({ fileName: 'a', error: 'too big' }).tone).toBe('bad');
  });
  it('renders nothing for an empty batch and counts filed vs pending', () => {
    const { container, rerender } = render(<BulkUploadResults rows={[]} skipped={[]} />);
    expect(container.innerHTML).toBe('');
    rerender(<BulkUploadResults rows={[{ fileName: 'a', placedStd: '4' }, { fileName: 'b' }, { fileName: 'c', duplicateOf: 'x' }]} />);
    expect(screen.getByTestId('bulk-upload-results').textContent).toMatch(/1 filed · 1 need a Standard · 3 total/);
  });
});

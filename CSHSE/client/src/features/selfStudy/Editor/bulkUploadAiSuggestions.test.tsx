/**
 * Kennesaw, 2026-11-19: after a 30-file appendix upload the AI read every file
 * and suggested a Standard, but the per-file list still said "Unassigned —
 * choose a Standard" (0 filed · 30 need a Standard). The list must show the
 * AI's suggestion and offer one click to file them all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('../../../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from '../../../services/api';
import { ImportFilePanel } from './ImportFilePanel';
import { applyAiSuggestions, acceptAiSuggestions, suggestedRows } from './bulkEvidenceUpload';
import { BulkUploadResults, placementLabel } from './BulkUploadResults';

const post = api.post as unknown as ReturnType<typeof vi.fn>;
const get = api.get as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => { post.mockReset(); get.mockReset(); get.mockResolvedValue({ data: { previewable: false } }); });
const pdf = (n: string) => new File(['%PDF'], n, { type: 'application/pdf' });

describe('applyAiSuggestions', () => {
  const rows = [
    { fileName: 'Agency Critique.pdf', fileId: 'e1' },
    { fileName: 'Notes.docx', fileId: 'e2' },
    { fileName: 'Filed.pdf', fileId: 'e3', placedStd: '4', placedSpec: 'a' },
    { fileName: 'NoResult.pdf', fileId: 'e4' },
    { fileName: 'Broken.pdf', fileId: 'e5' },
  ];
  const out = applyAiSuggestions(rows, [
    { id: 'e1', std: '12', spec: 'b', confidence: 0.85, kind: 'evidence', reason: 'HS 2200 group project' },
    { id: 'e2', kind: 'working_file', reason: 'meeting notes' },
    { id: 'e3', std: '9', spec: 'a', confidence: 0.9, kind: 'evidence' },
    { id: 'e5', error: 'unreadable' },
  ]);
  it('POSITIVE: a suggested file says where the AI would put it, not "Unassigned"', () => {
    expect(out[0]).toMatchObject({ resolvedStd: '12', resolvedSpec: 'b', aiSuggested: true });
    expect(placementLabel(out[0]).text).toBe('AI suggests Standard 12.b — not filed yet');
    expect(out[0].aiSuggestionRationale).toContain('85% sure');
    expect(placementLabel(out[1]).text).toMatch(/working material/);
  });
  it('NEGATIVE: already-filed, no-result and errored files are untouched', () => {
    expect(out[2]).toEqual(rows[2]);
    expect(placementLabel(out[2]).text).toBe('Filed under Standard 4.a');
    expect(out[3]).toEqual(rows[3]);
    expect(out[4]).toEqual(rows[4]);
    expect(placementLabel(out[3]).text).toBe('Unassigned — choose a Standard');
    expect(suggestedRows(out).map((r) => r.fileId)).toEqual(['e1']);
  });
});

describe('acceptAiSuggestions', () => {
  it('POSITIVE: files exactly the suggested rows and marks them filed', async () => {
    post.mockResolvedValue({ data: { ok: true, accepted: 1 } });
    const rows = applyAiSuggestions([{ fileName: 'a.pdf', fileId: 'e1' }, { fileName: 'b.pdf', fileId: 'e9' }], [{ id: 'e1', std: '13', spec: 'a', confidence: 0.6, kind: 'evidence' }]);
    const next = await acceptAiSuggestions('sub1', rows);
    expect(post).toHaveBeenCalledWith('/api/submissions/sub1/evidence/accept-ai-placements', { evidenceIds: ['e1'] });
    expect(placementLabel(next[0]).text).toBe('Filed under Standard 13.a (AI suggestion accepted)');
    expect(placementLabel(next[1]).text).toBe('Unassigned — choose a Standard');
  });
  it('NEGATIVE: nothing suggested → no request', async () => {
    const rows = [{ fileName: 'a.pdf', fileId: 'e1', placedStd: '1' }];
    expect(await acceptAiSuggestions('sub1', rows)).toBe(rows);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('BulkUploadResults summary', () => {
  it('counts AI suggestions separately and shows the file-all button only when some wait', () => {
    const onAccept = vi.fn();
    const { rerender } = render(<BulkUploadResults rows={[{ fileName: 'a', fileId: '1', aiSuggested: true, resolvedStd: '11', resolvedSpec: 'a' }, { fileName: 'b' }]} onAcceptSuggestions={onAccept} />);
    expect(screen.getByTestId('bulk-upload-summary').textContent).toBe('0 filed · 1 suggested by the AI · 1 need a Standard · 2 total');
    fireEvent.click(screen.getByTestId('bulk-upload-accept-ai'));
    expect(onAccept).toHaveBeenCalled();
    rerender(<BulkUploadResults rows={[{ fileName: 'a', placedStd: '11' }]} onAcceptSuggestions={onAccept} />);
    expect(screen.queryByTestId('bulk-upload-accept-ai')).toBeNull();
  });
});

describe('Upload Appendices panel — end to end with the AI pass', () => {
  it('after the AI pass the list shows suggestions, and "File all" files them', async () => {
    post.mockImplementation(async (url: string, body: any) => {
      if (url.endsWith('/review/bulk-evidence')) return { data: { ok: true, count: 2, added: [
        { fileName: 'APPENDIX XII/Agency Critique.pdf', fileId: 'e1', placedStd: null },
        { fileName: 'APPENDIX XII/Study Guide.docx', fileId: 'e2', placedStd: null },
      ] } };
      if (url.endsWith('/fill-missing-text')) return { data: { processed: 0, remaining: 0 } };
      if (url.endsWith('/ai-place-unassigned')) return { data: { processed: 2, placed: 2, remaining: 0, results: [
        { id: 'e1', std: '12', spec: 'b', confidence: 0.85, kind: 'evidence', reason: 'group project' },
        { id: 'e2', std: '11', spec: 'a', confidence: 0.5, kind: 'evidence', reason: 'study guide' },
      ] } };
      if (url.endsWith('/accept-ai-placements')) return { data: { ok: true, accepted: body.evidenceIds.length } };
      return { data: {} };
    });
    render(<QueryClientProvider client={new QueryClient()}><ImportFilePanel submissionId="sub1" standardCode="1" specCode="a" canPasteNarrative={false} narrativeTargetLabel="" onPasteNarrative={() => {}} onClose={() => {}} readOnly={false} /></QueryClientProvider>);
    expect(screen.getByText('Upload Appendices')).toBeTruthy();
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [pdf('Agency Critique.pdf'), pdf('Study Guide.pdf')] } });
    await waitFor(() => expect(screen.getByTestId('bulk-upload-placement-0').textContent).toBe('AI suggests Standard 12.b — not filed yet'));
    expect(screen.getByTestId('bulk-upload-placement-1').textContent).toBe('AI suggests Standard 11.a — not filed yet');
    expect(screen.queryByText('Unassigned — choose a Standard')).toBeNull();
    fireEvent.click(screen.getByTestId('bulk-upload-accept-ai'));
    await waitFor(() => expect(screen.getByTestId('bulk-upload-placement-0').textContent).toBe('Filed under Standard 12.b (AI suggestion accepted)'));
    expect(screen.getByTestId('bulk-upload-summary').textContent).toBe('2 filed · 0 need a Standard · 2 total');
    expect(post).toHaveBeenCalledWith('/api/submissions/sub1/evidence/accept-ai-placements', { evidenceIds: ['e1', 'e2'] });
  });
});

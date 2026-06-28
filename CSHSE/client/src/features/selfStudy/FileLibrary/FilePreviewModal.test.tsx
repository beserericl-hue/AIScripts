/**
 * FilePreviewModal — PDFs must render in their NATIVE format (an iframe / the
 * browser PDF viewer), NOT as an extracted-text dump (which confused users).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}));
import { api } from '../../../services/api';
import { FilePreviewModal } from './FilePreviewModal';

beforeEach(() => {
  vi.clearAllMocks();
  (URL as any).createObjectURL = vi.fn(() => 'blob:fake-pdf');
  (URL as any).revokeObjectURL = vi.fn();
});

describe('FilePreviewModal — native PDF', () => {
  it('renders the PDF in an iframe and NOT the extracted-text html', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve({
          data: {
            previewable: true,
            contentType: 'document',
            summary: 'A short summary',
            html: '<p>messy extracted text dump</p>',
          },
        });
      }
      // /download → blob
      return Promise.resolve({
        data: new Blob(['%PDF-1.4']),
        headers: { 'content-type': 'application/pdf' },
      });
    });

    render(
      <FilePreviewModal
        submissionId="s1"
        evidenceId="e1"
        fileName="report.pdf"
        mimeType="application/pdf"
        onClose={() => {}}
      />
    );

    const iframe = await screen.findByTestId('pdf-native-preview');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'blob:fake-pdf');
    // The messy extracted text is NOT shown for a PDF.
    expect(screen.queryByText(/messy extracted text dump/i)).not.toBeInTheDocument();
  });

  it('still renders the native PDF even if the text-extraction preview fails', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.reject({ response: { data: { error: 'extraction failed' } } });
      }
      return Promise.resolve({
        data: new Blob(['%PDF-1.4']),
        headers: { 'content-type': 'application/pdf' },
      });
    });

    render(
      <FilePreviewModal
        submissionId="s1"
        evidenceId="e1"
        fileName="report.pdf"
        mimeType="application/pdf"
        onClose={() => {}}
      />
    );

    expect(await screen.findByTestId('pdf-native-preview')).toBeInTheDocument();
  });
});

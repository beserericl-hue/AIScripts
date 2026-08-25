import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, AlertTriangle, FileText, Check } from 'lucide-react';
import { api } from '../../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface FilePreviewModalProps {
  submissionId: string;
  evidenceId: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  onClose: () => void;
  onDescriptionUpdated?: () => void;
}

interface PreviewResponse {
  previewable: boolean;
  contentType?: string;
  html?: string;
  summary?: string;
  error?: string;
  message?: string;
}

export function FilePreviewModal({
  submissionId,
  evidenceId,
  fileName,
  mimeType,
  fileSize,
  onClose,
  onDescriptionUpdated,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PDFs render in their NATIVE format (the browser's built-in viewer) instead
  // of a messy extracted-text dump, which confused users.
  const isPdf =
    (mimeType || '').toLowerCase().includes('pdf') || /\.pdf$/i.test(fileName || '');
  // xlsx / pptx render natively via the Microsoft Office web viewer (it needs a
  // public URL, which we mint on demand).
  const isOffice =
    (mimeType || '').toLowerCase().includes('spreadsheetml') ||
    (mimeType || '').toLowerCase().includes('presentationml') ||
    /\.(xlsx|pptx)$/i.test(fileName || '');
  const [officeUrl, setOfficeUrl] = useState<string | null>(null);
  const [savingSummary, setSavingSummary] = useState(false);
  const [summarySaved, setSummarySaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPreview() {
      // xlsx/pptx: mint a public URL and hand it to the Office web viewer. No
      // text-extraction preview needed — the viewer renders the real file.
      if (isOffice) {
        try {
          const resp = await api.get(
            `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/public-url`
          );
          if (cancelled) return;
          const publicUrl = resp.data?.url as string;
          if (publicUrl) {
            setOfficeUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`);
          } else {
            setError('Could not build a viewer link for this file.');
          }
        } catch (err: any) {
          if (cancelled) return;
          setError(err.response?.data?.error?.message || err.response?.data?.error || 'Could not load the Office viewer.');
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // 1) Text-extraction preview (summary + html) — best effort. For PDFs and
      //    images we can still render the native file even if this fails, so a
      //    preview error here is not fatal.
      let data: PreviewResponse | null = null;
      try {
        const response = await api.get(
          `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/preview`
        );
        if (cancelled) return;
        data = response.data;
        setPreview(data);
      } catch (err: any) {
        if (cancelled) return;
        if (!isPdf) {
          setError(err.response?.data?.error || 'Failed to load preview');
          setLoading(false);
          return;
        }
      }

      // 2) Native file blob. PDFs render in the browser's PDF viewer; images
      //    render inline.
      try {
        if (isPdf) {
          const pdfResponse = await api.get(
            `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/download`,
            { responseType: 'blob' }
          );
          if (cancelled) return;
          const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
          setPdfUrl(URL.createObjectURL(blob));
        } else if (data?.previewable && data.contentType === 'image') {
          const imgResponse = await api.get(
            `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/download`,
            { responseType: 'blob' }
          );
          if (cancelled) return;
          const blob = new Blob([imgResponse.data], {
            type: imgResponse.headers['content-type'] || 'image/png',
          });
          setImageUrl(URL.createObjectURL(blob));
        }
      } catch (err: any) {
        if (cancelled) return;
        if (!data) setError(err.response?.data?.error || 'Failed to load preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPreview();

    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [submissionId, evidenceId]);

  const handleDownload = async () => {
    try {
      const response = await api.get(
        `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/download`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download file');
    }
  };

  const handleSaveSummaryAsDescription = async () => {
    if (!preview?.summary || savingSummary) return;
    setSavingSummary(true);
    try {
      await api.patch(
        `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}`,
        { description: preview.summary }
      );
      setSummarySaved(true);
      onDescriptionUpdated?.();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Failed to save';
      setSaveError(typeof msg === 'string' ? msg : 'Failed to save description');
    } finally {
      setSavingSummary(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Rendered through a portal to <body> so it escapes any `position: sticky` /
  // transformed ancestor (e.g. the Reader Report's sticky checklist card) that
  // would otherwise trap this modal inside a lower stacking context and let
  // sibling cards paint over it. z-[100] keeps it above every in-page overlay.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-teal-600 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-800 truncate">
              {fileName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-3" />
              <span className="text-sm text-gray-500">Loading preview...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <p className="text-sm text-gray-700 mb-4">{error}</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download File Instead
              </button>
            </div>
          )}

          {/* Native PDF — render the real file in the browser's PDF viewer. */}
          {!loading && !error && isPdf && (
            <>
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  title={fileName}
                  data-testid="pdf-native-preview"
                  className="w-full h-[72vh] rounded-lg border border-gray-200 bg-gray-50"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                  <p className="text-sm text-gray-700 mb-4">Couldn’t load the PDF preview.</p>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download File Instead
                  </button>
                </div>
              )}
            </>
          )}

          {/* Native xlsx/pptx — Microsoft Office web viewer. */}
          {!loading && !error && isOffice && officeUrl && (
            <iframe
              src={officeUrl}
              title={fileName}
              data-testid="office-web-viewer"
              className="w-full h-[72vh] rounded-lg border border-gray-200 bg-gray-50"
            />
          )}

          {!loading && !error && !isPdf && !isOffice && preview && !preview.previewable && (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                Preview not available
              </p>
              <p className="text-sm text-gray-500 mb-5">
                {preview.message || 'This file type cannot be previewed in the browser.'}
              </p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download File Instead
              </button>
            </div>
          )}

          {!loading && !error && !isPdf && !isOffice && preview?.previewable && (
            <>
              {/* Summary box */}
              {preview.summary && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Summary
                    </h3>
                    {summarySaved ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Check className="w-3.5 h-3.5" />
                        Saved as description
                      </span>
                    ) : (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          disabled={savingSummary}
                          onChange={(e) => {
                            if (e.target.checked) handleSaveSummaryAsDescription();
                          }}
                        />
                        <span className="text-xs text-gray-500">
                          {savingSummary ? 'Saving...' : 'Use as file description'}
                        </span>
                      </label>
                    )}
                  </div>
                  {saveError && (
                    <p className="text-xs text-red-600 mb-1">{saveError}</p>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {preview.summary}
                  </p>
                </div>
              )}

              {/* Image preview */}
              {preview.contentType === 'image' && imageUrl && (
                <div className="flex justify-center">
                  <img
                    src={imageUrl}
                    alt={fileName}
                    className="max-w-full max-h-[60vh] rounded-lg border border-gray-200 shadow-sm"
                  />
                </div>
              )}

              {/* Document HTML preview (PDF/DOCX) */}
              {preview.contentType === 'document' && preview.html && (
                <div
                  className="prose prose-sm max-w-none
                    prose-headings:text-gray-800 prose-headings:font-semibold
                    prose-p:text-gray-700 prose-p:leading-relaxed
                    prose-table:border-collapse prose-table:w-full
                    prose-td:border prose-td:border-gray-300 prose-td:px-2 prose-td:py-1 prose-td:text-sm
                    prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:px-2 prose-th:py-1 prose-th:text-sm prose-th:font-semibold
                    prose-li:text-gray-700
                    prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

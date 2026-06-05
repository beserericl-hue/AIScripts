/**
 * ImportFilePanel — CR-059.
 *
 * A standalone, right-side drawer in the Self-Study editor (outside the AI
 * Import Wizard). It replaces the legacy per-standard "Import Document" editor.
 *
 * Flow:
 *   1. Drag/drop OR browse ONE file. It uploads immediately and is auto-retained
 *      as a SupportingEvidence record (this IS "importing the file") — it shows
 *      up in the File Library / EvidencePanel right away (the evidence query is
 *      invalidated). No separate "keep" step.
 *   2. The parsed document renders in a preview pane (reuses the same server
 *      parse path as FilePreviewModal — GET /evidence/:id/preview).
 *   3. The PC selects a section (native browser text selection) and pastes it as
 *      a summary into EITHER:
 *        - the active standard/sub-spec narrative (or the Introduction), via the
 *          parent-supplied onPasteNarrative (fires the editor's autosave); OR
 *        - the imported file's supporting-evidence description (PATCH
 *          /evidence/:id), appended to any existing summary.
 *      The two targets are independent and non-exclusive.
 *
 * No new server endpoints, no AI — pure reuse of upload / preview / patch.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ClipboardPaste,
  FilePlus2,
} from 'lucide-react';
import { api } from '../../../services/api';

// Mirror FileUpload.tsx's accept list + cap (those constants aren't exported).
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface PreviewResponse {
  previewable: boolean;
  contentType?: string;
  html?: string;
  summary?: string;
  error?: string;
  message?: string;
}

interface ImportedEvidence {
  _id: string;
  description?: string;
  originalName?: string;
}

export interface ImportFilePanelProps {
  submissionId: string;
  /** Active standard selection (always present). */
  standardCode: string;
  /** Active sub-spec, or null/undefined at standard level. */
  specCode?: string | null;
  /** Whether a narrative paste target exists (spec narrative or Introduction). */
  canPasteNarrative: boolean;
  /** Human label for the narrative target, e.g. "Standard 2.a" or "Introduction". */
  narrativeTargetLabel?: string;
  /** Paste the given HTML into the active narrative surface (parent wires the editor). */
  onPasteNarrative: (html: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export function ImportFilePanel({
  submissionId,
  standardCode,
  specCode,
  canPasteNarrative,
  narrativeTargetLabel,
  onPasteNarrative,
  onClose,
  readOnly = false,
}: ImportFilePanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportedEvidence | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [summary, setSummary] = useState<string>(''); // current evidence description
  const [savingSummary, setSavingSummary] = useState(false);
  const [pasteFlash, setPasteFlash] = useState<null | 'narrative' | 'summary'>(null);
  // Captured selection (html + text) from the preview. Captured on
  // 'selectionchange' rather than read live at click time, so the paste
  // buttons still work after the user moves focus to click them.
  const [selected, setSelected] = useState<{ html: string; text: string } | null>(null);

  const refreshEvidence = () => {
    // Prefix-match invalidation: refreshes the File Library + every per-spec
    // EvidencePanel for this submission so the imported file appears at once.
    queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
  };

  const validate = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'File type not supported.';
    if (file.size > MAX_FILE_SIZE) return 'File exceeds the 50MB limit.';
    return null;
  };

  const handleFile = async (file: File) => {
    setError(null);
    const v = validate(file);
    if (v) {
      setError(v);
      return;
    }
    setUploading(true);
    setImported(null);
    setPreview(null);
    setSummary('');
    setSelected(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('standardCode', standardCode);
      if (specCode) form.append('specCode', specCode);
      form.append('title', file.name);
      const res = await api.post(
        `/api/submissions/${submissionId}/evidence/upload`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const ev = res.data?.evidence;
      const rec: ImportedEvidence = {
        _id: ev?._id,
        description: ev?.description || ev?.metadata?.description || '',
        originalName: ev?.file?.originalName || file.name,
      };
      setImported(rec);
      setSummary(rec.description || '');
      // The file is now an imported supporting-evidence record — surface it.
      refreshEvidence();
      void loadPreview(rec._id);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const loadPreview = async (evidenceId: string) => {
    setPreviewLoading(true);
    try {
      const res = await api.get(
        `/api/submissions/${submissionId}/evidence/${evidenceId}/preview`
      );
      setPreview(res.data as PreviewResponse);
    } catch (err: any) {
      setPreview({
        previewable: false,
        message:
          err?.response?.data?.message || err?.message || 'Could not load preview.',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // --- selection capture ------------------------------------------------
  // Capture a selection made inside the preview into state. Listening to
  // 'selectionchange' (not reading live at click time) means the capture
  // survives the focus shift when the PC clicks a paste button.
  useEffect(() => {
    const onSelChange = () => {
      const sel = window.getSelection();
      if (
        !sel ||
        sel.rangeCount === 0 ||
        sel.isCollapsed ||
        !previewRef.current ||
        !previewRef.current.contains(sel.anchorNode)
      ) {
        return; // keep the last valid capture; don't clear on focus shift
      }
      const div = document.createElement('div');
      for (let i = 0; i < sel.rangeCount; i++) {
        div.appendChild(sel.getRangeAt(i).cloneContents());
      }
      const html = div.innerHTML.trim();
      const text = sel.toString().trim();
      if (html || text) setSelected({ html, text });
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

  // Selected fragment, or the whole document as a sensible fallback.
  const getSelectedHtml = (): string =>
    (selected?.html && selected.html) || preview?.html || '';
  const getSelectedText = (): string =>
    (selected?.text && selected.text) || (preview?.summary || '').trim();

  const flash = (which: 'narrative' | 'summary') => {
    setPasteFlash(which);
    window.setTimeout(() => setPasteFlash(null), 3000);
  };

  const handlePasteNarrative = () => {
    if (!canPasteNarrative || readOnly) return;
    const html = getSelectedHtml();
    if (!html) return;
    onPasteNarrative(html);
    flash('narrative');
  };

  const handlePasteSummary = async () => {
    if (!imported?._id || readOnly) return;
    const text = getSelectedText();
    if (!text) return;
    setSavingSummary(true);
    setError(null);
    try {
      // Append to any existing summary, separated by a blank line.
      const next = summary && summary.trim() ? `${summary.trim()}\n\n${text}` : text;
      await api.patch(
        `/api/submissions/${submissionId}/evidence/${imported._id}`,
        { description: next }
      );
      setSummary(next);
      refreshEvidence();
      flash('summary');
    } catch (err: any) {
      setError(
        err?.response?.data?.error || err?.message || 'Could not save the summary.'
      );
    } finally {
      setSavingSummary(false);
    }
  };

  // Reset everything if the active spec/standard changes under us.
  useEffect(() => {
    setImported(null);
    setPreview(null);
    setSummary('');
    setError(null);
    setSelected(null);
  }, [standardCode, specCode]);

  return (
    <div
      data-testid="import-file-panel"
      className="w-[520px] max-w-[90vw] h-full max-h-full flex-shrink-0 border-l border-gray-200 bg-white shadow-lg flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <FilePlus2 className="h-4 w-4 text-teal-600" />
          Import file
        </div>
        <button
          onClick={onClose}
          data-testid="import-file-close"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <p className="text-xs text-gray-500">
          Bring in one file (CV, syllabus, project, or a section draft). It is
          saved to your File Library automatically. Then select any part of the
          preview and paste it into your narrative or as a file summary.
        </p>

        {/* Drop zone */}
        <div
          data-testid="import-file-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          onClick={() => !readOnly && fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            isDragging
              ? 'border-teal-400 bg-teal-50'
              : 'border-gray-300 hover:border-teal-300 hover:bg-gray-50'
          } ${readOnly ? 'pointer-events-none opacity-50' : ''}`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          ) : (
            <Upload className="h-6 w-6 text-gray-400" />
          )}
          <span className="mt-2 text-sm text-gray-600">
            {uploading
              ? 'Uploading…'
              : 'Drag a file here, or click to browse'}
          </span>
          <span className="mt-1 text-[11px] text-gray-400">
            PDF, Word, PowerPoint, Excel, or image · up to 50MB
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
            className="hidden"
            data-testid="import-file-input"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span data-testid="import-file-error">{error}</span>
          </div>
        )}

        {imported && (
          <div
            data-testid="import-file-imported"
            className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800"
          >
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Imported <strong>{imported.originalName}</strong> — saved to your
              File Library.
            </span>
          </div>
        )}

        {/* Preview */}
        {(previewLoading || preview) && (
          <div className="rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-600">
              <FileText className="h-3.5 w-3.5" />
              Document preview
              <span className="ml-auto text-[11px] font-normal text-gray-400">
                select text below, then paste it →
              </span>
            </div>
            <div className="max-h-[40vh] overflow-auto p-3">
              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
                </div>
              ) : preview?.previewable && preview.contentType === 'document' && preview.html ? (
                <div
                  ref={previewRef}
                  data-testid="import-file-preview"
                  className="prose prose-sm max-w-none
                    prose-headings:text-gray-800 prose-headings:font-semibold
                    prose-p:text-gray-700 prose-p:leading-relaxed
                    prose-a:text-teal-600"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <div className="text-sm text-gray-500" data-testid="import-file-preview">
                  {preview?.message ||
                    'This file type can’t be previewed, but it is saved to your File Library.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paste actions */}
        {imported && (
          <div className="space-y-2">
            <button
              onClick={handlePasteNarrative}
              disabled={!canPasteNarrative || readOnly}
              data-testid="import-file-paste-narrative"
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                canPasteNarrative && !readOnly
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
              title={
                canPasteNarrative
                  ? `Paste the selected text into ${narrativeTargetLabel || 'the narrative'}`
                  : 'Select a sub-specification (or the Introduction) to paste into the narrative'
              }
            >
              <ClipboardPaste className="h-4 w-4" />
              {pasteFlash === 'narrative'
                ? 'Pasted into narrative ✓'
                : `Paste into narrative${
                    narrativeTargetLabel ? ` (${narrativeTargetLabel})` : ''
                  }`}
            </button>

            <button
              onClick={handlePasteSummary}
              disabled={savingSummary || readOnly}
              data-testid="import-file-paste-summary"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-600 bg-white px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50"
              title="Append the selected text as this file's supporting-evidence summary"
            >
              {savingSummary ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardPaste className="h-4 w-4" />
              )}
              {pasteFlash === 'summary'
                ? 'Added to summary ✓'
                : 'Paste as supporting-evidence summary'}
            </button>

            {summary && (
              <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <div className="mb-1 font-medium text-gray-500">Current summary</div>
                <div
                  data-testid="import-file-summary"
                  className="whitespace-pre-wrap"
                >
                  {summary}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportFilePanel;

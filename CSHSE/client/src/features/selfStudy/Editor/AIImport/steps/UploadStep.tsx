/**
 * Step 1 — Upload (sub-sprint 1.a functional stub).
 *
 * Implements the full UploadStep flow from UI spec §6.1: file picker
 * with size cap, program-level radio, re-import + force-template
 * checkboxes, and a Next button that posts the upload + kicks off the
 * cshse-ai job via the store's `startUpload` action.
 *
 * Loading: progress bar bound to `uploadProgress`.
 * Error states: 100 MB cap, MIME type check, server failure surfaced
 * inline.
 */
import React, { useCallback, useState } from 'react';
import { Upload as UploadIcon, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';

const MAX_FILE_SIZE = 100 * 1024 * 1024;  // 100 MB (raised from legacy 50 MB cap)
const KIND_LABELS: Record<string, string> = { cv: 'CV', syllabus: 'Syllabus', project: 'Project' };
const ACCEPTED_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // .docx
  'application/pdf'  // .pdf fallback
]);

export function UploadStep(): JSX.Element {
  const uploadFile = useAIImportStore((s) => s.uploadFile);
  const uploadProgress = useAIImportStore((s) => s.uploadProgress);
  const programLevel = useAIImportStore((s) => s.programLevel);
  const isReimport = useAIImportStore((s) => s.isReimport);
  const forceFormat = useAIImportStore((s) => s.forceFormat);
  const status = useAIImportStore((s) => s.status);
  const errors = useAIImportStore((s) => s.errors);
  const setUploadFile = useAIImportStore((s) => s.setUploadFile);
  const setProgramLevel = useAIImportStore((s) => s.setProgramLevel);
  const setIsReimport = useAIImportStore((s) => s.setIsReimport);
  const setForceFormat = useAIImportStore((s) => s.setForceFormat);
  const documentKind = useAIImportStore((s) => s.documentKind);
  const setDocumentKind = useAIImportStore((s) => s.setDocumentKind);
  const directStoredResult = useAIImportStore((s) => s.directStoredResult);
  const clearDirectStored = useAIImportStore((s) => s.clearDirectStored);
  const startUpload = useAIImportStore((s) => s.startUpload);

  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File | null) => {
      setLocalError(null);
      if (!file) {
        setUploadFile(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setLocalError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
        return;
      }
      // Some browsers report empty file.type for .docx — fall back to extension check.
      const looksDocx = file.name.toLowerCase().endsWith('.docx');
      const looksPdf = file.name.toLowerCase().endsWith('.pdf');
      if (!ACCEPTED_MIMES.has(file.type) && !looksDocx && !looksPdf) {
        setLocalError(`We accept .docx (preferred) or .pdf. Got: ${file.type || file.name}.`);
        return;
      }
      setUploadFile(file);
    },
    [setUploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  }, [isDragOver]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear when leaving the label itself, not entering a child element.
    if (e.currentTarget === e.target) setIsDragOver(false);
  }, []);

  // CR-041 user story 1 — accept N files. enqueueFiles promotes the
  // first into uploadFile + queues the rest. handleFile remains for
  // single-file callers (input change without multi-select).
  // CR-041 US-2/US-5 — multi-file batched upload + hold-for-review flag.
  const enqueueFiles = useAIImportStore((s) => s.enqueueFiles);
  const pendingFiles = useAIImportStore((s) => s.pendingFiles);
  const startBatchUpload = useAIImportStore((s) => s.startBatchUpload);
  const holdForReview = useAIImportStore((s) => s.holdForReview);
  const setHoldForReview = useAIImportStore((s) => s.setHoldForReview);
  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      handleFile(files[0]);
      return;
    }
    enqueueFiles(Array.from(files));
  }, [handleFile, enqueueFiles]);

  const handleNext = useCallback(async () => {
    setLocalError(null);
    try {
      // CR-041 US-2 — when the coordinator has 2+ files queued, route
      // through the batched-import code path. Single-file uploads keep
      // the legacy startUpload flow so the existing wizard semantics
      // stay unchanged.
      // A marked CV / Syllabus / Project is always filed individually via the
      // single-file path (it skips parsing server-side), even if other files
      // happen to be queued.
      if (pendingFiles.length > 0 && uploadFile && !documentKind) {
        const allFiles = [uploadFile, ...pendingFiles];
        await startBatchUpload(allFiles);
      } else {
        await startUpload();
      }
    } catch (err: any) {
      setLocalError(err?.message || String(err));
    }
  }, [startUpload, startBatchUpload, pendingFiles, uploadFile, documentKind]);

  const isUploading = status === 'uploading';
  // After upload hits 100% the client makes a follow-up POST /start-ai;
  // surface that distinct phase so the user doesn't think "100% uploading" is hung.
  const isStartingAi = status === 'uploading' && uploadProgress >= 0.999;
  const canProceed = !!uploadFile && !isUploading;

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <h2 className="text-2xl font-semibold text-gray-900">Upload your self-study document</h2>
      <p className="text-sm text-gray-600">
        Drop a .docx file (PDF accepted as a fallback). The AI service will auto-detect whether
        this is a finished free-form self-study or a partially-filled template and route accordingly.
        Importing a standalone CV, syllabus, or project? Mark it below and we&rsquo;ll file it directly &mdash;
        no parsing.
      </p>

      {directStoredResult && (
        <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div className="flex-1">
            <div className="font-medium">
              Added to your File Library as a {KIND_LABELS[directStoredResult.kind] || directStoredResult.kind.toUpperCase()}.
            </div>
            <div className="mt-0.5 text-emerald-700">
              <span className="font-mono">{directStoredResult.fileName}</span> was filed directly &mdash; no parsing needed.
            </div>
            <button
              onClick={() => { clearDirectStored(); setDocumentKind(null); setUploadFile(null); }}
              className="mt-2 rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Upload another file
            </button>
          </div>
        </div>
      )}

      <label
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors ${
          uploadFile || isDragOver
            ? 'border-cshse-500 bg-cshse-50'
            : 'border-gray-300 bg-gray-50 hover:border-cshse-400 hover:bg-cshse-50'
        }`}
      >
        <UploadIcon className="h-8 w-8 text-cshse-500" />
        <div className="text-center">
          {uploadFile ? (
            <>
              <div className="font-medium text-cshse-700">{uploadFile.name}</div>
              <div className="text-sm text-gray-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</div>
            </>
          ) : (
            <>
              <div className="font-medium text-gray-700">Drop a .docx file here, or click to browse</div>
              <div className="text-sm text-gray-500">Max 100 MB. PDF accepted as a fallback.</div>
            </>
          )}
        </div>
        <input
          type="file"
          multiple
          accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
          onChange={(e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            if (files.length === 1) {
              handleFile(files[0]);
              return;
            }
            // CR-041 — multiple selected; enqueue
            enqueueFiles(Array.from(files));
          }}
          className="hidden"
        />
      </label>

      {(localError || errors.length > 0) && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{localError || errors[errors.length - 1]}</div>
        </div>
      )}

      {/* CR-041 US-2/US-5 — multi-file queue + hold-for-review flag. */}
      {pendingFiles.length > 0 && (
        <div className="rounded-md border border-cshse-200 bg-cshse-50 p-3 text-sm">
          <div className="font-medium text-cshse-800">
            Multi-file batch: {(pendingFiles.length + (uploadFile ? 1 : 0))} files queued
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-cshse-700">
            {uploadFile && (
              <li className="flex items-center justify-between">
                <span className="truncate font-mono">{uploadFile.name}</span>
                <span className="text-cshse-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </li>
            )}
            {pendingFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between">
                <span className="truncate font-mono">{f.name}</span>
                <span className="text-cshse-500">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-cshse-800">
            <input
              type="checkbox"
              checked={holdForReview}
              onChange={(e) => setHoldForReview(e.target.checked)}
              className="mt-0.5 rounded text-cshse-600 focus:ring-cshse-500"
            />
            <span>
              <strong>Hold review until all files have processed (recommended).</strong>{' '}
              When unchecked, the Review step opens as the first file completes and later files merge in live.
            </span>
          </label>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Program level</legend>
        <div className="flex gap-4 text-sm">
          {(['associate', 'bachelors', 'masters'] as const).map((level) => (
            <label key={level} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="programLevel"
                value={level}
                checked={programLevel === level}
                onChange={() => setProgramLevel(level)}
                className="text-cshse-600 focus:ring-cshse-500"
              />
              <span className="capitalize">{level === 'bachelors' ? 'Baccalaureate' : `${level === 'masters' ? "Master's" : "Associate"}`}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isReimport}
            onChange={(e) => setIsReimport(e.target.checked)}
            className="rounded text-cshse-600 focus:ring-cshse-500"
          />
          <span>This is a re-import of an existing self-study</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={forceFormat === 'template'}
            onChange={(e) => setForceFormat(e.target.checked ? 'template' : null)}
            className="rounded text-cshse-600 focus:ring-cshse-500"
          />
          <span>Treat this upload as template format (skip auto-detect)</span>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">What kind of file is this?</legend>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {([
            { val: null, label: 'Self-study document', hint: 'Parse into sections' },
            { val: 'cv', label: 'CV', hint: 'File as a CV' },
            { val: 'syllabus', label: 'Syllabus', hint: 'File as a syllabus' },
            { val: 'project', label: 'Project', hint: 'File as a project' },
          ] as const).map((opt) => {
            const active = documentKind === opt.val;
            return (
              <label
                key={String(opt.val)}
                className={`flex cursor-pointer flex-col rounded-md border px-3 py-2 ${
                  active ? 'border-cshse-500 bg-cshse-50 ring-1 ring-cshse-400' : 'border-gray-300 hover:border-cshse-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="documentKind"
                    checked={active}
                    onChange={() => setDocumentKind(opt.val)}
                    className="text-cshse-600 focus:ring-cshse-500"
                  />
                  <span className="font-medium text-gray-800">{opt.label}</span>
                </span>
                <span className="ml-6 text-xs text-gray-500">{opt.hint}</span>
              </label>
            );
          })}
        </div>
        {documentKind && (
          <p className="flex items-start gap-2 rounded-md bg-cshse-50 p-2 text-xs text-cshse-800">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span>
              This file will be filed directly in your File Library as a {KIND_LABELS[documentKind]} &mdash; it
              won&rsquo;t be parsed into standard sections.
            </span>
          </p>
        )}
      </fieldset>

      {isUploading && (
        <div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>{isStartingAi ? 'Starting AI service…' : 'Uploading…'}</span>
            <span>{Math.round(uploadProgress * 100)}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full bg-cshse-500 transition-all ${isStartingAi ? 'animate-pulse' : ''}`}
              style={{ width: `${uploadProgress * 100}%` }}
            />
          </div>
          {isStartingAi && (
            <p className="mt-2 text-xs text-gray-500">
              File uploaded. Asking the AI service to begin parsing… (this can take 5–10 seconds)
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-6">
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="rounded-md bg-cshse-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isStartingAi
            ? 'Starting AI…'
            : isUploading
              ? (documentKind ? 'Filing…' : 'Uploading…')
              : (documentKind ? `Add ${KIND_LABELS[documentKind]} to File Library` : 'Next ▸')}
        </button>
      </div>
    </div>
  );
}

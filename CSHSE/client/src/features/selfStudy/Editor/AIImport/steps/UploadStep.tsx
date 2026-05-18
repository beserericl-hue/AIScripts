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
import { Upload as UploadIcon, AlertTriangle } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';

const MAX_FILE_SIZE = 100 * 1024 * 1024;  // 100 MB (raised from legacy 50 MB cap)
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
  const startUpload = useAIImportStore((s) => s.startUpload);

  const [localError, setLocalError] = useState<string | null>(null);

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
      if (!ACCEPTED_MIMES.has(file.type)) {
        setLocalError(`We accept .docx (preferred) or .pdf. Got: ${file.type || 'unknown'}.`);
        return;
      }
      setUploadFile(file);
    },
    [setUploadFile]
  );

  const handleNext = useCallback(async () => {
    setLocalError(null);
    try {
      await startUpload();
    } catch (err: any) {
      setLocalError(err?.message || String(err));
    }
  }, [startUpload]);

  const isUploading = status === 'uploading';
  const canProceed = !!uploadFile && !isUploading;

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <h2 className="text-2xl font-semibold text-gray-900">Upload your self-study document</h2>
      <p className="text-sm text-gray-600">
        Drop a .docx file (PDF accepted as a fallback). The AI service will auto-detect whether
        this is a finished free-form self-study or a partially-filled template and route accordingly.
      </p>

      <label
        className={`flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors ${
          uploadFile
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
          accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          className="hidden"
        />
      </label>

      {(localError || errors.length > 0) && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{localError || errors[errors.length - 1]}</div>
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

      {isUploading && (
        <div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Uploading…</span>
            <span>{Math.round(uploadProgress * 100)}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-cshse-500 transition-all"
              style={{ width: `${uploadProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-6">
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="rounded-md bg-cshse-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isUploading ? 'Uploading…' : 'Next ▸'}
        </button>
      </div>
    </div>
  );
}

/**
 * Component unit tests for UploadStep — the wizard's entry surface.
 *
 * UploadStep validates the file (size cap, MIME / extension), then
 * either fires startUpload() (single file) or enqueueFiles + startBatchUpload
 * (multi-file CR-041). We assert:
 *   - Empty state renders the drop zone copy + Next disabled
 *   - Picking a valid .docx enables Next + stores the file in the store
 *   - File over MAX_FILE_SIZE (100 MB) renders inline error, no store mutation
 *   - Wrong extension renders inline error, no store mutation
 *   - Picking 2+ files calls enqueueFiles and surfaces the queue panel
 *     with the hold-for-review checkbox (CR-041 US-2/US-5)
 *   - Next button on a single file calls startUpload()
 *   - Next button with pendingFiles calls startBatchUpload()
 *   - Program-level radio + reimport + force-template flags wire to store
 *   - Uploading state renders the progress bar
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAIImportStore } from '../../../../../store/aiImportStore';
import { UploadStep } from './UploadStep';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function makeFile(name: string, bytes: number, mime: string): File {
  // Files in jsdom report .size from the BlobPart length, so we feed it the
  // right number of bytes.
  const buffer = new Uint8Array(bytes);
  return new File([buffer], name, { type: mime });
}

function getFileInput(): HTMLInputElement {
  // The input is `hidden` so getByRole won't find it; querySelector + cast.
  const el = document.querySelector('input[type="file"]') as HTMLInputElement;
  if (!el) throw new Error('file input not in DOM');
  return el;
}

describe('<UploadStep />', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
  });

  it('renders the drop zone copy and a disabled Next button when no file is staged', () => {
    render(<UploadStep />);
    expect(screen.getByText(/Drop a \.docx file here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('selecting a valid .docx stages it on the store and enables Next', async () => {
    render(<UploadStep />);
    const file = makeFile('study.docx', 1024, DOCX_MIME);
    await userEvent.upload(getFileInput(), file);
    expect(useAIImportStore.getState().uploadFile?.name).toBe('study.docx');
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
    expect(screen.getByText('study.docx')).toBeInTheDocument();
  });

  it('rejects files over the 100 MB cap with an inline error and does not mutate the store', async () => {
    render(<UploadStep />);
    // 101 MB
    const tooBig = makeFile('huge.docx', 101 * 1024 * 1024, DOCX_MIME);
    await userEvent.upload(getFileInput(), tooBig);
    expect(useAIImportStore.getState().uploadFile).toBeNull();
    expect(screen.getByText(/limit is 100 MB/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('rejects unknown file types with an inline error and does not mutate the store', async () => {
    render(<UploadStep />);
    const bad = makeFile('notes.txt', 1024, 'text/plain');
    // userEvent.upload defaults to enforcing the input's `accept` attribute,
    // which would silently filter out .txt before the component ever sees
    // it. Disable applyAccept so the real validation path runs.
    await userEvent.upload(getFileInput(), bad, { applyAccept: false });
    expect(useAIImportStore.getState().uploadFile).toBeNull();
    expect(screen.getByText(/We accept .docx/i)).toBeInTheDocument();
  });

  it('accepts .docx files with empty MIME type via extension fallback', async () => {
    render(<UploadStep />);
    const file = makeFile('study.docx', 1024, ''); // some browsers report empty type
    await userEvent.upload(getFileInput(), file);
    expect(useAIImportStore.getState().uploadFile?.name).toBe('study.docx');
  });

  it('selecting 2+ files routes through enqueueFiles and shows the queue panel', async () => {
    render(<UploadStep />);
    const a = makeFile('a.docx', 1024, DOCX_MIME);
    const b = makeFile('b.docx', 2048, DOCX_MIME);
    await userEvent.upload(getFileInput(), [a, b]);
    // CR-041 — the queue panel surfaces both files. a.docx appears twice
    // (drop-zone label + queue panel) so use getAllByText.
    expect(screen.getByText(/Multi-file batch/i)).toBeInTheDocument();
    expect(screen.getAllByText('a.docx').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('b.docx')).toBeInTheDocument();
    // Hold-for-review checkbox should be present and default to true
    const hold = screen.getByRole('checkbox', {
      name: /Hold review until all files have processed/i,
    });
    expect(hold).toBeChecked();
  });

  it('clicking Next on a single file calls startUpload()', async () => {
    const spy = vi.spyOn(useAIImportStore.getState(), 'startUpload')
      .mockResolvedValue(undefined as any);
    render(<UploadStep />);
    const file = makeFile('study.docx', 1024, DOCX_MIME);
    await userEvent.upload(getFileInput(), file);
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('clicking Next with queued pendingFiles calls startBatchUpload() instead of startUpload()', async () => {
    const startUpload = vi.spyOn(useAIImportStore.getState(), 'startUpload')
      .mockResolvedValue(undefined as any);
    const startBatchUpload = vi.spyOn(useAIImportStore.getState(), 'startBatchUpload')
      .mockResolvedValue(undefined as any);
    render(<UploadStep />);
    const a = makeFile('a.docx', 1024, DOCX_MIME);
    const b = makeFile('b.docx', 2048, DOCX_MIME);
    await userEvent.upload(getFileInput(), [a, b]);
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(startBatchUpload).toHaveBeenCalledTimes(1);
    // The first file is promoted to uploadFile + the rest stay in pendingFiles;
    // startBatchUpload receives all files (combined).
    expect(startBatchUpload.mock.calls[0][0]).toHaveLength(2);
    expect(startUpload).not.toHaveBeenCalled();
    startUpload.mockRestore();
    startBatchUpload.mockRestore();
  });

  it('program-level radios update the store', async () => {
    render(<UploadStep />);
    const masters = screen.getByRole('radio', { name: /Master/i });
    await userEvent.click(masters);
    expect(useAIImportStore.getState().programLevel).toBe('masters');
  });

  it('re-import + force-template checkboxes update the store', async () => {
    render(<UploadStep />);
    const reimport = screen.getByRole('checkbox', { name: /This is a re-import/i });
    const forceTpl = screen.getByRole('checkbox', { name: /Treat this upload as template format/i });
    await userEvent.click(reimport);
    await userEvent.click(forceTpl);
    expect(useAIImportStore.getState().isReimport).toBe(true);
    expect(useAIImportStore.getState().forceFormat).toBe('template');
  });

  it('renders the progress bar when status === "uploading"', () => {
    useAIImportStore.setState({ status: 'uploading', uploadProgress: 0.42 });
    render(<UploadStep />);
    // "Uploading…" appears in both the progress label and the button — both
    // are expected.
    expect(screen.getAllByText(/Uploading…/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('switches the progress copy to "Starting AI…" near 100% progress', () => {
    useAIImportStore.setState({ status: 'uploading', uploadProgress: 0.9995 });
    render(<UploadStep />);
    expect(screen.getByText(/Starting AI service/i)).toBeInTheDocument();
  });

  it('surfaces store errors in the inline error banner', () => {
    useAIImportStore.setState({ errors: ['oops something broke'] });
    render(<UploadStep />);
    expect(screen.getByText('oops something broke')).toBeInTheDocument();
  });
});

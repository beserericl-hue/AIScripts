// ---------------------------------------------------------------------------
// CR-021 / Sprint 9.4 — client-side attachment guardrails.
//
// Mirrors the server allowlist + size cap (commentController.ts) so the
// composer can reject obviously-bad files before the round-trip. The server
// remains the source of truth; this is only a fast-fail UX layer.
// ---------------------------------------------------------------------------

export const ATTACHMENT_MIME_ALLOWLIST: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — CR-021 decision.

/** File-picker `accept` attribute matching the allowlist. */
export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.txt';

export interface AttachmentValidation {
  ok: boolean;
  error?: string;
}

export function validateAttachmentFile(file: { mimeType: string; sizeBytes: number }): AttachmentValidation {
  if (!ATTACHMENT_MIME_ALLOWLIST.has(file.mimeType)) {
    return { ok: false, error: 'Only PDF, DOC, DOCX, or TXT files are allowed.' };
  }
  if (file.sizeBytes > ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: 'File is larger than 25 MB.' };
  }
  return { ok: true };
}

/** Human-readable byte size for the staged-file list. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

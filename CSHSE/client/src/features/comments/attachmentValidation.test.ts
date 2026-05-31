/**
 * CR-021 / Sprint 9.4 — attachment validation guardrails.
 *
 * Pins the client-side fast-fail layer to the server allowlist + 25 MB cap.
 */
import { describe, it, expect } from 'vitest';
import {
  validateAttachmentFile,
  formatBytes,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_ALLOWLIST,
} from './attachmentValidation';

describe('CR-021 — validateAttachmentFile', () => {
  it('accepts every allowlisted MIME type within the size cap', () => {
    for (const mimeType of ATTACHMENT_MIME_ALLOWLIST) {
      expect(validateAttachmentFile({ mimeType, sizeBytes: 1024 })).toEqual({ ok: true });
    }
  });

  it('rejects a non-allowlisted MIME type', () => {
    const result = validateAttachmentFile({ mimeType: 'image/png', sizeBytes: 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/PDF, DOC, DOCX, or TXT/);
  });

  it('rejects a file over 25 MB even with an allowed MIME type', () => {
    const result = validateAttachmentFile({
      mimeType: 'application/pdf',
      sizeBytes: ATTACHMENT_MAX_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/25 MB/);
  });

  it('accepts a file exactly at the 25 MB boundary', () => {
    expect(
      validateAttachmentFile({ mimeType: 'text/plain', sizeBytes: ATTACHMENT_MAX_BYTES })
    ).toEqual({ ok: true });
  });
});

describe('CR-021 — formatBytes', () => {
  it('formats bytes, KB, and MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

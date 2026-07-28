/**
 * Short-lived signed tokens that let an EXTERNAL viewer (Microsoft Office web
 * viewer) fetch a private evidence file over a public URL.
 *
 * The Office embed (`view.officeapps.live.com/op/embed.aspx?src=<url>`) renders
 * xlsx/pptx by having Microsoft's servers fetch the file — so the file must be
 * reachable without our auth header. We never expose the raw file; instead an
 * AUTHENTICATED endpoint (which enforces submission ownership) mints a token
 * that embeds the S3 key + mime, signed with JWT_SECRET and valid ~30 min. The
 * public route verifies the token and streams that one object. The heavy
 * access-control happens at mint time; the token cannot be forged and expires.
 */
import jwt from 'jsonwebtoken';

export interface FileAccessTokenPayload {
  s3Key: string;
  mimeType: string;
  fileName: string;
  /** submission the file belongs to — carried for audit/logging only. */
  sub: string;
}

const TTL_SECONDS = 30 * 60; // 30 minutes — long enough to load + browse a deck.

function secret(): string {
  return process.env.JWT_SECRET || 'development-secret-key';
}

export function signFileAccessToken(p: FileAccessTokenPayload): string {
  return jwt.sign(p, secret(), { expiresIn: TTL_SECONDS });
}

export function verifyFileAccessToken(token: string): FileAccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret()) as any;
    if (!decoded?.s3Key) return null;
    return {
      s3Key: String(decoded.s3Key),
      mimeType: String(decoded.mimeType || 'application/octet-stream'),
      fileName: String(decoded.fileName || 'file'),
      sub: String(decoded.sub || ''),
    };
  } catch {
    return null;
  }
}

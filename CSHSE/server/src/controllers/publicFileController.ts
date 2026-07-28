/**
 * Public (unauthenticated) file streaming for the Office web viewer.
 *
 * Reachable at GET /public-file/:token — mounted BEFORE the authenticated /api
 * routers. The token is a short-lived JWT minted by an authenticated,
 * ownership-checked endpoint (see aiReviewController.getReviewEvidenceDocPublicUrl
 * / evidenceController.getEvidencePublicUrl). It embeds the S3 key + mime, so
 * this handler just verifies + streams. No DB access, no session — the token IS
 * the capability, and it expires in ~30 min.
 */
import { Request, Response } from 'express';
import { verifyFileAccessToken } from '../services/fileAccessToken';
import { downloadFileAsBuffer } from '../services/s3Service';

export async function servePublicFile(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  const payload = verifyFileAccessToken(String(token || ''));
  if (!payload) {
    res.status(403).send('Invalid or expired file link');
    return;
  }
  try {
    const buf = await downloadFileAsBuffer(payload.s3Key);
    const name = payload.fileName.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', payload.mimeType);
    // inline so the Office viewer renders it rather than forcing a download.
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    // The Office viewer fetches cross-origin; allow it and permit range GETs.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(buf);
  } catch (err: any) {
    console.error('[servePublicFile] fetch failed:', err?.message || err);
    res.status(502).send('Could not fetch the stored file');
  }
}

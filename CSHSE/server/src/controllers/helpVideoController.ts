/**
 * Per-screen help videos (narrated walkthrough + a PDF of the narration with
 * screenshots), opened from the "?" in the top-right corner of every screen.
 *
 * Storage: S3, under `help-videos/`:
 *   help-videos/manifest.json        { videos: { <screenId>: { title, summary, durationSec, updatedAt, video, pdf } } }
 *   help-videos/<screenId>.mp4       the narrated video
 *   help-videos/<screenId>.pdf       narration text + screenshots
 * The manifest is the source of truth for which screens have a video, so a
 * re-recorded video ships by uploading new objects — no redeploy.
 *
 * Playback: a <video> element cannot send our Bearer header, so the
 * authenticated GET /api/help-videos/:screenId/links mints short-lived signed
 * links (same JWT capability as /public-file) and the public
 * GET /help-video-file/:token streams the object with HTTP Range support so
 * the player can seek.
 */
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { downloadFileAsBuffer, downloadFileRange, isS3Configured } from '../services/s3Service';

export const HELP_VIDEO_PREFIX = 'help-videos/';
const MANIFEST_KEY = `${HELP_VIDEO_PREFIX}manifest.json`;
const LINK_TTL_SECONDS = 4 * 60 * 60; // a long video can be paused and resumed
const MANIFEST_TTL_MS = 5 * 60 * 1000;
const SCREEN_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface HelpVideoEntry {
  title: string;
  summary?: string;
  durationSec?: number;
  updatedAt?: string;
  video: string; // S3 key under help-videos/
  pdf?: string; // S3 key under help-videos/
}
export interface HelpVideoManifest {
  videos: Record<string, HelpVideoEntry>;
}

let cache: { at: number; manifest: HelpVideoManifest } | null = null;

/** Test hook — drop the cached manifest. */
export function _resetHelpVideoManifestCache(): void {
  cache = null;
}

export async function loadHelpVideoManifest(): Promise<HelpVideoManifest> {
  if (cache && Date.now() - cache.at < MANIFEST_TTL_MS) return cache.manifest;
  let manifest: HelpVideoManifest = { videos: {} };
  if (isS3Configured()) {
    try {
      const buf = await downloadFileAsBuffer(MANIFEST_KEY);
      const parsed = JSON.parse(buf.toString('utf8'));
      if (parsed && typeof parsed.videos === 'object') manifest = { videos: parsed.videos };
    } catch (err: any) {
      // No manifest yet (NoSuchKey) or unreadable — the "?" then shows chat/tour only.
      console.warn('[helpVideos] manifest unavailable:', err?.name || err?.message || err);
    }
  }
  cache = { at: Date.now(), manifest };
  return manifest;
}

function secret(): string {
  return process.env.JWT_SECRET || 'development-secret-key';
}

/** Only keys under help-videos/ can ever be signed — the token can't reach evidence files. */
function signKey(key: string, kind: 'video' | 'pdf', fileName: string): string {
  return jwt.sign({ hv: 1, key, kind, fileName }, secret(), { expiresIn: LINK_TTL_SECONDS });
}

function verifyKey(token: string): { key: string; kind: 'video' | 'pdf'; fileName: string } | null {
  try {
    const d = jwt.verify(token, secret()) as any;
    if (d?.hv !== 1 || typeof d.key !== 'string' || !d.key.startsWith(HELP_VIDEO_PREFIX)) return null;
    if (d.key.includes('..')) return null;
    return { key: d.key, kind: d.kind === 'pdf' ? 'pdf' : 'video', fileName: String(d.fileName || 'help') };
  } catch {
    return null;
  }
}

/** GET /api/help-videos — which screens have a video (no links). */
export async function listHelpVideos(_req: Request, res: Response): Promise<void> {
  const m = await loadHelpVideoManifest();
  const videos: Record<string, Omit<HelpVideoEntry, 'video' | 'pdf'> & { hasPdf: boolean }> = {};
  for (const [id, v] of Object.entries(m.videos)) {
    videos[id] = { title: v.title, summary: v.summary, durationSec: v.durationSec, updatedAt: v.updatedAt, hasPdf: !!v.pdf };
  }
  res.json({ videos });
}

/** GET /api/help-videos/:screenId/links — signed, expiring playback + PDF links. */
export async function getHelpVideoLinks(req: Request, res: Response): Promise<void> {
  const screenId = String(req.params.screenId || '');
  if (!SCREEN_ID.test(screenId)) {
    res.status(400).json({ error: 'Invalid screen id' });
    return;
  }
  const m = await loadHelpVideoManifest();
  const v = m.videos[screenId];
  if (!v || !v.video || !v.video.startsWith(HELP_VIDEO_PREFIX)) {
    res.status(404).json({ error: 'No help video for this screen yet' });
    return;
  }
  const base = `CSHSE-help-${screenId}`;
  res.json({
    screenId,
    title: v.title,
    summary: v.summary,
    durationSec: v.durationSec,
    updatedAt: v.updatedAt,
    videoUrl: `/help-video-file/${signKey(v.video, 'video', `${base}.mp4`)}`,
    pdfUrl: v.pdf && v.pdf.startsWith(HELP_VIDEO_PREFIX) ? `/help-video-file/${signKey(v.pdf, 'pdf', `${base}.pdf`)}` : null,
  });
}

/** GET /help-video-file/:token — public, token-gated, Range-aware streaming. */
export async function serveHelpVideoFile(req: Request, res: Response): Promise<void> {
  const tok = verifyKey(String(req.params.token || ''));
  if (!tok) {
    res.status(403).send('Invalid or expired help link');
    return;
  }
  try {
    const range = typeof req.headers.range === 'string' && /^bytes=\d*-\d*$/.test(req.headers.range) ? req.headers.range : undefined;
    const obj = await downloadFileRange(tok.key, range);
    const type = tok.kind === 'pdf' ? 'application/pdf' : obj.contentType && obj.contentType !== 'application/octet-stream' ? obj.contentType : 'video/mp4';
    res.status(obj.partial ? 206 : 200);
    res.setHeader('Content-Type', type);
    res.setHeader('Accept-Ranges', 'bytes');
    if (obj.contentLength != null) res.setHeader('Content-Length', String(obj.contentLength));
    if (obj.contentRange) res.setHeader('Content-Range', obj.contentRange);
    const download = tok.kind === 'pdf' && req.query.download === '1';
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${tok.fileName.replace(/[\r\n"]/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
  } catch (err: any) {
    const code = err?.$metadata?.httpStatusCode;
    if (code === 416) {
      res.status(416).end();
      return;
    }
    console.error('[helpVideos] stream failed:', err?.name || err?.message || err);
    res.status(code === 404 || err?.name === 'NoSuchKey' ? 404 : 502).send('Help file unavailable');
  }
}

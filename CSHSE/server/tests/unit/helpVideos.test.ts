import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Readable } from 'stream';

const store: Record<string, Buffer> = {};
vi.mock('../../src/services/s3Service', () => ({
  isS3Configured: () => true,
  downloadFileAsBuffer: async (key: string) => {
    if (!store[key]) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return store[key];
  },
  downloadFileRange: async (key: string, range?: string) => {
    const buf = store[key];
    if (!buf) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
    if (range) {
      const [, a, b] = /bytes=(\d*)-(\d*)/.exec(range)!;
      const s = Number(a || 0), e = b ? Number(b) : buf.length - 1;
      const part = buf.subarray(s, e + 1);
      return { stream: Readable.from(part), contentLength: part.length, contentRange: `bytes ${s}-${e}/${buf.length}`, partial: true, contentType: 'video/mp4' };
    }
    return { stream: Readable.from(buf), contentLength: buf.length, partial: false, contentType: 'video/mp4' };
  },
}));
vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

import helpVideosRouter from '../../src/routes/helpVideos';
import { serveHelpVideoFile, _resetHelpVideoManifestCache } from '../../src/controllers/helpVideoController';

function app() {
  const a = express();
  a.use('/api/help-videos', helpVideosRouter);
  a.get('/help-video-file/:token', serveHelpVideoFile);
  return a;
}

describe('per-screen help videos', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    _resetHelpVideoManifestCache();
    store['help-videos/manifest.json'] = Buffer.from(
      JSON.stringify({
        videos: {
          'pc-dashboard': { title: 'Program Coordinator dashboard', durationSec: 120, video: 'help-videos/pc-dashboard.mp4', pdf: 'help-videos/pc-dashboard.pdf' },
          'bad-key': { title: 'x', video: 'someinst/evidence.pdf' },
        },
      })
    );
    store['help-videos/pc-dashboard.mp4'] = Buffer.from('0123456789abcdef');
    store['help-videos/pc-dashboard.pdf'] = Buffer.from('%PDF-1.7 test');
  });

  it('lists screens with a video, without exposing storage keys', async () => {
    const r = await request(app()).get('/api/help-videos');
    expect(r.status).toBe(200);
    expect(r.body.videos['pc-dashboard']).toMatchObject({ title: 'Program Coordinator dashboard', hasPdf: true });
    expect(JSON.stringify(r.body)).not.toContain('help-videos/');
  });

  it('mints playback + PDF links that stream the objects, with Range for seeking', async () => {
    const r = await request(app()).get('/api/help-videos/pc-dashboard/links');
    expect(r.status).toBe(200);
    expect(r.body.videoUrl).toMatch(/^\/help-video-file\//);
    const full = await request(app()).get(r.body.videoUrl);
    expect(full.status).toBe(200);
    expect(full.headers['accept-ranges']).toBe('bytes');
    const part = await request(app()).get(r.body.videoUrl).set('Range', 'bytes=4-7');
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe('bytes 4-7/16');
    expect(part.body.toString()).toBe('4567');
    const pdf = await request(app()).get(r.body.pdfUrl + '?download=1');
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toMatch(/^attachment; filename="CSHSE-help-pc-dashboard\.pdf"/);
  });

  it('404s a screen with no video and refuses keys outside help-videos/', async () => {
    expect((await request(app()).get('/api/help-videos/messages/links')).status).toBe(404);
    expect((await request(app()).get('/api/help-videos/bad-key/links')).status).toBe(404);
    expect((await request(app()).get('/api/help-videos/..%2Fx/links')).status).toBe(400);
  });

  it('rejects forged, foreign and evidence-scoped tokens', async () => {
    const secret = process.env.JWT_SECRET || 'development-secret-key';
    const evidence = jwt.sign({ hv: 1, key: 'inst/v1/evidence.pdf', kind: 'pdf' }, secret);
    const publicFileStyle = jwt.sign({ s3Key: 'help-videos/pc-dashboard.mp4', mimeType: 'video/mp4' }, secret);
    const forged = jwt.sign({ hv: 1, key: 'help-videos/pc-dashboard.mp4', kind: 'video' }, 'not-the-secret');
    for (const t of [evidence, publicFileStyle, forged, 'garbage']) {
      expect((await request(app()).get('/help-video-file/' + t)).status).toBe(403);
    }
  });

  it('board sessions may load help videos', async () => {
    const { boardPathAllowed } = await vi.importActual<any>('../../src/middleware/auth');
    expect(boardPathAllowed('/api/help-videos')).toBe(true);
    expect(boardPathAllowed('/api/help-videos/board-dashboard/links')).toBe(true);
    expect(boardPathAllowed('/api/help-videos-evil')).toBe(false);
  });
});

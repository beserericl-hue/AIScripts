import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { fixUploadFilename, utf8Upload } from '../../src/middleware/utf8Upload';

const asLatin1 = (s: string) => Buffer.from(s, 'utf8').toString('latin1');

describe('fixUploadFilename', () => {
  it('repairs UTF-8 names that were decoded as latin1 (en dash, curly apostrophe, accents)', () => {
    for (const name of ['Program Differentiators – East Tennessee.pdf', 'MASTER’S DEGREE IN HUMAN SERVICES v2025.pdf', 'Résumé – Dr. Núñez.docx', '日本語.pdf']) {
      expect(fixUploadFilename(asLatin1(name))).toBe(name);
    }
  });
  it('leaves correct names alone (idempotent)', () => {
    for (const name of ['plain.pdf', 'Program Differentiators – ETSU.pdf', 'MASTER’S.pdf', 'Café.pdf', '']) {
      expect(fixUploadFilename(name)).toBe(name);
      expect(fixUploadFilename(fixUploadFilename(name))).toBe(name);
    }
  });
  it('NEGATIVE: a genuine latin1 name that is not valid UTF-8 is not mangled', () => {
    expect(fixUploadFilename('Café.pdf')).toBe('Café.pdf'); // é alone is invalid UTF-8 → kept
    expect(fixUploadFilename('naïve ×2.pdf')).toBe('naïve ×2.pdf');
  });
});

describe('utf8Upload — real multipart upload', () => {
  function app() {
    const a = express();
    const up = utf8Upload({ storage: (require('multer') as any).memoryStorage() });
    a.post('/one', up.single('file'), (req: any, res) => res.json({ name: req.file.originalname }));
    a.post('/many', up.array('files', 5), (req: any, res) => res.json({ names: req.files.map((f: any) => f.originalname) }));
    return a;
  }
  it('POSITIVE: single upload keeps the en dash and the curly apostrophe', async () => {
    const r = await request(app()).post('/one').attach('file', Buffer.from('x'), { filename: 'Program Differentiators – MASTER’S.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Program Differentiators – MASTER’S.pdf');
  });
  it('POSITIVE: multi-file upload repairs every name; ASCII names unchanged', async () => {
    const r = await request(app())
      .post('/many')
      .attach('files', Buffer.from('a'), { filename: 'APPENDIX IV 9 – Alumni.pdf' })
      .attach('files', Buffer.from('b'), { filename: 'plain-name.docx' });
    expect(r.body.names).toEqual(['APPENDIX IV 9 – Alumni.pdf', 'plain-name.docx']);
  });
});

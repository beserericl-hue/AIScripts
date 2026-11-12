import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
import { textToPdf, isTextUpload, pdfNameFor } from '../../src/services/textToPdf';

// The PDF is written uncompressed; pdfkit puts each line's text in TJ arrays
// of hex strings. (pdf-parse's bundled pdf.js 1.10 rejects many small pdfkit
// files with "bad XRef entry", so short documents are read this way.)
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const lines: string[] = [];
  for (const m of raw.matchAll(/\[((?:<[0-9a-f]*>\s*-?\d*\.?\d*\s*)+)\]\s*TJ/gi)) {
    lines.push([...m[1].matchAll(/<([0-9a-f]*)>/gi)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join(''));
  }
  return lines.join('\n');
}

describe('help upload: text/markdown → PDF', () => {
  it('POSITIVE: markdown becomes a PDF with the same words in its text layer', async () => {
    const md = '# CSHSE Help\n\nUse **Import file** to add a [syllabus](http://x).\n\n- Approve drafts\n- Validate specs\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
    const pdf = await textToPdf(md, 'Guide');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdfText(pdf);
    expect(text).toContain('CSHSE Help');
    expect(text).toContain('Use Import file to add a syllabus.');
    expect(text).toContain('Approve drafts');
    expect(text).not.toContain('**');
    expect(text).not.toContain('](');
  });
  it('POSITIVE: a large file converts quickly (the n8n text path timed out at ~30s)', async () => {
    const big = Array.from({ length: 3000 }, (_, i) => `Line ${i} of the user guide with some words.`).join('\n');
    const t0 = Date.now();
    const pdf = await textToPdf(big, 'Big');
    expect(Date.now() - t0).toBeLessThan(15000);
    expect((await pdfParse(pdf)).text).toContain('Line 2999');
  });
  it('detects text uploads and names the PDF', () => {
    expect(isTextUpload('guide.md', 'application/octet-stream')).toBe(true);
    expect(isTextUpload('notes.txt', '')).toBe(true);
    expect(isTextUpload('x', 'text/markdown')).toBe(true);
    expect(pdfNameFor('User Guide.md')).toBe('User Guide.pdf');
  });
  it('NEGATIVE: PDFs and Word files are not converted', () => {
    expect(isTextUpload('manual.pdf', 'application/pdf')).toBe(false);
    expect(isTextUpload('manual.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
  });
});

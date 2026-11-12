/**
 * Plain text / Markdown → PDF, for the help-chat knowledge base upload.
 *
 * The shared n8n "CSHSE Help - Document Upload" workflow chunks text/markdown
 * in a JS code node that the n8n task runner kills after ~30 s on any
 * realistically sized file, so .md / .txt uploads stuck at "processing" and
 * were never vectorized. Its PDF branch uses native LangChain nodes and works.
 * So the server turns text into a simple, text-layer PDF (same words, headings
 * kept as larger bold lines) and sends that — no change to the shared workflow.
 */
import PDFDocument from 'pdfkit';

const MD_INLINE = [
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'], // images → alt text
  [/\[([^\]]+)\]\([^)]*\)/g, '$1'], // links → text
  [/`([^`]+)`/g, '$1'],
  [/\*\*([^*]+)\*\*/g, '$1'],
  [/__([^_]+)__/g, '$1'],
  [/(^|[^*])\*([^*\n]+)\*/g, '$1$2'],
] as const;

function inline(s: string): string {
  let out = s;
  for (const [re, rep] of MD_INLINE) out = out.replace(re as RegExp, rep as string);
  return out;
}

export function isTextUpload(fileName: string, mimeType: string): boolean {
  return /\.(md|markdown|txt)$/i.test(fileName) || /^text\/(plain|markdown|x-markdown)$/i.test(mimeType || '');
}

export function pdfNameFor(fileName: string): string {
  return fileName.replace(/\.(md|markdown|txt)$/i, '') + '.pdf';
}

export function textToPdf(text: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, compress: false, info: { Title: title } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    let inFence = false;
    for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
      const line = raw.replace(/\t/g, '    ');
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        doc.font('Courier').fontSize(9).text(line || ' ');
        continue;
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const size = [20, 16, 14, 12, 11, 11][h[1].length - 1];
        doc.moveDown(0.4).font('Helvetica-Bold').fontSize(size).text(inline(h[2]));
        doc.moveDown(0.2);
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        doc.moveDown(0.5);
        continue;
      }
      const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (bullet) {
        const indent = 12 + Math.min(4, Math.floor(bullet[1].length / 2)) * 12;
        const mark = /\d/.test(bullet[2]) ? bullet[2] : '•';
        doc.font('Helvetica').fontSize(11).text(`${mark} ${inline(bullet[3])}`, { indent });
        continue;
      }
      const t = inline(line.replace(/^>\s?/, '').replace(/^\|/, '').replace(/\|$/, '').replace(/\s*\|\s*/g, '  ·  '));
      if (/^\s*\|?\s*:?-{3,}/.test(line)) continue; // table divider row
      doc.font('Helvetica').fontSize(11).text(t || ' ');
    }
    doc.end();
  });
}

#!/usr/bin/env node
/**
 * Bulk supporting-evidence import — DEV validation report.
 * For the real AACC "Supporting Documents" folder (24 files) shows, per file,
 * the AI-suggested Standard / Sub-specification, the confidence, and WHY (the
 * reference / semantic rationale), plus screenshots of the files read into the
 * Review panel, the Office web viewer path, and the File Library.
 *   node e2e/report/build_bulk_report.mjs
 * Inputs:  e2e/report/bulk-evidence-results.json
 *          e2e/report/bulk/*.png
 * Output:  e2e/report/bulk-evidence-import-report.pdf
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(DIR, 'bulk');
const RESULTS = path.join(DIR, 'bulk-evidence-results.json');
const OUT_HTML = path.join(DIR, 'bulk-evidence-report.html');
const OUT_PDF = path.join(DIR, 'bulk-evidence-import-report.pdf');

const data = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf-8')) : { rows: [], total: 0, suggested: 0 };
const rows = data.rows || [];
const img = (f) => (fs.existsSync(path.join(SHOTS, f)) ? `data:image/png;base64,${fs.readFileSync(path.join(SHOTS, f)).toString('base64')}` : null);
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const typeLabel = (m) =>
  /spreadsheetml/.test(m) ? 'XLSX' : /presentationml/.test(m) ? 'PPTX' : /wordprocessingml/.test(m) ? 'DOCX' : /pdf/.test(m) ? 'PDF' : (m || '').split('/').pop();

const shot = (f, cap) => {
  const src = img(f);
  return src ? `<figure><figcaption>${esc(cap)}</figcaption><img src="${src}"></figure>` : '';
};

const tableRows = rows
  .map((r, i) => {
    const assigned = r.suggestion && r.suggestion !== '(unassigned)';
    return `<tr class="${assigned ? '' : 'unassigned'}">
      <td class="num">${i + 1}</td>
      <td class="file">${esc(r.file)}</td>
      <td class="type">${esc(typeLabel(r.mime))}</td>
      <td class="sug">${esc(r.suggestion)}</td>
      <td class="conf">${esc(r.confidence)}</td>
      <td class="rat">${esc(r.rationale)}${r.alternates ? `<span class="alt"> · alt: ${esc(r.alternates)}</span>` : ''}</td>
      <td class="chars">${r.chars ? r.chars.toLocaleString() : '—'}</td>
    </tr>`;
  })
  .join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  :root { --ink:#1b2733; --muted:#5b6b7b; --line:#dbe3ea; --accent:#0d6e6e; --amber:#b7791f; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: var(--ink); margin: 0; }
  .page { padding: 40px 44px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: var(--muted); font-size: 12px; margin-bottom: 18px; }
  .cards { display: flex; gap: 12px; margin: 14px 0 22px; }
  .kpi { flex: 1; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .kpi .n { font-size: 26px; font-weight: 700; color: var(--accent); }
  .kpi .l { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
  th { text-align: left; background: #f2f6f8; border-bottom: 2px solid var(--line); padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
  td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  td.num { color: var(--muted); }
  td.file { font-weight: 600; max-width: 220px; }
  td.type { font-family: ui-monospace, Menlo, monospace; color: var(--muted); }
  td.sug { font-family: ui-monospace, Menlo, monospace; color: var(--accent); font-weight: 700; white-space: nowrap; }
  td.rat { color: #33424f; }
  td.rat .alt { color: var(--muted); }
  tr.unassigned td.sug { color: var(--amber); }
  figure { margin: 0 0 20px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; break-inside: avoid; }
  figcaption { background: #f2f6f8; padding: 7px 12px; font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--line); }
  figure img { width: 100%; display: block; }
  h2 { font-size: 15px; margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 2px solid var(--accent); }
  .note { font-size: 11px; color: var(--muted); margin: 4px 0 16px; }
</style></head><body><div class="page">
  <h1>Bulk Supporting-Evidence Import — AACC (dev validation)</h1>
  <div class="sub">Real AACC “Supporting Documents” folder · submission ${esc(data.submissionId || '')} · ${now}</div>

  <div class="cards">
    <div class="kpi"><div class="n">${data.total}</div><div class="l">Files imported</div></div>
    <div class="kpi"><div class="n">${data.suggested}</div><div class="l">AI-suggested a standard</div></div>
    <div class="kpi"><div class="n">${rows.filter((r) => /XLSX|PPTX/.test(typeLabel(r.mime))).length}</div><div class="l">Native Office (xlsx/pptx)</div></div>
  </div>

  <div class="note">Every file was dropped into the Review panel’s Evidence rail, stored in the File Library on upload, and matched to a Standard / Sub-specification by reference-matching the imported AACC narratives (name + content) with an AI-placement fallback. The coordinator accepts or overrides each suggestion; Approve stamps the standard onto the already-stored file.</div>

  <table>
    <thead><tr><th>#</th><th>File</th><th>Type</th><th>AI-suggested</th><th>Conf.</th><th>Why (rationale)</th><th>Text</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2>Screenshots</h2>
  ${shot('01-dropzone.png', 'Review panel — Evidence rail drop zone (bulk drag-and-drop)')}
  ${shot('02-review-cards.png', 'Review panel — all files read in, each with its AI-suggested standard + rationale')}
  ${shot('03-office-xlsx.png', 'Transfer Rates workbook — card with “View file” (opens the Office web viewer)')}
  ${shot('03-office-pptx.png', 'Human Services Stats deck — card with “View file” (opens the Office web viewer)')}
  ${shot('04-file-library-unassigned.png', 'File Library — imported files present immediately (Unassigned until Approve routes them)')}
</div></body></html>`;

fs.writeFileSync(OUT_HTML, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + OUT_HTML);
await page.pdf({ path: OUT_PDF, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log('Wrote', OUT_PDF);

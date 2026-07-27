#!/usr/bin/env node
/**
 * Parser Train — REVIEW PANEL validation report. For each document shows the
 * parsed result ON THE REVIEW PANEL (Introduction / Standards / Compare / Files)
 * on DEV, beside the PRODUCTION review panel for the same document, plus the
 * validation numbers (dev reproduces the prod validated outcome).
 *   node e2e/report/build_review_report.mjs
 * Inputs:  e2e/report/review/<doc>-<dev|prod>-<NN-section>.png
 *          e2e/report/review-results.json
 * Output:  e2e/report/parser-train-review-panel-report.pdf
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(DIR, 'review');
const RESULTS = path.join(DIR, 'review-results.json');
const OUT_HTML = path.join(DIR, 'review-report.html');
const OUT_PDF = path.join(DIR, 'parser-train-review-panel-report.pdf');

const SECTIONS = [
  ['01-overview', 'Review panel — overview (narratives / evidence / files counts, Introduction + Supporting Evidence rail)'],
  ['02-introduction', 'Introduction — the parsed introduction text'],
  ['03-standards', 'Standards — a spec card showing the parsed narrative text'],
  ['04-compare', 'Compare — the card resolved against the source (located, never “section not located”)'],
  ['05-files', 'Files — the Supporting Evidence rail (CVs / Syllabi / Papers·Appendices / Matrices)'],
];

const results = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf-8')) : [];
const img = (f) => fs.existsSync(path.join(SHOTS, f)) ? `data:image/png;base64,${fs.readFileSync(path.join(SHOTS, f)).toString('base64')}` : null;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

function docBlock(r) {
  const shot = (env, key) => {
    const src = img(`${r.name}-${env}-${key}.png`);
    return src ? `<figure><figcaption>${esc(env.toUpperCase())} — ${esc(SECTIONS.find(s => s[0] === key)?.[1] || key)}</figcaption><img src="${src}"></figure>` : '';
  };
  const v = r.validation;
  const validBadge = r.prod
    ? `<div class="valid ${v && v.ok ? 'ok' : 'bad'}">Validated vs production review panel: ${v ? esc(v.detail) : 'n/a'}</div>`
    : `<div class="valid note">Dev-only document (not on production) — shown on the Parser Train review panel.</div>`;
  const devShots = SECTIONS.map(([k]) => shot('dev', k)).filter(Boolean).join('');
  const prodShots = r.prod ? SECTIONS.map(([k]) => shot('prod', k)).filter(Boolean).join('') : '';
  return `
  <div class="doc">
    <h2>${esc(r.title)}</h2>
    <div class="meta">${esc(r.meta || '')}</div>
    ${validBadge}
    <h3>Dev — Parser Train review panel (superuser)</h3>
    ${devShots || '<p class="miss">no dev screenshots</p>'}
    ${r.prod ? `<h3>Production — review panel (the document’s Program Coordinator)</h3>${prodShots || '<p class="miss">no prod screenshots</p>'}` : ''}
  </div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a2233;margin:0}
  .page{padding:40px 48px}
  h1{font-size:25px;margin:0 0 4px} .sub{color:#5b6b8c;font-size:13px;margin-bottom:18px}
  .intro{font-size:13px;line-height:1.6;border:1px solid #e5e9f2;border-radius:10px;padding:14px 16px;margin-bottom:8px}
  .doc{page-break-before:always;padding-top:8px}
  h2{font-size:19px;margin:22px 0 2px;color:#14224a}
  h3{font-size:14px;margin:22px 0 8px;color:#14224a;border-bottom:2px solid #e5e9f2;padding-bottom:5px}
  .meta{color:#5b6b8c;font-size:12px}
  .valid{font-size:13px;border-radius:8px;padding:9px 12px;margin:10px 0}
  .valid.ok{background:#e7f6ee;color:#16794b;border:1px solid #bfe6cf}
  .valid.bad{background:#fdeceb;color:#b42318;border:1px solid #f3c6c2}
  .valid.note{background:#eef1f6;color:#42506e;border:1px solid #dce1ea}
  figure{margin:0 0 22px;page-break-inside:avoid}
  figcaption{font-size:12.5px;color:#14224a;margin-bottom:7px;font-weight:600}
  figure img{width:100%;border:1px solid #d9dfea;border-radius:8px}
  .miss{color:#b42318;font-size:12px}
</style></head><body>
  <div class="page">
    <h1>Parser Train — Review Panel Validation</h1>
    <div class="sub">CSHSE Accreditation Portal · CR-073 · ${now} · parsed output shown ON THE REVIEW PANEL, validated against production</div>
    <div class="intro">
      <p>This report shows the Parser Train parsing result <strong>on the Review panel</strong> (not the Self-Study Editor) for each document, section by section — Introduction, Standards (parsed narrative text per spec), Compare (the card located in the source), and Files (the Supporting Evidence rail). The Review panel is opened as a <strong>superuser</strong> on dev (Parser Train is a superuser function).</p>
      <p>Each production-available document (AACC, Kennesaw, MCC) is <strong>validated against the production review panel</strong> — opened by impersonating that document’s real Program Coordinator — to confirm the dev parse (with the learned rules) reproduces the validated outcome real coordinators see. Stevenson is the brand-new document (dev only).</p>
    </div>
    ${results.map((r) => `<div class="valid ${r.prod ? (r.validation && r.validation.ok ? 'ok' : 'bad') : 'note'}"><strong>${esc(r.title)}</strong> — ${r.prod ? (r.validation ? esc(r.validation.detail) : '') : 'dev-only'}</div>`).join('')}
  </div>
  ${results.map(docBlock).join('')}
</body></html>`;

fs.writeFileSync(OUT_HTML, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + OUT_HTML, { waitUntil: 'load' });
await page.pdf({ path: OUT_PDF, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log(`wrote ${OUT_PDF}`);

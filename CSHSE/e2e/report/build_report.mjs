#!/usr/bin/env node
/**
 * Build the Parser Train E2E PDF report: embeds every captured screenshot + the
 * pass/fail of each test suite, renders an HTML, and prints it to PDF via the
 * Playwright chromium already installed for E2E.
 *
 *   node e2e/report/build_report.mjs
 * Inputs:  e2e/report/shots/*.png   (from 76_parser_train_screenshots)
 *          e2e/report/results.json  (array of {suite, title, status, detail})
 * Output:  e2e/report/parser-train-e2e-report.pdf
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(DIR, 'shots');
const RESULTS = path.join(DIR, 'results.json');
const OUT_HTML = path.join(DIR, 'report.html');
const OUT_PDF = path.join(DIR, 'parser-train-e2e-report.pdf');

const CAPTIONS = {
  '01-parser-train-page': 'The superuser-only Parser Train surface (create run → import → diagnose → learn → approve).',
  '02-run-created': 'A sandbox training run is created — isolated on its own institution, excluded from every real list.',
  '03-parsed': 'The document is imported and parsed as the sandbox PC.',
  '04-diagnose-contract': 'Contract diagnose: the §7 verifier — every card anchored (Compare locates all), Standard/spec placement, file-type classification.',
  '05-learning-started': 'The learning loop starts: the agent searches candidate parse settings.',
  '06-learning-done': 'The learning loop finished: it tried each candidate, scored every parse against the contract, and LEARNED the winning setting — written back as an active rule.',
  '07-approved': 'Approve = activate the learned rule(s) for future imports (institution-scoped; the proven baseline is untouched).',
  '08-final-state': 'Final Parser Train state, including the recent-runs list.',
};

const results = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf-8')) : [];
const shots = fs.existsSync(SHOTS) ? fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png')).sort() : [];

const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(SHOTS, f)).toString('base64')}`;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const badge = (st) => `<span class="badge ${st === 'passed' ? 'pass' : st === 'skipped' ? 'skip' : 'fail'}">${st.toUpperCase()}</span>`;

const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const passCount = results.filter((r) => r.status === 'passed').length;
const failCount = results.filter((r) => r.status === 'failed').length;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a2233; margin: 0; }
  .page { padding: 40px 48px; page-break-after: always; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 10px; color: #14224a; border-bottom: 2px solid #e5e9f2; padding-bottom: 6px; }
  .sub { color: #5b6b8c; font-size: 13px; }
  .summary { display: flex; gap: 16px; margin: 18px 0; }
  .stat { flex: 1; border: 1px solid #e5e9f2; border-radius: 10px; padding: 14px 16px; }
  .stat .n { font-size: 26px; font-weight: 700; }
  .stat.pass .n { color: #16794b; } .stat.fail .n { color: #b42318; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eef1f6; vertical-align: top; }
  th { color: #5b6b8c; font-weight: 600; }
  .badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
  .badge.pass { background: #e7f6ee; color: #16794b; } .badge.fail { background: #fdeceb; color: #b42318; } .badge.skip { background: #eef1f6; color: #5b6b8c; }
  figure { margin: 0 0 26px; page-break-inside: avoid; }
  figcaption { font-size: 13px; color: #14224a; margin-bottom: 8px; font-weight: 600; }
  figure img { width: 100%; border: 1px solid #d9dfea; border-radius: 8px; }
  .arch { font-size: 13px; line-height: 1.6; }
  .arch code { background: #f2f4f8; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
</style></head><body>
  <div class="page">
    <h1>Parser Train — Self-Improving Parser: E2E Test Report</h1>
    <div class="sub">CSHSE Accreditation Portal · CR-073 · ${now} · target: dev</div>
    <div class="summary">
      <div class="stat pass"><div class="n">${passCount}</div><div>suites passed</div></div>
      <div class="stat fail"><div class="n">${failCount}</div><div>suites failed</div></div>
      <div class="stat"><div class="n">${shots.length}</div><div>screenshots</div></div>
    </div>
    <h2>What was tested</h2>
    <div class="arch">
      <p>The architecture has two halves. <strong>The ai-service is the rule ENGINE</strong>: at parse time it reads <code>parserRules</code> from Mongo and applies matching institution-scoped rules as a post-pass — strictly default-preserving, so with no matching rule the parse is byte-identical (proven by the golden regression staying green). <strong>The server is the LEARNING LOOP</strong>: the agent re-parses the document under candidate settings, scores each result against the §7 contract (every card anchored, correct Standard/spec placement, correct file type), and writes the winner back as an active rule the engine then consumes.</p>
    </div>
    <h2>Test suites</h2>
    <table><thead><tr><th style="width:90px">Result</th><th>Suite / assertion</th><th>Detail</th></tr></thead><tbody>
      ${results.map((r) => `<tr><td>${badge(r.status)}</td><td><strong>${esc(r.suite)}</strong><br>${esc(r.title)}</td><td>${esc(r.detail || '')}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="page">
    <h1>Screenshot walkthrough</h1>
    <div class="sub">Every stage of the SU Parser Train flow, captured live from the dev UI.</div>
    ${shots.map((f) => {
      const key = f.replace(/\.png$/, '');
      return `<figure><figcaption>${esc(key.replace(/^\d+-/, '').replace(/-/g, ' '))} — ${esc(CAPTIONS[key] || '')}</figcaption><img src="${img(f)}"></figure>`;
    }).join('')}
  </div>
</body></html>`;

fs.writeFileSync(OUT_HTML, html);
console.log(`wrote ${OUT_HTML} (${shots.length} shots, ${results.length} results)`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + OUT_HTML, { waitUntil: 'load' });
await page.pdf({ path: OUT_PDF, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log(`wrote ${OUT_PDF}`);

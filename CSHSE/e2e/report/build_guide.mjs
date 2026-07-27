#!/usr/bin/env node
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const G = path.join(DIR, 'guide');
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(G, f)).toString('base64')}`;
const OUT_PDF = path.join(DIR, 'self-study-editor-display-guide.pdf');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a2233;margin:0;line-height:1.55}
  .page{padding:38px 46px}
  h1{font-size:24px;margin:0 0 2px;color:#14532d}
  .sub{color:#5b6b8c;font-size:13px;margin-bottom:20px}
  h2{font-size:17px;margin:26px 0 8px;color:#14224a;display:flex;align-items:center;gap:8px}
  .num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#14532d;color:#fff;font-size:13px;font-weight:700}
  p{font-size:13.5px;margin:6px 0}
  ol{font-size:13.5px;margin:8px 0 8px 4px;padding-left:22px} ol li{margin:5px 0}
  figure{margin:12px 0 6px} figure img{width:100%;border:1px solid #d9dfea;border-radius:8px}
  .cap{font-size:12px;color:#5b6b8c;margin-top:5px}
  .tip{background:#eef6ef;border:1px solid #cfe6d3;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#1c5231;margin:10px 0}
  kbd{background:#f2f4f8;border:1px solid #d9dfea;border-bottom-width:2px;border-radius:4px;padding:1px 6px;font-size:12px}
  .lead{background:#f7faf7;border:1px solid #e5efe6;border-radius:10px;padding:14px 16px;margin-bottom:6px}
</style></head><body>
<div class="page">
  <h1>Self-Study Editor — New Display Features</h1>
  <div class="sub">A quick guide to the two new controls that give you more room on smaller screens · Self-Study Portal</div>
  <div class="lead">
    <p>Two new controls were added to the top of the Self-Study Editor to make it easier to work on a laptop or a smaller screen:</p>
    <p><strong>1. Full screen</strong> — hides the menus and gives your working area the whole window.<br>
       <strong>2. Menu (▤)</strong> — on smaller screens the toolbar buttons tuck into a single tidy menu.</p>
  </div>

  <h2><span class="num">1</span> Full screen — expand your workspace</h2>
  <p>When you want the most room to read and edit, click <strong>Full screen</strong> in the top bar. The wizard steps, title, and toolbar disappear and your work area (the standards list on the left and the editor on the right) fills the entire window.</p>
  <figure><img src="${img('d-fullscreen-button.png')}"><div class="cap">The <strong>Full screen</strong> button, next to the “Self-Study Editor” title.</div></figure>
  <figure><img src="${img('e-fullscreen-active.png')}"><div class="cap">Full screen on — the whole window is your workspace. Click <strong>Exit full screen</strong> (top-right) or press <kbd>Esc</kbd> to return.</div></figure>
  <div class="tip">Tip: press <kbd>Esc</kbd> at any time to leave full screen and bring the menus back.</div>

  <h2><span class="num">2</span> Menu — the toolbar on smaller screens</h2>
  <p>On a maximized laptop or a smaller window, the row of buttons (Introduction, Standards, Curriculum Matrix, Supporting File Library, and the draft tools) collapses into a single <strong>Menu</strong> button so the top bar stays short and nothing is cut off.</p>
  <figure><img src="${img('b-narrow-hamburger.png')}"><div class="cap">On a smaller screen the buttons collapse — look for <strong>Menu</strong> (the ▤ icon) next to <strong>Full screen</strong>.</div></figure>
  <p>Click <strong>Menu</strong> to open the list, then choose where you want to go:</p>
  <figure><img src="${img('c-menu-open.png')}"><div class="cap">The Menu opens the same choices — Introduction, Standards, Curriculum Matrix, Supporting File Library, and your draft tools.</div></figure>
  <div class="tip">On a large monitor the full button row shows as before — the Menu only appears when the window is narrow.</div>

  <p style="margin-top:24px;color:#5b6b8c;font-size:12px">Also new: an <strong>AI evaluation</strong> button now sits with the editor’s Save/Validate controls on each specification, so you can open the AI review for that spec at any time.</p>
</div>
</body></html>`;

const out = path.join(DIR, 'guide.html');
fs.writeFileSync(out, html);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + out, { waitUntil: 'load' });
await p.pdf({ path: OUT_PDF, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await b.close();
console.log('wrote', OUT_PDF);

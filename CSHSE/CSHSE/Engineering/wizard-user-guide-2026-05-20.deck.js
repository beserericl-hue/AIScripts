/**
 * AI Import Wizard — User Guide & Test Plan
 * CSHSE Accreditation Self-Study Portal
 */
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const {
  FaUpload, FaCog, FaListUl, FaTable, FaRocket, FaCheckCircle,
  FaSearch, FaTag, FaPlus, FaExclamationTriangle, FaInfoCircle,
  FaFileWord, FaDatabase, FaArrowRight, FaSync, FaTimes, FaPencilAlt,
  FaUserCheck, FaBookOpen, FaProjectDiagram, FaClipboardCheck,
  FaQuestionCircle, FaLayerGroup, FaArrowDown, FaEye, FaPaperPlane,
} = require('react-icons/fa');

// ---- Palette: CSHSE brand-aligned forest + moss with white sandwiching ----
const CSHSE_GREEN = '006B3F';     // primary dark
const CSHSE_GREEN_LT = '81C784';  // secondary light
const CSHSE_GREEN_DK = '004D2C';  // headlines on light bg
const CREAM = 'F5F1E8';            // off-white background
const INK = '1F2937';             // body text
const MUTE = '64748B';            // captions
const AMBER = 'D97706';           // warning
const EMERALD = '059669';         // success / apply CTA
const RED = 'DC2626';             // error

function renderIconSvg(IconComponent, color = '#000000', size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}
async function icon(IconComponent, hexColor) {
  const svg = renderIconSvg(IconComponent, '#' + hexColor, 256);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// Real CSHSE logo from the application's top-left brand chip.
// Source: client/public/cshse-logo.svg — rasterized to 1024px PNG.
const fs = require('fs');
async function loadLogoBase64() {
  const buf = fs.readFileSync('/tmp/cshse-logo-1024.png');
  return 'image/png;base64,' + buf.toString('base64');
}
// White-background variant for use on the dark-green header bar where the
// transparent logo's white internals would disappear into a dark bar.
async function loadLogoOnGreenBase64() {
  const svg = fs.readFileSync(
    '/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/client/public/cshse-logo.svg'
  );
  // The SVG already has the dark green fill — keep it transparent so the
  // green rounded square renders cleanly on cream backgrounds too.
  const buf = await sharp(svg, { density: 600 })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// ---- Helpers ----
function shadowOpts() {
  return { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.10 };
}

function addSlideHeader(slide, title, kicker) {
  // Top brand bar with real CSHSE logo at left.
  slide.addShape('rect', {
    x: 0, y: 0, w: 10, h: 0.4, fill: { color: CSHSE_GREEN_DK }, line: { color: CSHSE_GREEN_DK }
  });
  if (LOGO_DATA) {
    // 0.32 inch tall logo, vertically centered in the 0.4-tall bar.
    slide.addImage({ data: LOGO_DATA, x: 0.1, y: 0.04, w: 0.32, h: 0.32 });
  }
  slide.addText('AI Import Wizard · User Guide', {
    x: 0.5, y: 0, w: 9.0, h: 0.4, fontSize: 10, color: 'FFFFFF', valign: 'middle', margin: 0,
    fontFace: 'Calibri'
  });
  if (kicker) {
    slide.addText(kicker, {
      x: 0.5, y: 0.55, w: 9, h: 0.3,
      fontSize: 11, color: CSHSE_GREEN, bold: true, valign: 'middle', margin: 0,
      charSpacing: 4, fontFace: 'Calibri'
    });
  }
  slide.addText(title, {
    x: 0.5, y: kicker ? 0.85 : 0.6, w: 9, h: 0.7,
    fontSize: 32, bold: true, color: CSHSE_GREEN_DK, valign: 'middle', margin: 0,
    fontFace: 'Georgia'
  });
}

function addSlideFooter(slide, pageNum) {
  slide.addShape('rect', {
    x: 0, y: 5.5, w: 10, h: 0.125, fill: { color: CSHSE_GREEN_LT }, line: { color: CSHSE_GREEN_LT }
  });
  slide.addText(`${pageNum}`, {
    x: 9.4, y: 5.3, w: 0.5, h: 0.2, fontSize: 9, color: MUTE, align: 'right', margin: 0,
    fontFace: 'Calibri'
  });
}

// Module-scoped cache so addSlideHeader can use the logo synchronously.
let LOGO_DATA = null;

async function main() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';  // 10 x 5.625
  pres.author = 'CSHSE Engineering';
  pres.title = 'AI Import Wizard — User Guide & Test Plan';
  pres.subject = 'Coordinator walkthrough for the wizard from DOCX upload to Standards editor.';

  LOGO_DATA = await loadLogoBase64();

  // ------------------------------- SLIDE 1 — Title ----------------------------
  {
    const s = pres.addSlide();
    s.background = { color: CSHSE_GREEN_DK };

    // Big decorative leaf-shape suggestion using overlapping rectangles
    s.addShape('rect', { x: 0, y: 0, w: 4.5, h: 5.625, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
    s.addShape('rect', { x: 0, y: 4.6, w: 10, h: 1.025, fill: { color: CSHSE_GREEN_LT, transparency: 60 }, line: { color: CSHSE_GREEN_LT, transparency: 60 } });

    // Big CSHSE logo on the dark side of the title slide.
    s.addImage({ data: LOGO_DATA, x: 0.8, y: 0.55, w: 1.5, h: 1.5 });

    s.addText('Council for Standards in Human Service Education', {
      x: 0.5, y: 2.15, w: 4, h: 0.3, fontSize: 11, color: CSHSE_GREEN_LT, bold: true, fontFace: 'Calibri', align: 'left', margin: 0
    });
    s.addText('AI Import Wizard', {
      x: 0.5, y: 2.55, w: 4, h: 0.8, fontSize: 34, color: 'FFFFFF', bold: true, fontFace: 'Georgia', margin: 0
    });
    s.addText('User Guide & Test Plan', {
      x: 0.5, y: 3.35, w: 4, h: 0.4, fontSize: 18, color: CSHSE_GREEN_LT, fontFace: 'Georgia', italic: true, margin: 0
    });
    s.addText('From your self-study DOCX to the Standards editor — top-down.', {
      x: 5, y: 2.6, w: 4.5, h: 1.5, fontSize: 16, color: 'FFFFFF', fontFace: 'Calibri', valign: 'middle', margin: 0
    });
    s.addText([
      { text: 'Sprint 1 · commit 8ea57e6 · ', options: { color: CSHSE_GREEN_LT } },
      { text: '2026-05-20', options: { color: 'FFFFFF', bold: true } }
    ], { x: 0.8, y: 4.85, w: 7, h: 0.3, fontSize: 11, fontFace: 'Calibri', margin: 0 });
  }

  // ------------------------------- SLIDE 2 — What this is ---------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'What the wizard replaces', 'WHY');

    // Left card: manual flow
    s.addShape('rect', { x: 0.5, y: 1.7, w: 4.2, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addShape('rect', { x: 0.5, y: 1.7, w: 0.08, h: 3.4, fill: { color: RED }, line: { color: RED } });
    s.addText('Manual tagging today', { x: 0.75, y: 1.85, w: 3.9, h: 0.35, fontSize: 16, bold: true, color: INK, fontFace: 'Georgia', margin: 0 });
    s.addText([
      { text: 'Coordinator opens the DOCX', options: { bullet: true, breakLine: true } },
      { text: 'Reads each spec one by one', options: { bullet: true, breakLine: true } },
      { text: 'Cuts and pastes the matching text into the editor', options: { bullet: true, breakLine: true } },
      { text: 'Decides narrative vs. supporting evidence', options: { bullet: true, breakLine: true } },
      { text: 'Tags every matrix cell by hand', options: { bullet: true, breakLine: true } },
      { text: '~3-5 days of focused work per self-study', options: { color: RED, bold: true, italic: true } }
    ], { x: 0.85, y: 2.3, w: 3.6, h: 2.6, fontSize: 12, color: INK, fontFace: 'Calibri', paraSpaceAfter: 4 });

    const iconArrow = await icon(FaArrowRight, CSHSE_GREEN_DK);
    s.addImage({ data: iconArrow, x: 4.8, y: 3.0, w: 0.4, h: 0.4 });

    // Right card: wizard flow
    s.addShape('rect', { x: 5.3, y: 1.7, w: 4.2, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addShape('rect', { x: 5.3, y: 1.7, w: 0.08, h: 3.4, fill: { color: EMERALD }, line: { color: EMERALD } });
    s.addText('With the wizard', { x: 5.55, y: 1.85, w: 3.9, h: 0.35, fontSize: 16, bold: true, color: INK, fontFace: 'Georgia', margin: 0 });
    s.addText([
      { text: 'Drop the DOCX once', options: { bullet: true, breakLine: true } },
      { text: 'Pipeline extracts every section + matrix', options: { bullet: true, breakLine: true } },
      { text: 'Claude routes each section to its spec', options: { bullet: true, breakLine: true } },
      { text: 'Coordinator reviews + corrects in 3-pane UI', options: { bullet: true, breakLine: true } },
      { text: 'One click sends everything to the editor', options: { bullet: true, breakLine: true } },
      { text: '~5 minutes parse + ~30 min review', options: { color: EMERALD, bold: true, italic: true } }
    ], { x: 5.65, y: 2.3, w: 3.6, h: 2.6, fontSize: 12, color: INK, fontFace: 'Calibri', paraSpaceAfter: 4 });

    addSlideFooter(s, 2);
  }

  // ------------------------------- SLIDE 3 — The pipeline ---------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'The wizard pipeline — top down', 'PIPELINE');

    // Five stage cards across the slide
    const stages = [
      { icon: FaUpload, label: '1. Upload', sub: 'Drop the .docx', color: CSHSE_GREEN },
      { icon: FaCog, label: '2. Parse', sub: 'S3 → mammoth → walker → matcher', color: CSHSE_GREEN },
      { icon: FaListUl, label: '3. Review', sub: 'Spec rail + cards + preview', color: CSHSE_GREEN },
      { icon: FaTable, label: '4. Matrix', sub: 'Map columns to courses', color: CSHSE_GREEN },
      { icon: FaRocket, label: '5. Apply', sub: 'One click to editor', color: EMERALD },
    ];
    const stageW = 1.7;
    const gap = 0.15;
    const startX = (10 - (stages.length * stageW + (stages.length - 1) * gap)) / 2;
    let x = startX;
    for (const st of stages) {
      s.addShape('rect', { x, y: 1.9, w: stageW, h: 1.8, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
      const iconImg = await icon(st.icon, st.color);
      s.addImage({ data: iconImg, x: x + (stageW - 0.55) / 2, y: 2.1, w: 0.55, h: 0.55 });
      s.addText(st.label, { x: x + 0.1, y: 2.75, w: stageW - 0.2, h: 0.3, fontSize: 14, bold: true, color: st.color, align: 'center', margin: 0, fontFace: 'Calibri' });
      s.addText(st.sub, { x: x + 0.1, y: 3.05, w: stageW - 0.2, h: 0.55, fontSize: 10, color: MUTE, align: 'center', margin: 0, fontFace: 'Calibri' });
      x += stageW + gap;
    }
    // Connecting line under the cards
    s.addShape('rect', { x: startX + 0.3, y: 3.85, w: 5 * stageW + 4 * gap - 0.6, h: 0.05, fill: { color: CSHSE_GREEN_LT }, line: { color: CSHSE_GREEN_LT } });

    // Below the row: "What you'll see"
    s.addShape('rect', { x: 0.5, y: 4.1, w: 9, h: 1.15, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' } });
    s.addShape('rect', { x: 0.5, y: 4.1, w: 0.08, h: 1.15, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
    s.addText('What the coordinator does', { x: 0.7, y: 4.18, w: 8.5, h: 0.28, fontSize: 12, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
    s.addText('Stages 1, 4, and 5 are essentially clicks. Stage 2 runs unattended (~4 min). Stage 3 is the real work: skim cards, fix anything wrong, hit Apply.', {
      x: 0.7, y: 4.45, w: 8.5, h: 0.7, fontSize: 11, color: INK, fontFace: 'Calibri', margin: 0
    });

    addSlideFooter(s, 3);
  }

  // ------------------------------- SLIDE 4 — Before you start -----------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Before you start', 'PRE-FLIGHT');

    const items = [
      { ic: FaFileWord, t: 'Have your DOCX ready', d: 'A finished self-study .docx (PDF is a fallback). Up to 100 MB.' },
      { ic: FaUserCheck, t: 'Program Coordinator role', d: 'Only Coordinators see the Import File Wizard tab; Readers / Lead Readers do not.' },
      { ic: FaSync, t: 'Hard-refresh first', d: 'After any deploy: ⌘⇧R (Mac) or Ctrl⇧R (PC) to flush the old client bundle.' },
      { ic: FaDatabase, t: 'OpenAI balance > $1', d: 'A full Stevenson-scale run is ~$0.45 in OpenAI embeddings + Claude Haiku. Set auto-recharge in your OpenAI billing page to avoid the wizard halting mid-run.' },
    ];
    let y = 1.7;
    for (const it of items) {
      s.addShape('rect', { x: 0.5, y, w: 9, h: 0.78, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
      const ic = await icon(it.ic, CSHSE_GREEN);
      s.addImage({ data: ic, x: 0.7, y: y + 0.16, w: 0.45, h: 0.45 });
      s.addText(it.t, { x: 1.3, y: y + 0.08, w: 8, h: 0.3, fontSize: 14, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
      s.addText(it.d, { x: 1.3, y: y + 0.38, w: 8, h: 0.4, fontSize: 11, color: INK, fontFace: 'Calibri', margin: 0 });
      y += 0.85;
    }

    addSlideFooter(s, 4);
  }

  // ------------------------------- SLIDE 5 — Step 1 Upload --------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Step 1 — Upload', 'STEP 1 OF 5');

    // Left: how
    s.addShape('rect', { x: 0.5, y: 1.7, w: 4.5, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addText('How', { x: 0.7, y: 1.8, w: 4.2, h: 0.3, fontSize: 13, bold: true, color: CSHSE_GREEN_DK, charSpacing: 4, fontFace: 'Calibri', margin: 0 });
    s.addText([
      { text: 'Open the Self-Study Editor for your submission', options: { bullet: { type: 'number' }, breakLine: true } },
      { text: 'Click the Import File Wizard tab in the top bar', options: { bullet: { type: 'number' }, breakLine: true } },
      { text: 'Drag the .docx into the drop zone (or click to browse)', options: { bullet: { type: 'number' }, breakLine: true } },
      { text: 'Pick the program level (Associate / Baccalaureate / Master’s)', options: { bullet: { type: 'number' }, breakLine: true } },
      { text: 'Tick "This is a re-import" if you’re replacing a prior run', options: { bullet: { type: 'number' }, breakLine: true } },
      { text: 'Click Next', options: { bullet: { type: 'number' } } }
    ], { x: 0.85, y: 2.15, w: 4.2, h: 2.8, fontSize: 11, color: INK, fontFace: 'Calibri', paraSpaceAfter: 5 });

    // Right: what to verify
    s.addShape('rect', { x: 5.2, y: 1.7, w: 4.3, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addShape('rect', { x: 5.2, y: 1.7, w: 0.08, h: 3.4, fill: { color: EMERALD }, line: { color: EMERALD } });
    s.addText('TEST CHECKLIST', { x: 5.45, y: 1.8, w: 4, h: 0.3, fontSize: 13, bold: true, color: EMERALD, charSpacing: 4, fontFace: 'Calibri', margin: 0 });
    s.addText([
      { text: 'Drag-drop accepts the file (no auto-bounce)', options: { bullet: true, breakLine: true } },
      { text: 'Upload progress bar reaches 100%', options: { bullet: true, breakLine: true } },
      { text: '"Starting AI service…" appears briefly', options: { bullet: true, breakLine: true } },
      { text: 'Page advances to the Parse step', options: { bullet: true, breakLine: true } },
      { text: 'If error red banner: "Start over" returns you cleanly to a fresh upload form (no stale error left over).', options: { bullet: true } }
    ], { x: 5.55, y: 2.15, w: 3.7, h: 2.8, fontSize: 11, color: INK, fontFace: 'Calibri', paraSpaceAfter: 5 });

    addSlideFooter(s, 5);
  }

  // ------------------------------- SLIDE 6 — Step 2 Parse ---------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Step 2 — Parse', 'STEP 2 OF 5');

    // Pipeline strip showing stages
    const stageData = [
      ['download_s3', '~1s'],
      ['format_detect', '<1s'],
      ['mammoth', '~15s'],
      ['deep_walker', '~15s'],
      ['matcher', '2-3 min'],
      ['coverage_review', '~1 min'],
      ['matrix_extract', '~15s'],
    ];
    const stageW = 1.25, gap = 0.05;
    const startX = (10 - (stageData.length * stageW + (stageData.length - 1) * gap)) / 2;
    let x = startX;
    for (const [name, dur] of stageData) {
      s.addShape('rect', { x, y: 1.8, w: stageW, h: 0.8, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
      s.addShape('rect', { x, y: 1.8, w: stageW, h: 0.08, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
      s.addText(name, { x: x + 0.05, y: 1.95, w: stageW - 0.1, h: 0.32, fontSize: 10, bold: true, color: CSHSE_GREEN_DK, align: 'center', fontFace: 'Consolas', margin: 0 });
      s.addText(dur, { x: x + 0.05, y: 2.27, w: stageW - 0.1, h: 0.3, fontSize: 10, color: MUTE, align: 'center', fontFace: 'Calibri', margin: 0 });
      x += stageW + gap;
    }

    // Below the strip: descriptors
    s.addShape('rect', { x: 0.5, y: 3.0, w: 4.3, h: 2.1, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addText('What’s happening', { x: 0.7, y: 3.1, w: 4, h: 0.3, fontSize: 13, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
    s.addText([
      { text: 'Pulls the DOCX from Tigris S3', options: { bullet: true, breakLine: true } },
      { text: 'Converts to ~350 MB HTML', options: { bullet: true, breakLine: true } },
      { text: 'Walks every table + letter-tagged response', options: { bullet: true, breakLine: true } },
      { text: 'Claude Haiku routes each section to a (Standard, Spec)', options: { bullet: true, breakLine: true } },
      { text: 'Matrix anchors (HSR + Non-HS) extracted as first-class', options: { bullet: true } }
    ], { x: 0.85, y: 3.4, w: 3.9, h: 1.65, fontSize: 11, color: INK, fontFace: 'Calibri', paraSpaceAfter: 3 });

    s.addShape('rect', { x: 5.0, y: 3.0, w: 4.5, h: 2.1, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addShape('rect', { x: 5.0, y: 3.0, w: 0.08, h: 2.1, fill: { color: AMBER }, line: { color: AMBER } });
    s.addText('"LOOKS HUNG"?', { x: 5.25, y: 3.1, w: 4, h: 0.3, fontSize: 13, bold: true, color: AMBER, fontFace: 'Calibri', charSpacing: 4, margin: 0 });
    s.addText([
      { text: 'matcher is the longest stage — ~2-3 min on a Stevenson-sized doc.', options: { breakLine: true } },
      { text: 'Watch the detail line: "200 / 557" → "557 / 557" ticks up every few seconds.', options: { breakLine: true } },
      { text: 'Elapsed timer + amber "stall" banner if no update for >30s.', options: { breakLine: true } },
      { text: 'If failed: red banner + "Start over" returns to upload (clears errors).', options: {} }
    ], { x: 5.25, y: 3.4, w: 4.15, h: 1.65, fontSize: 11, color: INK, fontFace: 'Calibri', paraSpaceAfter: 4 });

    addSlideFooter(s, 6);
  }

  // ------------------------------- SLIDE 7 — Review intro ---------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Step 3 — Review (3-pane workspace)', 'STEP 3 OF 5');

    // Three columns
    const cols = [
      { x: 0.5, w: 2.8, title: 'LEFT · Spec Rail', icon: FaListUl, lines: ['Matrices (N) — when detected', 'Standard 1 → 1.a, 1.b, …', 'Coverage dots: 🟢🟡🔴', 'Item count badge', 'Unplaced · Unwritten'] },
      { x: 3.5, w: 3.2, title: 'MIDDLE · Item Cards', icon: FaLayerGroup, lines: ['Full body text per card', 'Inline kind chips: Narrative / Evidence / File', 'Per-card Approve button', '"+ Add from source" on empties', '"View in Matrix" link for matrix-covered specs'] },
      { x: 6.9, w: 2.6, title: 'RIGHT · AI Preview', icon: FaEye, lines: ['AI confidence + rationale', 'Change kind dropdown', 'Reassign to a different (Std, Spec)', 'Show in source document'] },
    ];
    for (const c of cols) {
      s.addShape('rect', { x: c.x, y: 1.7, w: c.w, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
      s.addShape('rect', { x: c.x, y: 1.7, w: c.w, h: 0.08, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
      const ic = await icon(c.icon, CSHSE_GREEN);
      s.addImage({ data: ic, x: c.x + 0.15, y: 1.92, w: 0.35, h: 0.35 });
      s.addText(c.title, { x: c.x + 0.55, y: 1.9, w: c.w - 0.6, h: 0.4, fontSize: 13, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0, valign: 'middle' });
      s.addText(c.lines.map((l, i) => ({
        text: l,
        options: { bullet: true, ...(i < c.lines.length - 1 ? { breakLine: true } : {}) }
      })), { x: c.x + 0.15, y: 2.4, w: c.w - 0.3, h: 2.6, fontSize: 10.5, color: INK, fontFace: 'Calibri', paraSpaceAfter: 3 });
    }

    addSlideFooter(s, 7);
  }

  // ------------------------------- SLIDE 8 — Spec Rail ------------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'The Spec Rail — your map of the document', 'STEP 3a');

    // Mocked rail
    s.addShape('rect', { x: 0.5, y: 1.7, w: 3.3, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    // "Matrices (2)" entry
    s.addShape('rect', { x: 0.65, y: 1.85, w: 3.0, h: 0.3, fill: { color: 'E8F5E9' }, line: { color: CSHSE_GREEN_LT } });
    s.addText('📊 Matrices', { x: 0.75, y: 1.85, w: 1.5, h: 0.3, fontSize: 11, bold: true, color: CSHSE_GREEN_DK, margin: 0, valign: 'middle', fontFace: 'Calibri' });
    s.addText('2', { x: 3.0, y: 1.85, w: 0.4, h: 0.3, fontSize: 10, bold: true, color: CSHSE_GREEN, margin: 0, valign: 'middle', align: 'right', fontFace: 'Calibri' });
    // Standard 1 + specs
    s.addText('STANDARD 1', { x: 0.65, y: 2.25, w: 3.0, h: 0.25, fontSize: 9, bold: true, color: MUTE, charSpacing: 3, fontFace: 'Calibri', margin: 0 });
    const specs = [
      ['1.a Institutional Requirements', '1', '🟢'],
      ['1.b Institutional Requirements', '7', '🟢'],
      ['1.c Institutional Requirements', '2', '🟡'],
      ['1.d Institutional Requirements', '1', '🔴'],
      ['1.e Institutional Requirements', '4', '🟡'],
      ['1.f Institutional Requirements', '3', '🔴'],
    ];
    let sy = 2.55;
    for (const [name, count, dot] of specs) {
      s.addText(name, { x: 0.75, y: sy, w: 2.4, h: 0.25, fontSize: 9.5, color: INK, fontFace: 'Calibri', margin: 0, valign: 'middle' });
      s.addText(count, { x: 3.0, y: sy, w: 0.25, h: 0.25, fontSize: 9, color: CSHSE_GREEN_DK, bold: true, fontFace: 'Calibri', margin: 0, valign: 'middle' });
      s.addText(dot, { x: 3.3, y: sy, w: 0.25, h: 0.25, fontSize: 9, margin: 0, valign: 'middle' });
      sy += 0.27;
    }

    // Right side: legend
    s.addShape('rect', { x: 4.1, y: 1.7, w: 5.4, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addText('How to read the rail', { x: 4.3, y: 1.85, w: 5, h: 0.3, fontSize: 14, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
    s.addText([
      { text: '📊 Matrices (N) ', options: { bold: true, color: CSHSE_GREEN_DK } },
      { text: 'jumps to a dedicated matrices view — full source <table> + per-row deep-links.', options: { breakLine: true } },
      { text: '\nN badge ', options: { bold: true, color: CSHSE_GREEN_DK } },
      { text: 'on each spec = item count auto-routed there.', options: { breakLine: true } },
      { text: '\n🟢 green ', options: { bold: true } },
      { text: '= spec fully covered. ', options: {} },
      { text: '🟡 amber ', options: { bold: true } },
      { text: '= partial coverage. ', options: {} },
      { text: '🔴 red ', options: { bold: true } },
      { text: '= the spec has items but the coverage reviewer found gaps.', options: { breakLine: true } },
      { text: '\nNo dot, no badge ', options: { bold: true, color: CSHSE_GREEN_DK } },
      { text: '= nothing routed here. ', options: {} },
      { text: 'Click the spec to see the "+ Add from source" CTA — that’s your correction path.', options: { italic: true, color: MUTE } },
    ], { x: 4.3, y: 2.2, w: 5.0, h: 2.85, fontSize: 11, color: INK, fontFace: 'Calibri' });

    addSlideFooter(s, 8);
  }

  // ------------------------------- SLIDE 9 — Item cards / kind chips ----------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Item cards & the kind chips', 'STEP 3b');

    // Mocked card
    s.addShape('rect', { x: 0.5, y: 1.7, w: 5.0, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    // Header chips
    s.addText('#3', { x: 0.7, y: 1.85, w: 0.3, h: 0.3, fontSize: 10, bold: true, color: MUTE, fontFace: 'Calibri', margin: 0, valign: 'middle' });
    s.addShape('rect', { x: 1.0, y: 1.85, w: 0.55, h: 0.3, fill: { color: 'DCFCE7' }, line: { color: 'DCFCE7' } });
    s.addText('0.94', { x: 1.0, y: 1.85, w: 0.55, h: 0.3, fontSize: 10, bold: true, color: '15803D', align: 'center', valign: 'middle', margin: 0, fontFace: 'Calibri' });

    // Kind chip group: Narrative / Evidence / File
    let cx = 1.65;
    const chips = [
      { l: 'Narrative', bg: CSHSE_GREEN_DK, fg: 'FFFFFF' },
      { l: 'Evidence', bg: 'FFFFFF', fg: INK },
      { l: 'File', bg: 'FFFFFF', fg: INK },
    ];
    for (const c of chips) {
      const w = 0.85;
      s.addShape('rect', { x: cx, y: 1.85, w, h: 0.3, fill: { color: c.bg }, line: { color: 'D1D5DB' } });
      s.addText(c.l, { x: cx, y: 1.85, w, h: 0.3, fontSize: 10, color: c.fg, align: 'center', valign: 'middle', margin: 0, fontFace: 'Calibri' });
      cx += w;
    }

    // Approve button
    s.addShape('rect', { x: 4.7, y: 1.85, w: 0.75, h: 0.3, fill: { color: 'FFFFFF' }, line: { color: 'D1D5DB' } });
    s.addText('✓ Approve', { x: 4.7, y: 1.85, w: 0.75, h: 0.3, fontSize: 9, color: INK, align: 'center', valign: 'middle', margin: 0, fontFace: 'Calibri' });

    // Title
    s.addText('Provide evidence that the development of competent human services…', { x: 0.7, y: 2.3, w: 4.7, h: 0.4, fontSize: 11.5, bold: true, color: INK, fontFace: 'Calibri', margin: 0 });
    s.addText('Source heading: b.', { x: 0.7, y: 2.7, w: 4.7, h: 0.25, fontSize: 9, italic: true, color: MUTE, fontFace: 'Calibri', margin: 0 });
    // Body snippet
    s.addShape('rect', { x: 0.7, y: 3.0, w: 4.7, h: 2.0, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    s.addText('Response: The Counseling & Human Services Program is designed for students who want to provide human services for people in need. The major prepares students for careers in human services and also for graduate school. The courses provide students with a comprehensive understanding of how individuals and families develop…', {
      x: 0.85, y: 3.1, w: 4.4, h: 1.8, fontSize: 10, color: INK, fontFace: 'Calibri'
    });

    // Right: the WHAT and the WHY
    s.addShape('rect', { x: 5.8, y: 1.7, w: 3.7, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addShape('rect', { x: 5.8, y: 1.7, w: 0.08, h: 3.4, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
    s.addText('Click anything', { x: 6.0, y: 1.85, w: 3.5, h: 0.3, fontSize: 14, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
    s.addText([
      { text: 'Kind chips ', options: { bold: true } },
      { text: '(Narrative · Evidence · File) — click to re-bucket. One click flips a narrative to supporting evidence.', options: { breakLine: true } },
      { text: '\nApprove ', options: { bold: true } },
      { text: '— marks the card green. Coordinator workflow tracker; does NOT gate the Apply action.', options: { breakLine: true } },
      { text: '\nCheckbox ', options: { bold: true } },
      { text: '— select for bulk Send-to-tags / Apply-as-file / Reassign in the toolbar above.', options: { breakLine: true } },
      { text: '\nClick the body ', options: { bold: true } },
      { text: '— opens the right-pane preview with the AI rationale.', options: {} }
    ], { x: 6.0, y: 2.2, w: 3.4, h: 2.85, fontSize: 10.5, color: INK, fontFace: 'Calibri', paraSpaceAfter: 3 });

    addSlideFooter(s, 9);
  }

  // ------------------------------- SLIDE 10 — Correcting missing -------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'When a spec is empty: the correction loop', 'STEP 3c');

    // 3-step horizontal flow
    const steps = [
      { ic: FaPlus, t: '1. Click "+ Add from source"', d: 'Visible on every empty spec card. Opens the source-DOCX viewer in selection mode.' },
      { ic: FaSearch, t: '2. Highlight the passage', d: 'Drag-select the text in the document that addresses this spec. Selected text shows at the bottom of the viewer.' },
      { ic: FaCheckCircle, t: '3. Use this passage', d: 'Click confirm. The spec card fills instantly AND the matcher learns this example — per-institution scope, only your future runs.' },
    ];
    const w = 3.0, gap = 0.15;
    const startX = (10 - (steps.length * w + (steps.length - 1) * gap)) / 2;
    let xx = startX;
    for (const st of steps) {
      s.addShape('rect', { x: xx, y: 1.8, w, h: 2.6, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
      s.addShape('oval', { x: xx + (w - 0.7) / 2, y: 2.0, w: 0.7, h: 0.7, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
      const ic = await icon(st.ic, 'FFFFFF');
      s.addImage({ data: ic, x: xx + (w - 0.4) / 2, y: 2.15, w: 0.4, h: 0.4 });
      s.addText(st.t, { x: xx + 0.2, y: 2.8, w: w - 0.4, h: 0.4, fontSize: 12, bold: true, color: CSHSE_GREEN_DK, align: 'center', fontFace: 'Calibri', margin: 0 });
      s.addText(st.d, { x: xx + 0.2, y: 3.2, w: w - 0.4, h: 1.15, fontSize: 10.5, color: INK, align: 'center', fontFace: 'Calibri', margin: 0 });
      xx += w + gap;
    }

    // Footer callout
    s.addShape('rect', { x: 0.5, y: 4.6, w: 9, h: 0.5, fill: { color: 'FEF3C7' }, line: { color: 'FCD34D' } });
    const icInfo = await icon(FaInfoCircle, AMBER);
    s.addImage({ data: icInfo, x: 0.65, y: 4.7, w: 0.3, h: 0.3 });
    s.addText('Your corrections become labeled examples in cshse_corrections_{env}. Stevenson’s corrections shape only Stevenson’s future runs.', {
      x: 1.05, y: 4.6, w: 8.4, h: 0.5, fontSize: 11, italic: true, color: '78350F', fontFace: 'Calibri', valign: 'middle', margin: 0
    });

    addSlideFooter(s, 10);
  }

  // ------------------------------- SLIDE 11 — Matrix step --------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Step 4 — Matrix (optional)', 'STEP 4 OF 5');

    // Left: purpose
    s.addShape('rect', { x: 0.5, y: 1.7, w: 4.3, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addShape('rect', { x: 0.5, y: 1.7, w: 0.08, h: 3.4, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
    s.addText('Purpose', { x: 0.75, y: 1.85, w: 4, h: 0.3, fontSize: 13, bold: true, color: CSHSE_GREEN_DK, charSpacing: 4, fontFace: 'Calibri', margin: 0 });
    s.addText([
      { text: 'The AI extracted the matrix cell codes per column index (Col 1, Col 2 …).', options: { breakLine: true } },
      { text: '\nMammoth’s DOCX→HTML often loses the course-code header (merged cells, styled rows). So the AI can’t name "Col 5" as HS301.', options: { breakLine: true } },
      { text: '\nThis step asks you to map each Col N to a course in your ProgramCourses catalog.', options: { breakLine: true } },
      { text: '\nOnce mapped, the cells persist to CurriculumMatrix.standards[] with real courseId references.', options: {} }
    ], { x: 0.85, y: 2.2, w: 4.0, h: 2.85, fontSize: 10.5, color: INK, fontFace: 'Calibri' });

    // Right: what to do
    s.addShape('rect', { x: 5.1, y: 1.7, w: 4.4, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addShape('rect', { x: 5.1, y: 1.7, w: 0.08, h: 3.4, fill: { color: EMERALD }, line: { color: EMERALD } });
    s.addText('YOUR CHOICES', { x: 5.35, y: 1.85, w: 4, h: 0.3, fontSize: 13, bold: true, color: EMERALD, charSpacing: 4, fontFace: 'Calibri', margin: 0 });
    s.addText([
      { text: '🟢 Map every column', options: { bold: true, breakLine: true } },
      { text: 'Pick a course in each dropdown. The cell table below previews how the matrix will land.', options: { breakLine: true } },
      { text: '\n🟡 Map some, skip the rest', options: { bold: true, breakLine: true } },
      { text: 'Partial mappings are fine. Cells in named columns persist; unmapped columns are dropped.', options: { breakLine: true } },
      { text: '\n⏭ Skip this matrix', options: { bold: true, breakLine: true } },
      { text: 'Check the "Skip this matrix" toggle in the top-right of the block. Populate manually later from the Curriculum Matrix tab.', options: {} }
    ], { x: 5.35, y: 2.2, w: 4.1, h: 2.85, fontSize: 10.5, color: INK, fontFace: 'Calibri', paraSpaceAfter: 3 });

    addSlideFooter(s, 11);
  }

  // ------------------------------- SLIDE 12 — Cell-code reference ------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Matrix cell codes — quick reference', 'STEP 4 · LEGEND');

    // Two tables side by side
    s.addShape('rect', { x: 0.5, y: 1.8, w: 4.5, h: 3.3, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addText('Content types', { x: 0.7, y: 1.9, w: 4, h: 0.3, fontSize: 14, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
    s.addTable([
      [{ text: 'Code', options: { bold: true, color: 'FFFFFF', fill: { color: CSHSE_GREEN } } }, { text: 'Meaning', options: { bold: true, color: 'FFFFFF', fill: { color: CSHSE_GREEN } } }],
      ['I', 'Introduction of the topic'],
      ['T', 'Theory'],
      ['K', 'Knowledge'],
      ['S', 'Skills'],
    ], { x: 0.7, y: 2.3, w: 4.1, colW: [0.9, 3.2], fontSize: 12, fontFace: 'Calibri', border: { pt: 0.5, color: 'E5E7EB' }, rowH: 0.45 });

    s.addShape('rect', { x: 5.2, y: 1.8, w: 4.3, h: 3.3, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addText('Depth modifiers', { x: 5.4, y: 1.9, w: 4, h: 0.3, fontSize: 14, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
    s.addTable([
      [{ text: 'Code', options: { bold: true, color: 'FFFFFF', fill: { color: CSHSE_GREEN } } }, { text: 'Meaning', options: { bold: true, color: 'FFFFFF', fill: { color: CSHSE_GREEN } } }],
      ['L', 'Low depth'],
      ['M', 'Medium depth'],
      ['H', 'High depth'],
    ], { x: 5.4, y: 2.3, w: 3.9, colW: [0.9, 3.0], fontSize: 12, fontFace: 'Calibri', border: { pt: 0.5, color: 'E5E7EB' }, rowH: 0.45 });

    // Example
    s.addShape('rect', { x: 0.5, y: 4.7, w: 9, h: 0.4, fill: { color: 'F1F5F9' }, line: { color: 'E2E8F0' } });
    s.addText([
      { text: 'Example: ', options: { bold: true, color: CSHSE_GREEN_DK } },
      { text: '"I,KM" = Introduction + Knowledge at Medium depth · "T,L" = Theory at Low depth · "ITKSH" = all four content types at High depth.', options: { color: INK } }
    ], { x: 0.65, y: 4.7, w: 8.7, h: 0.4, fontSize: 11, fontFace: 'Calibri', valign: 'middle', margin: 0 });

    addSlideFooter(s, 12);
  }

  // ------------------------------- SLIDE 13 — Step 5 Apply --------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Step 5 — Apply', 'STEP 5 OF 5');

    // Big one-click button mockup centered
    s.addShape('rect', { x: 0.5, y: 1.7, w: 4.4, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addText('Two paths to the editor', { x: 0.7, y: 1.85, w: 4, h: 0.3, fontSize: 13, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });

    // Path A
    s.addText('Path A — One click', { x: 0.7, y: 2.25, w: 4, h: 0.3, fontSize: 12, bold: true, color: EMERALD, fontFace: 'Calibri', margin: 0 });
    s.addShape('rect', { x: 0.7, y: 2.55, w: 2.4, h: 0.4, fill: { color: EMERALD }, line: { color: EMERALD } });
    const iconRocketSm = await icon(FaRocket, 'FFFFFF');
    s.addImage({ data: iconRocketSm, x: 0.8, y: 2.62, w: 0.25, h: 0.25 });
    s.addText('Apply to editor', { x: 1.05, y: 2.55, w: 1.8, h: 0.4, fontSize: 11, bold: true, color: 'FFFFFF', align: 'left', valign: 'middle', margin: 0, fontFace: 'Calibri' });
    s.addText('On the Review screen top toolbar. Opens confirm dialog → fires apply() → lands you on the success summary.', {
      x: 0.7, y: 3.05, w: 4.0, h: 0.7, fontSize: 10, color: INK, fontFace: 'Calibri', margin: 0
    });

    // Path B
    s.addText('Path B — Guided', { x: 0.7, y: 3.85, w: 4, h: 0.3, fontSize: 12, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
    s.addText('Next: Matrix ▸ → map columns → Next: Apply ▸ → pick merge mode → Apply & finish. Use when re-importing into an existing self-study where merge behavior matters.', {
      x: 0.7, y: 4.15, w: 4.0, h: 0.95, fontSize: 10, color: INK, fontFace: 'Calibri', margin: 0
    });

    // Right: confirm modal preview
    s.addShape('rect', { x: 5.2, y: 1.7, w: 4.3, h: 3.4, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addText('Send everything to the editor?', { x: 5.4, y: 1.85, w: 3.9, h: 0.3, fontSize: 14, bold: true, color: INK, fontFace: 'Georgia', margin: 0 });
    s.addText('The following items will be written to the standards editor. Existing content stays — new content is merged in.', {
      x: 5.4, y: 2.15, w: 3.9, h: 0.55, fontSize: 10, color: INK, fontFace: 'Calibri', margin: 0
    });
    s.addShape('rect', { x: 5.4, y: 2.75, w: 3.9, h: 1.6, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    s.addText([
      { text: '📝 N narratives', options: { breakLine: true } },
      { text: '📄 N supporting evidence text', options: { breakLine: true } },
      { text: '📎 N evidence files', options: { breakLine: true } },
      { text: '🔢 N matrix cells across N matrices', options: { breakLine: true } },
      { text: '🏷 N unplaced items → Tag list', options: {} }
    ], { x: 5.55, y: 2.85, w: 3.7, h: 1.45, fontSize: 11, color: INK, fontFace: 'Calibri' });

    s.addShape('rect', { x: 7.2, y: 4.55, w: 2.2, h: 0.35, fill: { color: EMERALD }, line: { color: EMERALD } });
    s.addText('🚀 Confirm — send to editor', { x: 7.2, y: 4.55, w: 2.2, h: 0.35, fontSize: 9.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, fontFace: 'Calibri' });
    s.addShape('rect', { x: 6.4, y: 4.55, w: 0.7, h: 0.35, fill: { color: 'FFFFFF' }, line: { color: 'D1D5DB' } });
    s.addText('Cancel', { x: 6.4, y: 4.55, w: 0.7, h: 0.35, fontSize: 9.5, color: INK, align: 'center', valign: 'middle', margin: 0, fontFace: 'Calibri' });

    addSlideFooter(s, 13);
  }

  // ------------------------------- SLIDE 14 — Round-trip ---------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'What lands in the Standards editor', 'ROUND-TRIP');

    const tiles = [
      { ic: FaBookOpen, t: 'Standards tab', d: 'Narratives appear under each (Standard, Spec). Each card wraps the AI rationale + confidence in a styled <div class="ai-analysis"> block.' },
      { ic: FaProjectDiagram, t: 'Curriculum Matrix tab', d: 'One CurriculumMatrix doc per detected matrix. The matrix HTML is seeded into rawContent so you can see the full grid + row anchors right away.' },
      { ic: FaTag, t: 'Tag list', d: 'Items the matcher couldn’t confidently route land here. Use the editor’s tag panel to triage at your own pace.' },
      { ic: FaTable, t: 'Supporting evidence', d: 'Long-form evidence text is stored on Submission.narratives[std][spec].supportingEvidenceText. Files become SupportingEvidence rows.' },
    ];
    let tx = 0.5, ty = 1.7;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const xx = 0.5 + (i % 2) * 4.6;
      const yy = 1.7 + Math.floor(i / 2) * 1.75;
      s.addShape('rect', { x: xx, y: yy, w: 4.4, h: 1.55, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
      const ic = await icon(t.ic, CSHSE_GREEN);
      s.addImage({ data: ic, x: xx + 0.15, y: yy + 0.2, w: 0.5, h: 0.5 });
      s.addText(t.t, { x: xx + 0.75, y: yy + 0.15, w: 3.5, h: 0.35, fontSize: 13, bold: true, color: CSHSE_GREEN_DK, fontFace: 'Calibri', margin: 0 });
      s.addText(t.d, { x: xx + 0.15, y: yy + 0.75, w: 4.1, h: 0.75, fontSize: 10, color: INK, fontFace: 'Calibri', margin: 0 });
    }

    addSlideFooter(s, 14);
  }

  // ------------------------------- SLIDE 15 — Full test plan ------------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Test plan — end-to-end checklist', 'QA');

    s.addShape('rect', { x: 0.5, y: 1.7, w: 9, h: 3.6, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
    s.addTable([
      [
        { text: '#', options: { bold: true, color: 'FFFFFF', fill: { color: CSHSE_GREEN } } },
        { text: 'Step', options: { bold: true, color: 'FFFFFF', fill: { color: CSHSE_GREEN } } },
        { text: 'Pass criterion', options: { bold: true, color: 'FFFFFF', fill: { color: CSHSE_GREEN } } }
      ],
      ['1', 'Hard-refresh the wizard tab', 'Browser fetches the latest client bundle (no "Spec ?.?")'],
      ['2', 'Start over from a failed run', 'Red error banner clears; upload form is fresh'],
      ['3', 'Drop the DOCX', 'Upload progress to 100%, "Starting AI service…" briefly, advance to Parse'],
      ['4', 'Parse completes', 'All 7 stages done; "N raw, M after filter" line in deep_walker detail'],
      ['5', 'Spec 1.a has content', 'Rail shows a number badge on 1.a (no longer empty)'],
      ['6', 'Matrices entry visible', 'Top of the rail: "📊 Matrices · 2"; click shows the full <table>'],
      ['7', 'Kind chip flip', 'Click "Evidence" on a Narrative card → it re-buckets, the rail badges update'],
      ['8', 'Approve all', 'Bulk toolbar button marks every visible card green'],
      ['9', '+ Add from source', 'Empty spec card → modal opens → highlight → "Use this passage" → card fills'],
      ['10', '🚀 Apply to editor', 'Confirm dialog shows counts; status flips to "applied"; success banner'],
      ['11', 'Standards tab', 'Narratives visible under each spec; AI-analysis blocks at the top of each'],
      ['12', 'Curriculum Matrix tab', 'Two new CurriculumMatrix documents; rawContent renders the matrix tables'],
    ], { x: 0.7, y: 1.95, w: 8.6, colW: [0.4, 3.2, 5.0], fontSize: 10, fontFace: 'Calibri', border: { pt: 0.5, color: 'E5E7EB' }, rowH: 0.27 });

    addSlideFooter(s, 15);
  }

  // ------------------------------- SLIDE 16 — Troubleshooting -----------------
  {
    const s = pres.addSlide();
    s.background = { color: CREAM };
    addSlideHeader(s, 'Troubleshooting', 'WHEN THINGS GO SIDEWAYS');

    const troubles = [
      { icon: FaExclamationTriangle, color: AMBER, t: 'OpenAI 429 insufficient_quota', d: 'Add credits at platform.openai.com/billing. Set auto-recharge to avoid the wizard halting mid-run.' },
      { icon: FaExclamationTriangle, color: AMBER, t: '"Spec ?.?" in the matrix step', d: 'Old browser bundle. Hard-refresh (⌘⇧R / Ctrl⇧R). After refresh you should see actual spec markers like 11.a, 11.b.' },
      { icon: FaExclamationTriangle, color: AMBER, t: 'Matrix columnHeaders blank', d: 'Mammoth couldn’t read the source header cells. Open your DOCX side-by-side to read column 1, 2, 3 … or skip the matrix.' },
      { icon: FaExclamationTriangle, color: AMBER, t: 'Stage stuck on matcher', d: 'Coverage-review takes ~2-3 min on a Stevenson-scale doc. Watch the "N / M" counter. Stall banner appears if no update for >30s.' },
      { icon: FaTimes, color: RED, t: 'Parse failed: red banner', d: 'Click "Start over" — clears errors + transient state + returns to upload. Check the error detail for the failing stage.' },
    ];
    let yy = 1.65;
    for (const tr of troubles) {
      s.addShape('rect', { x: 0.5, y: yy, w: 9, h: 0.68, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB' }, shadow: shadowOpts() });
      const ic = await icon(tr.icon, tr.color);
      s.addImage({ data: ic, x: 0.7, y: yy + 0.18, w: 0.32, h: 0.32 });
      s.addText(tr.t, { x: 1.15, y: yy + 0.08, w: 8.2, h: 0.28, fontSize: 12, bold: true, color: INK, fontFace: 'Calibri', margin: 0 });
      s.addText(tr.d, { x: 1.15, y: yy + 0.34, w: 8.2, h: 0.32, fontSize: 10, color: MUTE, fontFace: 'Calibri', margin: 0 });
      yy += 0.72;
    }

    addSlideFooter(s, 16);
  }

  // ------------------------------- SLIDE 17 — Closing ------------------------
  {
    const s = pres.addSlide();
    s.background = { color: CSHSE_GREEN_DK };
    s.addShape('rect', { x: 5.5, y: 0, w: 4.5, h: 5.625, fill: { color: CSHSE_GREEN }, line: { color: CSHSE_GREEN } });
    s.addShape('rect', { x: 0, y: 4.6, w: 10, h: 1.025, fill: { color: CSHSE_GREEN_LT, transparency: 60 }, line: { color: CSHSE_GREEN_LT, transparency: 60 } });

    // Real CSHSE logo on the dark side.
    s.addImage({ data: LOGO_DATA, x: 0.8, y: 0.6, w: 1.3, h: 1.3 });
    s.addText('You’re done.', { x: 0.5, y: 2.0, w: 4.7, h: 0.7, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Georgia', margin: 0 });
    s.addText('Open the Standards tab and watch your self-study fill in.', { x: 0.5, y: 2.75, w: 4.7, h: 0.4, fontSize: 14, color: CSHSE_GREEN_LT, fontFace: 'Georgia', italic: true, margin: 0 });

    s.addText([
      { text: 'Next runs get easier', options: { bold: true, color: 'FFFFFF', breakLine: true } },
      { text: 'Every correction you make becomes a labeled few-shot example for the matcher. Your institution’s third self-study should need fewer manual fixes than your first.', options: { color: 'FFFFFF' } }
    ], { x: 5.9, y: 1.5, w: 3.7, h: 2.5, fontSize: 13, fontFace: 'Calibri', margin: 0 });

    s.addText('Vault: CSHSE/Engineering/wizard-user-guide-2026-05-20.md', {
      x: 0.8, y: 4.85, w: 8.5, h: 0.3, fontSize: 11, color: 'FFFFFF', fontFace: 'Consolas', margin: 0
    });
  }

  await pres.writeFile({ fileName: '/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/CSHSE/Engineering/wizard-user-guide-2026-05-20.pptx' });
  console.log('wrote /Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/CSHSE/Engineering/wizard-user-guide-2026-05-20.pptx');
}

main().catch((e) => { console.error(e); process.exit(1); });

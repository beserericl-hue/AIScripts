// AI Import Wizard — User Guide & Test Plan deck
// Palette: Midnight Executive (navy + ice blue + white)
// Motif: numbered step circles, repeated across deck

const pptxgen = require('pptxgenjs');
const pres = new pptxgen();

pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = 'AI Import Wizard — User Guide & Test Plan';
pres.author = 'CSHSE Engineering';

// ---------- Palette ----------
const NAVY = '1E2761';
const NAVY_DK = '141A47';
const ICE = 'CADCFC';
const WHITE = 'FFFFFF';
const ACCENT = 'F96167'; // coral accent for warnings / highlights
const GREEN_OK = '2E8B57';
const GRAY_MUTED = '6B7280';

// ---------- Fonts ----------
const H_FONT = 'Georgia';
const B_FONT = 'Calibri';

// ---------- Logo ----------
const LOGO_PATH = '/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/docs/decks/cshse-logo.png';
function addLogo(slide) {
  // Top-right corner. Logo is square (1:1).
  slide.addImage({ path: LOGO_PATH, x: 12.55, y: 0.25, w: 0.55, h: 0.55 });
}

// ---------- Helpers ----------
function lightSlide(slide) {
  slide.background = { color: 'F7F8FB' };
  // thin vertical navy bar on left as motif
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: NAVY } });
  addLogo(slide);
}
function darkSlide(slide) {
  slide.background = { color: NAVY };
  addLogo(slide);
}
function pageFooter(slide, pageNum, totalPages) {
  slide.addText('AI Import Wizard — User Guide & Test Plan', {
    x: 0.5, y: 7.15, w: 8, h: 0.25,
    fontFace: B_FONT, fontSize: 9, color: GRAY_MUTED, italic: true
  });
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: 12.3, y: 7.15, w: 0.6, h: 0.25,
    fontFace: B_FONT, fontSize: 9, color: GRAY_MUTED, align: 'right'
  });
}
function numberedCircle(slide, x, y, n, color = NAVY, txtColor = WHITE, size = 0.6) {
  slide.addShape(pres.ShapeType.ellipse, {
    x, y, w: size, h: size, fill: { color }, line: { color, width: 0 }
  });
  slide.addText(String(n), {
    x, y, w: size, h: size,
    fontFace: H_FONT, fontSize: 18, bold: true, color: txtColor,
    align: 'center', valign: 'middle'
  });
}
function slideTitle(slide, txt) {
  slide.addText(txt, {
    x: 0.5, y: 0.35, w: 11.8, h: 0.7,
    fontFace: H_FONT, fontSize: 32, bold: true, color: NAVY
  });
}

const TOTAL = 14;

// =========================================================================
// 1. TITLE SLIDE
// =========================================================================
{
  const s = pres.addSlide();
  darkSlide(s);

  // accent vertical strip
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.45, h: 7.5, fill: { color: ICE } });

  s.addText('AI Import Wizard', {
    x: 1.0, y: 2.2, w: 11, h: 1.2,
    fontFace: H_FONT, fontSize: 56, bold: true, color: WHITE
  });
  s.addText('User Guide & Test Plan', {
    x: 1.0, y: 3.45, w: 11, h: 0.7,
    fontFace: H_FONT, fontSize: 30, color: ICE, italic: true
  });

  // 5 numbered circles preview as motif
  const labels = ['Upload', 'Parse', 'Match', 'Matrix', 'Review'];
  for (let i = 0; i < 5; i++) {
    const cx = 1.0 + i * 2.2;
    numberedCircle(s, cx, 5.0, i + 1, ICE, NAVY, 0.7);
    s.addText(labels[i], {
      x: cx - 0.5, y: 5.8, w: 1.7, h: 0.35,
      fontFace: B_FONT, fontSize: 14, color: WHITE, align: 'center'
    });
  }

  s.addText('CSHSE Self-Study Editor   •   Coordinator-facing import flow', {
    x: 1.0, y: 6.6, w: 11, h: 0.35,
    fontFace: B_FONT, fontSize: 13, color: ICE, italic: true
  });
}

// =========================================================================
// 2. WHAT IS IT
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  slideTitle(s, 'What the AI Import Wizard Does');

  // left column: explanation
  s.addText(
    'Coordinators arrive with a finished self-study report (a Word doc) ' +
    'that has to be split across dozens of standards, sub-specs, faculty rows, ' +
    'and matrix tables.',
    {
      x: 0.6, y: 1.3, w: 6.5, h: 1.4,
      fontFace: B_FONT, fontSize: 15, color: '1F2937'
    }
  );
  s.addText(
    'The wizard reads the document once, asks the AI to place each paragraph ' +
    'into the correct cell, then hands the coordinator a Review screen to ' +
    'confirm, edit, or move anything that landed wrong.',
    {
      x: 0.6, y: 2.8, w: 6.5, h: 1.4,
      fontFace: B_FONT, fontSize: 15, color: '1F2937'
    }
  );
  s.addText('Goal: turn a 4-hour copy-paste job into a 10-minute review.', {
    x: 0.6, y: 4.4, w: 6.5, h: 0.5,
    fontFace: B_FONT, fontSize: 16, italic: true, bold: true, color: NAVY
  });

  // right column: card stack
  const cards = [
    ['ONE',   'Upload your .docx — the wizard takes it from there.'],
    ['TWO',   'AI matches paragraphs to standards by meaning, not just keywords.'],
    ['THREE', 'You stay in control — edit, move, discard before applying.']
  ];
  cards.forEach(([tag, body], i) => {
    const y = 1.3 + i * 1.55;
    s.addShape(pres.ShapeType.roundRect, {
      x: 7.6, y, w: 5.3, h: 1.35,
      fill: { color: WHITE }, line: { color: ICE, width: 1.5 },
      rectRadius: 0.08
    });
    s.addText(tag, {
      x: 7.8, y: y + 0.1, w: 1.2, h: 0.35,
      fontFace: H_FONT, fontSize: 12, bold: true, color: NAVY,
      charSpacing: 2
    });
    s.addText(body, {
      x: 7.8, y: y + 0.45, w: 5.0, h: 0.85,
      fontFace: B_FONT, fontSize: 13, color: '374151'
    });
  });

  pageFooter(s, 2, TOTAL);
}

// =========================================================================
// 3. THE 5-STEP FLOW
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  slideTitle(s, 'The Five-Step Flow');

  const steps = [
    { n: 1, label: 'Upload',  desc: 'Pick a .docx and a degree level' },
    { n: 2, label: 'Parse',   desc: 'Document Reader extracts structure' },
    { n: 3, label: 'Match',   desc: 'AI places content into standards' },
    { n: 4, label: 'Matrix',  desc: 'Faculty rows reviewed one at a time' },
    { n: 5, label: 'Review',  desc: 'Edit, move, discard, then Apply' }
  ];

  const stepW = 2.4;
  // horizontal flow band — terminates at circle 1 center on left, circle 5 center on right
  // First circle center x = 0.7 + 0*2.4 + 0.5 + 0.35 = 1.55. Last = 0.7 + 4*2.4 + 0.5 + 0.35 = 11.15.
  s.addShape(pres.ShapeType.rect, {
    x: 1.55, y: 2.6, w: 11.15 - 1.55, h: 0.08, fill: { color: ICE }, line: { color: ICE }
  });

  steps.forEach((step, i) => {
    const cx = 0.7 + i * stepW;
    // circle on the line
    numberedCircle(s, cx + 0.5, 2.3, step.n, NAVY, WHITE, 0.7);

    // label
    s.addText(step.label, {
      x: cx - 0.1, y: 3.15, w: stepW, h: 0.4,
      fontFace: H_FONT, fontSize: 20, bold: true, color: NAVY, align: 'center'
    });
    // desc
    s.addText(step.desc, {
      x: cx - 0.1, y: 3.6, w: stepW, h: 0.9,
      fontFace: B_FONT, fontSize: 12, color: '374151', align: 'center'
    });
  });

  // bottom callouts
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.6, y: 5.3, w: 5.95, h: 1.45,
    fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.08
  });
  s.addText('Linear, but resumable', {
    x: 0.85, y: 5.4, w: 5.5, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: WHITE
  });
  s.addText(
    'A hard refresh or browser crash returns you to the same step. ' +
    'Edits are persisted as you go — nothing is committed to the self-study ' +
    'until you click Apply on Step 5.',
    {
      x: 0.85, y: 5.8, w: 5.5, h: 0.9,
      fontFace: B_FONT, fontSize: 12, color: ICE
    }
  );

  s.addShape(pres.ShapeType.roundRect, {
    x: 6.85, y: 5.3, w: 5.95, h: 1.45,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 }, rectRadius: 0.08
  });
  s.addText('Back-and-forth is fine', {
    x: 7.1, y: 5.4, w: 5.5, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  s.addText(
    'Move between steps to spot-check. The Review screen always reflects ' +
    'the latest AI placement plus any edits you have made.',
    {
      x: 7.1, y: 5.8, w: 5.5, h: 0.9,
      fontFace: B_FONT, fontSize: 12, color: '374151'
    }
  );

  pageFooter(s, 3, TOTAL);
}

// =========================================================================
// 4. STEP 1: UPLOAD
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  numberedCircle(s, 0.6, 0.35, 1, NAVY, WHITE, 0.7);
  s.addText('Upload your document', {
    x: 1.6, y: 0.4, w: 10.7, h: 0.6,
    fontFace: H_FONT, fontSize: 28, bold: true, color: NAVY
  });

  // left: what you do
  s.addText('What you do', {
    x: 0.6, y: 1.4, w: 6, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  const doSteps = [
    'Pick a self-study .docx (Associate / Baccalaureate / Master\'s).',
    'Confirm the degree level — this picks the standards set.',
    'Click Start. The Parse step begins automatically.'
  ];
  doSteps.forEach((t, i) => {
    s.addText(`${i + 1}.  ${t}`, {
      x: 0.6, y: 1.85 + i * 0.55, w: 6.2, h: 0.5,
      fontFace: B_FONT, fontSize: 13, color: '1F2937'
    });
  });

  // right: test plan
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.2, y: 1.4, w: 5.7, h: 5.4,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 }, rectRadius: 0.08
  });
  s.addText('Test plan — Step 1', {
    x: 7.4, y: 1.5, w: 5.3, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  const tests = [
    'Upload a valid .docx — proceeds to Parse.',
    'Upload a .pdf — surfaces a clear error, no crash.',
    'Upload a 30+ MB file — progress indicator appears.',
    'Cancel mid-upload — returns to a clean upload screen.',
    'Pick wrong degree, fix it, restart — no stale state.'
  ];
  tests.forEach((t, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: 7.45, y: 2.07 + i * 0.85, w: 0.16, h: 0.16,
      fill: { color: ACCENT }, line: { color: ACCENT }
    });
    s.addText(t, {
      x: 7.75, y: 2.0 + i * 0.85, w: 5.0, h: 0.7,
      fontFace: B_FONT, fontSize: 12, color: '1F2937'
    });
  });

  // bottom callout
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.6, y: 5.4, w: 6.4, h: 1.35,
    fill: { color: NAVY_DK }, line: { color: NAVY_DK }, rectRadius: 0.08
  });
  s.addText('Heads-up', {
    x: 0.85, y: 5.5, w: 5.5, h: 0.35,
    fontFace: H_FONT, fontSize: 13, bold: true, color: ACCENT, charSpacing: 2
  });
  s.addText(
    'A reimport is required when the underlying parser or matcher changes. ' +
    'Client-only UI fixes do NOT require a reimport — your existing job ' +
    'continues from where you left it.',
    {
      x: 0.85, y: 5.85, w: 6.0, h: 0.85,
      fontFace: B_FONT, fontSize: 11, color: ICE, italic: true
    }
  );

  pageFooter(s, 4, TOTAL);
}

// =========================================================================
// 5. STEP 2: PARSE
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  numberedCircle(s, 0.6, 0.35, 2, NAVY, WHITE, 0.7);
  s.addText('Parse — the Document Reader', {
    x: 1.6, y: 0.4, w: 10.7, h: 0.6,
    fontFace: H_FONT, fontSize: 28, bold: true, color: NAVY
  });

  // What you see
  s.addText('Stages you will see (in order):', {
    x: 0.6, y: 1.4, w: 7, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });

  const stages = [
    ['Document Reader', 'Converts .docx to structured HTML'],
    ['Reading structure', 'Walks headings, tables, paragraphs'],
    ['Building chunks',  'Groups content into matchable units'],
    ['Embedding',        'Generates vector embeddings'],
    ['Indexing',         'Loads chunks into Qdrant for AI matching']
  ];
  stages.forEach(([name, desc], i) => {
    const y = 1.9 + i * 0.75;
    s.addShape(pres.ShapeType.ellipse, {
      x: 0.6, y, w: 0.4, h: 0.4,
      fill: { color: GREEN_OK }, line: { color: GREEN_OK }
    });
    s.addText('✓', {
      x: 0.6, y, w: 0.4, h: 0.4,
      fontFace: B_FONT, fontSize: 14, bold: true, color: WHITE,
      align: 'center', valign: 'middle'
    });
    s.addText(name, {
      x: 1.1, y: y - 0.02, w: 2.3, h: 0.4,
      fontFace: H_FONT, fontSize: 14, bold: true, color: NAVY
    });
    s.addText(desc, {
      x: 3.5, y: y - 0.02, w: 3.7, h: 0.4,
      fontFace: B_FONT, fontSize: 12, color: '374151'
    });
  });

  // right: test plan
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.5, y: 1.4, w: 5.4, h: 5.4,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 }, rectRadius: 0.08
  });
  s.addText('Test plan — Step 2', {
    x: 7.7, y: 1.5, w: 5.0, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  const tests = [
    'Stages display friendly names (NOT raw "mammoth", "deep_walker").',
    'Each stage shows a check mark when complete.',
    'Total parse time stays under ~90s for a typical self-study.',
    'A matcher-disconnect mid-parse auto-retries silently.',
    'Refreshing during Parse resumes at the same stage.'
  ];
  tests.forEach((t, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: 7.7, y: 2.12 + i * 0.85, w: 0.16, h: 0.16,
      fill: { color: ACCENT }, line: { color: ACCENT }
    });
    s.addText(t, {
      x: 8.0, y: 2.05 + i * 0.85, w: 4.8, h: 0.75,
      fontFace: B_FONT, fontSize: 11, color: '1F2937'
    });
  });

  pageFooter(s, 5, TOTAL);
}

// =========================================================================
// 6. STEP 3: MATCH
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  numberedCircle(s, 0.6, 0.35, 3, NAVY, WHITE, 0.7);
  s.addText('Match — AI places content', {
    x: 1.6, y: 0.4, w: 10.7, h: 0.6,
    fontFace: H_FONT, fontSize: 28, bold: true, color: NAVY
  });

  // left: how it works
  s.addText('How the matcher decides', {
    x: 0.6, y: 1.4, w: 6, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  s.addText(
    'For every paragraph, the matcher pulls the most semantically similar ' +
    'standards from Qdrant, then asks Claude Haiku 4.5 to pick the best fit ' +
    'and report a confidence score.',
    {
      x: 0.6, y: 1.85, w: 6.5, h: 1.2,
      fontFace: B_FONT, fontSize: 13, color: '1F2937'
    }
  );

  // confidence bucket cards
  const buckets = [
    { tag: 'HIGH',   color: GREEN_OK,  body: 'Auto-placed under the matched spec' },
    { tag: 'MEDIUM', color: 'D97706',  body: 'Auto-placed but flagged for your eyes' },
    { tag: 'LOW',    color: ACCENT,    body: 'Goes to Unplaced with neighbor context' }
  ];
  buckets.forEach((b, i) => {
    const y = 3.3 + i * 1.05;
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.6, y, w: 6.7, h: 0.92,
      fill: { color: WHITE }, line: { color: ICE, width: 1.5 }, rectRadius: 0.08
    });
    s.addShape(pres.ShapeType.rect, {
      x: 0.6, y, w: 0.18, h: 0.92, fill: { color: b.color }, line: { color: b.color }
    });
    s.addText(b.tag, {
      x: 0.95, y: y + 0.08, w: 1.3, h: 0.4,
      fontFace: H_FONT, fontSize: 14, bold: true, color: b.color, charSpacing: 2
    });
    s.addText(b.body, {
      x: 0.95, y: y + 0.42, w: 6.0, h: 0.5,
      fontFace: B_FONT, fontSize: 12, color: '1F2937'
    });
  });

  // right: test plan
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.6, y: 1.4, w: 5.3, h: 5.4,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 }, rectRadius: 0.08
  });
  s.addText('Test plan — Step 3', {
    x: 7.8, y: 1.5, w: 5.0, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  const tests = [
    'Every paragraph appears in exactly one bucket.',
    'Confidence colors render correctly.',
    'No paragraph is silently dropped.',
    'Matcher disconnect mid-run shows a retry banner.',
    'Reimport after CR-031 produces monotonic byte offsets.',
    'Show-in-source highlights the right span, not a matrix row.'
  ];
  tests.forEach((t, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: 7.8, y: 2.12 + i * 0.75, w: 0.16, h: 0.16,
      fill: { color: ACCENT }, line: { color: ACCENT }
    });
    s.addText(t, {
      x: 8.1, y: 2.05 + i * 0.75, w: 4.7, h: 0.7,
      fontFace: B_FONT, fontSize: 11, color: '1F2937'
    });
  });

  pageFooter(s, 6, TOTAL);
}

// =========================================================================
// 7. STEP 4: MATRIX
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  numberedCircle(s, 0.6, 0.35, 4, NAVY, WHITE, 0.7);
  s.addText('Matrix — one faculty row at a time', {
    x: 1.6, y: 0.4, w: 10.7, h: 0.6,
    fontFace: H_FONT, fontSize: 28, bold: true, color: NAVY
  });

  // left: what changed
  s.addText('What you do', {
    x: 0.6, y: 1.4, w: 6, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  const doSteps = [
    ['Review each faculty row in turn', 'No more giant column-dropdown grid.'],
    ['Confirm the inferred sub-spec',   'Haiku suggests "Spec 12.b", you accept or change.'],
    ['Keep, retag, or remove the row',  'Removed rows can be restored from the Review screen.']
  ];
  doSteps.forEach(([label, desc], i) => {
    const y = 1.9 + i * 1.05;
    s.addShape(pres.ShapeType.ellipse, {
      x: 0.6, y, w: 0.4, h: 0.4,
      fill: { color: NAVY }, line: { color: NAVY }
    });
    s.addText(String(i + 1), {
      x: 0.6, y, w: 0.4, h: 0.4,
      fontFace: H_FONT, fontSize: 14, bold: true, color: WHITE,
      align: 'center', valign: 'middle'
    });
    s.addText(label, {
      x: 1.1, y: y - 0.02, w: 6.0, h: 0.4,
      fontFace: H_FONT, fontSize: 14, bold: true, color: NAVY
    });
    s.addText(desc, {
      x: 1.1, y: y + 0.38, w: 6.0, h: 0.5,
      fontFace: B_FONT, fontSize: 12, color: '374151', italic: true
    });
  });

  // stat callout
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.6, y: 5.4, w: 6.5, h: 1.35,
    fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.08
  });
  s.addText('80%', {
    x: 0.85, y: 5.45, w: 2.2, h: 1.0,
    fontFace: H_FONT, fontSize: 42, bold: true, color: ICE,
    valign: 'middle'
  });
  s.addText('of matrix rows arrive with an auto-inferred sub-spec.', {
    x: 3.1, y: 5.55, w: 3.9, h: 1.05,
    fontFace: B_FONT, fontSize: 13, color: WHITE, valign: 'middle'
  });

  // right: test plan
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.4, y: 1.4, w: 5.5, h: 5.4,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 }, rectRadius: 0.08
  });
  s.addText('Test plan — Step 4', {
    x: 7.6, y: 1.5, w: 5.2, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  const tests = [
    'Inferred sub-spec shown on each row (e.g. "Spec 12.b").',
    '"Spec ?.?" only appears when AI truly cannot decide.',
    'Keep this row → row appears on the Review screen.',
    'Remove this row → row vanishes; Restore brings it back.',
    'Retag to a different sub-spec → updates Review immediately.',
    'Hard refresh mid-matrix returns to the same row position.'
  ];
  tests.forEach((t, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: 7.6, y: 2.12 + i * 0.75, w: 0.16, h: 0.16,
      fill: { color: ACCENT }, line: { color: ACCENT }
    });
    s.addText(t, {
      x: 7.9, y: 2.05 + i * 0.75, w: 4.9, h: 0.7,
      fontFace: B_FONT, fontSize: 11, color: '1F2937'
    });
  });

  pageFooter(s, 7, TOTAL);
}

// =========================================================================
// 8. STEP 5: REVIEW
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  numberedCircle(s, 0.6, 0.35, 5, NAVY, WHITE, 0.7);
  s.addText('Review — confirm, edit, apply', {
    x: 1.6, y: 0.4, w: 10.7, h: 0.6,
    fontFace: H_FONT, fontSize: 28, bold: true, color: NAVY
  });

  // left: anatomy of a card
  s.addText('Anatomy of an item card', {
    x: 0.6, y: 1.4, w: 6, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });

  // fake card
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.6, y: 1.95, w: 6.5, h: 2.8,
    fill: { color: WHITE }, line: { color: ICE, width: 1.5 }, rectRadius: 0.08
  });
  // confidence stripe
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.95, w: 0.15, h: 2.8, fill: { color: GREEN_OK }, line: { color: GREEN_OK }
  });
  // card header row
  s.addText('Faculty Members and their roles', {
    x: 0.95, y: 2.05, w: 4.0, h: 0.4,
    fontFace: H_FONT, fontSize: 14, bold: true, color: NAVY
  });
  // buttons row (mock)
  s.addShape(pres.ShapeType.roundRect, {
    x: 5.15, y: 2.05, w: 0.7, h: 0.4, fill: { color: ICE }, line: { color: ICE }, rectRadius: 0.05
  });
  s.addText('Edit', { x: 5.15, y: 2.05, w: 0.7, h: 0.4, fontFace: B_FONT, fontSize: 10, color: NAVY, align: 'center', valign: 'middle', bold: true });
  s.addShape(pres.ShapeType.roundRect, {
    x: 5.95, y: 2.05, w: 0.95, h: 0.4, fill: { color: ACCENT }, line: { color: ACCENT }, rectRadius: 0.05
  });
  s.addText('Discard', { x: 5.95, y: 2.05, w: 0.95, h: 0.4, fontFace: B_FONT, fontSize: 10, color: WHITE, align: 'center', valign: 'middle', bold: true });

  s.addText(
    'The program currently employs five core faculty members covering ' +
    'introductory, clinical-skills, and field-placement coursework...',
    {
      x: 0.95, y: 2.5, w: 6.0, h: 1.6,
      fontFace: B_FONT, fontSize: 11, color: '1F2937'
    }
  );
  s.addText('Spec 1.a   •   confidence: high', {
    x: 0.95, y: 4.25, w: 6.0, h: 0.35,
    fontFace: B_FONT, fontSize: 10, color: GRAY_MUTED, italic: true
  });

  // callouts
  s.addText('Three actions live on every card:', {
    x: 0.6, y: 4.95, w: 6.5, h: 0.4,
    fontFace: H_FONT, fontSize: 14, bold: true, color: NAVY
  });
  const acts = [
    ['Edit',    'Plain text editor — delete sentences, add a clarifying line.'],
    ['Discard', 'One click + confirm. Item leaves the spec entirely.'],
    ['Move',    'Drop into a different spec from the right pane.']
  ];
  acts.forEach(([k, v], i) => {
    s.addText(`${k}:`, {
      x: 0.6, y: 5.4 + i * 0.4, w: 1.25, h: 0.35,
      fontFace: H_FONT, fontSize: 12, bold: true, color: ACCENT
    });
    s.addText(v, {
      x: 1.85, y: 5.4 + i * 0.4, w: 5.15, h: 0.35,
      fontFace: B_FONT, fontSize: 11, color: '374151'
    });
  });

  // right: test plan
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.4, y: 1.4, w: 5.5, h: 5.4,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 }, rectRadius: 0.08
  });
  s.addText('Test plan — Step 5', {
    x: 7.6, y: 1.5, w: 5.2, h: 0.4,
    fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
  });
  const tests = [
    'Every spec card lists at least one item or is clearly empty.',
    'Edit pencil opens a textarea, Save persists, Revert restores.',
    'Discard button is visible on every text-bearing card.',
    '+ Add from source preserves table structure when copying rows.',
    'Unplaced bucket shows neighbor context for low-confidence items.',
    'Hard refresh → all edits, moves, and discards persist.',
    'Apply → content lands in the self-study editor untouched.'
  ];
  tests.forEach((t, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: 7.6, y: 2.12 + i * 0.68, w: 0.16, h: 0.16,
      fill: { color: ACCENT }, line: { color: ACCENT }
    });
    s.addText(t, {
      x: 7.9, y: 2.05 + i * 0.68, w: 4.9, h: 0.65,
      fontFace: B_FONT, fontSize: 11, color: '1F2937'
    });
  });

  pageFooter(s, 8, TOTAL);
}

// =========================================================================
// 9. THE EDIT PENCIL
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  slideTitle(s, 'The Edit Pencil (CR-032)');

  // intro line
  s.addText(
    'Coordinators told us the AI sometimes pulls in a paragraph too much. ' +
    'Now you can fix it inline — no need to detour into the self-study editor.',
    {
      x: 0.6, y: 1.2, w: 12.3, h: 0.7,
      fontFace: B_FONT, fontSize: 14, italic: true, color: '374151'
    }
  );

  // three-column workflow
  const cols = [
    { n: 1, title: 'Click the pencil', body: 'A textarea replaces the rendered card. The original text is loaded for you.' },
    { n: 2, title: 'Trim, add, rewrite', body: 'Plain text only — formatting belongs in the self-study editor downstream.' },
    { n: 3, title: 'Save or Revert',    body: 'Save persists across refresh. Revert restores the original AI output.' }
  ];
  cols.forEach((c, i) => {
    const x = 0.6 + i * 4.25;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.2, w: 4.0, h: 3.4,
      fill: { color: WHITE }, line: { color: NAVY, width: 1.5 }, rectRadius: 0.1
    });
    numberedCircle(s, x + 0.3, 2.4, c.n, NAVY, WHITE, 0.55);
    s.addText(c.title, {
      x: x + 0.3, y: 3.05, w: 3.4, h: 0.4,
      fontFace: H_FONT, fontSize: 16, bold: true, color: NAVY
    });
    s.addText(c.body, {
      x: x + 0.3, y: 3.55, w: 3.4, h: 1.8,
      fontFace: B_FONT, fontSize: 12, color: '374151'
    });
  });

  // bottom advisory
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.6, y: 5.9, w: 12.3, h: 0.95,
    fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.08
  });
  s.addText(
    'Edits survive a hard refresh — they are persisted via the import store. ' +
    'They are NOT pushed to the self-study until you click Apply on Step 5.',
    {
      x: 0.85, y: 6.05, w: 11.8, h: 0.7,
      fontFace: B_FONT, fontSize: 13, color: ICE, italic: true
    }
  );

  pageFooter(s, 9, TOTAL);
}

// =========================================================================
// 10. + ADD FROM SOURCE
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  slideTitle(s, '+ Add from Source — pulling text from the doc');

  // 4-step flow horizontally
  const steps = [
    { n: 1, t: 'Click + Add from source', d: 'On any spec without enough content.' },
    { n: 2, t: 'Highlight in the doc',     d: 'Modal shows your uploaded .docx, pre-rendered.' },
    { n: 3, t: 'Confirm selection',         d: 'Tables come over as tables — structure preserved.' },
    { n: 4, t: 'Lands as a new card',       d: 'Same Edit / Discard controls apply.' }
  ];
  steps.forEach((step, i) => {
    const x = 0.5 + i * 3.2;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.4, w: 3.0, h: 2.7,
      fill: { color: WHITE }, line: { color: ICE, width: 1.5 }, rectRadius: 0.1
    });
    numberedCircle(s, x + 1.2, 1.55, step.n, ACCENT, WHITE, 0.6);
    s.addText(step.t, {
      x: x + 0.1, y: 2.25, w: 2.8, h: 0.7,
      fontFace: H_FONT, fontSize: 13, bold: true, color: NAVY, align: 'center'
    });
    s.addText(step.d, {
      x: x + 0.15, y: 3.0, w: 2.7, h: 1.0,
      fontFace: B_FONT, fontSize: 11, color: '374151', align: 'center'
    });
  });

  // Recovery sub-section
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 4.5, w: 12.5, h: 2.25,
    fill: { color: NAVY_DK }, line: { color: NAVY_DK }, rectRadius: 0.08
  });
  s.addText('What if the copied content looks wrong?', {
    x: 0.85, y: 4.6, w: 12, h: 0.45,
    fontFace: H_FONT, fontSize: 17, bold: true, color: ICE
  });
  s.addText('A bad paste is never permanent. You have three recovery paths:', {
    x: 0.85, y: 5.05, w: 12, h: 0.4,
    fontFace: B_FONT, fontSize: 12, color: ICE, italic: true
  });
  const fixes = [
    ['Click Edit',    'Open the textarea and clean up the markup directly.'],
    ['Click Discard', 'Remove the entire card and start fresh with + Add from source.'],
    ['Re-add',        'Selecting a wider range usually pulls in the wrapping <table> automatically.']
  ];
  fixes.forEach(([k, v], i) => {
    const x = 0.85 + i * 4.05;
    s.addText(k, {
      x, y: 5.55, w: 3.8, h: 0.35,
      fontFace: H_FONT, fontSize: 13, bold: true, color: ACCENT
    });
    s.addText(v, {
      x, y: 5.9, w: 3.8, h: 0.8,
      fontFace: B_FONT, fontSize: 11, color: WHITE
    });
  });

  pageFooter(s, 10, TOTAL);
}

// =========================================================================
// 11. RECOVERY PATTERNS
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  slideTitle(s, 'Recovery — when something goes sideways');

  const cases = [
    {
      title: 'Matcher disconnected mid-run',
      body: 'A red banner appears with an automatic retry. No manual action needed unless retries exhaust — then click Restart Matching.'
    },
    {
      title: 'Browser crash / hard refresh',
      body: 'Your wizard state is persisted. Re-open the import and you return to the same step with edits intact.'
    },
    {
      title: 'Wrong content in a card',
      body: 'Click Edit to fix it inline, or Discard to remove it. Both survive refresh until you click Apply.'
    },
    {
      title: 'Matrix row removed by mistake',
      body: 'Restore is on the same row card you used to remove it — Removed rows section at the bottom of the matrix step.'
    },
    {
      title: 'Pushed too far and need to restart',
      body: 'Step 1 → "Start over" wipes the wizard cleanly. Nothing in the self-study is touched until Apply.'
    }
  ];

  cases.forEach((c, i) => {
    const y = 1.35 + i * 1.07;
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.6, y, w: 12.3, h: 0.95,
      fill: { color: WHITE }, line: { color: ICE, width: 1.5 }, rectRadius: 0.06
    });
    s.addShape(pres.ShapeType.rect, {
      x: 0.6, y, w: 0.15, h: 0.95, fill: { color: ACCENT }, line: { color: ACCENT }
    });
    s.addText(c.title, {
      x: 0.95, y: y + 0.08, w: 11.9, h: 0.4,
      fontFace: H_FONT, fontSize: 14, bold: true, color: NAVY
    });
    s.addText(c.body, {
      x: 0.95, y: y + 0.46, w: 11.9, h: 0.45,
      fontFace: B_FONT, fontSize: 11, color: '374151'
    });
  });

  pageFooter(s, 11, TOTAL);
}

// =========================================================================
// 12. SMOKE TEST CHECKLIST
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  slideTitle(s, 'Smoke Test Checklist');

  s.addText('Run end-to-end after every parser, matcher, or store change:', {
    x: 0.6, y: 1.2, w: 12.3, h: 0.4,
    fontFace: B_FONT, fontSize: 13, italic: true, color: '374151'
  });

  // two-column checklist
  const left = [
    'Upload Associate, Baccalaureate, and Master\'s docs in turn.',
    'Confirm friendly stage names ("Document Reader", not "mammoth").',
    'Verify all five Parse stages tick green.',
    'Match step shows confidence bands and bucket distribution.',
    'No paragraph silently dropped between Parse and Review.',
    'Matrix step: confirm at least one auto-inferred sub-spec.',
    'Matrix step: keep + remove + restore a row, confirm Review reflects.'
  ];
  const right = [
    'Review: edit a card, save, hard-refresh, edit persists.',
    'Review: discard a card, refresh, item is still gone.',
    'Review: + Add from source on a tabular section preserves <table>.',
    'Review: + Add from source on a paragraph section works as before.',
    'Unplaced bucket shows neighbor context for low-confidence items.',
    'Apply → self-study editor opens with imported content correct.',
    'Re-enter wizard after Apply: starts from a clean slate.'
  ];

  function col(items, x) {
    items.forEach((t, i) => {
      const y = 1.8 + i * 0.7;
      s.addShape(pres.ShapeType.rect, {
        x, y: y + 0.05, w: 0.3, h: 0.3,
        fill: { color: WHITE }, line: { color: NAVY, width: 1.2 }
      });
      s.addText(t, {
        x: x + 0.45, y, w: 5.7, h: 0.65,
        fontFace: B_FONT, fontSize: 11, color: '1F2937'
      });
    });
  }
  col(left, 0.6);
  col(right, 6.85);

  pageFooter(s, 12, TOTAL);
}

// =========================================================================
// 13. KNOWN ISSUES & TIPS
// =========================================================================
{
  const s = pres.addSlide();
  lightSlide(s);
  slideTitle(s, 'Tips & Known Issues');

  const items = [
    {
      tag: 'TIP',
      color: GREEN_OK,
      title: 'Skim Unplaced first',
      body: 'It is faster to find a home for orphaned items first — the rest of the review goes faster once Unplaced is empty.'
    },
    {
      tag: 'TIP',
      color: GREEN_OK,
      title: 'Edit before you Apply',
      body: 'Edits in the wizard are easier than edits in the self-study editor. Trim down long pastes here.'
    },
    {
      tag: 'KNOWN',
      color: ACCENT,
      title: 'Selection capture in the source modal',
      body: 'Selecting individual rows from a long matrix table works — the wrapper <table> is auto-added on capture and on render.'
    },
    {
      tag: 'KNOWN',
      color: ACCENT,
      title: 'Reimport required after parser changes',
      body: 'If engineering pushes a deep_walker or matrix-inference change, restart the import from Step 1.'
    },
    {
      tag: 'NOTE',
      color: NAVY,
      title: 'Nothing commits until Apply',
      body: 'You can step back, edit, even start over without touching the published self-study.'
    }
  ];

  items.forEach((it, i) => {
    const y = 1.35 + i * 1.05;
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.6, y, w: 12.3, h: 0.92,
      fill: { color: WHITE }, line: { color: ICE, width: 1.5 }, rectRadius: 0.06
    });
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.75, y: y + 0.18, w: 1.05, h: 0.55,
      fill: { color: it.color }, line: { color: it.color }, rectRadius: 0.04
    });
    s.addText(it.tag, {
      x: 0.75, y: y + 0.18, w: 1.05, h: 0.55,
      fontFace: H_FONT, fontSize: 11, bold: true, color: WHITE,
      align: 'center', valign: 'middle', charSpacing: 2
    });
    s.addText(it.title, {
      x: 2.0, y: y + 0.08, w: 10.8, h: 0.35,
      fontFace: H_FONT, fontSize: 13, bold: true, color: NAVY
    });
    s.addText(it.body, {
      x: 2.0, y: y + 0.42, w: 10.8, h: 0.5,
      fontFace: B_FONT, fontSize: 11, color: '374151'
    });
  });

  pageFooter(s, 13, TOTAL);
}

// =========================================================================
// 14. CLOSING
// =========================================================================
{
  const s = pres.addSlide();
  darkSlide(s);
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.45, h: 7.5, fill: { color: ICE } });

  s.addText('Ready to import?', {
    x: 1.0, y: 2.0, w: 11, h: 1.0,
    fontFace: H_FONT, fontSize: 48, bold: true, color: WHITE
  });
  s.addText(
    'Five steps. Editable on every card. Reversible until you click Apply.',
    {
      x: 1.0, y: 3.1, w: 11, h: 0.6,
      fontFace: H_FONT, fontSize: 22, italic: true, color: ICE
    }
  );

  // CTA row
  const ctas = [
    { k: 'Start',  v: 'Self Study Editor → AI Import' },
    { k: 'Issue?', v: 'eric@agileadtesting.com' },
    { k: 'Docs',   v: 'CSHSE/docs/IMPORT_PROCESS_REFERENCE.md' }
  ];
  ctas.forEach((c, i) => {
    const x = 1.0 + i * 4.0;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 4.5, w: 3.7, h: 1.4,
      fill: { color: NAVY_DK }, line: { color: ICE, width: 1 }, rectRadius: 0.08
    });
    s.addText(c.k.toUpperCase(), {
      x: x + 0.2, y: 4.65, w: 3.4, h: 0.4,
      fontFace: H_FONT, fontSize: 14, bold: true, color: ACCENT, charSpacing: 2
    });
    s.addText(c.v, {
      x: x + 0.2, y: 5.05, w: 3.4, h: 0.8,
      fontFace: B_FONT, fontSize: 12, color: WHITE
    });
  });

  s.addText('CSHSE Self-Study Editor — AI Import Wizard', {
    x: 1.0, y: 6.7, w: 11, h: 0.3,
    fontFace: B_FONT, fontSize: 11, color: ICE, italic: true
  });
}

// ---------- Save ----------
const outPath = '/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/docs/decks/AI_Import_Wizard_Guide.pptx';
pres.writeFile({ fileName: outPath }).then(fn => {
  console.log('WROTE:', fn);
});

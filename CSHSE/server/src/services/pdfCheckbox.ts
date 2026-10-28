/**
 * Vector checkboxes for pdfkit reports.
 *
 * pdfkit's built-in Helvetica only carries WinAnsi glyphs, so '☐' / '☒' render
 * as the same unreadable glyph — a lead reader's "Accreditation with no
 * conditions" choice was indistinguishable from the unchecked options (Lauri,
 * Oct 2026). Draw the box (and its X) as vector shapes instead, and bold the
 * label of a checked option so the choice reads at a glance.
 */
type Doc = any;

/** Draw one box at (x, y); size in points. */
export function drawBox(doc: Doc, x: number, y: number, checked: boolean, size = 9): void {
  doc.save();
  doc.lineWidth(0.8).strokeColor('#111827').rect(x, y, size, size).stroke();
  if (checked) {
    const p = 1.8;
    doc.lineWidth(1.4)
      .moveTo(x + p, y + p).lineTo(x + size - p, y + size - p)
      .moveTo(x + size - p, y + p).lineTo(x + p, y + size - p)
      .stroke();
  }
  doc.restore();
}

/** A checkbox followed by its label, as one flowing line. */
export function checkboxLine(
  doc: Doc, checked: boolean, label: string,
  opts: { fontSize?: number; color?: string; indent?: number } = {},
): void {
  const fontSize = opts.fontSize ?? 10;
  const size = Math.round(fontSize * 0.9);
  const x = doc.page.margins.left + (opts.indent ?? 0);
  const y = doc.y;
  drawBox(doc, x, y + 1, checked, size);
  doc.fontSize(fontSize).fillColor(opts.color ?? '#111827')
    .font(checked ? 'Helvetica-Bold' : 'Helvetica')
    .text(label, x + size + 5, y, { width: doc.page.width - doc.page.margins.right - (x + size + 5) });
  doc.font('Helvetica');
  doc.x = doc.page.margins.left;
}

/** "☐ Compliant   ☐ Non-Compliant" pair on one line. */
export function compliancePair(
  doc: Doc, mark: 'compliant' | 'noncompliant' | null | '', opts: { fontSize?: number; indent?: number } = {},
): void {
  const fontSize = opts.fontSize ?? 10;
  const size = Math.round(fontSize * 0.9);
  const x0 = doc.page.margins.left + (opts.indent ?? 0);
  const y = doc.y;
  const items: Array<[boolean, string, string]> = [
    [mark === 'compliant', 'Compliant', '#15803d'],
    [mark === 'noncompliant', 'Non-Compliant', '#b91c1c'],
  ];
  let x = x0;
  for (const [on, label, color] of items) {
    drawBox(doc, x, y + 1, on, size);
    doc.fontSize(fontSize).font(on ? 'Helvetica-Bold' : 'Helvetica').fillColor(on ? color : '#6b7280');
    doc.text(label, x + size + 4, y, { lineBreak: false });
    x += size + 4 + doc.widthOfString(label) + 18;
  }
  doc.font('Helvetica');
  doc.x = doc.page.margins.left;
  doc.y = y + fontSize * 1.35;
}

// WinAnsi (Windows-1252) is all the built-in PDF fonts can encode. Text pasted
// from Word (Symbol-font bullets U+F0B7, tabs, private-use glyphs, ☐/✓ …) came
// out as garbage — Lauri's Lead Reader Report PDF read "•"–æ6ÇVFRPvidence…".
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
// Code point -> WinAnsi-safe replacement.
const SUBSTITUTE = new Map<string, string>([
  [0xF0B7, '•'], [0xF0A7, '•'], [0xF076, '•'], [0xF0D8, '•'], [0xF0FC, 'v'], [0x25AA, '•'],
  [0x25CF, '•'], [0x25E6, '•'], [0x2023, '•'], [0x2043, '-'], [0x2212, '-'], [0x2010, '-'],
  [0x2011, '-'], [0x00AD, ''], [0x200B, ''], [0x200C, ''], [0x200D, ''], [0xFEFF, ''],
  [0x2028, '\n'], [0x2029, '\n'], [0x0009, '    '], [0x2610, '[ ]'], [0x2612, '[X]'], [0x2611, '[X]'],
  [0x2713, 'v'], [0x2714, 'v'], [0x2192, '->'], [0x2190, '<-'], [0x2265, '>='], [0x2264, '<='],
].map(([cp, v]) => [String.fromCodePoint(cp as number), v as string]));
export function pdfSafe(s: string): string {
  let out = '';
  for (const ch of String(s).normalize('NFC')) {
    const sub = SUBSTITUTE.get(ch);
    if (sub !== undefined) { out += sub; continue; }
    const c = ch.codePointAt(0)!;
    if (ch === '\n' || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.has(ch)) out += ch;
    else out += '?';
  }
  return out;
}

/** Route every doc.text() string through pdfSafe. */
export function useSafeText<T>(doc: T): T {
  const d = doc as any;
  const orig = d.text.bind(d);
  d.text = (t: any, ...rest: any[]) => orig(typeof t === 'string' ? pdfSafe(t) : t, ...rest);
  const w = d.widthOfString.bind(d);
  d.widthOfString = (t: any, ...rest: any[]) => w(typeof t === 'string' ? pdfSafe(t) : t, ...rest);
  return doc;
}

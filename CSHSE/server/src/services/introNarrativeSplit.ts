/**
 * Split a program's Introduction narrative (Submission.documentIntroduction —
 * a flat HTML sequence of <p> blocks) into per-reader-form-row chunks, so the
 * Reader Report can show each Introduction section under its matching numbered
 * row (a–r) instead of dumping the whole blob on row 'a'.
 *
 * WHY match on TEXT, not the program's numbers: the self-study's own numbering
 * drifts from the official form (e.g. Anne Arundel labels "course requirements"
 * as section 6 and "multiple sites" as section 4). The reliable signal is the
 * PROMPT the program echoed from the official form — it closely matches each
 * INTRO_RUBRIC row's `criteria`. So we cut the narrative at its bare numbered
 * markers ("<p>1.</p>", "<p>a.</p>", "<p>B.</p>") and assign each section to the
 * rubric row whose criteria its prompt best matches (distinctive-token overlap).
 *
 * Fidelity: every byte of the narrative lands in exactly one section; nothing is
 * dropped. Any section that matches no row (and the preamble before the first
 * marker) is appended to row 'a' so the reader still sees it. If no markers are
 * found at all (an older/odd format), the whole narrative falls back to row 'a'
 * — exactly the previous behavior.
 */
import { INTRO_RUBRIC } from '../data/introRubric';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'which', 'is', 'are', 'being', 'and', 'to', 'in',
  'on', 'at', 'as', 'by', 'or', 'that', 'this', 'with', 'how', 'what', 'any', 'all',
  'each', 'its', 'their', 'they', 'be', 'if', 'may', 'must', 'such', 'other', 'e', 'g',
  'eg', 'etc', 'from', 'not', 'applicable', 'treat', 'compliant', 'initial',
  'accreditation', 'program', 'programs', 'describe', 'include', 'provide', 'document',
  'documentation', 'furnish', 'demonstrate', 'identify', 'specify', 'information',
  'students', 'student', 'self', 'study', 'offered', 'offer',
]);

function strip(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of strip(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

// Distinctive token signature per rubric row (from title + criteria).
const ROW_SIG = INTRO_RUBRIC.map((row) => ({
  specCode: row.specCode,
  isGate: row.gate === 'yesno',
  sig: tokens(`${row.title} ${row.criteria}`),
}));

function bestRowFor(promptText: string): string | null {
  const pt = tokens(promptText);
  if (pt.size === 0) return null;
  let best: { code: string; score: number } | null = null;
  for (const r of ROW_SIG) {
    if (r.isGate) continue; // the Certification gate takes no narrative
    let overlap = 0;
    for (const t of r.sig) if (pt.has(t)) overlap += 1;
    if (overlap >= 2 && (!best || overlap > best.score)) best = { code: r.specCode, score: overlap };
  }
  return best ? best.code : null;
}

/** True when a <p>'s text is a bare section marker alone: "1." "2." "a." "B." "(c)". */
function isBareMarker(text: string): boolean {
  return /^\(?[0-9]{1,2}\)?[.)]?$/.test(text) || /^\(?[A-Za-z]\)?[.)]$/.test(text);
}

export interface IntroSplitResult {
  /** specCode → concatenated narrative HTML for that reader-form row. */
  bySpec: Map<string, string>;
  /** How many distinct sections were matched to a row other than the 'a' catch-all. */
  matchedSections: number;
}

/**
 * Split the Introduction HTML into per-rubric-row narrative chunks. Pure +
 * deterministic so it can be unit-tested.
 */
export function splitIntroByRubric(introHtml: string): IntroSplitResult {
  const empty: IntroSplitResult = { bySpec: new Map(), matchedSections: 0 };
  const html = introHtml || '';
  if (!html.trim()) return empty;

  // Index every top-level <p> block (the markers live on their own <p>).
  const blocks: { start: number; end: number; text: string }[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) blocks.push({ start: m.index, end: re.lastIndex, text: strip(m[1]) });
  if (blocks.length === 0) return empty;

  // Marker blocks = section cuts.
  const markerIdx: number[] = [];
  for (let i = 0; i < blocks.length; i++) if (isBareMarker(blocks[i].text)) markerIdx.push(i);
  if (markerIdx.length === 0) return empty; // no structure → caller keeps whole blob on 'a'

  const bySpec = new Map<string, string>();
  const append = (code: string, frag: string) => {
    if (!frag.trim()) return;
    bySpec.set(code, (bySpec.get(code) || '') + frag);
  };

  // Preamble before the first marker (e.g. "A. Required Introductory Material") →
  // row 'a' so nothing is lost.
  const preamble = html.slice(0, blocks[markerIdx[0]].start);
  if (strip(preamble)) append('a', preamble);

  let matched = 0;
  for (let k = 0; k < markerIdx.length; k++) {
    const bi = markerIdx[k];
    const sectionStart = blocks[bi].start;
    const sectionEnd = k + 1 < markerIdx.length ? blocks[markerIdx[k + 1]].start : html.length;
    const sectionHtml = html.slice(sectionStart, sectionEnd);
    // Prompt = the next few non-empty block texts after the marker (the echoed
    // official criteria), used to pick the row.
    const nextMarkerBi = k + 1 < markerIdx.length ? markerIdx[k + 1] : blocks.length;
    let prompt = '';
    for (let j = bi + 1; j < nextMarkerBi && prompt.length < 200; j++) {
      if (blocks[j].text) prompt += blocks[j].text + ' ';
    }
    const code = bestRowFor(prompt) || 'a'; // unmatched → 'a' catch-all
    if (code !== 'a') matched += 1;
    append(code, sectionHtml);
  }

  return { bySpec, matchedSections: matched };
}

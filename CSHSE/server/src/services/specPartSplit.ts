import * as cheerio from 'cheerio';
import { getSpecParts, type SpecPart } from '../data/levelStandards';

/**
 * Split a specification's parsed narrative into its NUMBERED PARTS (4.a.1 …).
 *
 * Programs answer a spec with parts (Standard 4.a "Provide the following:
 * 1. … 2. … 3. … 4. …") by writing each part as its own heading line:
 *
 *     1. Measurable student learning outcomes          ← part 1
 *     <answer>
 *     4.a. 2. Assessment plan (include timelines)       ← part 2
 *     <answer> …
 *
 * The parser used to keep the whole answer as ONE narrative, so the 4.a.1–4.a.4
 * rows in Review / the Editor / the Reader Report had no text of their own.
 * Here each heading line is recognised against the OFFICIAL wording of the
 * part (specParts.json — the Standards / Reader Report forms), not just its
 * number, because programs number them differently: ETSU nests 16.c as
 * "1. Case management  a. Intake interviewing  b. Helping skills …  2. Group
 * facilitation" while the catalog lists 16.c.1–6 flat. A line only counts as a
 * part heading when its words match that part's wording, so an ordinary
 * numbered list inside an answer ("1) Empathy, 2) Multicultural …") never
 * splits anything.
 */

const STOP = new Set(
  'the and for with from that this these those their there are was were has have had not but its into upon how what which who whom whose may can will shall must each any all per via etc include includes including provide following'.split(' ')
);

export function contentWords(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1'));
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Share of `words` that belong to the part's official wording. */
export function wordsCovered(words: string[], partText: string): number {
  if (!words.length) return 0;
  const pw = new Set(contentWords(partText));
  return words.filter((w) => pw.has(w)).length / words.length;
}

export interface PartHeading {
  n: number;
  /** True when the line is ONLY the heading (it is replaced by the part's own heading). */
  headingOnly: boolean;
}

/**
 * Is this line a heading for one of `parts` (only parts numbered above `after`)?
 * Accepts "1. Text", "4.a. 2. Text", "4a.2 Text", "a. Text", "(3) Text",
 * "16.c. b. Text", "4.a.3 Text" — the words after the marker must match the
 * part's official wording.
 */
export function matchPartHeading(line: string, std: string, spec: string, parts: SpecPart[], after = 0): PartHeading | null {
  const text = (line || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 700) return null;
  const prefix = `(?:standard\\s+)?${esc(std)}\\s*\\.?\\s*${esc(spec)}\\s*\\.?\\s*`;
  const re = new RegExp(`^(${prefix})?(?:\\(?(\\d{1,2}|[a-j])\\s*[.):]\\s*)?(.*)$`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const hasPrefix = !!m[1];
  const enumTok = m[2];
  const rest = m[3] || '';
  // A heading needs a marker: an enumerator ("2.") or the spec prefix ("4.a.").
  if (!enumTok && !hasPrefix) return null;
  // "4.a.3 Text" — the number sits right after the prefix with no separator.
  let num: number | null = enumTok && /^\d+$/.test(enumTok) ? Number(enumTok) : null;
  let body = rest;
  if (!enumTok && hasPrefix) {
    const m2 = rest.match(/^(\d{1,2})\b\.?\s*(.*)$/);
    if (m2) {
      num = Number(m2[1]);
      body = m2[2];
    }
  }
  const bodyWords = contentWords(body);
  if (!bodyWords.length) return null;
  let best: { n: number; score: number; len: number } | null = null;
  for (const p of parts) {
    if (p.n <= after) continue;
    const pw = Array.from(new Set(contentWords(p.text)));
    if (!pw.length) continue;
    // Compare against the start of the line (a heading may run on into the answer).
    const window = new Set(bodyWords.slice(0, pw.length + 6));
    const hit = pw.filter((w) => window.has(w)).length;
    // A long part ("Examples of assessment tools (e.g. rubrics, exams, …)") is
    // often headed by just its core words — score the text before "(" too.
    const core = Array.from(new Set(contentWords(p.text.split('(')[0])));
    const coreScore = core.length >= 2 ? core.filter((w) => window.has(w)).length / core.length : 0;
    const score = Math.max(hit / pw.length, coreScore);
    const numberAgrees = num === p.n;
    const ok = pw.length === 1 ? score === 1 && (numberAgrees || hasPrefix || bodyWords.length <= 3) : score >= 0.6 || (numberAgrees && score >= 0.34);
    if (!ok) continue;
    const ranked = score + (numberAgrees ? 0.2 : 0);
    if (!best || ranked > best.score) best = { n: p.n, score: ranked, len: p.text.length };
  }
  if (!best) return null;
  return { n: best.n, headingOnly: wordsCovered(bodyWords, parts.find((p) => p.n === best!.n)!.text) >= 0.7 };
}

export interface PartChunk {
  /** 0 = text before the first part heading. */
  n: number;
  html: string;
  text: string;
}

const blockText = ($: cheerio.CheerioAPI, el: any): string => $(el).text().replace(/\s+/g, ' ').trim();

/**
 * Split one narrative's HTML at its part headings. Returns null when no part
 * heading is found (nothing to split). Headings are matched on top-level
 * blocks, in ascending part order.
 */
export function splitHtmlIntoParts(html: string, std: string, spec: string, parts: SpecPart[]): PartChunk[] | null {
  if (!html || !parts.length) return null;
  const $ = cheerio.load(`<div id="__root">${html}</div>`, null, false);
  const root = $('#__root');
  const nodes = root.contents().toArray();
  const chunks: Array<{ n: number; html: string[]; text: string[] }> = [{ n: 0, html: [], text: [] }];
  let last = 0;
  let found = 0;
  // After a heading-only line: the heading may wrap onto the next paragraph(s)
  // ("1. A detailed description … (e.g. names," / "agencies, roles, …").
  let wrapOf: SpecPart | null = null;
  for (const node of nodes) {
    const isEl = (node as any).type === 'tag';
    const t = isEl ? blockText($, node) : String((node as any).data || '').trim();
    const outer = isEl ? $.html(node) : String((node as any).data || '');
    // Empty wrappers from nested <p><p>…</p></p> markup.
    if (isEl && !t && !$(node).find('img,table,hr,br').length && /^(p|div|span)$/i.test((node as any).name)) continue;
    const tag = isEl ? String((node as any).name).toLowerCase() : '';
    const head = isEl && !/^(table|ul|ol)$/.test(tag) ? matchPartHeading(t, std, spec, parts, last) : null;
    if (head) {
      found += 1;
      last = head.n;
      wrapOf = head.headingOnly ? parts.find((p) => p.n === head.n) || null : null;
      chunks.push({ n: head.n, html: head.headingOnly ? [] : [outer], text: head.headingOnly ? [] : [t] });
      continue;
    }
    if (wrapOf && isEl && t && t.length <= 240 && !/^(table|ul|ol)$/.test(tag)) {
      const w = contentWords(t);
      if ((w.length && wordsCovered(w, wrapOf.text) >= 0.7) || (!w.length && t.length <= 20)) continue; // rest of the heading
    }
    if (t) wrapOf = null;
    const cur = chunks[chunks.length - 1];
    cur.html.push(outer);
    if (t) cur.text.push(t);
  }
  if (!found) return null;
  // The parts restated as a list ("1. Observation to / 2. Directly supervised …
  // to / 3. … / 4. …") followed by ONE combined answer is the prompt, not
  // per-part answers: most headings then have no text of their own. Keep the
  // narrative whole for the spec rather than file it all under the last part.
  const emptyParts = chunks.filter((c) => c.n > 0 && !c.text.join(' ').trim() && !/<(img|table)/i.test(c.html.join(''))).length;
  if (emptyParts >= 2 && emptyParts * 2 >= found) return null;
  return chunks
    .map((c) => ({ n: c.n, html: c.html.join(''), text: c.text.join('\n\n') }))
    .filter((c) => c.n > 0 || /\w/.test(c.text.replace(/^provide the following:?$/i, '')));
}

export const PART_ID_SEP = '::part-';

/**
 * Split every narrative of every spec-with-parts in a review-state `buckets`
 * object into one item per numbered part. Pure: returns the new buckets and
 * a map original sectionId → new sectionIds (so approvals / discards /
 * provenance can follow). Idempotent — an already split item has `partN` and
 * the leftover intro has no headings left.
 */
export function splitBucketsIntoParts(
  buckets: Record<string, any> | null | undefined,
  level: string | null | undefined
): { buckets: Record<string, any>; idMap: Record<string, string[]>; changed: boolean } {
  const idMap: Record<string, string[]> = {};
  if (!buckets || typeof buckets !== 'object') return { buckets: buckets || {}, idMap, changed: false };
  const out: Record<string, any> = { ...buckets };
  let changed = false;
  for (const [key, b] of Object.entries(buckets)) {
    const std = b?.standardCode != null ? String(b.standardCode) : '';
    const spec = b?.specCode != null ? String(b.specCode) : '';
    if (!std || !spec || !Array.isArray(b.narratives) || !b.narratives.length) continue;
    const parts = getSpecParts(level, std, spec);
    if (!parts.length) continue;
    const next: any[] = [];
    let touched = false;
    for (const it of b.narratives) {
      if (it?.partN || String(it?.sectionId || '').includes(PART_ID_SEP)) {
        next.push(it);
        continue;
      }
      const html = it?.htmlSnippet || (it?.snippet ? String(it.snippet).split(/\n{2,}/).map((p: string) => `<p>${escapeHtml(p)}</p>`).join('') : '');
      const chunks = splitHtmlIntoParts(html, std, spec, parts);
      if (!chunks) {
        next.push(it);
        continue;
      }
      touched = true;
      const ids: string[] = [];
      for (const c of chunks) {
        const p = parts.find((x) => x.n === c.n);
        const sectionId = c.n ? `${it.sectionId}${PART_ID_SEP}${c.n}` : it.sectionId;
        ids.push(sectionId);
        const words = c.text ? c.text.split(/\s+/).filter(Boolean).length : 0;
        next.push({
          ...it,
          sectionId,
          heading: p ? `${std}.${spec}.${p.n} ${p.text}` : it.heading,
          snippet: c.text,
          htmlSnippet: c.html,
          wordCount: words,
          ...(p ? { partN: p.n, partText: p.text, splitFrom: it.sectionId } : { partIntro: true }),
        });
      }
      idMap[it.sectionId] = ids;
    }
    if (touched) {
      // Keep the intro first, then parts in their official order.
      const order = (x: any) => (x?.partN ? x.partN : 0);
      out[key] = { ...b, narratives: next.map((x, i) => [x, i] as const).sort((a, z) => order(a[0]) - order(z[0]) || a[1] - z[1]).map(([x]) => x) };
      changed = true;
    }
  }
  return { buckets: out, idMap, changed };
}

/**
 * Apply the split to a whole aiReviewState (mutates + returns it): the new part
 * items inherit the original item's approved / discarded status and source.
 */
export function splitReviewStateIntoParts(state: any, level: string | null | undefined): boolean {
  if (!state?.buckets) return false;
  const { buckets, idMap, changed } = splitBucketsIntoParts(state.buckets, level);
  if (!changed) return false;
  state.buckets = buckets;
  const follow = (list: string[] | undefined) => {
    if (!Array.isArray(list)) return list;
    const s = new Set(list);
    for (const [orig, ids] of Object.entries(idMap)) if (s.has(orig)) for (const id of ids) s.add(id);
    return Array.from(s);
  };
  state.approvedIds = follow(state.approvedIds);
  state.discardedIds = follow(state.discardedIds);
  if (state.itemSources) {
    for (const [orig, ids] of Object.entries(idMap)) {
      const src = state.itemSources[orig];
      if (src) for (const id of ids) if (!state.itemSources[id]) state.itemSources[id] = { ...src };
    }
  }
  return true;
}

/**
 * Editor HTML for one spec's approved narratives: text before any part first,
 * then each numbered part under its own "4.a.2 Assessment plan …" heading, in
 * official order — the same rows the Reader Report lists.
 */
export function composeSpecNarrativeHtml(items: Array<{ html: string; partN?: number; partText?: string }>, std: string, spec: string): string {
  if (!items.some((i) => i.partN)) return items.map((i) => i.html).join('\n<hr class="ai-import-merge"/>\n');
  const intro = items.filter((i) => !i.partN).map((i) => i.html);
  const byPart = new Map<number, { text: string; html: string[] }>();
  for (const i of items) {
    if (!i.partN) continue;
    const e = byPart.get(i.partN) || { text: i.partText || '', html: [] };
    e.html.push(i.html);
    byPart.set(i.partN, e);
  }
  const sections = Array.from(byPart.entries())
    .sort((a, z) => a[0] - z[0])
    .map(([n, e]) => `<h3>${std}.${spec}.${n} ${escapeHtml(e.text)}</h3>\n${e.html.join('\n')}`);
  return [...intro, ...sections].join('\n');
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

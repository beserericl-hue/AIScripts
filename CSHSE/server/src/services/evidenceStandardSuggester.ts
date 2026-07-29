/**
 * Bulk supporting-evidence → (standard, sub-specification) suggestion.
 *
 * A coordinator drops a folder of files the self-study REFERENCES but which
 * carry no standard number (e.g. "advisory board meeting minutes.pdf",
 * "Standard 4 Documentation Program Evaluation.pdf", "Transfer Rates ...xlsx").
 * We recommend where each belongs using two complementary signals:
 *
 *   1. REFERENCE MATCH (primary, deterministic) — does the imported narrative
 *      text actually mention this file, by title/name or by distinctive
 *      content? Filenames frequently name the standard outright ("Standard 4")
 *      or a course/topic the narrative discusses. We score each (std, spec)
 *      narrative by IDF-weighted token overlap with the file, plus a big bonus
 *      when the file's title appears verbatim, plus an explicit "Standard N"
 *      filename parse.
 *
 *   2. SEMANTIC PLACEMENT (secondary) — the same embeddings+Haiku SpecMatcher
 *      the import uses (`/ai/placement/recommend`), run over the file's text.
 *      Best-effort; contributes a candidate but never dominates a strong
 *      reference match.
 *
 * The reference-match half is a pure function (`referenceMatch`) so it is unit
 * testable without the AI service.
 */
import { recommendPlacement } from './cshseAiClient';

export interface NarrativeTuple {
  standardCode: string;
  /** undefined for a standard-level introduction. */
  specCode?: string;
  content: string;
}

export interface Suggestion {
  standardCode: string;
  specCode?: string;
  /** 0..1 */
  confidence: number;
  /** 'reference' = named/content match in the narrative; 'semantic' = SpecMatcher. */
  source: 'reference' | 'semantic' | 'filename';
  rationale: string;
}

// Words too common in a CSHSE self-study to discriminate between standards.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'will',
  'has', 'have', 'had', 'not', 'but', 'they', 'their', 'our', 'his', 'her', 'its',
  'all', 'any', 'can', 'may', 'per', 'via', 'each', 'into', 'onto', 'than', 'then',
  'human', 'services', 'service', 'program', 'programs', 'student', 'students',
  'course', 'courses', 'department', 'college', 'standard', 'standards', 'aacc',
  'form', 'report', 'reports', 'document', 'documentation', 'template', 'chart',
  'data', 'overall', 'cycle', 'spring', 'fall', 'summer', 'winter', 'aas',
  // Filename boilerplate — words that describe the FILE, not its subject, and
  // must never drive a match (e.g. "…TO SEND TO FACULTY.xlsx" is a curriculum
  // map, not a faculty doc; "FINAL …", "…copy 2", "Master List").
  'final', 'updated', 'update', 'draft', 'copy', 'version', 'ver', 'revised', 'rev',
  'new', 'old', 'master', 'list', 'send', 'sent', 'complete', 'completed', 'sheet',
  'file', 'files', 'appendix', 'appendices', 'attachment', 'exhibit', 'ksu',
  // File-extension tokens that leak in from names like "Education_Outcomes.pdf".
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'csv', 'png', 'jpg', 'jpeg',
]);

function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function normalizePhrase(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Strip the extension + trailing date/junk to get the human title. */
export function titleFromFilename(filename: string): string {
  return (filename || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse an explicit standard (and optional sub-spec) that the coordinator put
 * in the filename — the reliable, zero-guesswork signal we ask them to use:
 *   "Standard 4 - Exit Survey.xlsx"        → { std: '4' }
 *   "Std 11.a Course Contents.pdf"         → { std: '11', spec: 'a' }
 *   "4.b Departmental Bylaws.pdf"          → { std: '4',  spec: 'b' }
 */
export function explicitStandardFromName(name: string): { std: string; spec?: string } | null {
  const s = name || '';
  // Word form: "Standard 4", "Std 4.a", "Standard4a".
  let m = s.match(/\b(?:standard|std)\s*\.?\s*(\d{1,2})\s*\.?\s*([a-z])?(?![a-z0-9])/i);
  // Leading-code form: "4.a - …", "11.b_…" at the very start of the name.
  if (!m) m = s.match(/^\s*(\d{1,2})\.([a-z])(?![a-z0-9])/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 30) return { std: String(n), spec: m[2] ? m[2].toLowerCase() : undefined };
  }
  return null;
}

/**
 * Pure reference-match: score every narrative tuple against the file's
 * title/name and (optionally) its extracted text. Returns ranked candidates
 * with an ABSOLUTE (not normalize-to-max) 0..1 confidence + a human rationale.
 *
 * Confidence is calibrated to what the match actually is:
 *   • the self-study names the file VERBATIM            → ~0.9  (real reference)
 *   • several DISTINCTIVE name-words overlap a narrative → up to ~0.55
 *   • a single / common word overlaps                    → ~0.1–0.25 (a guess)
 * plus an ambiguity penalty when a runner-up standard is nearly as strong. The
 * old code divided by the best score, so the top pick was ALWAYS ~100% even on
 * one incidental word — the "100% but wrong" Monica saw.
 */
export function referenceMatch(
  file: { title: string; filename: string; text?: string },
  narratives: NarrativeTuple[]
): Suggestion[] {
  const out: Suggestion[] = [];
  if (!narratives.length) return out;

  const nameTokens = new Set([...tokenize(file.title), ...tokenize(file.filename)]);
  const bodyTokens = file.text ? new Set(tokenize(file.text).slice(0, 400)) : new Set<string>();
  if (nameTokens.size + bodyTokens.size === 0) return out;

  // IDF across narratives so ubiquitous tokens (e.g. "faculty") weigh far less
  // than rare, discriminating ones (e.g. "advisory", "fieldwork", "equity").
  const N = narratives.length;
  const df = new Map<string, number>();
  const docTokenSets = narratives.map((n) => {
    const set = new Set(tokenize(n.content));
    for (const t of set) df.set(t, (df.get(t) || 0) + 1);
    return set;
  });
  const idf = (t: string) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;

  const titlePhrase = normalizePhrase(file.title);
  const titleIsDistinctive = titlePhrase.split(' ').filter((w) => w.length >= 3).length >= 2;

  const raw: Array<{
    n: NarrativeTuple; score: number; hits: string[]; verbatim: boolean; nameWeight: number; nameHits: number;
  }> = [];
  for (let i = 0; i < narratives.length; i++) {
    const n = narratives[i];
    const docSet = docTokenSets[i];
    const hits: string[] = [];
    let score = 0;
    let nameWeight = 0; // IDF mass from NAME tokens only — drives confidence.
    for (const t of nameTokens) {
      if (docSet.has(t)) {
        const w = idf(t);
        score += w * 2;
        nameWeight += w;
        hits.push(t);
      }
    }
    for (const t of bodyTokens) {
      if (!nameTokens.has(t) && docSet.has(t)) score += idf(t) * 0.5;
    }
    const normContent = normalizePhrase(n.content);
    let verbatim = false;
    if (titleIsDistinctive && titlePhrase.length >= 8 && normContent.includes(titlePhrase)) {
      score += 20;
      verbatim = true;
    }
    if (score > 0) raw.push({ n, score, hits, verbatim, nameWeight, nameHits: hits.length });
  }
  if (!raw.length) return out;

  raw.sort((a, b) => b.score - a.score);
  const topScore = raw[0].score;
  const secondScore = raw[1]?.score ?? 0;

  for (let idx = 0; idx < Math.min(raw.length, 4); idx++) {
    const r = raw[idx];
    let conf: number;
    if (r.verbatim) {
      conf = 0.9;
    } else {
      // Saturating strength from distinctive name-token IDF mass. ~6 IDF points
      // (a couple of rare words) ≈ 0.63; a lone word is heavily discounted.
      let strength = 1 - Math.exp(-r.nameWeight / 6);
      if (r.nameHits <= 1) strength *= 0.4; // one word alone is a guess, not a match
      conf = 0.6 * strength; // keyword-only tops out ~0.55, never near 1.0
      // Ambiguity penalty: if the runner-up standard is nearly as strong, the
      // top pick is not trustworthy — damp it so it falls below the auto-route
      // threshold and the coordinator (or the semantic classifier) decides.
      if (idx === 0 && secondScore > 0 && secondScore / topScore > 0.6) conf *= 0.7;
    }
    conf = Math.max(0, Math.min(1, conf));
    if (conf < 0.12 && !r.verbatim) continue; // drop noise
    const where = r.n.specCode
      ? `Standard ${r.n.standardCode}.${r.n.specCode}`
      : `the Standard ${r.n.standardCode} introduction`;
    const rationale = r.verbatim
      ? `Named verbatim in ${where}`
      : `Keyword overlap with ${where} (${r.hits.slice(0, 4).join(', ') || 'content'})`;
    out.push({ standardCode: r.n.standardCode, specCode: r.n.specCode, confidence: conf, source: 'reference', rationale });
  }
  return out;
}

/** Merge candidate lists, keeping the highest-confidence entry per (std,spec). */
function mergeSuggestions(...lists: Suggestion[][]): Suggestion[] {
  const byKey = new Map<string, Suggestion>();
  for (const list of lists) {
    for (const s of list) {
      const key = `${s.standardCode}.${s.specCode ?? ''}`;
      const existing = byKey.get(key);
      if (!existing || s.confidence > existing.confidence) {
        // Prefer a reference rationale but keep the higher confidence.
        byKey.set(key, existing && existing.source === 'reference' && s.source !== 'reference'
          ? { ...existing, confidence: Math.max(existing.confidence, s.confidence) }
          : s);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.confidence - a.confidence);
}

// Only auto-route (pre-fill the card) when we clear this bar. Below it the file
// stays UNASSIGNED with its guesses shown — better than a confident wrong route.
export const MIN_CONFIDENT = 0.45;

/**
 * Full suggestion: explicit-standard filename parse (authoritative) + reference
 * match (deterministic) + semantic placement (AI topic classifier). Returns
 * ranked suggestions and a `best` ONLY when we're confident enough to auto-route
 * — otherwise `best` is undefined so the coordinator assigns it themselves.
 */
export async function suggestStandardForFile(opts: {
  title: string;
  filename: string;
  text?: string;
  narratives: NarrativeTuple[];
  programLevel: string;
  institutionId?: string;
}): Promise<{ suggestions: Suggestion[]; best?: Suggestion }> {
  const ref = referenceMatch({ title: opts.title, filename: opts.filename, text: opts.text }, opts.narratives);
  const refVerbatim = ref[0]?.confidence === 0.9 && /Named verbatim/.test(ref[0]?.rationale || '');

  // 1) Explicit standard/sub-spec in the filename — the coordinator told us
  //    outright. Authoritative; we trust it and skip the AI call.
  const filenameSuggestions: Suggestion[] = [];
  const explicit = explicitStandardFromName(opts.filename) || explicitStandardFromName(opts.title);
  if (explicit) {
    filenameSuggestions.push({
      standardCode: explicit.std,
      specCode: explicit.spec,
      confidence: 0.95,
      source: 'filename',
      rationale: `Filename states Standard ${explicit.std}${explicit.spec ? '.' + explicit.spec : ''}`,
    });
  }

  // 2) Semantic placement (embeddings + LLM topic classifier). Run it UNLESS we
  //    already have a genuinely strong signal (explicit filename, or the
  //    self-study names the file verbatim). Previously this was gated on the
  //    reference confidence — but that was normalized to ~1.0 for every match,
  //    so the AI classifier was ALWAYS skipped. That's the bug; now it runs
  //    exactly when the reference match is only keyword-level (Monica's case).
  const semanticSuggestions: Suggestion[] = [];
  const skipSemantic = filenameSuggestions.length > 0 || refVerbatim;
  if (!skipSemantic) {
    const probeText = (opts.text && opts.text.trim().length > 20 ? opts.text : opts.title).slice(0, 8000);
    try {
      const rec = await recommendPlacement({
        text: probeText,
        heading: opts.title,
        programLevel: opts.programLevel,
        institutionId: opts.institutionId,
      });
      if (rec.std && !rec.error) {
        semanticSuggestions.push({
          standardCode: String(rec.std),
          specCode: rec.spec ? String(rec.spec) : undefined,
          confidence: Math.max(0, Math.min(1, (rec.confidence || 0.5) * 0.85)),
          source: 'semantic',
          rationale: `Content is about Standard ${rec.std}${rec.spec ? '.' + rec.spec : ''} (AI topic match)`,
        });
      }
    } catch {
      /* advisory — the AI service being unavailable must never abort the drop */
    }
  }

  // 3) Agreement boost — when the semantic classifier and the keyword match
  //    independently land on the SAME standard, that agreement is strong
  //    evidence, so lift the more specific of the two.
  const sem = semanticSuggestions[0];
  if (sem) {
    const agree = ref.find((r) => r.standardCode === sem.standardCode);
    if (agree) {
      const spec = agree.specCode || sem.specCode;
      const boosted = Math.min(0.85, Math.max(agree.confidence, sem.confidence) + 0.25);
      semanticSuggestions[0] = {
        standardCode: sem.standardCode,
        specCode: spec,
        confidence: boosted,
        source: 'semantic',
        rationale: `Standard ${sem.standardCode}${spec ? '.' + spec : ''} — the AI topic match and the self-study text agree`,
      };
    }
  }

  const suggestions = mergeSuggestions(filenameSuggestions, semanticSuggestions, ref);
  const top = suggestions[0];
  // Auto-route only when confident; otherwise leave it for the coordinator.
  const best = top && top.confidence >= MIN_CONFIDENT ? top : undefined;
  return { suggestions, best };
}

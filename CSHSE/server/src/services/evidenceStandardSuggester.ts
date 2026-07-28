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

/** Parse an explicit "Standard N" / "Std N" out of a filename/title. */
export function explicitStandardFromName(name: string): string | null {
  const m = (name || '').match(/\b(?:standard|std)\s*\.?\s*(\d{1,2})\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 30) return String(n);
  }
  return null;
}

/**
 * Pure reference-match: score every narrative tuple against the file's
 * title/name and (optionally) its extracted text. Returns ranked candidates
 * with a normalized 0..1 confidence and a human rationale.
 */
export function referenceMatch(
  file: { title: string; filename: string; text?: string },
  narratives: NarrativeTuple[]
): Suggestion[] {
  const out: Suggestion[] = [];
  if (!narratives.length) return out;

  // File token bag: title + filename tokens carry the most reference weight;
  // add a bounded set of the file's own distinctive body tokens (the "content"
  // signal — narrative that discusses the same distinctive terms).
  const nameTokens = new Set([...tokenize(file.title), ...tokenize(file.filename)]);
  const bodyTokens = file.text ? new Set(tokenize(file.text).slice(0, 400)) : new Set<string>();
  const fileTokens = new Set<string>([...nameTokens, ...bodyTokens]);
  if (fileTokens.size === 0) return out;

  // IDF across narratives so ubiquitous tokens (e.g. "faculty") weigh less than
  // rare ones (e.g. "advisory", "fieldwork", "equity").
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

  let maxRaw = 0;
  const raw: Array<{ n: NarrativeTuple; score: number; hits: string[]; verbatim: boolean }> = [];
  for (let i = 0; i < narratives.length; i++) {
    const n = narratives[i];
    const docSet = docTokenSets[i];
    const hits: string[] = [];
    let score = 0;
    for (const t of nameTokens) {
      if (docSet.has(t)) {
        score += idf(t) * 2; // name tokens matter most
        hits.push(t);
      }
    }
    for (const t of bodyTokens) {
      if (!nameTokens.has(t) && docSet.has(t)) score += idf(t) * 0.5;
    }
    // Verbatim title (or a long distinctive fragment) appearing in the
    // narrative is the strongest possible "referenced by name" signal.
    const normContent = normalizePhrase(n.content);
    let verbatim = false;
    if (titleIsDistinctive && titlePhrase.length >= 8 && normContent.includes(titlePhrase)) {
      score += 20;
      verbatim = true;
    }
    if (score > 0) {
      raw.push({ n, score, hits, verbatim });
      if (score > maxRaw) maxRaw = score;
    }
  }
  if (maxRaw === 0) return out;

  raw.sort((a, b) => b.score - a.score);
  for (const r of raw.slice(0, 4)) {
    const conf = Math.max(0, Math.min(1, r.score / maxRaw));
    if (conf < 0.35 && !r.verbatim) continue; // drop weak tails
    const where = r.n.specCode ? `Standard ${r.n.standardCode}.${r.n.specCode}` : `the Standard ${r.n.standardCode} introduction`;
    const rationale = r.verbatim
      ? `Named verbatim in ${where}`
      : `Referenced in ${where} (matched: ${r.hits.slice(0, 4).join(', ')})`;
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

/**
 * Full suggestion: reference-match (deterministic) + explicit-standard filename
 * parse + semantic placement (AI, best-effort). Returns ranked suggestions;
 * `[0]` is the recommended routing.
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

  // Explicit "Standard N" in the filename → high-confidence standard-level hint.
  const filenameSuggestions: Suggestion[] = [];
  const explicit = explicitStandardFromName(opts.filename) || explicitStandardFromName(opts.title);
  if (explicit) {
    filenameSuggestions.push({
      standardCode: explicit,
      specCode: undefined,
      confidence: 0.9,
      source: 'filename',
      rationale: `Filename names Standard ${explicit}`,
    });
  }

  // Semantic placement — best-effort; never blocks on AI-service trouble. Skip
  // it when the reference match is already strong (most bulk files are named
  // after the standard/topic they support), so a 24-file drop doesn't fan out
  // into 24 sequential AI calls.
  const semanticSuggestions: Suggestion[] = [];
  const strongReference = (ref[0] && ref[0].confidence >= 0.6) || filenameSuggestions.length > 0;
  const probeText = (opts.text && opts.text.trim().length > 20 ? opts.text : opts.title).slice(0, 8000);
  if (strongReference) {
    const suggestions = mergeSuggestions(ref, filenameSuggestions);
    return { suggestions, best: suggestions[0] };
  }
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
        confidence: Math.max(0, Math.min(1, rec.confidence || 0.5)) * 0.8, // cap below a strong reference match
        source: 'semantic',
        rationale: `Content matches Standard ${rec.std}${rec.spec ? '.' + rec.spec : ''} (AI placement)`,
      });
    }
  } catch {
    /* advisory — ignore */
  }

  const suggestions = mergeSuggestions(ref, filenameSuggestions, semanticSuggestions);
  return { suggestions, best: suggestions[0] };
}

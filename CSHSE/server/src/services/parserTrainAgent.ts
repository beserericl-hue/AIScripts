/**
 * parserTrainAgent — the diagnose→refine LEARNING LOOP (CR-073, the graph's cyclic core).
 *
 * This is the "learns from each document and gets smarter" node. Given a sandbox
 * training import, the agent runs a real optimization: it tries candidate parse
 * settings, RE-PARSES the document under each, scores every result against the §7
 * contract (parserContract), and writes the winning setting back to `parserRules`
 * as an ACTIVE, institution-scoped rule the engine will consume on future imports.
 * It is not a stub — the rule it writes provably changes how the document parses,
 * and the loop terminates when the contract is satisfied (or candidates exhaust).
 *
 * Today's lever is the format decision (template / self_study / mcc_narrative /
 * auto-detect) — the single highest-leverage parse setting, and the one behind the
 * AACC "read as self_study, dropped the tables" class of failure. Routing and
 * classification rules are authored via set-rule / approve and consumed by the
 * ai-service rule engine's post-pass; this loop owns the format lever end to end.
 *
 * DEFAULT-PRESERVING: the rule it writes is ALWAYS institution-scoped to the
 * sandbox institution, so it can never affect the proven baseline or any real
 * institution. Activation of anything global stays gated (see approve-spec).
 */
import { Submission } from '../models/Submission';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { ParserRule } from '../models/ParserRule';
import { checkParserContract, ContractResult } from './parserContract';
import { startAIImportForBatch } from '../controllers/aiImportController';
import { recommendPlacement } from './cshseAiClient';
import { getLevelStandards } from '../data/levelStandards';

type Fmt = 'template' | 'self_study' | 'mcc_narrative' | null;

// section_type (matcher) → parserRule classification
function mapSectionType(t: string): string {
  const s = String(t || '').toLowerCase();
  if (s.includes('supporting_evidence') || s === 'supporting-evidence') return 'evidence-text';
  if (s.includes('curriculum_matrix') || s.includes('matrix')) return 'matrix';
  if (s.includes('introduction')) return 'intro';
  return 'narrative'; // narrative_response / context / unknown default to narrative
}

// A clean, distinctive contiguous run (6 pure-ASCII words) — a robust textContains
// needle that survives whitespace normalisation across re-parses.
function cleanNeedle(text: string): string {
  const words = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  for (let i = 0; i + 6 <= words.length; i++) {
    const run = words.slice(i, i + 6);
    if (run.every((w) => /^[A-Za-z][A-Za-z-]*$/.test(w))) return run.join(' ');
  }
  return words.slice(0, 8).join(' ');
}

interface Candidate { forceFormat: Fmt; }
interface Attempt {
  candidate: string;           // 'auto' | 'template' | ...
  format: string;              // what actually parsed
  specsWithContent: number;
  anchorsOk: boolean;
  unplacedTags: number;
  score: number;
  ts: string;
}
interface RefineState {
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  finishedAt?: string;
  importId: string;
  attempts: Attempt[];
  winner?: { candidate: string; ruleId?: string; score: number };
  synthesis?: {
    rulesSynthesized: number;
    ruleIds: string[];
    unplacedBefore: number;
    unplacedAfter: number;
    specsBefore: number;
    specsAfter: number;
    anchorsOkAfter: boolean;
  };
  message?: string;
}

// Score a contract result: anchors are the hard gate (huge weight), then coverage,
// then fewer unplaced tags. Higher is better.
function scoreContract(c: ContractResult): number {
  const anchorBonus = c.anchors.missing.length === 0 ? 1_000_000 : 0;
  return anchorBonus + c.coverage.specsWithContent * 1000 - c.coverage.unplacedTags * 10;
}

async function pollParsed(importId: string, timeoutMs = 500_000): Promise<string> {
  const started = Date.now();
  // give the batch dispatch a moment to flip status to queued
  while (Date.now() - started < timeoutMs) {
    const imp: any = await SelfStudyImport.findById(importId).select('aiStatus').lean();
    const st = imp?.aiStatus || '';
    if (['parsed', 'completed', 'failed'].includes(st)) return st;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return 'timeout';
}

// The terminal callback flips aiStatus to 'parsed' and materializes the review
// state + Compare source HTML in SEPARATE writes; scoring the contract before the
// source HTML lands reads 0 anchors spuriously. Return a SETTLED contract: for
// template/mcc (which anchor every item) wait until anchored === totalItems;
// self_study anchors nothing, so accept its first non-empty read. This makes the
// anchors gate in the score reflect the real parse, not a write race.
async function settledContract(importId: string, timeoutMs = 90_000): Promise<ContractResult> {
  const started = Date.now();
  let last = await checkParserContract(importId);
  while (Date.now() - started < timeoutMs) {
    const a = last.anchors;
    const anchoringFormat = last.format === 'template' || last.format === 'mcc_narrative';
    // materialized when there ARE items and (self_study, or every item anchored)
    if (a.totalItems > 0 && (!anchoringFormat || a.anchored === a.totalItems)) return last;
    await new Promise((r) => setTimeout(r, 4000));
    last = await checkParserContract(importId);
  }
  return last;
}

// Re-parse the import and return its contract, RETRYING while the parse is
// degraded. A single re-parse can transiently time out (AI-service under load)
// and yield a near-empty result (few/no specs, anchors missing). When we already
// know a clean parse is reachable (`wantSpecs` from the winning attempt), a lone
// bad parse must NOT be persisted as the final state — retry until it reproduces
// that quality, or the tries are exhausted. `wantSpecs<=0` → accept any parse
// that completes with all items anchored.
async function reparseStable(
  importId: string,
  programLevel: string,
  wantSpecs: number,
  tries = 4
): Promise<ContractResult> {
  let c = await settledContract(importId);
  for (let i = 1; i <= tries; i++) {
    await clearReviewState(importId);
    await startAIImportForBatch(importId, programLevel, null as any);
    const st = await pollParsed(importId);
    c = await settledContract(importId);
    const okSpecs = wantSpecs <= 0 || c.coverage.specsWithContent >= Math.floor(wantSpecs * 0.9);
    const okAnchors = c.anchors.missing.length === 0;
    if (st !== 'timeout' && st !== 'failed' && okSpecs && okAnchors) break;
  }
  return c;
}

async function persist(importId: string, state: RefineState) {
  const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
  if (imp?.submissionId) {
    await Submission.updateOne({ _id: imp.submissionId }, { $set: { parserTrainState: state } });
  }
}

// Re-parsing the SAME import accumulates review items across parse jobs (each
// parse mints new sectionIds, so the re-import "replace" can't purge the old
// ones, and the fresh source HTML only anchors the latest job → stale items read
// as un-anchored). Before each candidate re-parse, clear the sandbox submission's
// review state so every candidate is measured on a CLEAN parse. Sandbox-only.
async function clearReviewState(importId: string): Promise<void> {
  const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
  if (imp?.submissionId) {
    await Submission.updateOne({ _id: imp.submissionId }, { $unset: { aiReviewState: 1 } });
  }
}

// The single agent-managed format rule for this training import.
function formatRuleId(importId: string) { return `agent.format.${String(importId).slice(-8)}`; }

async function setFormatRule(importId: string, institutionId: string, forceFormat: Fmt, active: boolean) {
  const ruleId = formatRuleId(importId);
  if (!forceFormat || !active) {
    // retire (or don't create) — auto-detect means NO active format rule
    await ParserRule.updateOne({ ruleId, version: 1 }, { $set: { status: 'retired', updatedAt: new Date() } });
    return ruleId;
  }
  await ParserRule.updateOne(
    { ruleId, version: 1 },
    {
      $set: {
        ruleId, version: 1, name: `Agent-learned format for this document`,
        description: `Parser Train discovered "${forceFormat}" maximizes the §7 contract for this document.`,
        scope: { level: 'institution', institutionId },
        status: 'active', createdBy: 'agent', createdFromImportId: importId,
        match: { format: 'any', region: 'document', signature: { from: 'parser-train-agent' } },
        extract: { forceFormat }, anchor: { emit: true, wrap: 'section', idFrom: 'sectionId' },
        confidence: 0.9, updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  return ruleId;
}

/**
 * Run the format-search refine loop in the background. Persists progress to
 * Submission.parserTrainState (poll via getRefineState). Returns immediately.
 */
export function startAutoRefine(importId: string, programLevel: string, institutionId: string, isPdf: boolean): void {
  const state: RefineState = { status: 'running', startedAt: new Date().toISOString(), importId, attempts: [] };
  // candidate parse settings to try, matched to the container type
  const candidates: Candidate[] = isPdf
    ? [{ forceFormat: null }, { forceFormat: 'mcc_narrative' }, { forceFormat: 'self_study' }]
    : [{ forceFormat: null }, { forceFormat: 'template' }, { forceFormat: 'self_study' }];

  (async () => {
    try {
      await persist(importId, state);
      let best: { attempt: Attempt; candidate: Candidate } | null = null;

      for (const cand of candidates) {
        // set the active format rule for this candidate, then RE-PARSE (the batch
        // helper resolves forceFormat via the rule engine → consumes our rule).
        await setFormatRule(importId, institutionId, cand.forceFormat, cand.forceFormat !== null);
        await clearReviewState(importId);
        await startAIImportForBatch(importId, programLevel, null as any);
        const st = await pollParsed(importId);
        if (st === 'failed' || st === 'timeout') {
          state.attempts.push({ candidate: cand.forceFormat || 'auto', format: st, specsWithContent: 0, anchorsOk: false, unplacedTags: 0, score: -1, ts: new Date().toISOString() });
          await persist(importId, state);
          continue;
        }
        const c = await settledContract(importId);
        const attempt: Attempt = {
          candidate: cand.forceFormat || 'auto',
          format: c.format,
          specsWithContent: c.coverage.specsWithContent,
          anchorsOk: c.anchors.missing.length === 0,
          unplacedTags: c.coverage.unplacedTags,
          score: scoreContract(c),
          ts: new Date().toISOString(),
        };
        state.attempts.push(attempt);
        if (!best || attempt.score > best.attempt.score) best = { attempt, candidate: cand };
        await persist(importId, state);
      }

      if (!best) {
        state.status = 'failed';
        state.message = 'no candidate parsed successfully';
      } else {
        // Write the winner as the ACTIVE learned rule and re-parse once more so the
        // final review state on disk reflects the winning setting.
        const ruleId = await setFormatRule(importId, institutionId, best.candidate.forceFormat, best.candidate.forceFormat !== null);
        // The winning attempt PROVED a clean parse is reachable under this rule;
        // retry the write-back re-parse until it reproduces that quality so a
        // transient timeout can't persist a degraded parse over the winner.
        const cWin = await reparseStable(importId, programLevel, best.attempt.specsWithContent);
        state.winner = { candidate: best.attempt.candidate, ruleId: best.candidate.forceFormat ? ruleId : undefined, score: best.attempt.score };

        // PHASE 2 — autonomous rule synthesis: place the content the winning parse
        // still left unplaced by writing deterministic placement rules, then
        // re-parse so the engine applies them and Compare stays intact.
        const unplacedBefore = cWin.coverage.unplacedTags;
        const specsBefore = cWin.coverage.specsWithContent;
        state.message = `Learned format "${best.attempt.candidate}" (${specsBefore} specs). Synthesizing placement rules for ${unplacedBefore} unplaced item(s)…`;
        await persist(importId, state);

        const syn = await synthesizePlacementRules(importId, institutionId, programLevel, { activate: true });
        // un-bunch any spec the walker merged into a neighbour (e.g. 15.b into 15.a)
        const split = await synthesizeSplitRules(importId, institutionId, programLevel, { activate: true });
        // Synthesis only ADDS placement/splits, so the post-synthesis parse must
        // hold at least the winner's spec count with anchors intact — retry if a
        // transient timeout degrades it.
        const cAfter = (syn.synthesized.length || split.synthesized.length)
          ? await reparseStable(importId, programLevel, specsBefore)
          : await settledContract(importId);
        state.synthesis = {
          rulesSynthesized: syn.synthesized.length + split.synthesized.length,
          ruleIds: [...syn.synthesized, ...split.synthesized],
          unplacedBefore, unplacedAfter: cAfter.coverage.unplacedTags,
          specsBefore, specsAfter: cAfter.coverage.specsWithContent,
          anchorsOkAfter: cAfter.anchors.missing.length === 0,
        };
        state.status = 'done';
        state.message = `Learned: format "${best.attempt.candidate}" + ${syn.synthesized.length} placement + ${split.synthesized.length} split rule(s). `
          + `Unplaced ${unplacedBefore}→${cAfter.coverage.unplacedTags}, specs ${specsBefore}→${cAfter.coverage.specsWithContent}`
          + (split.splits.length ? ` (un-bunched ${split.splits.map((s) => `${s.std}.${s.spec}`).join(',')})` : '')
          + `, anchors ${cAfter.anchors.missing.length === 0 ? 'OK' : 'MISSING'}.`;
      }
      state.finishedAt = new Date().toISOString();
      await persist(importId, state);
    } catch (err: any) {
      state.status = 'failed';
      state.message = `refine loop error: ${err?.message || String(err)}`;
      state.finishedAt = new Date().toISOString();
      await persist(importId, state).catch(() => {});
      console.error('[parser-train agent] refine failed:', err);
    }
  })();
}

/**
 * AUTONOMOUS RULE SYNTHESIS (CR-073 #1). For each UNPLACED tag (content the parser
 * could not route to a spec) — and optionally low-confidence placements — ask the
 * ai-service matcher where it SHOULD go, and if it has a confident target, write a
 * deterministic parserRule (textContains → std.spec + classification) so the engine
 * places it on the next parse. Institution-scoped, so it can never touch the
 * baseline. Returns the synthesized ruleIds. `activate` gates proposed vs active.
 */
export async function synthesizePlacementRules(
  importId: string, institutionId: string, programLevel: string,
  opts: { activate: boolean; cap?: number } = { activate: false }
): Promise<{ synthesized: string[]; considered: number }> {
  const cap = opts.cap ?? 25;
  const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
  if (!imp?.submissionId) return { synthesized: [], considered: 0 };
  const sub: any = await Submission.findById(imp.submissionId).select('aiReviewState').lean();
  const tags: any[] = sub?.aiReviewState?.tags || [];
  const synthesized: string[] = [];
  let considered = 0;

  for (const tag of tags.slice(0, cap)) {
    const text = String(tag.fullText || tag.snippet || '').trim();
    if (text.length < 40) continue; // too short to place / match reliably
    considered++;
    const rec = await recommendPlacement({
      text: text.slice(0, 4000), heading: String(tag.summary || tag.sourceHeading || ''),
      programLevel, institutionId,
    });
    if (!rec.std || !rec.spec || (rec.confidence ?? 0) < 0.5) continue;
    const needle = cleanNeedle(text);
    if (needle.length < 12) continue;
    const classification = mapSectionType(rec.sectionType);
    const ruleId = `agent.place.${String(tag.sectionId || tag.tagId || Math.abs(hashStr(needle))).slice(-16)}`;
    await ParserRule.updateOne(
      { ruleId, version: 1 },
      {
        $set: {
          ruleId, version: 1, name: `Agent-placed: ${rec.std}.${rec.spec}`,
          description: `Matcher placed unplaced content into ${rec.std}.${rec.spec} (${classification}, conf ${(rec.confidence ?? 0).toFixed(2)}).`,
          scope: { level: 'institution', institutionId },
          status: opts.activate ? 'active' : 'proposed', createdBy: 'agent', createdFromImportId: importId,
          match: { format: 'any', region: 'document', signature: { textContains: needle } },
          extract: { standardAssignment: 'explicit', specAssignment: 'explicit', classification, params: { std: rec.std, spec: rec.spec } },
          anchor: { emit: true, wrap: 'section', idFrom: 'sectionId' },
          examples: [{ importId, excerpt: text.slice(0, 200) }],
          confidence: rec.confidence ?? 0.6, updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    synthesized.push(ruleId);
  }
  return { synthesized, considered };
}

/**
 * SPLIT-RULE SYNTHESIS (CR-073). Detect a catalog spec the walker BUNCHED into an
 * adjacent spec — the spec has NO content, yet its prompt text appears mid-way
 * through another spec's narrative (e.g. AACC 15.b merged into 15.a). Synthesize a
 * split rule (boundary = the missing spec's prompt prefix as it appears in the
 * host) so the engine un-bunches it → the review panel gains the missing spec,
 * matching the human-validated production panel spec-for-spec.
 */
export async function synthesizeSplitRules(
  importId: string, institutionId: string, programLevel: string,
  opts: { activate: boolean } = { activate: false }
): Promise<{ synthesized: string[]; splits: Array<{ std: string; spec: string; host: string }> }> {
  const imp: any = await SelfStudyImport.findById(importId).select('submissionId aiFormat').lean();
  if (!imp?.submissionId) return { synthesized: [], splits: [] };
  // GUARD (CR-073) — spec-row bunching is a TEMPLATE-walker failure (a table row
  // merged into its neighbour, e.g. AACC 15.b). In prose formats (mcc_narrative /
  // self_study) a catalog prompt naturally appears as a *mention* inside a
  // narrative, so splitting on it invents specs the document doesn't have (MCC
  // 21.e/h/i). Only synthesize splits for the template format.
  const fmt = String(imp.aiFormat?.format || (typeof imp.aiFormat === 'string' ? imp.aiFormat : ''));
  if (fmt !== 'template') return { synthesized: [], splits: [] };
  const sub: any = await Submission.findById(imp.submissionId).select('aiReviewState').lean();
  const buckets: any = sub?.aiReviewState?.buckets || {};
  const catalog = getLevelStandards(programLevel) || [];
  const hasContent = (k: string) => {
    const b = buckets[k];
    return b && ((b.narratives || []).length || (b.evidenceText || []).length || (b.evidenceFiles || []).length);
  };
  const norm = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const synthesized: string[] = [];
  const splits: Array<{ std: string; spec: string; host: string }> = [];

  for (const std of catalog as any[]) {
    for (const spec of std.specifications || []) {
      const key = `${std.code}.${spec.code}`;
      if (hasContent(key)) continue; // spec already present — nothing to un-bunch
      const critWords = norm(spec.text).split(' ').filter(Boolean);
      if (critWords.length < 3) continue;
      // search every OTHER bucket's narratives for the longest verbatim prefix of
      // this spec's prompt that appears at a NON-start position (i.e. bunched).
      let found: { host: string; boundary: string } | null = null;
      for (const hk of Object.keys(buckets)) {
        if (hk === key || !hasContent(hk)) continue;
        for (const it of (buckets[hk].narratives || [])) {
          const snip = norm(it.snippet || '');
          for (let len = Math.min(10, critWords.length); len >= 3 && !found; len--) {
            const phrase = critWords.slice(0, len).join(' ');
            const idx = snip.indexOf(phrase);
            if (idx > 40) { found = { host: hk, boundary: phrase }; break; }
          }
          if (found) break;
        }
        if (found) break;
      }
      if (!found) continue;
      const ruleId = `agent.split.${std.code}.${spec.code}.${String(importId).slice(-6)}`;
      await ParserRule.updateOne(
        { ruleId, version: 1 },
        {
          $set: {
            ruleId, version: 1, name: `Agent split: un-bunch ${key} from ${found.host}`,
            description: `${key} was bunched into ${found.host}; split at its prompt boundary "${found.boundary.slice(0, 60)}…".`,
            scope: { level: 'institution', institutionId }, status: opts.activate ? 'active' : 'proposed',
            createdBy: 'agent', createdFromImportId: importId,
            match: { format: 'any', region: 'document', signature: { currentBucket: found.host } },
            extract: { split: { boundary: found.boundary, std: std.code, spec: spec.code } },
            anchor: { emit: true, wrap: 'section', idFrom: 'sectionId' }, confidence: 0.8, updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      synthesized.push(ruleId);
      splits.push({ std: std.code, spec: spec.code, host: found.host });
    }
  }
  return { synthesized, splits };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}

export async function getRefineState(importId: string): Promise<RefineState | null> {
  const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
  if (!imp?.submissionId) return null;
  const sub: any = await Submission.findById(imp.submissionId).select('parserTrainState').lean();
  return (sub?.parserTrainState as RefineState) || null;
}

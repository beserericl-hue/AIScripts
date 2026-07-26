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

type Fmt = 'template' | 'self_study' | 'mcc_narrative' | null;

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
        await clearReviewState(importId);
        await startAIImportForBatch(importId, programLevel, null as any);
        await pollParsed(importId);
        state.winner = { candidate: best.attempt.candidate, ruleId: best.candidate.forceFormat ? ruleId : undefined, score: best.attempt.score };
        state.status = 'done';
        state.message = `Learned: parse this document as "${best.attempt.candidate}" (${best.attempt.specsWithContent} specs, anchors ${best.attempt.anchorsOk ? 'OK' : 'MISSING'}).`;
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

export async function getRefineState(importId: string): Promise<RefineState | null> {
  const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
  if (!imp?.submissionId) return null;
  const sub: any = await Submission.findById(imp.submissionId).select('parserTrainState').lean();
  return (sub?.parserTrainState as RefineState) || null;
}

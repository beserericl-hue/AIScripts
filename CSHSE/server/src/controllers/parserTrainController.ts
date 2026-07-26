/**
 * Parser Train — the superuser human-in-the-loop parser training function (CR-073).
 *
 * The SU runs a document through the parser in a SANDBOX (never a real
 * submission), verifies the result in the Review screen + Compare, and sets /
 * approves parser rules. Rules are DATA in the `parserRules` store; approving
 * activates them (proposed → active). The rule-engine consultation
 * (`resolveForceFormat`, wired into start-ai / restart-ai) makes an active rule
 * change future parses in realtime, default-preserving so the proven baseline is
 * never affected.
 *
 * Isolation: training runs are `Submission.trainingRun = true` (excluded from
 * every list), owned by a dedicated sandbox PC at a sandbox institution.
 */
import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { isGlobalAdmin } from '../services/roleResolver';
import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { User } from '../models/User';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { ParserRule } from '../models/ParserRule';
import { ParserTrainGuard, GOLDEN_GUARD_TTL_MS } from '../models/ParserTrainGuard';
import { checkParserContract } from '../services/parserContract';
import { startAutoRefine, getRefineState, synthesizePlacementRules } from '../services/parserTrainAgent';

const SANDBOX_INST_NAME = 'Parser Train Sandbox';
const SANDBOX_PC_EMAIL = 'parser-train-pc@sandbox.local';

function isSU(req: AuthenticatedRequest): boolean {
  return isGlobalAdmin(req.user) || (req.user as any)?.isSuperuser === true || (req.user as any)?.realIsSuperuser === true;
}

async function ensureSandbox() {
  let inst: any = await Institution.findOne({ name: SANDBOX_INST_NAME });
  if (!inst) {
    inst = await Institution.create({
      name: SANDBOX_INST_NAME, type: 'college',
      address: { street: '1 Sandbox Way', city: 'Train', state: 'NA', zip: '00000', country: 'USA' },
      primaryContact: { name: 'Parser Train', email: SANDBOX_PC_EMAIL, phone: '000-000-0000' },
    });
  }
  let pc: any = await User.findOne({ email: SANDBOX_PC_EMAIL });
  if (!pc) {
    pc = await User.create({ email: SANDBOX_PC_EMAIL, firstName: 'Parser', lastName: 'Train', role: 'program_coordinator', institutionId: inst._id });
  }
  return { inst, pc };
}

// POST /api/parser-train  (SU) — create a sandbox training run.
export const createParserTrainRun = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const programLevel = ['associate', 'bachelors', 'masters'].includes(String(req.body?.programLevel)) ? req.body.programLevel : 'associate';
    const { inst, pc } = await ensureSandbox();
    const sub: any = await Submission.create({
      submissionId: `PTRAIN-${Date.now().toString(36)}`,
      institutionName: inst.name, institutionId: inst._id,
      programName: 'Parser Train', programLevel,
      submitterId: pc._id, type: 'initial', status: 'in_progress',
      trainingRun: true,
    });
    res.json({
      ok: true, submissionId: String(sub._id), programLevel,
      pcEmail: SANDBOX_PC_EMAIL, pcUserId: String(pc._id), institutionId: String(inst._id),
      next: 'Upload + start-ai on submissionId as the sandbox PC (impersonate pcUserId or sso-login as pcEmail), then POST /api/parser-train/:importId/diagnose as SU.',
    });
  } catch (err: any) {
    console.error('[parser-train create] failed:', err);
    res.status(500).json({ error: 'create failed', detail: err?.message || String(err) });
  }
};

// POST /api/parser-train/:importId/diagnose  (SU) — contract-check + auto-propose rules for gaps.
export const diagnoseParserTrain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const importId = req.params.importId;
    const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
    if (!imp) { res.status(404).json({ error: 'import not found' }); return; }
    const sub: any = await Submission.findById(imp.submissionId).select('trainingRun institutionId').lean();
    if (!sub?.trainingRun) { res.status(400).json({ error: 'not a Parser Train sandbox run' }); return; }

    const contract = await checkParserContract(importId);
    // REAL rule synthesis (CR-073 #1): for the content this parse left unplaced,
    // ask the matcher where it belongs and PROPOSE deterministic placement rules
    // (not activated — the SU approves them). Bounded so diagnose stays responsive.
    const sub2: any = await Submission.findById(imp.submissionId).select('programLevel').lean();
    const syn = await synthesizePlacementRules(
      importId, String(sub.institutionId), String(sub2?.programLevel || 'associate'),
      { activate: false, cap: 12 }
    );
    res.json({
      ok: true, contract,
      proposals: syn.synthesized,
      unplacedConsidered: syn.considered,
      cleanParse: contract.ok && contract.coverage.unplacedTags === 0 && syn.synthesized.length === 0,
    });
  } catch (err: any) {
    console.error('[parser-train diagnose] failed:', err);
    res.status(500).json({ error: 'diagnose failed', detail: err?.message || String(err) });
  }
};

// POST /api/parser-train/set-rule  (SU) — the SU sets/creates a parser rule.
// body: { ruleId, name, description?, scope?, match?, extract?, activate? }
export const setParserTrainRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const b = req.body || {};
    if (!b.ruleId) { res.status(400).json({ error: 'ruleId required' }); return; }
    const scope: any = b.scope || { level: 'global' };
    if (scope.institutionId) scope.institutionId = new mongoose.Types.ObjectId(String(scope.institutionId));
    // GUARDRAIL (CR-073 #7) — a GLOBAL rule (one that could affect the proven
    // baseline / every institution) may only be activated when the golden
    // regression is CURRENTLY green (a fresh mark-goldens-green stamp set by the
    // passing golden suite). Institution-scoped rules can never touch the
    // baseline, so they activate freely. This is the automated safety gate.
    const wantsActive = b.activate !== false;
    if (wantsActive && scope.level === 'global') {
      const guard: any = await ParserTrainGuard.findOne({ key: 'singleton' }).lean();
      const at = guard?.goldensGreenAt ? new Date(guard.goldensGreenAt).getTime() : 0;
      const fresh = at > 0 && (Date.now() - at) < GOLDEN_GUARD_TTL_MS;
      if (!fresh && b.goldenChecked !== true) {
        res.status(400).json({
          error: 'Global rule activation is blocked: the golden regression is not currently green. Run the golden suite (which stamps mark-goldens-green) within the last 24h, or scope the rule to an institution.',
          goldensGreenAt: guard?.goldensGreenAt || null,
        });
        return;
      }
    }
    const rule = {
      ruleId: b.ruleId, version: Number(b.version || 1), name: b.name || b.ruleId, description: b.description || '',
      scope, status: b.activate === false ? 'proposed' : 'active', createdBy: 'human',
      createdFromImportId: b.createdFromImportId ? new mongoose.Types.ObjectId(String(b.createdFromImportId)) : undefined,
      match: b.match || { format: 'any', region: 'document', signature: {} },
      extract: b.extract || {}, anchor: { emit: true, wrap: 'section', idFrom: 'sectionId' },
      examples: b.examples || [], confidence: b.confidence ?? 1.0, contractChecks: {}, metrics: {}, updatedAt: new Date(),
    };
    await ParserRule.updateOne({ ruleId: rule.ruleId, version: rule.version }, { $set: rule, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    res.json({ ok: true, ruleId: rule.ruleId, status: rule.status });
  } catch (err: any) {
    console.error('[parser-train set-rule] failed:', err);
    res.status(500).json({ error: 'set-rule failed', detail: err?.message || String(err) });
  }
};

// POST /api/parser-train/:importId/approve-spec  (SU) body {std, spec}
// The human-in-the-loop gate: approving a spec confirms its parse and ACTIVATES
// the rules this training run proposed (proposed → active).
export const approveParserTrainSpec = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const importId = req.params.importId;
    const { std, spec, all } = req.body || {};
    const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
    if (!imp) { res.status(404).json({ error: 'import not found' }); return; }
    // CR-073 #6 — approving a SPECIFIC spec activates only the proposed rule(s)
    // this run created for THAT std.spec (the rule that parsed it). `all:true`
    // activates every proposal for the run (bulk approve).
    const filter: any = { createdFromImportId: imp._id, status: 'proposed' };
    if (!all && std != null && spec != null) {
      filter['extract.params.std'] = String(std);
      filter['extract.params.spec'] = String(spec);
    }
    const r = await ParserRule.updateMany(filter, { $set: { status: 'active', updatedAt: new Date() } });
    const activatedIds = (await ParserRule.find({ createdFromImportId: imp._id, status: 'active', ...(!all && std != null && spec != null ? { 'extract.params.std': String(std), 'extract.params.spec': String(spec) } : {}) }).select('ruleId').lean()).map((x: any) => x.ruleId);
    res.json({ ok: true, approved: { std, spec, all: !!all }, activatedRules: r.modifiedCount, activatedRuleIds: activatedIds });
  } catch (err: any) {
    console.error('[parser-train approve-spec] failed:', err);
    res.status(500).json({ error: 'approve-spec failed', detail: err?.message || String(err) });
  }
};

// POST /api/parser-train/:importId/auto-refine  (SU) — run the learning loop.
// The agent tries candidate parse settings, re-parses under each, scores every
// result against the §7 contract, and writes the winner back as an ACTIVE
// institution-scoped rule the engine consumes on future imports. Runs in the
// background; poll GET /:importId/refine-status.
export const autoRefineParserTrain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const importId = req.params.importId;
    const imp: any = await SelfStudyImport.findById(importId).select('submissionId aiS3Key').lean();
    if (!imp) { res.status(404).json({ error: 'import not found' }); return; }
    const sub: any = await Submission.findById(imp.submissionId).select('trainingRun institutionId programLevel').lean();
    if (!sub?.trainingRun) { res.status(400).json({ error: 'not a Parser Train sandbox run' }); return; }
    const isPdf = /\.pdf(\?|$)/i.test(String(imp.aiS3Key || ''));
    startAutoRefine(importId, String(sub.programLevel || 'associate'), String(sub.institutionId), isPdf);
    res.json({ ok: true, started: true, note: 'Agent is searching parse settings; poll GET /api/parser-train/:importId/refine-status.' });
  } catch (err: any) {
    console.error('[parser-train auto-refine] failed:', err);
    res.status(500).json({ error: 'auto-refine failed', detail: err?.message || String(err) });
  }
};

// GET /api/parser-train/:importId/refine-status  (SU) — the agent's trajectory.
export const refineStatusParserTrain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const state = await getRefineState(req.params.importId);
    res.json({ ok: true, state });
  } catch (err: any) {
    res.status(500).json({ error: 'refine-status failed', detail: err?.message || String(err) });
  }
};

// POST /api/parser-train/:importId/note  (SU) — attach a note (+ optional
// screenshot data URI) to a card/spec of a training run (#5). Persists against
// the run in parserTrainState.notes[].
export const addParserTrainNote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const importId = req.params.importId;
    const { std, spec, ruleId, note, screenshot } = req.body || {};
    if (!note && !screenshot) { res.status(400).json({ error: 'note or screenshot required' }); return; }
    const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
    if (!imp) { res.status(404).json({ error: 'import not found' }); return; }
    const sub: any = await Submission.findById(imp.submissionId).select('trainingRun').lean();
    if (!sub?.trainingRun) { res.status(400).json({ error: 'not a Parser Train sandbox run' }); return; }
    // cap screenshot size (base64 data URI) so the state doc stays bounded (~2MB)
    const shot = typeof screenshot === 'string' && screenshot.length < 3_000_000 ? screenshot : undefined;
    const entry = { at: new Date().toISOString(), std: std ?? null, spec: spec ?? null, ruleId: ruleId ?? null, note: String(note || ''), screenshot: shot };
    await Submission.updateOne({ _id: imp.submissionId }, { $push: { 'parserTrainState.notes': entry } });
    res.json({ ok: true, note: { ...entry, screenshot: shot ? '[stored]' : undefined } });
  } catch (err: any) {
    console.error('[parser-train note] failed:', err);
    res.status(500).json({ error: 'note failed', detail: err?.message || String(err) });
  }
};

// POST /api/parser-train/mark-goldens-green  (SU) — the passing golden suite
// stamps this so global rule activation is unlocked for the TTL window (#7).
export const markGoldensGreen = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const detail = String(req.body?.detail || 'golden regression green');
    await ParserTrainGuard.updateOne({ key: 'singleton' }, { $set: { key: 'singleton', goldensGreenAt: new Date(), detail } }, { upsert: true });
    res.json({ ok: true, goldensGreenAt: new Date() });
  } catch (err: any) {
    res.status(500).json({ error: 'mark-goldens-green failed', detail: err?.message || String(err) });
  }
};

// GET /api/parser-train/guard  (SU) — current golden-guard freshness.
export const getGuard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  const guard: any = await ParserTrainGuard.findOne({ key: 'singleton' }).lean();
  const at = guard?.goldensGreenAt ? new Date(guard.goldensGreenAt).getTime() : 0;
  res.json({ ok: true, goldensGreenAt: guard?.goldensGreenAt || null, fresh: at > 0 && Date.now() - at < GOLDEN_GUARD_TTL_MS });
};

// GET /api/parser-train/:importId/review-page  (SU) — the dated per-run review
// page (#8): findings + synthesized rules + learning trajectory, as a report.
export const getReviewPage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const importId = req.params.importId;
    const imp: any = await SelfStudyImport.findById(importId).select('submissionId originalFilename').lean();
    if (!imp) { res.status(404).json({ error: 'import not found' }); return; }
    const sub: any = await Submission.findById(imp.submissionId).select('trainingRun institutionId programLevel parserTrainState createdAt').lean();
    if (!sub?.trainingRun) { res.status(400).json({ error: 'not a Parser Train sandbox run' }); return; }
    const contract = await checkParserContract(importId);
    const rules = await ParserRule.find({ createdFromImportId: imp._id }).select('ruleId status extract match description confidence').lean();
    const now = new Date();
    res.json({
      ok: true,
      reviewPage: {
        title: `Parser Train review — ${imp.originalFilename || 'document'}`,
        date: now.toISOString().slice(0, 10),
        generatedAt: now.toISOString(),
        programLevel: sub.programLevel,
        format: contract.format,
        summary: {
          specsWithContent: contract.coverage.specsWithContent,
          catalogSpecs: contract.coverage.catalogSpecs,
          unplacedTags: contract.coverage.unplacedTags,
          anchorsTotal: contract.anchors.totalItems,
          anchorsMissing: contract.anchors.missing.length,
          fileTypes: contract.fileTypes,
        },
        findings: contract.findings,
        learningTrajectory: sub.parserTrainState || null,
        rules: rules.map((r: any) => ({ ruleId: r.ruleId, status: r.status, target: r.extract?.params, classification: r.extract?.classification, forceFormat: r.extract?.forceFormat, signature: r.match?.signature, description: r.description, confidence: r.confidence })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'review-page failed', detail: err?.message || String(err) });
  }
};

// GET /api/parser-train/runs  (SU) — list sandbox training runs.
export const listParserTrainRuns = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isSU(req)) { res.status(403).json({ error: 'Parser Train is superuser-only' }); return; }
  try {
    const runs = await Submission.find({ trainingRun: true })
      .select('submissionId programLevel status createdAt')
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: 'list failed', detail: err?.message || String(err) });
  }
};

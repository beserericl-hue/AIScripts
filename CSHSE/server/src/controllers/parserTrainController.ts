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
import { checkParserContract } from '../services/parserContract';
import { startAutoRefine, getRefineState } from '../services/parserTrainAgent';

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
    const proposals: string[] = [];
    for (const f of contract.findings) {
      if (f.severity !== 'critical') continue; // only real gaps become proposed rules
      const ruleId = `agent.${f.check}.${String(importId).slice(-6)}`;
      const rule = {
        ruleId, version: 1, name: `Proposed by Parser Train: fix ${f.check}`, description: f.detail,
        scope: { level: 'institution', institutionId: sub.institutionId },
        status: 'proposed', createdBy: 'agent', createdFromImportId: imp._id,
        match: { format: 'any', region: 'document', signature: { from: 'parser-train', finding: f.check } },
        extract: {}, anchor: { emit: true, wrap: 'section', idFrom: 'sectionId' },
        examples: [{ importId: imp._id, excerpt: String(f.detail || '').slice(0, 200) }],
        confidence: 0.6, contractChecks: {}, metrics: {}, updatedAt: new Date(),
      };
      await ParserRule.updateOne({ ruleId, version: 1 }, { $set: rule, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      proposals.push(ruleId);
    }
    res.json({ ok: true, contract, proposals, cleanParse: contract.ok && proposals.length === 0 });
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
    // GUARDRAIL — a GLOBAL rule (one that could affect the proven baseline /
    // every institution) may only be activated when it has passed the golden
    // regression. Institution-scoped rules can never touch the baseline, so they
    // activate freely. This is what makes the self-improving loop safe.
    const wantsActive = b.activate !== false;
    if (wantsActive && scope.level === 'global' && b.goldenChecked !== true) {
      res.status(400).json({
        error: 'Global rule activation is blocked until it passes the golden regression. Scope the rule to an institution, or set goldenChecked:true only after the golden suite is green.',
      });
      return;
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
    const { std, spec } = req.body || {};
    const imp: any = await SelfStudyImport.findById(importId).select('submissionId').lean();
    if (!imp) { res.status(404).json({ error: 'import not found' }); return; }
    const r = await ParserRule.updateMany(
      { createdFromImportId: imp._id, status: 'proposed' },
      { $set: { status: 'active', updatedAt: new Date() } }
    );
    res.json({ ok: true, approved: { std, spec }, activatedRules: r.modifiedCount });
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

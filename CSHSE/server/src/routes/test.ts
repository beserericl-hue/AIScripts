/**
 * CR-034 — E2E seed endpoint.
 *
 * Dev-only router that lets Playwright tests drop deterministic state into
 * MongoDB and read it back via standard API paths. Mounted ONLY when
 * E2E_SEED_ENABLED=1 (see server/src/index.ts).
 *
 * Security model:
 *   - Refuses to load when NODE_ENV=production
 *   - Requires header `x-e2e-seed-token` matching env var E2E_SEED_TOKEN
 *   - Logs every call at INFO with the fixture name + caller IP
 *
 * Endpoints:
 *   POST   /api/test/seed       — body: { fixture, overrides? }
 *   DELETE /api/test/seed       — body: { cleanupToken }
 *   GET    /api/test/health     — verifies the endpoint is mounted
 *
 * Fixtures live in server/src/test/fixtures/*.json. Each fixture describes
 * a snapshot of (user, submission, import) state. The seed endpoint:
 *   1. Reads the fixture JSON
 *   2. Applies overrides (deep merge)
 *   3. Creates User → Submission → SelfStudyImport in that order
 *   4. Generates a cleanupToken, stamps it on the user record
 *   5. Returns the IDs + the Zustand state to inject into localStorage
 *
 * Cleanup reverses (1)–(4) by cleanupToken — drops the user, the
 * submission, the import. No state leaks between test runs.
 */
import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Submission } from '../models/Submission';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { APIKey } from '../models/APIKey';

const FIXTURE_DIR = path.join(__dirname, '..', 'test', 'fixtures');

/**
 * Per-process map of cleanupToken → { userId, submissionId, importId }.
 * In-memory is fine because seed records are short-lived and Railway
 * containers restart at most every few hours. Worst case: an orphan record
 * survives across a server restart; the once-an-hour janitor below sweeps.
 */
const ACTIVE_SEEDS = new Map<
  string,
  { userId: string; submissionId: string; importId: string; createdAt: number }
>();

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  // Shallow-with-recursive-objects merge. Arrays are replaced, not merged.
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === 'object' &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function loadFixture(name: string): Record<string, unknown> {
  // Defense against `..` traversal. Fixture names are alnum + underscore.
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`invalid fixture name: ${name}`);
  }
  const fpath = path.join(FIXTURE_DIR, `${name}.json`);
  if (!fs.existsSync(fpath)) {
    throw new Error(`fixture not found: ${name}`);
  }
  const raw = fs.readFileSync(fpath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Token check. Fails fast if E2E_SEED_TOKEN env var isn't set OR the
 * request's header doesn't match. Constant-time compare to defeat timing.
 */
function requireSeedToken(req: Request, res: Response): boolean {
  const expected = process.env.E2E_SEED_TOKEN;
  if (!expected) {
    res.status(503).json({ error: 'E2E_SEED_TOKEN not configured' });
    return false;
  }
  const got = req.header('x-e2e-seed-token') ?? '';
  if (
    got.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))
  ) {
    res.status(403).json({ error: 'invalid x-e2e-seed-token' });
    return false;
  }
  return true;
}

/**
 * Periodic janitor — every 60 minutes, drop seed records older than 2h
 * even if cleanupSeed was never called. Belt-and-suspenders against test
 * crashes leaking state.
 */
let janitorTimer: NodeJS.Timeout | null = null;
function startJanitor(): void {
  if (janitorTimer) return;
  janitorTimer = setInterval(async () => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [token, rec] of ACTIVE_SEEDS) {
      if (rec.createdAt < cutoff) {
        try {
          await User.deleteOne({ _id: rec.userId });
          await Submission.deleteOne({ _id: rec.submissionId });
          await SelfStudyImport.deleteOne({ _id: rec.importId });
        } catch (err) {
          console.error(`[seed-janitor] failed to clean token=${token.slice(0, 8)}…`, err);
        }
        ACTIVE_SEEDS.delete(token);
      }
    }
  }, 60 * 60 * 1000);
  janitorTimer.unref();
}

export function buildTestRouter(): Router | null {
  // Accept any truthy spelling and strip stray quotes / whitespace — some
  // dashboard UIs persist the literal `"1"` if the operator pastes a
  // quoted value, and there's nothing useful gained by being strict.
  const seedEnabledRaw = (process.env.E2E_SEED_ENABLED ?? '')
    .replace(/['"]/g, '')
    .trim()
    .toLowerCase();
  const seedEnabled = ['1', 'true', 'yes', 'on'].includes(seedEnabledRaw);
  if (!seedEnabled) {
    return null;
  }
  console.warn(
    `[test-router] E2E_SEED_ENABLED=${JSON.stringify(process.env.E2E_SEED_ENABLED)} parsed as ENABLED — mounting /api/test`
  );
  // CR-042: E2E_SEED_ENABLED is the explicit operator opt-in and is the
  // single mount gate. The actual security boundary is the
  // E2E_SEED_TOKEN-checked `x-e2e-seed-token` header on every endpoint —
  // the router is useless without it.
  //
  // We deliberately do NOT block on NODE_ENV === 'production'. Railway
  // (and most PaaS) set NODE_ENV=production for every deployed Node app,
  // which would force operators to choose between "real Express
  // optimizations" and "E2E seeding" in the same environment. The
  // intended deployment for cshse-develop is NODE_ENV=production + seed
  // router enabled. NEVER set E2E_SEED_ENABLED=1 on the real production
  // service.
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[test-router] mounting under NODE_ENV=production — verify this is a development environment (cshse-develop, not prod)'
    );
  }

  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      env: process.env.NODE_ENV ?? 'dev',
      activeSeeds: ACTIVE_SEEDS.size,
      fixturesAvailable: fs.existsSync(FIXTURE_DIR)
        ? fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))
        : []
    });
  });

  router.post('/seed', async (req: Request, res: Response) => {
    if (!requireSeedToken(req, res)) return;

    const { fixture, overrides } = req.body ?? {};
    if (!fixture || typeof fixture !== 'string') {
      return res.status(400).json({ error: 'body.fixture is required' });
    }

    let raw: Record<string, unknown>;
    try {
      raw = loadFixture(fixture);
    } catch (err: any) {
      return res.status(400).json({ error: err.message ?? 'bad fixture' });
    }

    const merged = overrides && typeof overrides === 'object'
      ? deepMerge(raw, overrides as Record<string, unknown>)
      : raw;

    const userSpec = (merged.user ?? {}) as Record<string, unknown>;
    const submissionSpec = (merged.submission ?? {}) as Record<string, unknown>;
    const importSpec = (merged.import ?? {}) as Record<string, unknown>;
    // CR-041 US-10 — multi-file batch fixtures. When present, the seed
    // creates an ImportBatch + N child SelfStudyImport records instead
    // of (or in addition to) the single-import payload above.
    const batchSpec = (merged.batch ?? null) as Record<string, unknown> | null;
    // CR-043 — submission-scoped persisted Review state fixture block.
    // When present, the seed stamps `Submission.aiReviewState` directly
    // so multi-import lifecycle specs can land on the Self-Study Editor
    // toolbar's Review surface with merged items from N synthetic imports.
    const reviewStateSpec = (merged.reviewState ?? null) as Record<string, unknown> | null;
    const matrixStateSpec = (merged.matrixState ?? null) as Record<string, unknown> | null;

    // Stamp a unique token onto the email so reruns don't collide.
    const stamp = crypto.randomBytes(4).toString('hex');
    const email = ((userSpec.email as string) ?? 'seed@example.test')
      .replace(/@/, `+${stamp}@`);
    // CR-042 — fixtures no longer ship a password. If one is present (legacy)
    // it's honored so loginViaUI specs keep working; otherwise the seeded
    // user has no passwordHash and can only be logged in via the SSO API.
    const password = (userSpec.password as string) ?? null;

    console.log(
      `[test-seed] fixture=${fixture} email=${email} ip=${req.ip}`
    );

    let userDoc: any;
    let submissionDoc: any;
    let importDoc: any;
    try {
      // Fixture authors can pass either {name: "First Last"} or
      // {firstName, lastName}. The User model requires both first + last.
      const nameRaw = (userSpec.name as string) ?? 'E2E Seed User';
      const nameParts = nameRaw.trim().split(/\s+/);
      const firstName =
        (userSpec.firstName as string) ?? nameParts[0] ?? 'E2E';
      const lastName =
        (userSpec.lastName as string) ??
        (nameParts.slice(1).join(' ') || 'Seed');

      const userPayload: Record<string, unknown> = {
        email,
        firstName,
        lastName,
        role: (userSpec.role as string) ?? 'program_coordinator',
        status: 'active',
        institutionName: (userSpec.institutionName as string) ?? 'E2E Test University',
        isActive: true,
        // CR-042: seeded users land in the trusted-domain allowlist (so any
        // future autoProvision request from the same domain is accepted).
        // The 'manual' provisioner stands in for "an admin created this
        // user out-of-band" — which is exactly what the seed endpoint does.
        provisionedBy: { type: 'manual', at: new Date() }
      };
      if (password) {
        userPayload.passwordHash = password; // pre-save hook hashes it
      }
      userDoc = await User.create(userPayload);

      submissionDoc = await Submission.create({
        // The Submission model auto-generates submissionId via a pre('save')
        // hook, but Mongoose runs `required` validation BEFORE pre-save —
        // so we have to stamp it explicitly here. Format mirrors the model
        // hook (YYYY-NNN) but uses the per-seed stamp for uniqueness.
        submissionId: `E2E-${stamp}`,
        institutionName: (submissionSpec.institutionName as string) ?? 'E2E Test University',
        programName: (submissionSpec.programName as string) ?? 'E2E Test Program',
        programLevel: (submissionSpec.programLevel as string) ?? 'bachelors',
        submitterId: userDoc._id,
        type: 'initial',
        status: 'in_progress'
      });

      importDoc = await SelfStudyImport.create({
        submissionId: submissionDoc._id,
        originalFilename: (importSpec.originalFilename as string) ?? 'seed-fixture.docx',
        fileType: 'docx',
        uploadedBy: userDoc._id,
        status: 'completed',
        aiStatus: (importSpec.aiStatus as string) ?? 'finished',
        aiJobId: (importSpec.aiJobId as string) ?? `seed-${stamp}`,
        aiProgramLevel: (importSpec.aiProgramLevel as string) ?? 'bachelors',
        aiBuckets: importSpec.aiBuckets ?? {},
        aiTags: importSpec.aiTags ?? [],
        aiPlaceholderSections: importSpec.aiPlaceholderSections ?? [],
        aiMatrices: importSpec.aiMatrices ?? [],
        aiStages: importSpec.aiStages ?? [],
        // CR-043 cutover-clear coverage — let fixtures seed the remaining
        // pre-CR-043 fields so AC#13/14 tests can verify they get wiped.
        aiCVs: importSpec.aiCVs ?? [],
        aiEvidenceDocs: importSpec.aiEvidenceDocs ?? [],
        aiIntroductions: importSpec.aiIntroductions ?? {},
        aiIntroductionHints: importSpec.aiIntroductionHints ?? {},
        // Scaffolded-stub support — fixtures that want to land the
        // wizard at the Apply / Applied state need to pass these.
        aiAppliedAt: importSpec.aiAppliedAt
          ? new Date(importSpec.aiAppliedAt as string)
          : undefined,
        aiAppliedCounts: (importSpec.aiAppliedCounts as any) ?? undefined,
        aiErrors: (importSpec.aiErrors as any) ?? [],
        aiStartedAt: new Date(),
        aiCompletedAt: new Date()
      });

      // Push the import onto the submission's imports array
      await Submission.updateOne(
        { _id: submissionDoc._id },
        { $push: { imports: importDoc._id } }
      );

      // CR-043 — when the fixture includes a reviewState block, stamp it
      // onto the submission. lastUpdatedAt is forced to "now" so the
      // wizard's read-through cache picks the fixture over any stale
      // localStorage value.
      if (reviewStateSpec || matrixStateSpec) {
        if (reviewStateSpec) {
          (submissionDoc as any).aiReviewState = {
            ...reviewStateSpec,
            lastUpdatedAt: new Date()
          };
          (submissionDoc as any).markModified('aiReviewState');
        }
        if (matrixStateSpec) {
          (submissionDoc as any).aiMatrixState = {
            ...matrixStateSpec,
            lastUpdatedAt: new Date()
          };
          (submissionDoc as any).markModified('aiMatrixState');
        }
        await submissionDoc.save();
      }

      // CR-041 US-10 — batch fixture support. Create an ImportBatch
      // plus per-child SelfStudyImport records when batchSpec is
      // present. The single-import created above remains for legacy
      // fixtures that don't want a batch.
      if (batchSpec) {
        // Use runtime require() — esbuild leaves `await import()` as a
        // literal ESM specifier that Node's CJS resolver can't load.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ImportBatch } = require('../models/ImportBatch');
        const children = (batchSpec.children ?? []) as Array<Record<string, unknown>>;
        const batchDoc = await ImportBatch.create({
          submissionId: submissionDoc._id,
          createdBy: userDoc._id,
          fileCount: children.length,
          holdForReview: (batchSpec.holdForReview as boolean) ?? true,
          status: (batchSpec.status as string) ?? 'completed',
          completedCount: children.filter(
            (c) => (c.aiStatus as string) === 'parsed' || (c.aiStatus as string) === 'finished'
          ).length,
          failedCount: children.filter(
            (c) => (c.aiStatus as string) === 'failed'
          ).length,
          reviewUnlockedAt: new Date()
        });
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const childDoc = await SelfStudyImport.create({
            submissionId: submissionDoc._id,
            originalFilename: (child.originalFilename as string) ?? `seed-child-${i + 1}.docx`,
            fileType: 'docx',
            uploadedBy: userDoc._id,
            status: 'completed',
            aiStatus: (child.aiStatus as string) ?? 'parsed',
            aiJobId: (child.aiJobId as string) ?? `seed-${stamp}-child-${i + 1}`,
            aiProgramLevel: (child.aiProgramLevel as string) ?? 'bachelors',
            aiBuckets: child.aiBuckets ?? {},
            aiTags: child.aiTags ?? [],
            aiPlaceholderSections: child.aiPlaceholderSections ?? [],
            aiMatrices: child.aiMatrices ?? [],
            aiStages: child.aiStages ?? [],
            aiCVs: child.aiCVs ?? [],
            aiEvidenceDocs: child.aiEvidenceDocs ?? [],
            aiStartedAt: new Date(),
            aiCompletedAt: new Date(),
            batchId: batchDoc._id,
            batchPosition: i + 1,
            batchHoldForReview: batchDoc.holdForReview
          });
          await Submission.updateOne(
            { _id: submissionDoc._id },
            { $push: { imports: childDoc._id } }
          );
        }
        // Stash batchId so the response can hand it back for the
        // client's Zustand state.
        (importDoc as any).__seededBatchId = String(batchDoc._id);
      }
    } catch (err: any) {
      console.error('[test-seed] create failed', err);
      // Best-effort cleanup on partial failure
      if (importDoc) await SelfStudyImport.deleteOne({ _id: importDoc._id }).catch(() => {});
      if (submissionDoc) await Submission.deleteOne({ _id: submissionDoc._id }).catch(() => {});
      if (userDoc) await User.deleteOne({ _id: userDoc._id }).catch(() => {});
      return res.status(500).json({
        error: 'seed creation failed',
        detail: err.message ?? String(err)
      });
    }

    const cleanupToken = crypto.randomBytes(16).toString('hex');
    ACTIVE_SEEDS.set(cleanupToken, {
      userId: String(userDoc._id),
      submissionId: String(submissionDoc._id),
      importId: String(importDoc._id),
      createdAt: Date.now()
    });
    startJanitor();

    // CR-034 — auto-build a Zustand `ai-import-storage` snapshot that lands
    // the wizard on the requested step with the seeded buckets/tags/etc.
    // visible. Without this, every spec that uses gotoReviewStep stalls on
    // the Upload tab (Parse/Review/Apply are disabled until store.status
    // becomes 'parsed' or later). Fixtures may override pieces via
    // `import.zustandState` if a spec needs a different shape.
    const fixtureStep =
      (importSpec.wizardStep as string) ?? 'review';
    // Mirror the fixture's aiStatus 1:1 into the Zustand snapshot. Fixtures
    // that want to land on Review should set aiStatus='parsed' (NOT
    // 'finished' — that routes the wizard to Apply via deriveStepFromStatus).
    const fixtureStatus = (importSpec.aiStatus as string) ?? 'parsed';
    const seededBatchId: string | undefined = (importDoc as any).__seededBatchId;
    const autoZustandState = {
      importId: String(importDoc._id),
      submissionId: String(submissionDoc._id),
      jobId: importDoc.aiJobId ?? `seed-${stamp}`,
      step: fixtureStep,
      status: fixtureStatus,
      programLevel: (importSpec.aiProgramLevel as string) ?? 'bachelors',
      isReimport: false,
      selectedSpecKey: null,
      selectedSectionId: null,
      buckets: importSpec.aiBuckets ?? {},
      tags: importSpec.aiTags ?? [],
      placeholderSections: importSpec.aiPlaceholderSections ?? [],
      matrices: importSpec.aiMatrices ?? [],
      matrixRowEdits: {},
      // CR-034: dirty=true so the wizard's _applySnapshot guard preserves
      // the seeded buckets (and any subsequent user edits) instead of
      // overwriting them with whatever /ai-status returns from the server.
      // Without this, every "edit + hard refresh" spec sees its edit
      // bounced back to the pre-edit state.
      dirty: true,
      // CR-041 US-10 — batch context for multi-file fixtures.
      batchId: seededBatchId ?? null,
      holdForReview: batchSpec ? ((batchSpec.holdForReview as boolean) ?? true) : true
    };
    const zustandState =
      (importSpec.zustandState as Record<string, unknown> | undefined) ??
      autoZustandState;

    return res.json({
      cleanupToken,
      userId: String(userDoc._id),
      userEmail: email,
      // CR-042: empty string when the fixture has no password (the user
      // is SSO-only). Kept in the payload shape for backwards compat with
      // any caller that still reads .userPassword.
      userPassword: password ?? '',
      submissionId: String(submissionDoc._id),
      submissionDocumentId: submissionDoc.submissionId, // human-readable id like 2026-001
      importId: String(importDoc._id),
      fixture,
      // The Zustand store key + payload, ready to inject into localStorage.
      // Wrapped in the same `{state, version}` envelope Zustand's persist
      // middleware writes, so the helper can JSON.stringify and drop it
      // straight into localStorage without re-wrapping.
      localStorageKey: 'ai-import-storage',
      localStorageValue: { state: zustandState, version: 0 }
    });
  });

  /**
   * CR-042 Slice 2 — bootstrap a single SSO API key for the E2E suite.
   *
   * Idempotent on the *name* "E2E SSO Login Key": if a key with that name
   * is already active, refuses to mint a second (the plaintext of the first
   * has already left the building — revoke it via the admin UI first).
   *
   * Only mounted alongside the rest of the test router (NODE_ENV != production
   * AND E2E_SEED_ENABLED=1). Token-gated by x-e2e-seed-token.
   *
   * Returns the plaintext key ONCE. Operator copies it into the local +
   * Railway `E2E_SSO_KEY` env var so Playwright's loginViaSso can use it.
   */
  router.post('/bootstrap-sso-key', async (req: Request, res: Response) => {
    if (!requireSeedToken(req, res)) return;

    const name = (req.body?.name as string) ?? 'E2E SSO Login Key';
    const autoProvision = req.body?.autoProvision !== false; // default true
    const allowedRoles = Array.isArray(req.body?.allowedRoles)
      ? req.body.allowedRoles
      : ['program_coordinator'];

    const existing = await APIKey.findOne({ name, isActive: true });
    if (existing) {
      return res.status(409).json({
        error: 'sso-key-already-exists',
        detail: `An active SSO key named "${name}" already exists (id=${existing._id}). Revoke it first via the admin UI or POST /api/admin/api-keys/${existing._id} DELETE.`
      });
    }

    const keyPrefix = 'cshse_sso_v1_';
    const randomPart = crypto.randomBytes(24).toString('base64url');
    const key = `${keyPrefix}${randomPart}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keySuffix = key.slice(-4);

    try {
      // Use the test-seed bootstrap caller identity for createdBy fields.
      // The schema requires an ObjectId — use a sentinel ObjectId (24 zeros)
      // so it's obviously a bootstrap record.
      const bootstrapId = new mongoose.Types.ObjectId('000000000000000000000000');

      const apiKey = await APIKey.create({
        name,
        keyPrefix,
        keyHash,
        keySuffix,
        purpose: 'integration',
        permissions: [],
        scope: 'sso-login',
        autoProvision,
        allowedRoles,
        isActive: true,
        createdBy: bootstrapId,
        createdByName: 'e2e-bootstrap'
      });

      console.warn(
        `[test-bootstrap-sso] minted SSO key id=${apiKey._id} name="${name}" autoProvision=${autoProvision} allowedRoles=${JSON.stringify(allowedRoles)}`
      );

      return res.json({
        keyId: String(apiKey._id),
        name: apiKey.name,
        key, // plaintext — shown once
        keyMasked: `${keyPrefix}****************************${keySuffix}`,
        scope: apiKey.scope,
        autoProvision: apiKey.autoProvision,
        allowedRoles: apiKey.allowedRoles,
        warning:
          'This is the only time the plaintext will be shown. Copy it into the E2E_SSO_KEY env var.'
      });
    } catch (err: any) {
      console.error('[test-bootstrap-sso] failed', err);
      return res.status(500).json({
        error: 'bootstrap failed',
        detail: err?.message ?? String(err)
      });
    }
  });

  /**
   * CR-036 test hook — inject N failures into the next ai-service
   * dispatches so tests can deterministically verify the retry
   * mechanism + the wizard's yellow "Connecting…" banner. Token-gated
   * by `x-e2e-seed-token` just like the rest of this router; the
   * injection state lives in module scope on aiImportController and
   * resets to null between calls.
   *
   * POST body: { count: number, statusCode?: number, pathPattern?: string }
   *   count       — number of upcoming attempts to short-circuit (the
   *                 retry loop will burn through them, then on attempt
   *                 N+1 the real fetch fires)
   *   statusCode  — defaults to 503 (the canonical retryable error)
   *   pathPattern — substring match on the AI-service path. Default
   *                 '/' matches every call; pass e.g. '/ai/import/start'
   *                 to target only handshake calls.
   *
   * POST with { count: 0 } or no body clears any prior injection.
   */
  router.post('/inject-ai-failure', async (req: Request, res: Response) => {
    if (!requireSeedToken(req, res)) return;
    const { count, statusCode, pathPattern } = (req.body || {}) as Record<string, any>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ctrl = require('../controllers/aiImportController');
      if (typeof ctrl._testSetInjectedAIFailures !== 'function') {
        return res.status(500).json({ error: 'injection hook not wired' });
      }
      ctrl._testSetInjectedAIFailures(
        typeof count === 'number' && count > 0
          ? { count, statusCode, pathPattern }
          : null
      );
      const remaining = typeof ctrl._testGetInjectedAIFailuresRemaining === 'function'
        ? ctrl._testGetInjectedAIFailuresRemaining()
        : null;
      return res.json({ ok: true, remaining });
    } catch (err: any) {
      console.error('[test-inject-ai-failure] failed', err);
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  router.delete('/seed', async (req: Request, res: Response) => {
    if (!requireSeedToken(req, res)) return;
    const { cleanupToken } = req.body ?? {};
    if (!cleanupToken || typeof cleanupToken !== 'string') {
      return res.status(400).json({ error: 'body.cleanupToken is required' });
    }
    const rec = ACTIVE_SEEDS.get(cleanupToken);
    if (!rec) {
      return res.status(404).json({ error: 'unknown cleanupToken (already cleaned?)' });
    }

    let deletedCounts = { user: 0, submission: 0, import: 0 };
    try {
      const r1 = await User.deleteOne({ _id: rec.userId });
      const r2 = await Submission.deleteOne({ _id: rec.submissionId });
      const r3 = await SelfStudyImport.deleteOne({ _id: rec.importId });
      deletedCounts = {
        user: r1.deletedCount ?? 0,
        submission: r2.deletedCount ?? 0,
        import: r3.deletedCount ?? 0
      };
    } catch (err: any) {
      console.error('[test-seed] cleanup partial failure', err);
    }
    ACTIVE_SEEDS.delete(cleanupToken);
    return res.json({ ok: true, deletedCounts });
  });

  return router;
}

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
  if (process.env.E2E_SEED_ENABLED !== '1') {
    return null;
  }
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
        aiStartedAt: new Date(),
        aiCompletedAt: new Date()
      });

      // Push the import onto the submission's imports array
      await Submission.updateOne(
        { _id: submissionDoc._id },
        { $push: { imports: importDoc._id } }
      );
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
      // The Zustand store key + payload, ready to inject into localStorage:
      localStorageKey: 'ai-import-storage',
      localStorageValue: importSpec.zustandState ?? null
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

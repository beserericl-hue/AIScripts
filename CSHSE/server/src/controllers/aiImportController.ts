/**
 * AI Import Wizard — server-side controller (Sprint 1, sub-sprint 1.a).
 *
 * Endpoints:
 *   POST /api/imports/:importId/start-ai           — kick off a cshse-ai job
 *   GET  /api/imports/:importId/ai-status          — snapshot (polling fallback)
 *   GET  /api/imports/:importId/ai-events          — SSE primary live updates
 *   POST /api/imports/:importId/apply-ai           — commit writes (stub in 1.a)
 *   POST /api/imports/:importId/restart-ai         — change format + re-run
 *   POST /api/imports/:importId/ai-event           — webhook from cshse-ai (signed)
 *   POST /api/imports/:importId/ai-callback        — terminal webhook (signed)
 *
 * SSE fan-out is in-memory per process. v2 moves it to Redis pub/sub if
 * we need multi-instance scale-out — UI spec §21.1 covers the Railway
 * proxy verification deferred to sub-sprint 1.a's smoke phase.
 */
import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { Submission, INarrativeContent } from '../models/Submission';
// Static import (was runtime require() / await import()) — both dynamic forms
// fail to resolve the relative TS/JS path in one of the two runtimes (vitest vs
// the compiled dist build), silently no-op'ing the evidence packaging in a
// swallowing try/catch. A static import resolves correctly in BOTH.
import { SupportingEvidence } from '../models/SupportingEvidence';
// Static import (was runtime require() — esbuild compiles to CJS just
// fine here and vitest's TS resolver picks it up under test, whereas
// the dynamic require missed the .ts extension in the test env and
// silently no-op'd the CR-043 merge with a 'Cannot find module' that
// the surrounding try/catch swallowed).
import * as aiReviewMerge from '../services/aiReviewMerge';
import * as gridFsService from '../services/gridFsService';
// Static import to mirror the batchAdvancer fix — runtime require()
// silently no-op'd under vitest because the .ts extension didn't
// resolve. ESM partial-binding handles the circular reference because
// advanceBatch is only called inside the receiveAICallback function
// body, not at module load time.
import * as batchAdvancerService from '../services/batchAdvancer';
import {
  CurriculumMatrix,
  ICourseEntry,
  ICourseAssessment,
  IStandardMapping,
  CoverageType,
  CoverageDepth
} from '../models/CurriculumMatrix';
import {
  ImportCorrection,
  CorrectionType,
  ExpectedSectionType
} from '../models/ImportCorrection';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireImportAccess, requireCanImport } from '../services/submissionAccessGuard';
import { checkParserContract } from '../services/parserContract';

// CR-040 Phase 2c — escape user-supplied strings for the evidenceDoc
// HTML wrapper we generate at Apply time. Captures the five characters
// that close out an HTML attribute value or open a script tag.
function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Env vars read lazily so tests that set them in beforeEach see the new value.
function getAIServiceUrl(): string {
  return process.env.AI_SERVICE_URL || 'http://ai-service.railway.internal:8080';
}

function getAIServiceSecret(): string {
  return process.env.NODE_SERVICE_HMAC_SECRET || '';
}

function getServerPublicUrl(): string {
  const raw = process.env.SERVER_PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3001';
  // RAILWAY_PUBLIC_DOMAIN is always scheme-less (e.g. "cshse.courseworx.media").
  // cshse-ai's HTTP client rejects scheme-less webhook URLs (UnsupportedProtocol),
  // which silently strands every import. Normalize to an absolute https:// URL.
  const trimmed = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// ============================================================================
// HMAC helpers (matches ai-service/app/auth.py format: t=<unix>,v1=<hex>)
// ============================================================================

function signOutgoing(body: string): { ts: string; signature: string } {
  const secret = getAIServiceSecret();
  const ts = Math.floor(Date.now() / 1000).toString();
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${body}`)
    .digest('hex');
  return { ts, signature: `t=${ts},v1=${digest}` };
}

function verifyIncoming(req: Request, rawBody: Buffer): boolean {
  const secret = getAIServiceSecret();
  if (!secret) {
    console.warn('[ai-import] NODE_SERVICE_HMAC_SECRET not set; rejecting webhook');
    return false;
  }
  const sig = req.headers['x-service-signature'];
  if (typeof sig !== 'string') return false;
  const parts: Record<string, string> = {};
  for (const piece of sig.split(',')) {
    const [k, v] = piece.split('=', 2);
    if (k && v) parts[k] = v;
  }
  if (!parts.t || !parts.v1) return false;
  const ts = parseInt(parts.t, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.`)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'));
  } catch {
    return false;  // length mismatch on Buffer.from when v1 isn't valid hex
  }
}

// ============================================================================
// SSE fan-out — in-memory map from importId to connected client streams
// ============================================================================

type SSEClient = {
  id: string;
  res: Response;
};

const sseClients: Map<string, Set<SSEClient>> = new Map();

function addSSEClient(importId: string, client: SSEClient): void {
  let set = sseClients.get(importId);
  if (!set) {
    set = new Set();
    sseClients.set(importId, set);
  }
  set.add(client);
}

function removeSSEClient(importId: string, client: SSEClient): void {
  const set = sseClients.get(importId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) sseClients.delete(importId);
}

function broadcastSSE(importId: string, payload: object): void {
  const set = sseClients.get(importId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  for (const client of set) {
    try {
      client.res.write(`event: status\ndata: ${data}\n\n`);
    } catch (err) {
      // The connection is gone; cleanup handler will run via 'close'.
    }
  }
}

// Periodic ping to keep proxies from idling out long-running parse streams.
setInterval(() => {
  for (const set of sseClients.values()) {
    for (const client of set) {
      try {
        client.res.write(`event: ping\ndata: {}\n\n`);
      } catch {
        // ignored — client is gone
      }
    }
  }
}, 30_000);

// ============================================================================
// Helpers
// ============================================================================

function buildSnapshotFromImport(importRecord: any): object {
  return {
    status: importRecord.aiStatus || 'idle',
    queuePosition: importRecord.aiQueuePosition ?? null,
    queueDepth: importRecord.aiQueueDepth ?? null,
    etaSeconds: importRecord.aiEtaSeconds ?? null,
    format: importRecord.aiFormat ?? null,
    stages: importRecord.aiStages || [],
    buckets: importRecord.aiBuckets || null,
    tags: importRecord.aiTags || null,
    matrices: importRecord.aiMatrices || null,
    placeholderSections: importRecord.aiPlaceholderSections || null,
    errors: importRecord.aiErrors || [],
    // CR-033 / CR-039 / CR-040 Phase 2b/c — surface the detector outputs
    // so the wizard's Zustand store can rehydrate them on /ai-status
    // poll + SSE without an extra fetch. cshse-server already persists
    // these fields when the terminal callback arrives.
    cvs: importRecord.aiCVs || [],
    evidenceDocs: importRecord.aiEvidenceDocs || [],
    introductionHints: importRecord.aiIntroductionHints || {},
    // CR-033 Phase 2c part 2 — standalone-CV mode flag.
    standaloneCv: !!importRecord.aiStandaloneCv,
    // CR-040 Phase 3b — coverage report (byte-level census +
    // boundary warnings + missing fragments).
    coverageReport: importRecord.aiCoverageReport || null
  };
}

/**
 * CR-036 — exponential-backoff retries on the cshse-server → ai-service
 * handshake. ai-service runs on Railway's free-tier sleep schedule and can
 * take 5-15 seconds to wake up; without retries, the first /ai/import/start
 * after a sleep returns a connection-refused or 502 and the wizard surfaces
 * a fatal red banner. Retries are constrained to the connection / 5xx
 * failure classes — 4xx responses are real errors and surface immediately.
 *
 * Retry policy:
 *   - up to 5 attempts (initial + 4 retries)
 *   - delays 500 / 1000 / 2000 / 4000 ms with ±25% jitter
 *   - any 4xx aborts immediately (legitimate caller error, never transient)
 *   - any 5xx, network error, or AbortError is retried
 */
const AI_SERVICE_MAX_ATTEMPTS = 5;
const AI_SERVICE_BASE_DELAY_MS = 500;
const AI_SERVICE_PER_ATTEMPT_TIMEOUT_MS = 30_000;

function jitter(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

/**
 * Test-only failure-injection state. Tests POST to
 * /api/test/inject-ai-failure to populate this; postToAIService below
 * consumes one entry per attempt and short-circuits the fetch. Reset
 * to null between test runs. NEVER set this in production.
 */
let _injectedAIFailures:
  | { remaining: number; statusCode: number; pathPattern: string }
  | null = null;

export function _testSetInjectedAIFailures(
  spec: { count: number; statusCode?: number; pathPattern?: string } | null
): void {
  if (!spec || spec.count <= 0) {
    _injectedAIFailures = null;
    return;
  }
  _injectedAIFailures = {
    remaining: spec.count,
    statusCode: spec.statusCode ?? 503,
    pathPattern: spec.pathPattern ?? '/',
  };
}

export function _testGetInjectedAIFailuresRemaining(): number {
  return _injectedAIFailures?.remaining ?? 0;
}

interface PostToAIServiceOptions {
  /** Per-attempt timeout in ms. Defaults to 30s. Long-running calls
   *  like /ai/import/redetect on a large DOCX need to override this —
   *  mammoth conversion + deep_walker + detector passes on a 370MB
   *  Stevenson-class document routinely exceed 30s, so the default
   *  triggers 5 retries of "aborted" before the user sees an error. */
  perAttemptTimeoutMs?: number;
  /** Max retry attempts. Defaults to 5. Long-running calls should
   *  use ``maxAttempts: 1`` so a slow response doesn't get
   *  retried-into-oblivion (the doc isn't going to convert faster
   *  on the 4th try). */
  maxAttempts?: number;
}

async function postToAIService(
  path: string,
  payload: object,
  opts: PostToAIServiceOptions = {}
): Promise<any> {
  const body = JSON.stringify(payload);
  const { signature } = signOutgoing(body);
  const perAttemptTimeoutMs = opts.perAttemptTimeoutMs ?? AI_SERVICE_PER_ATTEMPT_TIMEOUT_MS;
  const maxAttempts = opts.maxAttempts ?? AI_SERVICE_MAX_ATTEMPTS;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // CR-036 test hook — if a failure was injected for this path,
    // consume one attempt's worth without actually firing fetch. The
    // surrounding retry loop then exercises the same backoff +
    // jitter + re-attempt path it would for a real 5xx.
    if (
      _injectedAIFailures &&
      _injectedAIFailures.remaining > 0 &&
      path.includes(_injectedAIFailures.pathPattern)
    ) {
      _injectedAIFailures.remaining -= 1;
      lastError = new Error(
        `AI service ${path} returned ${_injectedAIFailures.statusCode}: [test-injected failure]`
      );
      if (attempt < maxAttempts) {
        const delay = jitter(AI_SERVICE_BASE_DELAY_MS * 2 ** (attempt - 1));
        console.warn(
          `[ai-service-retry] ${path} attempt ${attempt} test-injected ${_injectedAIFailures.statusCode}; retrying in ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perAttemptTimeoutMs);
    try {
      const res = await fetch(`${getAIServiceUrl()}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Signature': signature
        },
        body,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
      const text = await res.text();
      // 4xx = caller error, never transient. Surface immediately.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(
          `AI service ${path} returned ${res.status}: ${text.slice(0, 300)}`
        );
      }
      // 5xx is retryable.
      lastError = new Error(
        `AI service ${path} returned ${res.status}: ${text.slice(0, 300)}`
      );
    } catch (err: any) {
      clearTimeout(timer);
      // Re-throw 4xx errors as-is (those came from the inner throw above).
      if (
        err?.message &&
        /^AI service .+ returned 4\d\d:/.test(err.message)
      ) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < maxAttempts) {
      const delay = jitter(AI_SERVICE_BASE_DELAY_MS * 2 ** (attempt - 1));
      console.warn(
        `[ai-service-retry] ${path} attempt ${attempt} failed (${lastError?.message?.slice(0, 120)}); retrying in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError ?? new Error(`AI service ${path} failed without an error`);
}

// ============================================================================
// POST /api/imports/:importId/start-ai
// ============================================================================

/**
 * CR-041 US-3 — internal helper that runs the same /start-ai logic the
 * single-file flow uses, but driven by the batchAdvancer instead of an
 * incoming request. Returns the cshse-ai snapshot or throws.
 */
export async function startAIImportForBatch(
  importId: string,
  programLevel: string = 'bachelors',
  forceFormat: 'template' | 'self_study' | null = null
): Promise<void> {
  const initial = await SelfStudyImport.findById(importId).lean();
  if (!initial) throw new Error(`Import not found: ${importId}`);
  const s3Key = initial.aiS3Key || `imports/${importId}/source.docx`;
  const submissionDoc = await Submission.findById(initial.submissionId)
    .select('institutionId')
    .lean();
  const institutionIdStr = submissionDoc?.institutionId
    ? String(submissionDoc.institutionId)
    : null;
  await SelfStudyImport.findByIdAndUpdate(importId, {
    $set: {
      aiStatus: 'queued',
      aiProgramLevel: programLevel,
      aiForceFormat: forceFormat,
      aiS3Key: s3Key,
      aiStartedAt: new Date(),
      aiStages: [],
      aiErrors: []
    }
  });
  const callbackUrl = `${getServerPublicUrl()}/api/imports/${importId}/ai-callback`;
  const eventCallbackUrl = `${getServerPublicUrl()}/api/imports/${importId}/ai-event`;
  const snapshot = await postToAIService('/ai/import/start', {
    s3Key,
    submissionId: String(initial.submissionId),
    importId,
    programLevel,
    forceFormat,
    callbackUrl,
    eventCallbackUrl,
    institutionId: institutionIdStr
  });
  await SelfStudyImport.findByIdAndUpdate(importId, {
    $set: {
      aiJobId: snapshot.jobId,
      aiStatus: snapshot.status,
      aiQueuePosition: snapshot.queuePosition ?? null,
      aiQueueDepth: snapshot.queueDepth ?? null,
      aiEtaSeconds: snapshot.etaSeconds ?? null
    }
  });
}

export async function startAIImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  // A non-impersonating superuser must impersonate a PC to import.
  if (!requireCanImport(req, res)) return;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const { programLevel = 'bachelors', forceFormat = null, isReimport = false } = req.body || {};

  if (!['associate', 'bachelors', 'masters'].includes(programLevel)) {
    res.status(400).json({ error: `Invalid programLevel: ${programLevel}` });
    return;
  }
  if (forceFormat !== null && !['template', 'self_study', 'mcc_narrative'].includes(forceFormat)) {
    res.status(400).json({ error: `Invalid forceFormat: ${forceFormat}` });
    return;
  }

  // Use atomic findOneAndUpdate so we don't conflict with the legacy
  // manual-tagging pipeline that runs concurrently from the same /upload
  // request. A direct .save() on a doc loaded earlier hit a VersionError
  // when the legacy pipeline saved between our load and our save.
  const initial = await SelfStudyImport.findById(importId).lean();
  if (!initial) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }
  const s3Key = initial.aiS3Key || `imports/${importId}/source.docx`;
  const submissionIdStr = String(initial.submissionId);
  // Look up the owning institution so cshse-ai can scope the corrections
  // RAG to this school's history only (per-institution policy).
  const submissionDoc = await Submission.findById(initial.submissionId)
    .select('institutionId')
    .lean();
  const institutionIdStr = submissionDoc?.institutionId ? String(submissionDoc.institutionId) : null;

  // Mark queued atomically before dispatching to the AI service.
  await SelfStudyImport.findByIdAndUpdate(importId, {
    $set: {
      aiStatus: 'queued',
      aiProgramLevel: programLevel,
      aiForceFormat: forceFormat,
      aiIsReimport: !!isReimport,
      aiS3Key: s3Key,
      aiStartedAt: new Date(),
      aiStages: [],
      aiErrors: []
    }
  });

  // Kick off the AI service job — response carries the initial queue position.
  try {
    const callbackUrl = `${getServerPublicUrl()}/api/imports/${importId}/ai-callback`;
    const eventCallbackUrl = `${getServerPublicUrl()}/api/imports/${importId}/ai-event`;
    const snapshot = await postToAIService('/ai/import/start', {
      s3Key,
      submissionId: submissionIdStr,
      importId: String(importId),
      programLevel,
      forceFormat,
      callbackUrl,
      eventCallbackUrl,
      institutionId: institutionIdStr
    });
    // Atomic save of the cshse-ai snapshot — again no .save() to avoid version
    // races with the legacy pipeline.
    await SelfStudyImport.findByIdAndUpdate(importId, {
      $set: {
        aiJobId: snapshot.jobId,
        aiStatus: snapshot.status,
        aiQueuePosition: snapshot.queuePosition ?? null,
        aiQueueDepth: snapshot.queueDepth ?? null,
        aiEtaSeconds: snapshot.etaSeconds ?? null
      }
    });
    res.status(202).json({
      importId: String(importId),
      jobId: snapshot.jobId,
      status: snapshot.status,
      queuePosition: snapshot.queuePosition ?? null,
      queueDepth: snapshot.queueDepth ?? null,
      etaSeconds: snapshot.etaSeconds ?? null,
      format: null
    });
  } catch (err: any) {
    const errMsg = `start-ai failed: ${err?.message || String(err)}`;
    await SelfStudyImport.findByIdAndUpdate(importId, {
      $set: {
        aiStatus: 'failed',
        aiErrors: [errMsg]
      }
    });
    // Broadcast on the SSE channel so any open EventSource (e.g. a tab
    // already on the Parse step) sees the failure immediately rather
    // than sitting on a 'queued' snapshot until a manual reload.
    try {
      const updated = await SelfStudyImport.findById(importId);
      if (updated) {
        broadcastSSE(importId, buildSnapshotFromImport(updated));
      }
    } catch (_broadcastErr) {
      // Broadcast is best-effort.
    }
    res.status(502).json({ error: 'AI service unreachable', detail: err?.message || String(err) });
  }
}

// ============================================================================
// GET /api/imports/:importId/ai-status  (polling fallback)
// ============================================================================

export async function getAIImportStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }
  res.json(buildSnapshotFromImport(importRecord));
}

// ============================================================================
// GET /api/imports/:importId/ai-events  (SSE primary)
// ============================================================================

export async function streamAIImportEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  // Gate BEFORE any SSE headers/events are written — otherwise a foreign
  // caller would receive an event stream (and the initial snapshot) for
  // another institution's import.
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  // SSE headers. X-Accel-Buffering: no asks the Railway proxy (and any
  // intermediaries) to flush immediately instead of buffering.
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  // Emit the current snapshot immediately so the client doesn't see a
  // blank pipeline strip while the next webhook is in flight.
  const initialSnapshot = buildSnapshotFromImport(importRecord);
  res.write(`event: status\ndata: ${JSON.stringify(initialSnapshot)}\n\n`);

  const client: SSEClient = { id: crypto.randomUUID(), res };
  addSSEClient(importId, client);

  req.on('close', () => removeSSEClient(importId, client));
}

// ============================================================================
// POST /api/imports/:importId/ai-event  (incremental webhook from cshse-ai)
// ============================================================================

export async function receiveAIEventWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody || !verifyIncoming(req, rawBody)) {
    res.status(401).json({ error: 'Invalid HMAC signature' });
    return;
  }
  const payload = req.body || {};

  // Scalability fix (task #41) — ai-events are PROGRESS SNAPSHOTS (status,
  // queue position, stage list), and cshse-ai can post several in quick
  // succession while one is still being persisted. The old
  // findById → mutate → save() read-modify-write threw a Mongoose
  // VersionError (→ HTTP 500, dropped event) whenever two events for the
  // same import raced on the optimistic-concurrency __v guard. These are
  // snapshot fields where last-writer-wins is the correct semantic and
  // there is no accumulating array to clobber, so a single atomic $set is
  // both race-free and correct. Mirrors the document-matcher callback fix.
  const setOps: Record<string, any> = {};
  if (payload.status) setOps.aiStatus = payload.status;
  if ('queuePosition' in payload) setOps.aiQueuePosition = payload.queuePosition;
  if ('queueDepth' in payload) setOps.aiQueueDepth = payload.queueDepth;
  if ('etaSeconds' in payload) setOps.aiEtaSeconds = payload.etaSeconds;
  if (payload.format) setOps.aiFormat = payload.format;
  if (Array.isArray(payload.stages)) setOps.aiStages = payload.stages;
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    setOps.aiErrors = payload.errors;
  }

  const updated = await SelfStudyImport.findByIdAndUpdate(
    importId,
    Object.keys(setOps).length > 0 ? { $set: setOps } : {},
    { new: true }
  );
  if (!updated) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  // Fan out to any connected SSE clients.
  broadcastSSE(importId, buildSnapshotFromImport(updated));
  res.json({ ok: true });
}

// ============================================================================
// POST /api/imports/:importId/ai-callback  (terminal-state webhook)
// ============================================================================

/**
 * CR-037 — total bucket items (narratives + evidenceText + evidenceFiles)
 * across every spec, used by the empty-buckets guard in receiveAICallback.
 */
function sumBucketItems(buckets: any): number {
  if (!buckets || typeof buckets !== 'object') return 0;
  let total = 0;
  for (const b of Object.values(buckets as Record<string, any>)) {
    if (!b || typeof b !== 'object') continue;
    total +=
      (Array.isArray(b.narratives) ? b.narratives.length : 0) +
      (Array.isArray(b.evidenceText) ? b.evidenceText.length : 0) +
      (Array.isArray(b.evidenceFiles) ? b.evidenceFiles.length : 0);
  }
  return total;
}

export async function receiveAICallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody || !verifyIncoming(req, rawBody)) {
    res.status(401).json({ error: 'Invalid HMAC signature' });
    return;
  }
  const payload = req.body || {};
  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  // CR-037 Defense 2 — empty-buckets server-side guard. If ai-service
  // emitted a terminal "completed/parsed" callback with zero items across
  // every bucket AND no errors of its own, refuse to mark this import as
  // successfully parsed. Convert the silent-zero-success into an explicit
  // failure with an actionable diagnostic so the wizard surfaces a real
  // error instead of an empty Review screen.
  const isTerminalSuccess =
    payload.status === 'parsed' ||
    payload.status === 'completed' ||
    payload.status === 'finished';
  if (isTerminalSuccess) {
    const totalItems = sumBucketItems(payload.buckets);
    const totalTags = Array.isArray(payload.tags) ? payload.tags.length : 0;
    const totalMatrices = Array.isArray(payload.matrices) ? payload.matrices.length : 0;
    // CR-033 / CR-040 — CV-only and evidence-doc-only uploads are
    // legitimately zero across buckets/tags/matrices (all content lives
    // in payload.cvs / payload.evidenceDocs / payload.introductions).
    // Counting those in the empty-bucket guard is what made the
    // standalone-CV path silently rewrite successful Stevenson CV-only
    // uploads to "failed" — surfaced by 28_stevenson_multifile_
    // integration AC#3 ("CV-only file → aiStandaloneCv=true").
    const totalCVs = Array.isArray(payload.cvs) ? payload.cvs.length : 0;
    const totalEvidenceDocs = Array.isArray(payload.evidenceDocs)
      ? payload.evidenceDocs.length
      : 0;
    const totalIntroItems =
      payload.introductions && typeof payload.introductions === 'object'
        ? Object.values(payload.introductions as Record<string, any>).reduce(
            (acc: number, ib: any) =>
              acc + (Array.isArray(ib?.items) ? ib.items.length : 0),
            0
          )
        : 0;
    const totalAll =
      totalItems +
      totalTags +
      totalMatrices +
      totalCVs +
      totalEvidenceDocs +
      totalIntroItems;
    const hasReportedErrors =
      Array.isArray(payload.errors) && payload.errors.length > 0;
    if (totalAll === 0 && !hasReportedErrors) {
      console.warn(
        `[cr-037] empty-content terminal callback for import=${importId}; rewriting to failed`
      );
      payload.status = 'failed';
      // SelfStudyImport.aiErrors is typed as string[] — Mongoose coerces
      // a {stage, severity, message} object to '[object Object]' which
      // is what the coordinator actually sees in the failed-state panel.
      // Push the message string directly.
      payload.errors = [
        ...(Array.isArray(payload.errors) ? payload.errors : []),
        'AI matcher returned zero items. The document may be malformed or all sections may have failed individually. Try re-uploading; contact support if this persists.'
      ];
    }
  }

  // Terminal payload: persist buckets / tags / placeholders / matrices
  // along with the final status.
  if (payload.status) importRecord.aiStatus = payload.status;
  if (payload.format) importRecord.aiFormat = payload.format;
  if (Array.isArray(payload.stages)) importRecord.aiStages = payload.stages;
  if (Array.isArray(payload.errors)) importRecord.aiErrors = payload.errors;
  if (payload.buckets && typeof payload.buckets === 'object') {
    importRecord.aiBuckets = payload.buckets;
    importRecord.markModified('aiBuckets');  // Mixed type needs explicit mark
  }
  if (Array.isArray(payload.tags)) importRecord.aiTags = payload.tags;
  if (Array.isArray(payload.placeholderSections)) {
    importRecord.aiPlaceholderSections = payload.placeholderSections;
  }
  if (Array.isArray(payload.matrices)) {
    importRecord.aiMatrices = payload.matrices;
    importRecord.markModified('aiMatrices');  // Mixed[] needs explicit mark
  }
  // CR-033 Phase 2b — per-faculty CVs from cv_detector. Empty array
  // means "detector ran, no CVs found" — explicitly distinct from
  // "field absent" so an empty terminal callback doesn't accidentally
  // strand stale CVs from a previous run.
  if (Array.isArray(payload.cvs)) {
    (importRecord as any).aiCVs = payload.cvs;
    (importRecord as any).markModified('aiCVs');
  }
  // CR-033 Phase 2c part 2 — standalone-CV mode flag.
  if (typeof payload.standaloneCv === 'boolean') {
    (importRecord as any).aiStandaloneCv = payload.standaloneCv;
  }
  // CR-040 Phase 3b — coverage report.
  if (payload.coverageReport && typeof payload.coverageReport === 'object') {
    (importRecord as any).aiCoverageReport = payload.coverageReport;
    (importRecord as any).markModified('aiCoverageReport');
  }
  // CR-040 Phase 2b — appendix papers + syllabi from
  // appendix_paper_detector. Same empty-array semantics as CVs.
  if (Array.isArray(payload.evidenceDocs)) {
    (importRecord as any).aiEvidenceDocs = payload.evidenceDocs;
    (importRecord as any).markModified('aiEvidenceDocs');
  }
  // CR-039 Phase 2b — section_id → routing_hint map from
  // introduction_detector. Persisted so cshse-server can re-derive the
  // wizard's Introduction-bucket seed on a hard refresh; client picks
  // them up via the Zustand `introductions` field after Apply (Phase 2c
  // adds the actual seeding logic).
  if (payload.introductionHints && typeof payload.introductionHints === 'object') {
    (importRecord as any).aiIntroductionHints = payload.introductionHints;
    (importRecord as any).markModified('aiIntroductionHints');
  }
  // CR-039 Phase 2c — STRUCTURED introductions ('document' / 'standard-N' →
  // {scope, standardCode, items[]}). Persist so the merge below seeds
  // Submission.aiReviewState.introductions — the field the wizard's
  // Introduction rail renders. Without this, only hints arrived and the rail
  // stayed empty.
  if (payload.introductions && typeof payload.introductions === 'object') {
    (importRecord as any).aiIntroductions = payload.introductions;
    (importRecord as any).markModified('aiIntroductions');
  }
  importRecord.aiCompletedAt = new Date();
  importRecord.aiQueuePosition = null;
  importRecord.aiQueueDepth = null;

  // MCC — store the clean, link-anchored source HTML the walker rebuilt as
  // this import's GridFS content, OVERWRITING the legacy flattened PDF parse.
  // The Review "Compare / Show in source" pane serves this from
  // /api/imports/:id/content, so the source pane now renders formatted text
  // with working links and data-section-id anchors that match the imported
  // panes exactly (instead of run-on text with no links / no anchors).
  if (typeof payload.sourceHtml === 'string' && payload.sourceHtml.length > 0) {
    try {
      await gridFsService.storeHtmlContent(String(importRecord._id), payload.sourceHtml);
      importRecord.extractedContent = {
        ...(importRecord.extractedContent || {}),
        metadata: {
          ...((importRecord.extractedContent as any)?.metadata || {}),
          htmlStoredInGridFS: true,
        },
      } as any;
      importRecord.markModified('extractedContent');
    } catch (srcErr) {
      console.warn('[ai-callback] storing MCC source HTML failed (non-fatal):', srcErr);
    }
  }
  // CR-043 race fix — defer the importRecord.save() that flips
  // aiStatus visible to the poller until AFTER the merge has committed
  // submissionDoc.aiReviewState. Without this, a fast poll between the
  // two saves catches status='parsed' but aiReviewState=null. Surfaced
  // by 28_stevenson_multifile_integration #1 (standards-01-05 →
  // aiReviewState has narratives) when the test polled the live cshse-
  // develop fast enough to hit the intermediate state.

  // CR-043 — merge this import's output into Submission.aiReviewState.
  // First import per submission after the cutover triggers a clear of
  // pre-CR-043 wizard state on prior SelfStudyImports. Best-effort:
  // failure here logs but doesn't fail the callback (per-import
  // aiBuckets/etc are already persisted above as the authoritative
  // per-import record).
  if (importRecord.aiStatus === 'parsed') {
    try {
      const merge = aiReviewMerge;
      const submissionDoc = await Submission.findById(importRecord.submissionId);
      if (submissionDoc) {
        const isFirstPostCr043 = !(submissionDoc as any).aiReviewState;
        let cleared = 0;
        if (isFirstPostCr043) {
          // User-directed cutover: clear pre-CR-043 fields on every
          // OTHER prior import for this submission. The current import
          // record stays — its fields are now mirrored into aiReviewState
          // and serve as the authoritative per-source provenance.
          cleared = await merge.clearPreCR043State(
            SelfStudyImport,
            importRecord.submissionId,
            importRecord._id
          );
        }
        const state = (submissionDoc as any).aiReviewState ?? merge.buildEmptyReviewState();
        // Pull the content hash from the import's DocumentVersion if
        // available; fallback to filename-derived hash so the merge
        // still computes (degraded but functional). The upload path
        // already stamps aiDocumentVersionId on every import.
        let contentHash = '';
        if ((importRecord as any).aiDocumentVersionId) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const docVerModelMod = require('../models/DocumentVersion');
            const DV = docVerModelMod.DocumentVersion || docVerModelMod.default;
            const dv = DV ? await DV.findById((importRecord as any).aiDocumentVersionId).select('sha256').lean() : null;
            if (dv && (dv as any).sha256) contentHash = String((dv as any).sha256);
          } catch (_dvErr) {
            // DocumentVersion lookup is best-effort; fall through.
          }
        }
        if (!contentHash) {
          contentHash = merge.sha256Hex(
            `${importRecord.originalFilename}::${importRecord._id}`
          );
        }
        // Auto-detect a re-import of the SAME file even when the coordinator
        // didn't tick the reimport box (the common case: re-uploading the
        // self-study). If any prior item came from this filename or content
        // hash, treat it as a re-import so its items are REPLACED, not added
        // (fixes duplicates on re-import).
        const _srcFilename = importRecord.originalFilename || 'unknown.docx';
        const _priorSameSource = Object.values((state as any).itemSources || {}).some(
          (s: any) => s && (s.sourceFilename === _srcFilename || s.sourceContentHash === contentHash)
        );
        const report = merge.mergeImportIntoReviewState(state, {
          importId: String(importRecord._id),
          sourceFilename: _srcFilename,
          sourceContentHash: contentHash,
          importedAt: new Date(),
          reimport: !!(importRecord as any).aiIsReimport || _priorSameSource,
          buckets: importRecord.aiBuckets || {},
          tags: importRecord.aiTags || [],
          cvs: (importRecord as any).aiCVs || [],
          evidenceDocs: (importRecord as any).aiEvidenceDocs || [],
          introductions: (importRecord as any).aiIntroductions || {},
          placeholderSections: importRecord.aiPlaceholderSections || [],
          coverageReport: (importRecord as any).aiCoverageReport
        });
        (submissionDoc as any).aiReviewState = state;
        (submissionDoc as any).markModified('aiReviewState');
        // Matrix state ships separately (same submission scoping).
        if (Array.isArray(importRecord.aiMatrices) && importRecord.aiMatrices.length > 0) {
          const matrixState = (submissionDoc as any).aiMatrixState ?? {
            matrices: [],
            matrixRowEdits: {},
            lastUpdatedAt: new Date()
          };
          // Replace whole-matrix by matrixId. matrixRowEdits keyed by
          // `${matrixId}|${rowAnchor}` so retag/remove decisions survive.
          const seen = new Set<string>();
          for (const m of importRecord.aiMatrices as any[]) {
            seen.add(m.matrixId);
          }
          matrixState.matrices = [
            ...(matrixState.matrices || []).filter((m: any) => !seen.has(m.matrixId)),
            ...(importRecord.aiMatrices as any[])
          ];
          matrixState.lastUpdatedAt = new Date();
          (submissionDoc as any).aiMatrixState = matrixState;
          (submissionDoc as any).markModified('aiMatrixState');
        }
        await submissionDoc.save();
        console.log(
          `[CR-043 merge] importId=${importRecord._id} submissionId=${submissionDoc._id} ` +
          `cleared=${cleared} firstPostCr043=${isFirstPostCr043} ` +
          `counts=${JSON.stringify(report.counts)}`
        );
      }
    } catch (mergeErr) {
      console.error('[CR-043 merge] non-fatal merge failure:', mergeErr);
    }
  }

  // CR-043 race fix — flip aiStatus to its terminal value AFTER the
  // merge has committed Submission.aiReviewState. A poller that watches
  // aiStatus will now never observe 'parsed' before aiReviewState is
  // populated. Failed/canceled statuses also persist via this save.
  await importRecord.save();

  // Final SSE event, then connected clients drop the EventSource.
  broadcastSSE(importId, buildSnapshotFromImport(importRecord));

  // CR-041 US-3 — if this import is part of a batch, tell the advancer
  // so it can bump counts + start the next pending child. Best-effort;
  // a failure here doesn't roll back the callback. Required to use a
  // runtime require() rather than an esbuild-compiled dynamic import()
  // because esbuild leaves the ESM import literal in the CJS output
  // and Node 20's ESM resolver demands a file extension.
  const batchId = (importRecord as any).batchId;
  const terminalStatus = (importRecord as any).aiStatus;
  if (batchId && ['parsed', 'failed', 'canceled'].includes(terminalStatus)) {
    try {
      await batchAdvancerService.advanceBatch(
        batchId,
        terminalStatus as 'parsed' | 'failed' | 'canceled'
      );
    } catch (advErr) {
      console.error('[ai-callback] batchAdvancer hook failed:', advErr);
    }
  }

  res.json({ ok: true });
}

// ============================================================================
// POST /api/imports/:importId/apply-ai  (sub-sprint 1.c — real implementation)
// ============================================================================
//
// Atomic write into Submission.narratives + SelfStudyImport.aiTags +
// aiPlaceholderSections, wrapped in a Mongo session. The full evidence-file
// S3 ordering (upload → row insert with rollback-aware orphan tagging) lands
// alongside the SupportingEvidence collection work in [[evidence-document-review-pipeline]];
// for now evidence files are stored as inline references on the bucket so the
// wizard's output is complete and the row creation can be backfilled later.
//
// Idempotency: the client sends `idempotencyKey` (per UI spec §11.5). The
// server stores the last successful key on the SelfStudyImport doc; a retry
// with the same key short-circuits to a 200 with the cached counts.

type ApplyMatrixCell = {
  std: string;
  spec: string | null;
  specPrompt?: string;
  columnIndex: number;
  columnHeader?: string;
  codeRaw: string;
  contentTypes: string[];
  depth: string | null;
};

type ApplyMatrix = {
  matrixId: string;
  name: string;
  anchorName?: string;
  programLevel?: string;
  htmlSnippet?: string;
  columnHeaders: string[];
  cells: ApplyMatrixCell[];
};

type ApplyPayload = {
  narratives?: Record<string, Record<string, { content: string; mode?: 'merge' | 'replace' | 'keep' | 'take' }>>;
  supportingEvidenceText?: Record<string, Record<string, { text: string; mode?: 'merge' | 'replace' | 'keep' | 'take' }>>;
  supportingEvidenceFiles?: Array<{ std: string; spec: string; sectionId?: string; title?: string; snippet?: string }>;
  matrixCells?: any[];
  // Full per-matrix payloads from the wizard. When present, the apply step
  // creates one CurriculumMatrix document per entry and pushes the new
  // ObjectId onto submission.curriculumMatrices.
  matrices?: ApplyMatrix[];
  importTags?: any[];
  placeholderSections?: any[];
  globalMergeMode?: 'merge' | 'replace' | 'per_spec';
  perSpecResolution?: Record<string, 'keep' | 'take' | 'merge'>;
  idempotencyKey?: string;
  // CR-039 — Introduction payload keyed by 'document' / 'standard-{N}'.
  // content is opaque HTML the client renders with the same TipTap path
  // it uses for narratives.
  introductions?: Record<
    string,
    {
      scope: 'document' | 'standard';
      standardCode: string | null;
      content: string;
    }
  >;
  // CR-040 Phase 1 — appendix paper / syllabus list. Detection +
  // .docx generation + S3 upload land in Phase 2/3; until then this
  // field arrives empty and the apply path is a no-op.
  evidenceDocs?: any[];
  // CR-033 Phase 1 — faculty CV list. Detector lives in ai-service
  // Phase 2; until then this arrives empty.
  cvs?: any[];
};

function resolveMode(
  globalMergeMode: ApplyPayload['globalMergeMode'],
  perSpecResolution: ApplyPayload['perSpecResolution'],
  std: string,
  spec: string,
  itemMode?: string
): 'merge' | 'replace' | 'keep' | 'take' {
  if (itemMode === 'merge' || itemMode === 'replace' || itemMode === 'keep' || itemMode === 'take') {
    return itemMode;
  }
  if (globalMergeMode === 'per_spec') {
    const per = perSpecResolution?.[`${std}.${spec}`];
    return per === 'keep' || per === 'take' || per === 'merge' ? per : 'merge';
  }
  return globalMergeMode === 'replace' ? 'replace' : 'merge';
}

function mergeNarrativeContent(existing: string, incoming: string, mode: 'merge' | 'replace' | 'keep' | 'take'): string {
  if (mode === 'replace' || mode === 'take') return incoming;
  if (mode === 'keep') return existing || incoming;
  // merge: append a separator + the incoming content; if existing is empty, just take incoming.
  if (!existing) return incoming;
  return `${existing}\n<hr class="ai-import-merge"/>\n${incoming}`;
}

/**
 * CR-041 US-8 — extracted apply-core. Runs the per-import Submission +
 * SelfStudyImport writes inside an OPTIONAL outer session, so the batch
 * Apply controller (importBatchController.applyImportBatch) can wrap
 * every child in one transaction. When called from the per-import HTTP
 * handler, the handler still creates its own session as before.
 *
 * Returns the same shape the HTTP handler renders; never throws — error
 * paths return { ok: false, error }. The caller is responsible for HTTP
 * status + SSE broadcast.
 */
export async function applyAIImportCore(args: {
  importRecord: any;
  payload: ApplyPayload;
  userId: any;
  session: mongoose.ClientSession | null;
  /** When true, the caller manages session commit/abort. */
  externalSession?: boolean;
}): Promise<
  | { ok: true; status: 'applied'; appliedCounts: typeof emptyCounts; tagsRemaining: number; idempotentReplay?: boolean }
  | { ok: false; status: string; error: string; httpStatus?: number }
> {
  const { importRecord, payload, userId, session } = args;
  const externalSession = !!args.externalSession;

  if (importRecord.aiStatus !== 'parsed' && importRecord.aiStatus !== 'failed' && importRecord.aiStatus !== 'applied') {
    return {
      ok: false,
      status: importRecord.aiStatus,
      error: `Cannot apply from status ${importRecord.aiStatus}; must be parsed.`,
      httpStatus: 409
    };
  }
  const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : null;
  if (idempotencyKey && (importRecord as any).aiLastIdempotencyKey === idempotencyKey && importRecord.aiAppliedCounts) {
    return {
      ok: true,
      status: importRecord.aiStatus,
      appliedCounts: importRecord.aiAppliedCounts,
      tagsRemaining: (importRecord.aiTags || []).length,
      idempotentReplay: true
    };
  }
  const submission = await Submission.findById(importRecord.submissionId);
  if (!submission) {
    return {
      ok: false,
      status: importRecord.aiStatus,
      error: 'Submission not found for this import',
      httpStatus: 404
    };
  }
  importRecord.aiStatus = 'applying';
  // When part of a batch outer transaction we let the outer commit
  // carry the state flip; otherwise persist eagerly so a mid-apply
  // snapshot reflects the in-flight state.
  if (!externalSession) await importRecord.save();
  return _applyAIImportWrites({
    importRecord,
    submission,
    payload,
    userId,
    session,
    idempotencyKey
  });
}

const emptyCounts = {
  narratives: 0,
  evidenceText: 0,
  evidenceFiles: 0,
  matrixCells: 0,
  tags: 0,
  placeholders: 0
};

async function _applyAIImportWrites(args: {
  importRecord: any;
  submission: any;
  payload: ApplyPayload;
  userId: any;
  session: mongoose.ClientSession | null;
  idempotencyKey: string | null;
}): Promise<
  | { ok: true; status: 'applied'; appliedCounts: typeof emptyCounts; tagsRemaining: number }
  | { ok: false; status: string; error: string; httpStatus?: number }
> {
  const { importRecord, submission, payload, userId, session, idempotencyKey } = args;
  const counts = { ...emptyCounts };
  try {
    await _runApplyBody({ importRecord, submission, payload, userId, session, idempotencyKey, counts });
    return {
      ok: true,
      status: 'applied',
      appliedCounts: counts,
      tagsRemaining: (importRecord.aiTags || []).length
    };
  } catch (err: any) {
    importRecord.aiStatus = 'parsed';
    importRecord.aiErrors = [
      ...(importRecord.aiErrors || []),
      `apply-ai failed: ${err?.message || String(err)}`
    ];
    try {
      // Best-effort error persistence; if we're inside an outer session
      // that's about to abort, this save will abort with it.
      await importRecord.save(session ? { session } : {});
    } catch {
      // ignore
    }
    return {
      ok: false,
      status: 'parsed',
      error: err?.message || String(err),
      httpStatus: 500
    };
  }
}

export async function applyAIImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const payload: ApplyPayload = req.body || {};

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }
  // Atomicity model: see applyAIImportCore comment. mongodb-memory-server
  // runs a standalone mongod by default and rejects transactions;
  // production runs on Railway with a replica set that supports them.
  const useTransaction = process.env.MONGO_SUPPORTS_TRANSACTIONS === 'true';
  const session = useTransaction ? await mongoose.startSession() : null;
  if (session) session.startTransaction();
  const result = await applyAIImportCore({
    importRecord,
    payload,
    userId: req.user!._id,
    session,
    externalSession: false
  });
  try {
    if (result.ok === false) {
      if (session) {
        try {
          await session.abortTransaction();
        } catch {
          // ignore
        }
      }
      res.status(result.httpStatus ?? 500).json({
        ok: false,
        status: result.status,
        error: result.error
      });
      return;
    }
    if (session) await session.commitTransaction();
    broadcastSSE(importId, buildSnapshotFromImport(importRecord));
    res.json({
      ok: true,
      status: result.status,
      appliedCounts: result.appliedCounts,
      tagsRemaining: result.tagsRemaining,
      ...(result.idempotentReplay ? { idempotentReplay: true } : {})
    });
  } finally {
    if (session) await session.endSession();
  }
}

// CR-041 US-8 — body extracted so the per-import HTTP handler AND the
// batch Apply handler share the exact same write logic. Throws on
// failure so _applyAIImportWrites can roll back cleanly via the outer
// catch.
async function _runApplyBody(args: {
  importRecord: any;
  submission: any;
  payload: ApplyPayload;
  userId: any;
  session: mongoose.ClientSession | null;
  idempotencyKey: string | null;
  counts: typeof emptyCounts;
}): Promise<void> {
  const { importRecord, submission, payload, userId, session, idempotencyKey, counts } = args;
  // The original applyAIImport body is reproduced verbatim below — the
  // refactor is mechanical (extract body, keep behavior).
  const importId = String(importRecord._id);
  void importId;

  // CR-041 US-8 refactor: the orig body had an outer try/catch +
  // session lifecycle here; both moved up to _applyAIImportWrites and
  // the HTTP handler. The block below is the original write logic with
  // local `counts` references switched to the passed-in counts.
  {
    if (!submission.narratives) {
      submission.narratives = new Map() as any;
    }

    // --- narratives ---
    for (const [std, specs] of Object.entries(payload.narratives || {})) {
      for (const [spec, val] of Object.entries(specs)) {
        const mode = resolveMode(payload.globalMergeMode, payload.perSpecResolution, std, spec, val.mode);
        const stdMap: Map<string, INarrativeContent> =
          (submission.narratives as any).get(std) || new Map<string, INarrativeContent>();
        const existing = stdMap.get(spec);
        const mergedContent = mergeNarrativeContent(existing?.content || '', val.content || '', mode);
        const entry: INarrativeContent = {
          content: mergedContent,
          lastModified: new Date(),
          isComplete: existing?.isComplete ?? false,
          linkedDocuments: existing?.linkedDocuments || [],
          supportingEvidenceText: existing?.supportingEvidenceText
        };
        stdMap.set(spec, entry);
        (submission.narratives as any).set(std, stdMap);
        counts.narratives += 1;
      }
    }

    // --- supporting evidence text ---
    for (const [std, specs] of Object.entries(payload.supportingEvidenceText || {})) {
      for (const [spec, val] of Object.entries(specs)) {
        const mode = resolveMode(payload.globalMergeMode, payload.perSpecResolution, std, spec, val.mode);
        const stdMap: Map<string, INarrativeContent> =
          (submission.narratives as any).get(std) || new Map<string, INarrativeContent>();
        const existing = stdMap.get(spec);
        const merged = mergeNarrativeContent(existing?.supportingEvidenceText || '', val.text || '', mode);
        const entry: INarrativeContent = {
          content: existing?.content || '',
          lastModified: new Date(),
          isComplete: existing?.isComplete ?? false,
          linkedDocuments: existing?.linkedDocuments || [],
          supportingEvidenceText: merged
        };
        stdMap.set(spec, entry);
        (submission.narratives as any).set(std, stdMap);
        counts.evidenceText += 1;
      }
    }

    // --- supporting evidence files (inline reference only in 1.c MVP) ---
    for (const file of payload.supportingEvidenceFiles || []) {
      const stdMap: Map<string, INarrativeContent> =
        (submission.narratives as any).get(file.std) || new Map<string, INarrativeContent>();
      let existing = stdMap.get(file.spec);
      if (!existing) {
        // Create a minimal narrative shell so the linkedDocument has somewhere to live.
        existing = {
          content: '',
          lastModified: new Date(),
          isComplete: false,
          linkedDocuments: [],
          supportingEvidenceText: ''
        };
      }
      const refLabel = file.title || file.sectionId || 'evidence-file';
      if (!existing.linkedDocuments.includes(refLabel)) {
        existing.linkedDocuments = [...existing.linkedDocuments, refLabel];
        existing.lastModified = new Date();
        stdMap.set(file.spec, existing);
        (submission.narratives as any).set(file.std, stdMap);
      }
      counts.evidenceFiles += 1;
    }

    // Persist per-matrix payloads as CurriculumMatrix documents. Each matrix
    // becomes its own document so the existing MatrixEditor (which fetches
    // by submission.curriculumMatrices[]) sees them. Rows are grouped by
    // (std, spec); per-row courseAssessments come from the matrix cells.
    let appliedMatrixCellCount = 0;
    if (Array.isArray(payload.matrices) && payload.matrices.length > 0) {
      const newMatrixIds: mongoose.Types.ObjectId[] = [];

      for (const m of payload.matrices) {
        // Build the course list from the matrix's column headers. The
        // `id` field on ICourseEntry is referenced by ICourseAssessment.courseId.
        const courses: ICourseEntry[] = m.columnHeaders.map((header, idx) => ({
          id: `${m.matrixId}-col-${idx + 1}`,
          coursePrefix: header.replace(/\d+$/, '').trim() || header,
          courseNumber: header.match(/\d+/)?.[0] || '',
          courseName: header,
          order: idx
        }));

        // Group cells by (std, spec) so each row carries all its
        // courseAssessments.
        const rowMap = new Map<string, IStandardMapping>();
        let rowOrder = 0;
        for (const cell of m.cells) {
          const spec = cell.spec || '?';
          const key = `${cell.std}.${spec}`;
          let row = rowMap.get(key);
          if (!row) {
            row = {
              standardCode: cell.std,
              specCode: spec,
              specText: cell.specPrompt || '',
              rowIndex: rowOrder++,
              courseAssessments: []
            };
            rowMap.set(key, row);
          }
          // Validate cell codes against the enum types before pushing.
          const validTypes = (cell.contentTypes || []).filter((t): t is CoverageType =>
            t === 'I' || t === 'T' || t === 'K' || t === 'S'
          );
          const validDepth =
            cell.depth === 'L' || cell.depth === 'M' || cell.depth === 'H'
              ? (cell.depth as CoverageDepth)
              : ('M' as CoverageDepth);
          const courseId = `${m.matrixId}-col-${cell.columnIndex}`;
          const assess: ICourseAssessment = {
            courseId,
            type: validTypes,
            depth: validDepth,
            notes: cell.codeRaw && cell.codeRaw !== validTypes.join('') + validDepth ? cell.codeRaw : undefined
          };
          row.courseAssessments.push(assess);
          appliedMatrixCellCount += 1;
        }

        const matrixType =
          m.matrixId === 'matrix-hsr'
            ? 'human_services_courses'
            : m.matrixId === 'matrix-non-hsr'
              ? 'non_human_services_courses'
              : 'custom';

        // Seed rawContent so the existing MatrixEditor (which renders from
        // rawContent[]) shows the full table with row anchors. Each AI matrix
        // becomes one rawContent entry; `standardCode` is left undefined so
        // it surfaces in the editor's "Other Imported Sections" group as a
        // single full-table view (rather than fragmented per-standard).
        const rawContent = m.htmlSnippet
          ? [
              {
                id: `${m.matrixId}-ai-${Date.now()}`,
                content: m.htmlSnippet,
                title: m.name,
                sourceImportId: importId,
                addedAt: new Date(),
                addedBy: new mongoose.Types.ObjectId(userId),
                processed: true,
                processedAt: new Date()
              }
            ]
          : [];

        const matrixDoc = await CurriculumMatrix.create(
          [
            {
              submissionId: submission._id,
              matrixType,
              name: m.name,
              version: 1,
              lastModified: new Date(),
              lastModifiedBy: new mongoose.Types.ObjectId(userId),
              courses,
              standards: [...rowMap.values()],
              rawContent
            }
          ],
          session ? { session } : undefined
        );
        newMatrixIds.push(matrixDoc[0]._id as mongoose.Types.ObjectId);
      }

      // Replace any AI-derived matrices from a prior re-import: drop the old
      // refs (the matrices themselves stay for history but we point the
      // submission at the new ones) and append the new ones.
      submission.curriculumMatrices = [
        ...(submission.curriculumMatrices || []),
        ...newMatrixIds
      ];
    }

    counts.matrixCells = appliedMatrixCellCount || (payload.matrixCells || []).length;
    counts.tags = (payload.importTags || []).length;
    counts.placeholders = (payload.placeholderSections || []).length;

    // CR-039 — persist Introductions into the Submission. The payload's
    // `document` key writes documentIntroduction; every `standard-{N}`
    // key writes one entry into standardIntroductions (keyed by the bare
    // standard code, e.g. '1', '2', ...). Empty content is treated as
    // intentional clearing — coordinators can wipe a draft Introduction
    // by moving all its items out before Apply.
    const intros = (payload.introductions ?? {}) as Record<
      string,
      { scope: 'document' | 'standard'; standardCode: string | null; content: string }
    >;
    if (Object.keys(intros).length > 0) {
      for (const [key, val] of Object.entries(intros)) {
        if (key === 'document' && val.scope === 'document') {
          (submission as any).documentIntroduction = val.content || '';
        } else if (val.scope === 'standard' && val.standardCode) {
          if (!(submission as any).standardIntroductions) {
            (submission as any).standardIntroductions = new Map<string, string>();
          }
          ((submission as any).standardIntroductions as Map<string, string>).set(
            String(val.standardCode),
            val.content || ''
          );
        }
      }
      (submission as any).markModified('documentIntroduction');
      (submission as any).markModified('standardIntroductions');
    }

    (submission as any).markModified('narratives');
    await submission.save(session ? { session } : {});

    importRecord.aiStatus = 'applied';
    importRecord.aiAppliedAt = new Date();
    importRecord.aiAppliedCounts = counts;
    importRecord.aiTags = (payload.importTags || []) as any;
    importRecord.aiPlaceholderSections = (payload.placeholderSections || []) as any;
    // CR-039 / CR-040 Phase 1 — preserve the new content kinds on the
    // import record so a hard refresh post-apply still surfaces them.
    if (payload.introductions) {
      (importRecord as any).aiIntroductions = payload.introductions;
      (importRecord as any).markModified('aiIntroductions');
    }
    if (Array.isArray(payload.evidenceDocs)) {
      // CR-040 Phase 2c — at Apply time each evidenceDoc gets packaged
      // as a SupportingEvidence record so coordinators can open it via
      // the existing download endpoint. We generate a REAL .docx via
      // the `docx` npm package — coordinators open it in Word (or any
      // .docx viewer) and can add comments / track-changes review
      // directly, matching the format they originally uploaded.
      //
      // MVP storage = base64-in-Mongo; the client "View file" button
      // is identical regardless of backing store (S3 vs base64). When
      // S3 is wired in production the FileData.storageType flips to
      // 's3' without touching the wizard UI.
      try {
        const {
          Document,
          Packer,
          Paragraph,
          TextRun,
          HeadingLevel,
          AlignmentType,
        } = await import('docx');
        const stampedDocs = await Promise.all(
          (payload.evidenceDocs as any[]).map(async (doc) => {
            // Skip if a SupportingEvidence record was already created
            // (re-apply / idempotent replay).
            if (doc.fileId) return doc;
            const title = doc.title || 'Evidence Document';
            const kind = doc.docSubKind || 'paper';
            const safeTitle =
              String(title).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'evidence';

            // Build the .docx body. Title → heading 1. Subtitle line
            // identifies the kind (paper / syllabus) + course code.
            // Metadata pairs go in a small definition-list-style block.
            // Then summary (if any) + the captured snippet body.
            const children: any[] = [];
            children.push(
              new Paragraph({
                text: title,
                heading: HeadingLevel.HEADING_1,
              })
            );
            const kindLabel =
              kind === 'syllabus' ? 'Course syllabus' : 'Appendix paper';
            const subtitle = doc.courseCode
              ? `${kindLabel} — ${doc.courseCode}`
              : kindLabel;
            children.push(
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: subtitle, italics: true })],
              })
            );
            // Metadata pairs
            const meta: Array<[string, string]> = [];
            if (doc.author) meta.push(['Author', String(doc.author)]);
            if (doc.date) meta.push(['Date', String(doc.date)]);
            if (doc.subject) meta.push(['Subject', String(doc.subject)]);
            if (doc.pageCountEstimate)
              meta.push(['Pages (est.)', String(doc.pageCountEstimate)]);
            for (const [k, v] of meta) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `${k}: `, bold: true }),
                    new TextRun({ text: v }),
                  ],
                })
              );
            }
            if (doc.summary) {
              children.push(
                new Paragraph({
                  text: 'Summary',
                  heading: HeadingLevel.HEADING_2,
                })
              );
              children.push(new Paragraph({ text: String(doc.summary) }));
            }
            children.push(
              new Paragraph({
                text: 'Content',
                heading: HeadingLevel.HEADING_2,
              })
            );
            // Split the snippet on blank lines into paragraphs so Word
            // shows the original paragraph breaks.
            const bodyText = String(
              doc.snippet || '(no captured body — see source document)'
            );
            const paragraphs = bodyText.split(/\n\s*\n/);
            for (const p of paragraphs) {
              children.push(new Paragraph({ text: p.trim() }));
            }

            const docx = new Document({
              creator: 'CSHSE AI Importer',
              title,
              description: `${kindLabel}${doc.courseCode ? ' — ' + doc.courseCode : ''}`,
              sections: [{ properties: {}, children }],
            });
            const buffer = await Packer.toBuffer(docx);

            const filename = `${safeTitle}.docx`;
            const evidence = await SupportingEvidence.create({
              institutionId: submission.institutionId,
              submissionId: submission._id,
              uploadedBy: userId || importRecord.uploadedBy,
              standardCode: doc.routing?.std || undefined,
              specCode: doc.routing?.spec || undefined,
              evidenceType: 'document',
              file: {
                filename,
                originalName: doc.sourceFilename || filename,
                mimeType:
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: buffer.byteLength,
                data: buffer.toString('base64'),
                encoding: 'base64',
                storageType: 'base64',
                uploadedAt: new Date(),
                uploadedBy: userId || importRecord.uploadedBy,
              } as any,
              description: title,
              versionNumber: 1,
              isCurrentVersion: true,
              isDeleted: false,
              linkedNarratives: [],
              tags: ['ai-import', `kind:${kind}`],
            });
            counts.evidenceFiles += 1;
            return {
              ...doc,
              fileId: String(evidence._id),
              fileName: filename,
            };
          })
        );
        (importRecord as any).aiEvidenceDocs = stampedDocs;
      } catch (err) {
        // Non-fatal: if SupportingEvidence creation fails the apply
        // continues with the un-stamped docs so the rail still shows
        // the cards. View-file will be unavailable but coordinators
        // can still see the captured snippet in the wizard.
        (importRecord as any).aiEvidenceDocs = payload.evidenceDocs;
        console.warn('[CR-040] evidenceDoc → SupportingEvidence packaging failed:', err);
      }
      (importRecord as any).markModified('aiEvidenceDocs');
    }
    if (Array.isArray(payload.cvs)) {
      // Package each ASSIGNED CV as a SupportingEvidence record so the faculty
      // CV shows up under the standard/substandard the coordinator routed it
      // to (the same reader-facing linkage evidenceDocs get above). A CV is
      // "assigned" once it carries a resolved (std, spec) — set in the Review
      // wizard's CV rail via updateCvRouting. Unassigned CVs are stored as-is
      // (aiCVs) with no SupportingEvidence yet; assigning them later + re-Apply
      // packages them then. Idempotent: a CV that already has fileId is skipped.
      try {
        const {
          Document,
          Packer,
          Paragraph,
          TextRun,
          HeadingLevel,
        } = await import('docx');
        const stampedCvs = await Promise.all(
          (payload.cvs as any[]).map(async (cv) => {
            const std = cv.resolvedStd || cv.routing?.std;
            const spec = cv.resolvedSpec || cv.routing?.spec;
            // Only package CVs the coordinator has routed to a spec. Skip
            // already-packaged CVs (re-apply / idempotent replay).
            if (cv.fileId || !std || !spec) return cv;

            const faculty = cv.facultyName || 'Faculty CV';
            const safeName =
              String(faculty).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) ||
              'cv';
            const children: any[] = [];
            children.push(
              new Paragraph({ text: faculty, heading: HeadingLevel.HEADING_1 })
            );
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `Faculty CV — supports Spec ${std}.${spec}`, italics: true }),
                ],
              })
            );
            children.push(
              new Paragraph({ text: 'Curriculum Vitae', heading: HeadingLevel.HEADING_2 })
            );
            const bodyText = String(cv.snippet || '(no captured body — see source document)');
            for (const p of bodyText.split(/\n\s*\n/)) {
              children.push(new Paragraph({ text: p.trim() }));
            }

            const docx = new Document({
              creator: 'CSHSE AI Importer',
              title: `${faculty} — CV`,
              description: `Faculty CV supporting Spec ${std}.${spec}`,
              sections: [{ properties: {}, children }],
            });
            const buffer = await Packer.toBuffer(docx);
            const filename = `${safeName}-CV.docx`;
            const evidence = await SupportingEvidence.create({
              institutionId: submission.institutionId,
              submissionId: submission._id,
              uploadedBy: userId || importRecord.uploadedBy,
              standardCode: std,
              specCode: spec,
              evidenceType: 'document',
              file: {
                filename,
                originalName: cv.sourceFilename || filename,
                mimeType:
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: buffer.byteLength,
                data: buffer.toString('base64'),
                encoding: 'base64',
                storageType: 'base64',
                uploadedAt: new Date(),
                uploadedBy: userId || importRecord.uploadedBy,
              } as any,
              description: `${faculty} — Curriculum Vitae`,
              versionNumber: 1,
              isCurrentVersion: true,
              isDeleted: false,
              linkedNarratives: [],
              tags: ['ai-import', 'kind:cv'],
            });
            counts.evidenceFiles += 1;
            return { ...cv, fileId: String(evidence._id), fileName: filename };
          })
        );
        (importRecord as any).aiCVs = stampedCvs;
      } catch (err) {
        // Non-fatal: keep the un-stamped CVs so the rail still shows the cards.
        (importRecord as any).aiCVs = payload.cvs;
        console.warn('[CV-assign] CV → SupportingEvidence packaging failed:', err);
      }
      (importRecord as any).markModified('aiCVs');
    }
    if (idempotencyKey) {
      (importRecord as any).aiLastIdempotencyKey = idempotencyKey;
    }
    await importRecord.save(session ? { session } : {});
  }
  // _runApplyBody returns normally; the caller (applyAIImportCore →
  // _applyAIImportWrites) catches any throw + handles rollback.
}

// ============================================================================
// POST /api/imports/:importId/redetect
//   — CR-040 follow-on: re-run cv_detector + appendix_paper_detector +
//   introduction_detector against the already-uploaded DOCX without
//   re-triggering the matcher. Used by the Review surface "Re-run
//   detectors" button for imports that predate a detector deploy. The
//   coordinator's existing review state (approvals, edits, discards)
//   is preserved by aiReviewMerge's dedupe-by-sectionId — only the
//   standalone cvs[] / evidenceDocs[] / introductions{} arrays get
//   refreshed.
// ============================================================================

export async function redetectImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  try {
    const _imp = await requireImportAccess(req, res, req.params.importId);
    if (!_imp) return;
    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      res.status(404).json({ error: 'Import not found' });
      return;
    }
    const submission = await Submission.findById(importRecord.submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found for this import' });
      return;
    }
    // Owner check — mirror _loadOwnedSubmission so a PC at institution A
    // can't redetect institution B's import.
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userInstId = (req.user as any)?.institutionId;
    const isElevated = userRole === 'admin' || (req.user as any)?.isSuperuser;
    if (
      !isElevated &&
      userRole === 'program_coordinator' &&
      userInstId &&
      (submission as any).institutionId &&
      (submission as any).institutionId.toString() !== userInstId
    ) {
      res.status(403).json({ error: 'Forbidden: cross-institution access' });
      return;
    }
    void userId;

    const s3Key = (importRecord as any).aiS3Key;
    if (!s3Key) {
      res.status(409).json({
        error: 'no-s3-key',
        detail: 'This import has no S3 key on record — redetect requires the original DOCX to still be in storage. Re-upload via the Importer Wizard instead.'
      });
      return;
    }

    // Synchronous round-trip to ai-service. Detectors are lexical
    // heuristics + a single walker pass; typical Stevenson-size doc
    // returns in <10s. We use the existing postToAIService wrapper so
    // HMAC signing + retries + timeouts ride along.
    const submissionDoc = await Submission.findById(importRecord.submissionId)
      .select('institutionId')
      .lean();
    const institutionIdStr = submissionDoc?.institutionId ? String(submissionDoc.institutionId) : null;
    let result: any;
    try {
      // CR-040 follow-on (2026-05-27) — long timeout + no retries.
      // Real Stevenson-class .docx (370MB+) needs >30s for mammoth
      // conversion alone; deep_walker + detector passes add another
      // ~20s. The default 30s × 5-retry config aborted the request
      // at attempt 1 and then re-aborted each retry — surfacing
      // "This operation was aborted" to the user with no result.
      // 5 minutes single attempt is the right shape for the redetect
      // workload: deterministic, bounded, no thundering herd of
      // mammoth conversions if the request was actually slow not
      // stuck.
      result = await postToAIService(
        '/ai/import/redetect',
        {
          s3Key,
          importId: String(importRecord._id),
          submissionId: String(importRecord.submissionId),
          institutionId: institutionIdStr
        },
        { perAttemptTimeoutMs: 5 * 60 * 1000, maxAttempts: 1 }
      );
    } catch (err: any) {
      res.status(502).json({
        error: 'ai-service-failed',
        detail: err?.message || String(err)
      });
      return;
    }
    if (!result || result.ok !== true) {
      res.status(502).json({
        error: 'ai-service-bad-shape',
        detail: 'ai-service did not return ok:true'
      });
      return;
    }

    // Update the SelfStudyImport with the freshly-detected output.
    (importRecord as any).aiCVs = result.cvs || [];
    (importRecord as any).markModified('aiCVs');
    (importRecord as any).aiEvidenceDocs = result.evidenceDocs || [];
    (importRecord as any).markModified('aiEvidenceDocs');
    (importRecord as any).aiIntroductionHints = result.introductionHints || {};
    (importRecord as any).markModified('aiIntroductionHints');
    await importRecord.save();

    // Re-merge into the persisted Review state so the Review surface
    // immediately reflects the new tiles. dedupe-by-sectionId means
    // existing review work (approvals, edits, discards on buckets/tags)
    // survives — only the standalone cvs/evidenceDocs/intros refresh.
    const state = (submission as any).aiReviewState || {
      buckets: {},
      tags: [],
      cvs: [],
      evidenceDocs: [],
      introductions: {},
      placeholderSections: [],
      approvedIds: [],
      discardedIds: [],
      itemSources: {},
      mergeLog: [],
      lastUpdatedAt: new Date()
    };
    const contentHash = aiReviewMerge.sha256Hex(
      `${importRecord.originalFilename}::${importRecord._id}`
    );
    aiReviewMerge.mergeImportIntoReviewState(state, {
      importId: String(importRecord._id),
      sourceFilename: importRecord.originalFilename || 'unknown.docx',
      sourceContentHash: contentHash,
      importedAt: new Date(),
      reimport: false,
      // Pass the EXISTING buckets/tags untouched — redetect only refreshes
      // the standalone arrays, never the per-spec buckets. Empty objects
      // would cause the merge to no-op those kinds (no items to add).
      buckets: {},
      tags: [],
      cvs: result.cvs || [],
      evidenceDocs: result.evidenceDocs || [],
      introductions: {},
      placeholderSections: []
    });
    (submission as any).aiReviewState = state;
    (submission as any).markModified('aiReviewState');
    await submission.save();

    // CR-040 follow-on (2026-05-27) — TOC-anchored second-pass
    // diagnostics. The ai-service now parses the document's Table of
    // Contents and adds any CVs/syllabi/papers it listed but the
    // pattern detector missed. Surface the TOC contribution so the
    // coordinator can see when the TOC saved a detection that
    // would otherwise have been lost.
    const counts = result.counts || {};
    const tocDiag = (result.tocDiagnostics || {}) as {
      tocEntriesFound?: number;
      tocAnchoredDetections?: number;
      tocAdded?: { cvs?: number; papers?: number; syllabi?: number };
    };
    const tocAdded = tocDiag.tocAdded || {};
    const tocAddedTotal =
      (tocAdded.cvs || 0) + (tocAdded.papers || 0) + (tocAdded.syllabi || 0);
    const syllabusWord = (counts.syllabi || 0) === 1 ? 'us' : 'i';
    const base = `Re-detect complete. Found ${counts.cvs || 0} CV(s), ${counts.papers || 0} paper(s), ${counts.syllabi || 0} syllab${syllabusWord}.`;
    const tocBlurb = tocAddedTotal > 0
      ? ` (TOC pass recovered ${tocAdded.cvs || 0} CV(s), ${tocAdded.papers || 0} paper(s), ${tocAdded.syllabi || 0} syllab${(tocAdded.syllabi || 0) === 1 ? 'us' : 'i'} the pattern detector missed.)`
      : '';

    res.json({
      ok: true,
      counts,
      tocDiagnostics: tocDiag,
      message: base + tocBlurb
    });
  } catch (err: any) {
    console.error('redetectImport error', err);
    res.status(500).json({ error: 'redetect-failed', detail: err?.message || String(err) });
  }
}

// ============================================================================
// POST /api/imports/:importId/restart-ai  (re-run with a different format)
// ============================================================================

export async function restartAIImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const { forceFormat = null } = req.body || {};
  if (forceFormat !== null && !['template', 'self_study', 'mcc_narrative'].includes(forceFormat)) {
    res.status(400).json({ error: `Invalid forceFormat: ${forceFormat}` });
    return;
  }

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  // Cancel the in-flight job at the AI service if there is one. Best-effort —
  // a failure here doesn't block the restart.
  if (importRecord.aiJobId) {
    try {
      await postToAIService(`/ai/import/${importRecord.aiJobId}/cancel`, {});
    } catch (err) {
      console.warn(`[ai-import] cancel previous job ${importRecord.aiJobId} failed:`, err);
    }
  }

  importRecord.aiForceFormat = forceFormat;
  importRecord.aiStatus = 'queued';
  importRecord.aiBuckets = undefined as any;
  importRecord.markModified('aiBuckets');
  importRecord.aiTags = [];
  importRecord.aiPlaceholderSections = [];
  importRecord.aiStages = [];
  importRecord.aiErrors = [];

  try {
    const callbackUrl = `${getServerPublicUrl()}/api/imports/${importId}/ai-callback`;
    const eventCallbackUrl = `${getServerPublicUrl()}/api/imports/${importId}/ai-event`;
    const submissionDoc2 = await Submission.findById(importRecord.submissionId)
      .select('institutionId')
      .lean();
    const institutionIdStr = submissionDoc2?.institutionId
      ? String(submissionDoc2.institutionId)
      : null;
    const snapshot = await postToAIService('/ai/import/start', {
      s3Key: importRecord.aiS3Key,
      submissionId: String(importRecord.submissionId),
      importId: String(importId),
      programLevel: importRecord.aiProgramLevel || 'bachelors',
      forceFormat,
      callbackUrl,
      eventCallbackUrl,
      institutionId: institutionIdStr
    });
    importRecord.aiJobId = snapshot.jobId;
    importRecord.aiStatus = snapshot.status;
    importRecord.aiQueuePosition = snapshot.queuePosition ?? null;
    importRecord.aiQueueDepth = snapshot.queueDepth ?? null;
    importRecord.aiEtaSeconds = snapshot.etaSeconds ?? null;
    await importRecord.save();
    res.status(202).json({
      importId: String(importId),
      jobId: snapshot.jobId,
      status: snapshot.status,
      queuePosition: snapshot.queuePosition ?? null,
      queueDepth: snapshot.queueDepth ?? null
    });
  } catch (err: any) {
    importRecord.aiStatus = 'failed';
    importRecord.aiErrors = [`restart-ai failed: ${err?.message || String(err)}`];
    await importRecord.save();
    res.status(502).json({ error: 'AI service unreachable', detail: err?.message || String(err) });
  }
}

// ============================================================================
// POST /api/imports/:importId/reanchor-source — repair Compare anchors
// ============================================================================
//
// The Compare pane locates a review item by matching its sectionId to a
// data-section-id anchor in the stored source HTML. Older imports (template
// path built NO source HTML; MCC anchored only narratives) left items
// unanchored, so Compare showed "section not located — showing top". This
// rebuilds/repairs the source HTML from the CURRENT aiReviewState — anchoring
// EVERY narrative/evidence/intro item — WITHOUT re-parsing (no cost, preserves
// all review + editor state). Mirrors ai-service `_ensure_all_items_anchored`.

function _escHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// POST /api/imports/:importId/contract-check — run the §7 required-output
// contract checker (CR-073 verifier) over this import's parse result + source
// HTML. Returns the ContractResult (anchors gate + coverage/file-type/loss
// metrics + findings). Used by the golden regression tests + Parser Train.
export async function contractCheckImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  try {
    const result = await checkParserContract(req.params.importId);
    res.json(result);
  } catch (err: any) {
    console.error('[contract-check] failed:', err);
    res.status(500).json({ error: 'contract-check failed', detail: err?.message || String(err) });
  }
}

export async function reanchorImportSource(req: AuthenticatedRequest, res: Response): Promise<void> {
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const importId = req.params.importId;
  try {
    const importRecord = await SelfStudyImport.findById(importId).select('submissionId').lean();
    if (!importRecord) {
      res.status(404).json({ error: 'Import not found' });
      return;
    }
    const sub: any = await Submission.findById((importRecord as any).submissionId)
      .select('aiReviewState')
      .lean();
    const rs: any = sub?.aiReviewState || {};

    let html = '';
    try {
      html = await gridFsService.getHtmlContent(importId);
    } catch {
      html = '';
    }
    const hadAnchors = /data-section-id=/.test(html);
    const have = new Set<string>(
      [...html.matchAll(/data-section-id="([^"]+)"/g)].map((m) => m[1])
    );
    const parts: string[] = [];
    const emit = (it: any) => {
      const sid = it?.sectionId;
      if (!sid || have.has(sid)) return;
      have.add(sid);
      const heading = _escHtml(String(it.heading || '').trim());
      const raw = it.htmlSnippet;
      const body =
        typeof raw === 'string' && raw.trim()
          ? raw
          : `<p>${_escHtml(String(it.snippet || '').trim())}</p>`;
      parts.push(
        `<section data-section-id="${_escHtml(sid)}">${heading ? `<h3>${heading}</h3>` : ''}${body}</section>`
      );
    };
    for (const ib of Object.values(rs.introductions || {})) {
      for (const it of ((ib as any)?.items || [])) emit(it);
    }
    for (const bk of Object.values(rs.buckets || {})) {
      for (const kind of ['narratives', 'evidenceText', 'evidenceFiles']) {
        for (const it of ((bk as any)?.[kind] || [])) emit(it);
      }
    }
    for (const it of rs.tags || []) emit(it);

    if (parts.length === 0) {
      res.json({ ok: true, added: 0, totalAnchors: have.size, changed: false });
      return;
    }
    const block = `<div data-anchors="review-items">${parts.join('')}</div>`;
    let out: string;
    if (!hadAnchors) {
      // Template / raw-HTML import → clean anchored rebuild (matches new imports).
      out =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
        'body{font-family:Arial,sans-serif;line-height:1.6;padding:20px;max-width:100%;}' +
        'section{margin:0 0 1.25rem;}h3{margin:0 0 .35rem;font-size:1rem;}' +
        '</style></head><body>' + parts.join('') + '</body></html>';
    } else if (html.includes('</body>')) {
      out = html.replace('</body>', block + '</body>');
    } else {
      out = html + block;
    }
    await gridFsService.storeHtmlContent(importId, out);
    res.json({ ok: true, added: parts.length, totalAnchors: have.size, changed: true, rebuilt: !hadAnchors });
  } catch (err: any) {
    console.error('[reanchor-source] failed:', err);
    res.status(500).json({ error: 'reanchor failed', detail: err?.message || String(err) });
  }
}

// ============================================================================
// POST /api/imports/:importId/corrections — coordinator-supplied corrections
// ============================================================================
//
// When the wizard's matcher misses a spec, the coordinator highlights the
// source passage in the wizard's source viewer and posts a correction here.
// The row is persisted AND forwarded to cshse-ai which embeds `sourceText`
// and stores it in Qdrant for use as a few-shot example in future runs.
//
// Forward is best-effort: if cshse-ai is down the Mongo row still lands,
// and a background reconciler (sub-sprint 2.x) can replay un-ingested
// rows later. The wizard's local bucket update happens independently —
// this route just records the truth.

type CorrectionPayload = {
  expectedStd: string;
  expectedSpec: string;
  expectedSectionType?: ExpectedSectionType;
  sourceHeading?: string;
  sourceText: string;
  sourceLocation?: {
    paragraphIndex?: number;
    byteOffsetStart?: number;
    byteOffsetEnd?: number;
  };
  correctionType?: CorrectionType;
};

export async function createImportCorrection(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const payload = (req.body || {}) as CorrectionPayload;

  if (!payload.sourceText || !payload.expectedStd || !payload.expectedSpec) {
    res.status(400).json({
      error: 'expectedStd, expectedSpec, and sourceText are required'
    });
    return;
  }

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }
  const submission = await Submission.findById(importRecord.submissionId);
  if (!submission || !submission.institutionId) {
    res.status(404).json({ error: 'Submission or institution not found' });
    return;
  }

  const correction = await ImportCorrection.create({
    submissionId: importRecord.submissionId,
    importId: importRecord._id,
    institutionId: submission.institutionId,
    programLevel: importRecord.aiProgramLevel || 'bachelors',
    documentFormat: importRecord.aiFormat?.format || 'self_study',
    expectedStd: payload.expectedStd,
    expectedSpec: payload.expectedSpec,
    expectedSectionType: payload.expectedSectionType || 'narrative_response',
    sourceHeading: payload.sourceHeading || '',
    sourceText: payload.sourceText,
    sourceLocation: payload.sourceLocation,
    correctionType: payload.correctionType || 'missed-by-matcher',
    correctedBy: new mongoose.Types.ObjectId(req.user!._id)
  });

  // Forward to cshse-ai best-effort. Don't block the response — the wizard
  // already shows the spec card filled locally; the embedding is just for
  // future few-shot retrieval.
  postToAIService('/ai/corrections/ingest', {
    correctionId: String(correction._id),
    institutionId: String(submission.institutionId),
    programLevel: correction.programLevel,
    expectedStd: correction.expectedStd,
    expectedSpec: correction.expectedSpec,
    expectedSectionType: correction.expectedSectionType,
    sourceHeading: correction.sourceHeading,
    sourceText: correction.sourceText,
    correctionType: correction.correctionType
  }).catch((err) => {
    // Log + leave the row; reconciler can replay.
    console.warn(
      `[corrections] ai-service ingest failed for ${correction._id}:`,
      err?.message || err
    );
  });

  res.status(201).json({
    ok: true,
    correctionId: String(correction._id),
    expectedStd: correction.expectedStd,
    expectedSpec: correction.expectedSpec
  });
}

export async function listImportCorrections(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }
  // Same-submission corrections (the wizard's "you've filed N corrections"
  // banner). Older Stevenson runs share a submissionId so the count rolls
  // forward across re-imports of the same self-study.
  const rows = await ImportCorrection.find({ submissionId: importRecord.submissionId })
    .sort({ correctedAt: -1 })
    .lean();
  res.json({
    importId,
    count: rows.length,
    corrections: rows.map((r) => ({
      _id: String(r._id),
      expectedStd: r.expectedStd,
      expectedSpec: r.expectedSpec,
      sourceHeading: r.sourceHeading,
      sourceText: r.sourceText.slice(0, 200),
      correctionType: r.correctionType,
      correctedAt: r.correctedAt
    }))
  });
}

/**
 * CR-025 — Infer column → course mappings for one curriculum matrix.
 *
 * The wizard's Matrix step posts to this endpoint per matrix when the
 * coordinator lands on the step (or clicks "Run AI column inference").
 * We pull the institutionId off the user/submission, grab the raw
 * `<table>` HTML + the surrounding-narrative context from the import
 * record, then call cshse-ai's /ai/matrix/infer-columns.
 *
 * Returns suggestions for every column 0..N-1 in the same shape as
 * cshse-ai returns; never throws — falls back to empty suggestions on
 * upstream failure so the wizard reverts to the legacy free-text inputs.
 */
export async function inferMatrixColumns(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const { matrixSlug } = req.body || {};
  if (!matrixSlug) {
    res.status(400).json({ error: 'matrixSlug is required' });
    return;
  }

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  const submission = importRecord.submissionId
    ? await Submission.findById(importRecord.submissionId)
    : null;

  const aiMatrices: any[] = (importRecord as any).aiMatrices || [];
  const matrix = aiMatrices.find((m: any) => m.matrixId === matrixSlug || m.matrixSlug === matrixSlug);
  if (!matrix) {
    res.status(404).json({ error: `Matrix ${matrixSlug} not found on this import` });
    return;
  }

  const columnCount = matrix.columnCount || (matrix.columnHeaders || []).length || 0;
  if (columnCount === 0) {
    res.json({ matrixSlug, suggestions: [] });
    return;
  }

  // Pull surrounding context from any narrative buckets the matcher
  // already linked to the matrix's standards. Best-effort — cshse-ai
  // still has the raw HTML from its own ingest run as well.
  let surroundingContext = '';
  const buckets: Record<string, any> = (importRecord as any).aiBuckets || {};
  for (const k of Object.keys(buckets)) {
    if (k.startsWith('11.') || k.startsWith('12.') || k.startsWith('13.')) {
      const b = buckets[k];
      for (const n of [...(b?.narratives || []), ...(b?.evidenceText || [])]) {
        if (typeof n?.snippet === 'string') surroundingContext += '\n' + n.snippet;
        if (surroundingContext.length > 4000) break;
      }
    }
    if (surroundingContext.length > 4000) break;
  }

  try {
    const result = await postToAIService('/ai/matrix/infer-columns', {
      matrixSlug,
      institutionId: submission?.institutionId ? String(submission.institutionId) : null,
      programLevel: submission?.programLevel || (importRecord as any).aiProgramLevel || 'bachelors',
      rawTableHtml: matrix.htmlSnippet || '',
      columnCount,
      surroundingContext: surroundingContext.slice(0, 4000),
      knownCourses: matrix.columnHeaders || []
    });
    res.json(result);
  } catch (err: any) {
    console.warn(
      `[matrix-infer] cshse-ai inference failed for ${importId}/${matrixSlug}:`,
      err?.message || err
    );
    // Soft-fail: pad an empty-suggestion array so the client UI can render
    // the dropdown empty and let the PC type free-text.
    const empty = Array.from({ length: columnCount }, (_, i) => ({
      columnIndex: i,
      suggestedCourse: null,
      confidence: 0.0,
      rationale: 'ai-service unavailable; please type the course code'
    }));
    res.json({ matrixSlug, suggestions: empty });
  }
}

/**
 * CR-025 — Persist a coordinator-confirmed column → course mapping.
 *
 * Called when the coordinator clicks Accept on an AI suggestion or
 * types in a free-text override. We forward to cshse-ai which upserts
 * into the per-institution Qdrant collection. Best-effort: a failure
 * here is logged but does not block the wizard.
 */
export async function confirmMatrixColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const { matrixSlug, columnIndex, course, priorConfidence } = req.body || {};

  if (!matrixSlug || typeof columnIndex !== 'number' || !course) {
    res.status(400).json({ error: 'matrixSlug, columnIndex, course required' });
    return;
  }

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }
  const submission = importRecord.submissionId
    ? await Submission.findById(importRecord.submissionId)
    : null;
  if (!submission?.institutionId) {
    res.status(400).json({ error: 'Submission has no institutionId — cannot scope mapping' });
    return;
  }

  postToAIService('/ai/matrix/confirm-column', {
    institutionId: String(submission.institutionId),
    programLevel: submission.programLevel || 'bachelors',
    matrixSlug,
    columnIndex,
    course: String(course).trim(),
    priorConfidence: typeof priorConfidence === 'number' ? priorConfidence : 1.0
  }).catch((err) => {
    console.warn(
      `[matrix-confirm] cshse-ai persist failed for ${importId}/${matrixSlug}/${columnIndex}:`,
      err?.message || err
    );
  });

  res.status(201).json({
    ok: true,
    matrixSlug,
    columnIndex,
    course: String(course).trim()
  });
}

/**
 * CR-030 — Infer the subspec for a matrix row when the standard is known
 * but the extractor couldn't pin the subspec letter ('?').
 *
 * The wizard's matrix step calls this on demand when the coordinator
 * clicks "Suggest subspec" on a `?`-marked row. We forward to cshse-ai
 * which loads the Handbook spec list for the standard, builds a Haiku
 * prompt listing the candidates, and returns a confidence-ranked pick.
 *
 * Soft-fails to suggestedSpec=null on upstream failure so the UI can
 * fall back to manual entry rather than 500.
 */
export async function inferMatrixRowSpec(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const _imp = await requireImportAccess(req, res, req.params.importId);
  if (!_imp) return;
  const { rowPrompt, standardCode } = req.body || {};

  if (!rowPrompt || !standardCode) {
    res.status(400).json({ error: 'rowPrompt and standardCode are required' });
    return;
  }

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  const submission = importRecord.submissionId
    ? await Submission.findById(importRecord.submissionId)
    : null;

  // Surrounding-narrative context: grab a few applied buckets for the same
  // standard to give Haiku additional disambiguating signal.
  let surroundingContext = '';
  const buckets: Record<string, any> = (importRecord as any).aiBuckets || {};
  for (const k of Object.keys(buckets)) {
    if (k.startsWith(`${standardCode}.`)) {
      const b = buckets[k];
      for (const n of [...(b?.narratives || []), ...(b?.evidenceText || [])]) {
        if (typeof n?.snippet === 'string') surroundingContext += '\n' + n.snippet;
        if (surroundingContext.length > 3000) break;
      }
    }
    if (surroundingContext.length > 3000) break;
  }

  try {
    const result = await postToAIService('/ai/matrix/infer-row-spec', {
      rowPrompt: String(rowPrompt),
      standardCode: String(standardCode),
      programLevel: submission?.programLevel || (importRecord as any).aiProgramLevel || 'bachelors',
      surroundingContext: surroundingContext.slice(0, 3000)
    });
    res.json(result);
  } catch (err: any) {
    console.warn(
      `[matrix-row-spec] cshse-ai inference failed for ${importId}/${standardCode}:`,
      err?.message || err
    );
    res.json({
      suggestedSpec: null,
      confidence: 0.0,
      rationale: 'ai-service unavailable; please pick a subspec manually',
      candidateSpecs: []
    });
  }
}

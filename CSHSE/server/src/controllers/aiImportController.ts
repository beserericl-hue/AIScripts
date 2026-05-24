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

// Env vars read lazily so tests that set them in beforeEach see the new value.
function getAIServiceUrl(): string {
  return process.env.AI_SERVICE_URL || 'http://ai-service.railway.internal:8080';
}

function getAIServiceSecret(): string {
  return process.env.NODE_SERVICE_HMAC_SECRET || '';
}

function getServerPublicUrl(): string {
  return process.env.SERVER_PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3001';
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
    errors: importRecord.aiErrors || []
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

async function postToAIService(path: string, payload: object): Promise<any> {
  const body = JSON.stringify(payload);
  const { signature } = signOutgoing(body);
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= AI_SERVICE_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_SERVICE_PER_ATTEMPT_TIMEOUT_MS);
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
    if (attempt < AI_SERVICE_MAX_ATTEMPTS) {
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

export async function startAIImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const { programLevel = 'bachelors', forceFormat = null, isReimport = false } = req.body || {};

  if (!['associate', 'bachelors', 'masters'].includes(programLevel)) {
    res.status(400).json({ error: `Invalid programLevel: ${programLevel}` });
    return;
  }
  if (forceFormat !== null && !['template', 'self_study'].includes(forceFormat)) {
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
  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  // Persist whatever the AI service sent us so polling fallback + page
  // reload both see consistent state.
  if (payload.status) importRecord.aiStatus = payload.status;
  if ('queuePosition' in payload) importRecord.aiQueuePosition = payload.queuePosition;
  if ('queueDepth' in payload) importRecord.aiQueueDepth = payload.queueDepth;
  if ('etaSeconds' in payload) importRecord.aiEtaSeconds = payload.etaSeconds;
  if (payload.format) importRecord.aiFormat = payload.format;
  if (Array.isArray(payload.stages)) importRecord.aiStages = payload.stages;
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    importRecord.aiErrors = payload.errors;
  }
  await importRecord.save();

  // Fan out to any connected SSE clients.
  broadcastSSE(importId, buildSnapshotFromImport(importRecord));
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
    const totalAll = totalItems + totalTags + totalMatrices;
    const hasReportedErrors =
      Array.isArray(payload.errors) && payload.errors.length > 0;
    if (totalAll === 0 && !hasReportedErrors) {
      console.warn(
        `[cr-037] empty-buckets terminal callback for import=${importId}; rewriting to failed`
      );
      payload.status = 'failed';
      payload.errors = [
        ...(Array.isArray(payload.errors) ? payload.errors : []),
        {
          stage: 'matcher',
          severity: 'error',
          message:
            'AI matcher returned zero items. The document may be malformed or all sections may have failed individually. Try re-uploading; contact support if this persists.'
        }
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
  importRecord.aiCompletedAt = new Date();
  importRecord.aiQueuePosition = null;
  importRecord.aiQueueDepth = null;
  await importRecord.save();

  // Final SSE event, then connected clients drop the EventSource.
  broadcastSSE(importId, buildSnapshotFromImport(importRecord));
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

export async function applyAIImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const payload: ApplyPayload = req.body || {};

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }
  if (importRecord.aiStatus !== 'parsed' && importRecord.aiStatus !== 'failed' && importRecord.aiStatus !== 'applied') {
    res.status(409).json({
      error: `Cannot apply from status ${importRecord.aiStatus}; must be parsed.`,
      status: importRecord.aiStatus
    });
    return;
  }

  // Idempotency short-circuit. We stash the last successful idempotency key
  // on the record alongside the counts; a retry with the same key returns
  // the cached response without re-writing anything.
  const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : null;
  if (idempotencyKey && (importRecord as any).aiLastIdempotencyKey === idempotencyKey && importRecord.aiAppliedCounts) {
    res.json({
      ok: true,
      idempotentReplay: true,
      status: importRecord.aiStatus,
      appliedCounts: importRecord.aiAppliedCounts,
      tagsRemaining: (importRecord.aiTags || []).length
    });
    return;
  }

  const submission = await Submission.findById(importRecord.submissionId);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found for this import' });
    return;
  }

  importRecord.aiStatus = 'applying';
  await importRecord.save();

  // Atomicity model: we want a Mongo transaction wrapping Submission +
  // SelfStudyImport saves. mongodb-memory-server runs a standalone mongod
  // by default and rejects transactions; production runs on Railway with
  // a replica set that supports them. Use a session iff
  // MONGO_SUPPORTS_TRANSACTIONS=true (set in production env). Otherwise
  // save sequentially and lean on the idempotency-key replay for retry
  // safety.
  const useTransaction = process.env.MONGO_SUPPORTS_TRANSACTIONS === 'true';
  const session = useTransaction ? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  const counts = {
    narratives: 0,
    evidenceText: 0,
    evidenceFiles: 0,
    matrixCells: 0,
    tags: 0,
    placeholders: 0
  };
  try {
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
      const userId = req.user!._id;
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
      (importRecord as any).aiEvidenceDocs = payload.evidenceDocs;
      (importRecord as any).markModified('aiEvidenceDocs');
    }
    if (Array.isArray(payload.cvs)) {
      (importRecord as any).aiCVs = payload.cvs;
      (importRecord as any).markModified('aiCVs');
    }
    if (idempotencyKey) {
      (importRecord as any).aiLastIdempotencyKey = idempotencyKey;
    }
    await importRecord.save(session ? { session } : {});

    if (session) {
      await session.commitTransaction();
    }
  } catch (err: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore
      }
    }
    importRecord.aiStatus = 'parsed';
    importRecord.aiErrors = [
      ...(importRecord.aiErrors || []),
      `apply-ai failed: ${err?.message || String(err)}`
    ];
    try {
      await importRecord.save();
    } catch {
      // Best-effort error persistence; the 5xx tells the client to retry.
    }
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      status: 'parsed'
    });
    return;
  } finally {
    if (session) await session.endSession();
  }

  broadcastSSE(importId, buildSnapshotFromImport(importRecord));
  res.json({
    ok: true,
    status: 'applied',
    appliedCounts: counts,
    tagsRemaining: (importRecord.aiTags || []).length
  });
}

// ============================================================================
// POST /api/imports/:importId/restart-ai  (re-run with a different format)
// ============================================================================

export async function restartAIImport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { importId } = req.params;
  const { forceFormat = null } = req.body || {};
  if (forceFormat !== null && !['template', 'self_study'].includes(forceFormat)) {
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

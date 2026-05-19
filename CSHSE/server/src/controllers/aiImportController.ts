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

async function postToAIService(path: string, payload: object): Promise<any> {
  const body = JSON.stringify(payload);
  const { signature } = signOutgoing(body);
  const res = await fetch(`${getAIServiceUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Signature': signature
    },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI service ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
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
      eventCallbackUrl
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
    await SelfStudyImport.findByIdAndUpdate(importId, {
      $set: {
        aiStatus: 'failed',
        aiErrors: [`start-ai failed: ${err?.message || String(err)}`]
      }
    });
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
  if (Array.isArray(payload.matrices)) importRecord.aiMatrices = payload.matrices;
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

type ApplyPayload = {
  narratives?: Record<string, Record<string, { content: string; mode?: 'merge' | 'replace' | 'keep' | 'take' }>>;
  supportingEvidenceText?: Record<string, Record<string, { text: string; mode?: 'merge' | 'replace' | 'keep' | 'take' }>>;
  supportingEvidenceFiles?: Array<{ std: string; spec: string; sectionId?: string; title?: string; snippet?: string }>;
  matrixCells?: any[];
  importTags?: any[];
  placeholderSections?: any[];
  globalMergeMode?: 'merge' | 'replace' | 'per_spec';
  perSpecResolution?: Record<string, 'keep' | 'take' | 'merge'>;
  idempotencyKey?: string;
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

    counts.matrixCells = (payload.matrixCells || []).length;
    counts.tags = (payload.importTags || []).length;
    counts.placeholders = (payload.placeholderSections || []).length;

    (submission as any).markModified('narratives');
    await submission.save(session ? { session } : {});

    importRecord.aiStatus = 'applied';
    importRecord.aiAppliedAt = new Date();
    importRecord.aiAppliedCounts = counts;
    importRecord.aiTags = (payload.importTags || []) as any;
    importRecord.aiPlaceholderSections = (payload.placeholderSections || []) as any;
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
    const snapshot = await postToAIService('/ai/import/start', {
      s3Key: importRecord.aiS3Key,
      submissionId: String(importRecord.submissionId),
      importId: String(importId),
      programLevel: importRecord.aiProgramLevel || 'bachelors',
      forceFormat,
      callbackUrl,
      eventCallbackUrl
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

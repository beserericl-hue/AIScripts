/**
 * CR-018 — typed client for the cshse-ai (Python FastAPI) service.
 *
 * Phase 1 (this commit): the three evidence-review methods + a shared
 * `postSigned` helper that handles HMAC signing. The evidence endpoints
 * server-side return HTTP 501 with a `{ phase, ready, detail }` body
 * until Phase 2 lands the real matcher / RAG / scoring logic; callers
 * branch on the `ready` flag rather than the HTTP status so feature
 * detection is robust against deploy ordering.
 *
 * Phase 2 will replace the `_unwrapStubResponse` helper with the real
 * response-shape parsing; no other call-site change needed.
 *
 * The existing `postToAIService` helper in aiImportController.ts is
 * kept as-is to avoid touching the AI-Import path during this CR. A
 * follow-on can hoist that function into this module if we want one
 * single source of truth for cshse-ai HTTP.
 */
import crypto from 'crypto';

function getAIServiceUrl(): string {
  return process.env.AI_SERVICE_URL || 'http://ai-service.railway.internal:8080';
}

function getAIServiceSecret(): string {
  return process.env.NODE_SERVICE_HMAC_SECRET || '';
}

function signOutgoing(body: string): { signature: string } {
  const secret = getAIServiceSecret();
  const ts = Math.floor(Date.now() / 1000).toString();
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${body}`)
    .digest('hex');
  return { signature: `t=${ts},v1=${digest}` };
}

// Default per-call timeout so a stuck ai-service can't hang a caller
// (e.g. the submit path's section evaluation). Overridable per call.
const DEFAULT_TIMEOUT_MS = 60_000;

async function postSigned<T>(
  path: string,
  payload: object,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{
  status: number;
  body: T;
}> {
  const body = JSON.stringify(payload);
  const { signature } = signOutgoing(body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${getAIServiceUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Signature': signature
      },
      body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { rawText: text };
  }
  return { status: res.status, body: parsed as T };
}

/**
 * Phase-1 helper: callers wrap a `postSigned` call here to treat the
 * server-side 501 stub as a structured "feature not ready" response
 * rather than an error. Returns `{ ready: false, ...phaseBody }` when
 * the server hasn't shipped Phase 2 yet, or `{ ready: true, data }`
 * once it has.
 */
function _unwrapStubResponse<T>(
  res: { status: number; body: any }
): { ready: false; phase: string; detail: string } | { ready: true; data: T } {
  if (res.status === 501 && res.body && res.body.ready === false) {
    return {
      ready: false,
      phase: res.body.phase ?? 'unknown',
      detail: res.body.detail ?? 'evidence endpoint not implemented yet'
    };
  }
  if (res.status >= 400) {
    throw new Error(
      `cshse-ai returned ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`
    );
  }
  return { ready: true, data: res.body as T };
}

// ============================================================================
// CR-018 — Evidence-review surface
// ============================================================================

export interface EvidenceExtractRequest {
  institutionId: string;
  submissionId: string;
  documentId?: string;
  /** Highest-priority input: already-extracted markdown. */
  markdown?: string;
  /** Inline PDF bytes (base64). */
  pdfBase64?: string;
  /** S3/Tigris object key. Required when neither markdown nor pdfBase64 is set. */
  documentS3Key?: string;
  /** Use 'application/pdf' to trigger the pypdf path on documentS3Key. */
  documentMimeType?: string;
  sourceFilename?: string;
}

export interface EvidenceRecommendRequest {
  institutionId: string;
  submissionId: string;
  standardCode: string;
  specCode: string;
  topK?: number;
}

export interface EvidenceScoreRequest {
  institutionId: string;
  submissionId: string;
  standardCode: string;
  specCode: string;
  candidateChunks: unknown[];
  matrixRows?: unknown[];
}

export async function extractEvidence(req: EvidenceExtractRequest) {
  const res = await postSigned('/ai/evidence/extract', req);
  return _unwrapStubResponse<{
    chunksUpserted: number;
    collection: string;
    pdfSource?: 'pdfBase64' | 'documentS3Key';
    extractedChars?: number;
  }>(res);
}

export async function recommendEvidence(req: EvidenceRecommendRequest) {
  const res = await postSigned('/ai/evidence/recommend', req);
  return _unwrapStubResponse<{
    chunks: Array<{ chunkId: string; score: number; payload: unknown }>;
  }>(res);
}

export async function scoreEvidence(req: EvidenceScoreRequest) {
  const res = await postSigned('/ai/evidence/score', req);
  return _unwrapStubResponse<{
    confidence: number;
    rationale: string;
    citations: Array<{ chunkId?: string; matrixRowAnchor?: string }>;
  }>(res);
}

// ---------------------------------------------------------------------------
// CR-049 — section evaluation against the reader-review criteria.
// ---------------------------------------------------------------------------

export interface SectionEvaluateSpec {
  standardCode: string;
  specCode: string;
  criteria: string;
}

export interface SectionEvaluateRequest {
  institutionId: string;
  submissionId: string;
  // CR-049 Sprint 2.5 finish — programLevel is required by ai-service to
  // scope the corrections-RAG hints lookup (per-institution AND
  // per-program-level so bachelors corrections don't bleed into masters).
  programLevel: 'associate' | 'bachelors' | 'masters';
  specs: SectionEvaluateSpec[];
  narrativeHtml?: string;
  supportingEvidenceText?: string[];
  files?: Array<{ s3Key?: string; filename?: string; mimeType?: string }>;
  webLinks?: string[];
}

export interface SectionEvaluateVerdict {
  standardCode: string;
  specCode: string;
  verdict: 'pass' | 'needs_improvement' | 'fail';
  rationale: string;
  criteriaCoverage: Array<{ criterion: string; met: boolean; note?: string }>;
  improvementSuggestions: string[];
  sourcesUsed: Record<string, unknown>;
}

export interface SectionEvaluateResponse {
  perSpec: SectionEvaluateVerdict[];
  links: Array<{ url: string; evaluable: boolean; reason?: string }>;
}

/**
 * CR-049 — evaluate one or many specs of a section against the reader
 * criteria. Throws on a non-2xx so the caller can fail-soft.
 */
export async function evaluateSection(
  req: SectionEvaluateRequest
): Promise<SectionEvaluateResponse> {
  const res = await postSigned<SectionEvaluateResponse>('/ai/section/evaluate', req);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`section/evaluate returned HTTP ${res.status}`);
  }
  return res.body;
}

export interface CorrectionIngestRequest {
  correctionId: string;
  institutionId: string;
  programLevel: string;
  expectedStd: string;
  expectedSpec: string;
  expectedSectionType?: string;
  sourceHeading?: string;
  sourceText: string;
  correctionType?: string;
}

/**
 * CR-049 Phase 4b — feed a correction into the institution's RAG store so
 * future evaluations learn from it (e.g. a reader's `section_eval_override`).
 * Throws on non-2xx so the caller can treat learning as best-effort.
 */
export async function ingestCorrection(req: CorrectionIngestRequest): Promise<{ ok: boolean }> {
  const res = await postSigned<{ ok?: boolean }>('/ai/corrections/ingest', req);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`corrections/ingest returned HTTP ${res.status}`);
  }
  return { ok: true };
}

/**
 * Convenience predicate for call sites that want to gate on whether
 * Phase 2 has shipped. Wraps a recommend() call against an obviously
 * non-real institution + spec so a 501 short-circuits without touching
 * real data.
 */
export async function isEvidencePhase2Ready(): Promise<boolean> {
  try {
    const out = await recommendEvidence({
      institutionId: '000000000000000000000000',
      submissionId: '000000000000000000000000',
      standardCode: '_health',
      specCode: '_check',
      topK: 1
    });
    return out.ready;
  } catch {
    return false;
  }
}

import os

import httpx
from anthropic import Anthropic
from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient

from app.auth import verify_hmac_signature
from app.config import get_settings
from app.import_jobs import cancel_job, enqueue_job, get_job

GIT_SHA = os.environ.get("RAILWAY_GIT_COMMIT_SHA", "unknown")[:8]
VERSION = "0.1.0"

app = FastAPI(title="cshse-ai", version=VERSION)


@app.get("/health")
def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "version": VERSION,
        "git": GIT_SHA,
        "env": s.cshse_env,
    }


@app.get("/health/qdrant")
def health_qdrant() -> dict:
    s = get_settings()
    client = QdrantClient(url=s.qdrant_url, api_key=s.qdrant_api_key or None)
    collections = client.get_collections()
    return {
        "reachable": True,
        "collection_count": len(collections.collections),
        "collections": [c.name for c in collections.collections],
    }


@app.get("/health/anthropic")
def health_anthropic() -> dict:
    s = get_settings()
    if not s.anthropic_api_key:
        return {"reachable": False, "reason": "no key configured"}
    client = Anthropic(api_key=s.anthropic_api_key)
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=8,
        messages=[{"role": "user", "content": "ping"}],
    )
    return {"reachable": True, "model": msg.model}


@app.get("/health/openai")
def health_openai() -> dict:
    s = get_settings()
    if not s.openai_api_key:
        return {"reachable": False, "reason": "no key configured"}
    with httpx.Client(timeout=10.0) as c:
        r = c.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {s.openai_api_key}"},
        )
        r.raise_for_status()
    return {"reachable": True}


# ============================================================================
# AI Import Wizard endpoints (Sprint 1)
# ============================================================================
#
# Called by the CSHSE Express server, never by the browser directly. Both the
# inbound POST /ai/import/start and the outbound webhooks
# (ai-event / ai-callback) are protected by HMAC signature so the two services
# can trust each other without sharing a secret with the user.


class StartImportRequest(BaseModel):
    s3Key: str = Field(..., description="Tigris/S3 object key for the uploaded DOCX.")
    submissionId: str
    importId: str
    programLevel: str = Field(default="bachelors")
    forceFormat: str | None = Field(default=None, description="'template' | 'self_study' to skip auto-detect.")
    callbackUrl: str = Field(..., description="Terminal-state webhook on the CSHSE server.")
    eventCallbackUrl: str = Field(..., description="Per-stage progress webhook on the CSHSE server.")
    institutionId: str | None = Field(
        default=None,
        description=(
            "Per-institution scope key. Used by the corrections RAG so a "
            "school's accumulated corrections shape ONLY its own future "
            "matcher runs. Omitting it disables few-shot retrieval for "
            "the job (safer than leaking cross-school examples)."
        ),
    )


class CorrectionIngestRequest(BaseModel):
    correctionId: str
    institutionId: str
    programLevel: str
    expectedStd: str
    expectedSpec: str
    expectedSectionType: str = "narrative_response"
    sourceHeading: str = ""
    sourceText: str
    correctionType: str = "missed-by-matcher"


class MatrixInferColumnsRequest(BaseModel):
    """CR-025 — coordinator-facing column inference for the wizard's matrix step."""
    matrixSlug: str
    institutionId: str | None = None
    programLevel: str = "bachelors"
    rawTableHtml: str = ""
    columnCount: int
    surroundingContext: str = ""
    knownCourses: list[str] | None = None


class MatrixConfirmColumnRequest(BaseModel):
    """CR-025 — one row of confirmed column → course mapping."""
    institutionId: str
    programLevel: str = "bachelors"
    matrixSlug: str
    columnIndex: int
    course: str
    priorConfidence: float = 1.0


class MatrixInferRowSpecRequest(BaseModel):
    """CR-030 — infer the subspec for a matrix row when standard is known.

    The wizard's matrix step shows "Spec 12.?" when the extractor matched
    the row's standard via template heuristics but couldn't pin the
    subspec letter. This endpoint asks Haiku which subspec from the
    Handbook best matches the row's prompt.
    """
    rowPrompt: str
    standardCode: str
    programLevel: str = "bachelors"
    surroundingContext: str = ""


@app.post("/ai/import/start", status_code=status.HTTP_202_ACCEPTED)
async def start_import(req: StartImportRequest, request: Request) -> dict:
    """Accept an import job from the CSHSE server and enqueue it.

    Returns the initial job snapshot — either ``status: "parsing"`` if a
    worker slot is immediately available, or ``status: "queued"`` with
    a position. Subsequent updates flow through the event webhook.
    """
    body = await request.body()
    verify_hmac_signature(request, body)

    if req.programLevel not in ("associate", "bachelors", "masters"):
        raise HTTPException(status_code=400, detail=f"invalid programLevel: {req.programLevel}")
    if req.forceFormat is not None and req.forceFormat not in ("template", "self_study"):
        raise HTTPException(status_code=400, detail=f"invalid forceFormat: {req.forceFormat}")

    snapshot = enqueue_job(
        import_id=req.importId,
        s3_key=req.s3Key,
        submission_id=req.submissionId,
        program_level=req.programLevel,
        force_format=req.forceFormat,
        callback_url=req.callbackUrl,
        event_callback_url=req.eventCallbackUrl,
        institution_id=req.institutionId,
    )
    return snapshot


@app.get("/ai/import/{job_id}")
async def get_import(job_id: str, request: Request) -> dict:
    """Synchronous snapshot of a job's current state.

    Used by the CSHSE server as a fallback when its SSE stream to the
    client drops and the client falls back to polling (UI spec §11.3).
    Also handy for debugging from the Railway shell.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    snapshot = get_job(job_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail=f"job {job_id} not found")
    return snapshot


@app.post("/ai/corrections/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_correction_endpoint(req: CorrectionIngestRequest, request: Request) -> dict:
    """Embed a coordinator correction and store it in Qdrant.

    Called by the CSHSE Node server immediately after the coordinator
    saves a correction via /api/imports/:importId/corrections. The point
    is upserted into ``cshse_corrections_{env}`` keyed by correctionId,
    payload-filtered by institutionId + programLevel.

    On future imports the matcher will retrieve similar examples from
    this collection and inject them as few-shot hints in the Haiku
    prompt. Best-effort: failure here doesn't lose the correction (Mongo
    is the source of truth); a future reconciler can replay.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.corrections.store import ingest_correction
    try:
        return ingest_correction(req.model_dump())
    except Exception as exc:  # noqa: BLE001
        # Surface the error so the Node server logs it, but don't 500 if
        # the rest of the system is healthy — the row is already in Mongo.
        raise HTTPException(
            status_code=502,
            detail=f"correction ingest failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/matrix/infer-columns", status_code=status.HTTP_200_OK)
async def infer_matrix_columns_endpoint(req: MatrixInferColumnsRequest, request: Request) -> dict:
    """CR-025 — infer column → course mappings for one curriculum matrix.

    Server posts this for each matrix on the wizard's Matrix step. We
    read the raw `<table>` HTML (which still carries merged-cell course
    headers in the bytes even if mammoth's DOM walker missed them),
    consult the per-institution `cshse_matrix_columns_{env}` Qdrant
    collection for prior confirmations, and ask Haiku for confidence-
    ranked suggestions.

    Returns suggestions for every column from 0..columnCount-1, padded
    with "no signal" entries for columns the model couldn't guess.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.matrix.column_inference import infer_columns
    from app.vector.qdrant_ops import VectorStore
    from app.embeddings.openai_client import EmbeddingClient
    from app.config import get_settings as _gs

    settings = _gs()
    try:
        result = infer_columns(
            matrix_slug=req.matrixSlug,
            raw_table_html=req.rawTableHtml,
            column_count=req.columnCount,
            institution_id=req.institutionId,
            program_level=req.programLevel,
            surrounding_context=req.surroundingContext,
            known_courses=req.knownCourses or [],
            embedder=EmbeddingClient(settings.openai_api_key) if settings.openai_api_key else None,
            store=VectorStore(settings.qdrant_url, settings.qdrant_api_key or None) if settings.qdrant_url else None,
            settings=settings,
        )
        return result.to_dict()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"matrix column inference failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/matrix/confirm-column", status_code=status.HTTP_201_CREATED)
async def confirm_matrix_column_endpoint(req: MatrixConfirmColumnRequest, request: Request) -> dict:
    """CR-025 — persist a coordinator-confirmed column → course mapping.

    Called when the coordinator clicks "Accept" on an AI suggestion or
    types in their own override. Idempotent: keyed by
    (institution, matrix_slug, column_index). Subsequent imports for
    this institution surface this mapping as a RAG hint to the matcher.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.matrix.column_inference import record_confirmed_mapping
    from app.vector.qdrant_ops import VectorStore
    from app.embeddings.openai_client import EmbeddingClient
    from app.config import get_settings as _gs

    settings = _gs()
    try:
        return record_confirmed_mapping(
            institution_id=req.institutionId,
            program_level=req.programLevel,
            matrix_slug=req.matrixSlug,
            column_index=req.columnIndex,
            course=req.course,
            prior_confidence=req.priorConfidence,
            embedder=EmbeddingClient(settings.openai_api_key) if settings.openai_api_key else None,
            store=VectorStore(settings.qdrant_url, settings.qdrant_api_key or None) if settings.qdrant_url else None,
            settings=settings,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"matrix column confirm failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/matrix/infer-row-spec", status_code=status.HTTP_200_OK)
async def infer_matrix_row_spec_endpoint(req: MatrixInferRowSpecRequest, request: Request) -> dict:
    """CR-030 — given a row's prompt + known standard, pick the best subspec.

    The wizard's matrix step shows '?' for rows whose subspec couldn't be
    inferred from the template prompts. This endpoint reads the Handbook
    spec list for the standard, asks Haiku which subspec best matches,
    and returns a suggestion. The client uses the existing retagMatrixRow
    store action to apply the user's confirmed choice.

    Soft-fails to suggestedSpec=null + confidence=0 if Anthropic is
    unavailable; the client falls back to manual entry.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.matrix.row_spec_inference import infer_row_spec
    try:
        result = infer_row_spec(
            row_prompt=req.rowPrompt,
            standard_code=req.standardCode,
            program_level=req.programLevel,
            surrounding_context=req.surroundingContext,
        )
        return result.to_dict()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"matrix row spec inference failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/import/{job_id}/cancel")
async def cancel_import(job_id: str, request: Request) -> dict:
    """Cancel a queued or running job. Idempotent."""
    body = await request.body()
    verify_hmac_signature(request, body)
    ok = cancel_job(job_id)
    snapshot = get_job(job_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail=f"job {job_id} not found")
    return {"cancelled": ok, "snapshot": snapshot}


# ----------------------------------------------------------------------
# CR-018 — Evidence-review endpoints (Phase 1 stubs)
#
# Phase 1 wires the three endpoints described in the CR but returns
# HTTP 501 with a structured `{phase, ready, detail}` body. Callers
# (server/src/services/cshseAiClient.ts) read `ready=false` as the
# signal that Phase 2 hasn't landed, NOT as a deploy failure. The HMAC
# auth gate runs first, so the stubs also prove the auth wiring is
# correct end-to-end.
# ----------------------------------------------------------------------

from app.evidence import EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY
from app.evidence.extract import extract_evidence_text
from app.evidence.recommend import recommend_evidence
from app.evidence.score import score_evidence


class EvidenceExtractRequest(BaseModel):
    """Evidence-extract input.

    Phase 2 accepts already-extracted ``markdown``. PDF binaries
    (``documentS3Key`` + ``documentMimeType``) ship in Phase 2b when the
    marker-pdf binary lands in the ai-service container.
    """
    institutionId: str = Field(..., description="MongoDB ObjectId; required for per-institution Qdrant payload filter.")
    submissionId: str
    documentId: str = Field(default="", description="Originator's doc id (e.g. SupportingEvidence._id) — stamped on every chunk payload for later retrieval.")
    markdown: str | None = Field(default=None, description="Already-extracted markdown body. Provide this OR documentS3Key.")
    documentS3Key: str | None = None
    documentMimeType: str = Field(default="text/markdown")
    sourceFilename: str | None = None


class EvidenceRecommendRequest(BaseModel):
    institutionId: str
    submissionId: str
    standardCode: str
    specCode: str
    topK: int = Field(default=5, ge=1, le=20)
    programLevel: str = Field(default="bachelors")


class EvidenceScoreRequest(BaseModel):
    institutionId: str
    submissionId: str
    standardCode: str
    specCode: str
    candidateChunks: list[dict]
    matrixRows: list[dict] | None = Field(default=None, description="CR-024 Sprint 4 — matrix rows for the spec, included in the Haiku prompt.")


@app.post("/ai/evidence/extract")
async def evidence_extract(req: EvidenceExtractRequest, request: Request) -> dict:
    body = await request.body()
    verify_hmac_signature(request, body)
    if not req.markdown:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                **EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY,
                "endpoint": "evidence.extract",
                "reason": "markdown body is required in Phase 2; PDF binary path lands in Phase 2b",
            },
        )
    try:
        return extract_evidence_text(
            institution_id=req.institutionId,
            submission_id=req.submissionId,
            document_id=req.documentId or req.submissionId,
            markdown=req.markdown,
            source_filename=req.sourceFilename,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"evidence_extract failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/evidence/recommend")
async def evidence_recommend(req: EvidenceRecommendRequest, request: Request) -> dict:
    body = await request.body()
    verify_hmac_signature(request, body)
    try:
        return recommend_evidence(
            institution_id=req.institutionId,
            submission_id=req.submissionId,
            standard_code=req.standardCode,
            spec_code=req.specCode,
            top_k=req.topK,
            program_level=req.programLevel,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"evidence_recommend failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/evidence/score")
async def evidence_score(req: EvidenceScoreRequest, request: Request) -> dict:
    body = await request.body()
    verify_hmac_signature(request, body)
    try:
        return score_evidence(
            institution_id=req.institutionId,
            submission_id=req.submissionId,
            standard_code=req.standardCode,
            spec_code=req.specCode,
            candidate_chunks=req.candidateChunks,
            matrix_rows=req.matrixRows,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"evidence_score failed: {type(exc).__name__}: {exc}",
        )

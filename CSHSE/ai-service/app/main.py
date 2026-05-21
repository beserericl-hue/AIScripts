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

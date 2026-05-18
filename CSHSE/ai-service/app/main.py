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

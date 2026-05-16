import os

import httpx
from anthropic import Anthropic
from fastapi import FastAPI
from qdrant_client import QdrantClient

from app.config import get_settings

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

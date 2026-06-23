"""OpenAI text-embedding-3-small wrapper.

Single embedding provider for Sprint 1; a future PR can lift this behind an
abstraction if we want to add Voyage or local models.
"""
from __future__ import annotations

import random
import time
from typing import Sequence

from openai import (
    OpenAI,
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    RateLimitError,
)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

# Transient failures worth retrying. APITimeoutError subclasses APIConnectionError
# but we list it explicitly for clarity. A single transient timeout here used to
# HARD-FAIL the whole import — the spec-cache bootstrap (embed_batch over ~99
# specs) runs OUTSIDE the matcher's per-section retry, so nothing caught it.
_RETRYABLE = (APITimeoutError, APIConnectionError, RateLimitError, InternalServerError)
_MAX_RETRIES = 5


class EmbeddingClient:
    def __init__(self, api_key: str, timeout: float = 30.0):
        if not api_key:
            raise ValueError("OPENAI_API_KEY required")
        # CR-028 / prod hotfix 2026-06-23 — explicit per-call timeout (raised
        # 15s -> 30s for headroom on larger batches) and SDK retries disabled so
        # OUR backoff loop below is authoritative across every call site.
        self._client = OpenAI(api_key=api_key, timeout=timeout, max_retries=0)

    def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed a batch of texts. OpenAI accepts up to 2048 items per call.

        Retries transient errors (timeout / connection / rate-limit / 5xx) with
        exponential backoff so a momentary network wedge doesn't sink the whole
        import. Caller truncates texts to the model's 8192-token window.
        """
        if not texts:
            return []
        delay = 1.0
        last_exc: Exception | None = None
        for _ in range(_MAX_RETRIES):
            try:
                resp = self._client.embeddings.create(
                    model=EMBEDDING_MODEL,
                    input=list(texts),
                )
                return [item.embedding for item in resp.data]
            except _RETRYABLE as exc:
                last_exc = exc
                time.sleep(delay + random.uniform(0, 0.5))
                delay = min(delay * 2, 20.0)
        assert last_exc is not None
        raise last_exc

    def embed_one(self, text: str) -> list[float]:
        return self.embed_batch([text])[0]

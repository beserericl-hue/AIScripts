"""OpenAI text-embedding-3-small wrapper.

Single embedding provider for Sprint 1; a future PR can lift this behind an
abstraction if we want to add Voyage or local models.
"""
from __future__ import annotations

from typing import Sequence

from openai import OpenAI

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


class EmbeddingClient:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("OPENAI_API_KEY required")
        self._client = OpenAI(api_key=api_key)

    def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed a batch of texts. OpenAI accepts up to 2048 items per call.

        Caller is responsible for truncating texts to fit the model's 8192-token
        context window — Sprint 1 sections are typically well below that.
        """
        if not texts:
            return []
        resp = self._client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=list(texts),
        )
        return [item.embedding for item in resp.data]

    def embed_one(self, text: str) -> list[float]:
        return self.embed_batch([text])[0]

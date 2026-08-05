"""Qdrant collection helpers.

Single Qdrant instance shared between prod and dev; env isolation is via
collection-name suffixes (see ``app/config.py``).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Sequence

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.embeddings.openai_client import EMBEDDING_DIM


@dataclass
class SearchHit:
    score: float
    payload: dict[str, Any]


class VectorStore:
    def __init__(self, url: str, api_key: str | None):
        # CR-028 — explicit timeout on Qdrant operations. qdrant-client
        # talks HTTP by default with no client-side timeout; a single
        # wedged TCP connection can hold a matcher worker indefinitely.
        # 10s is generous for a single search/upsert (typical p99 <500ms).
        self._client = QdrantClient(
            url=url,
            api_key=api_key or None,
            timeout=10,
        )

    # ------------------------------------------------------------------ schema

    def ensure_collection(self, name: str, dim: int = EMBEDDING_DIM) -> None:
        """Create the collection with cosine distance if it doesn't exist."""
        existing = {c.name for c in self._client.get_collections().collections}
        if name in existing:
            return
        self._client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )

    # -------------------------------------------------------------- upsert/query

    def upsert(
        self,
        collection: str,
        vectors: Sequence[list[float]],
        payloads: Sequence[dict[str, Any]],
        ids: Sequence[str | int] | None = None,
    ) -> None:
        if len(vectors) != len(payloads):
            raise ValueError("vectors and payloads must be same length")
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in vectors]
        points = [
            PointStruct(id=pid, vector=vec, payload=payload)
            for pid, vec, payload in zip(ids, vectors, payloads)
        ]
        self._client.upsert(collection_name=collection, points=points, wait=True)

    def search(
        self,
        collection: str,
        query_vector: list[float],
        top_k: int = 5,
        payload_filter: dict[str, Any] | None = None,
    ) -> list[SearchHit]:
        qfilter = None
        if payload_filter:
            qfilter = Filter(
                must=[
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in payload_filter.items()
                ]
            )
        hits = self._client.search(
            collection_name=collection,
            query_vector=query_vector,
            limit=top_k,
            query_filter=qfilter,
        )
        return [SearchHit(score=h.score, payload=h.payload or {}) for h in hits]

    def count(self, collection: str) -> int:
        return self._client.count(collection, exact=True).count

    def delete_by_filter(self, collection: str, payload_filter: dict[str, Any]) -> None:
        """Delete every point matching the payload filter — used to replace a
        document's chunks before re-indexing so a re-run never duplicates."""
        if not payload_filter:
            return
        qfilter = Filter(
            must=[FieldCondition(key=k, match=MatchValue(value=v)) for k, v in payload_filter.items()]
        )
        try:
            self._client.delete(
                collection_name=collection,
                points_selector=FilterSelector(filter=qfilter),
                wait=True,
            )
        except Exception:  # noqa: BLE001 — best-effort (e.g. collection just created)
            pass

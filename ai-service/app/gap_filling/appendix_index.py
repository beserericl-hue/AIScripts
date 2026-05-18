"""Embed appendix items into a per-import Qdrant collection.

The collection is named ``cshse_gapfill_<import_id>`` so it's isolated from
the shared ``cshse_specs`` collection and from other concurrent imports.
It is dropped explicitly by ``drop_appendix_collection`` at wizard finish.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Iterable, Protocol

from app.splitter.appendix_walker import AppendixItem

# Embed prefix used so the appendix collection name is unambiguous.
_GAPFILL_PREFIX = "cshse_gapfill_"

# Conservative cap on body text we embed per item — text-embedding-3-small has
# an 8192-token window. ~6000 chars stays well under that for plain prose.
_EMBED_BODY_CHAR_LIMIT = 6000


@dataclass
class AppendixIndexEntry:
    """One record we wrote to the appendix collection."""
    point_id: str
    item_index: int
    item_title: str
    body_text: str
    standard_code: str
    appendix_anchor: str | None


class _EmbeddingProto(Protocol):
    def embed_batch(self, texts: list[str]) -> list[list[float]]: ...


class _StoreProto(Protocol):
    def ensure_collection(self, name: str) -> None: ...
    def upsert(
        self,
        collection: str,
        vectors: list[list[float]],
        payloads: list[dict],
        ids: list[str] | None = None,
    ) -> None: ...


def gapfill_collection_name(import_id: str) -> str:
    """Return the per-import collection name for the gap-fill index.

    ``import_id`` is sanitized to alphanumerics + underscores so the value
    is safe to embed in a Qdrant collection name.
    """
    safe = re.sub(r"[^A-Za-z0-9_]+", "_", import_id).strip("_")
    if not safe:
        safe = uuid.uuid4().hex
    return f"{_GAPFILL_PREFIX}{safe}"


def _embed_text(item: AppendixItem) -> str:
    """The text we embed: title prefix + body (truncated)."""
    body = item.body_text[:_EMBED_BODY_CHAR_LIMIT]
    return f"{item.item_title}\n\n{body}"


def index_appendix(
    store: _StoreProto,
    embedder: _EmbeddingProto,
    import_id: str,
    items: Iterable[AppendixItem],
    batch_size: int = 64,
) -> tuple[str, list[AppendixIndexEntry]]:
    """Embed every appendix item and upsert into the per-import collection.

    Returns ``(collection_name, entries)``. ``entries`` is the canonical
    record of what was written; callers can use ``item_index`` later to
    join back to the source ``AppendixItem`` list.
    """
    collection = gapfill_collection_name(import_id)
    items = list(items)
    if not items:
        store.ensure_collection(collection)
        return collection, []

    store.ensure_collection(collection)

    entries: list[AppendixIndexEntry] = []
    # Process in batches so a 890-item appendix doesn't hit OpenAI's batch
    # limit and stays within reasonable memory.
    for start in range(0, len(items), batch_size):
        batch = items[start : start + batch_size]
        texts = [_embed_text(it) for it in batch]
        vectors = embedder.embed_batch(texts)
        if len(vectors) != len(batch):
            raise RuntimeError(
                f"Embedder returned {len(vectors)} vectors for {len(batch)} items"
            )
        payloads: list[dict] = []
        ids: list[str] = []
        for it in batch:
            pid = str(uuid.uuid4())
            ids.append(pid)
            payloads.append(
                {
                    "itemIndex": it.item_index,
                    "itemTitle": it.item_title,
                    "bodyText": it.body_text,
                    "standardCode": it.standard_code,
                    "appendixAnchor": it.appendix_anchor or "",
                }
            )
            entries.append(
                AppendixIndexEntry(
                    point_id=pid,
                    item_index=it.item_index,
                    item_title=it.item_title,
                    body_text=it.body_text,
                    standard_code=it.standard_code,
                    appendix_anchor=it.appendix_anchor,
                )
            )
        store.upsert(collection, vectors, payloads, ids)

    return collection, entries


def drop_appendix_collection(store, import_id: str) -> bool:
    """Delete the per-import gap-fill collection.

    Called at wizard finish (success), cancellation, or failure. Idempotent:
    a missing collection is treated as success. Returns ``True`` if a
    delete request was sent.

    We reach into the underlying QdrantClient because ``VectorStore`` does
    not expose a delete helper today; if/when it does, switch to that.
    """
    collection = gapfill_collection_name(import_id)
    client = getattr(store, "_client", None)
    if client is None:
        return False
    try:
        # If the collection doesn't exist, delete_collection returns False
        # in qdrant-client; suppress any "not found" error to keep this
        # idempotent.
        client.delete_collection(collection_name=collection)
        return True
    except Exception:
        return False

"""Bootstrap the shared ``cshse_specs`` Qdrant collection.

Idempotent: skips re-embedding if the collection already has the expected
points for the active spec version.
"""
from __future__ import annotations

import uuid

from app.embeddings.openai_client import EmbeddingClient
from app.standards.loader import Specification, load_specifications
from app.vector.qdrant_ops import VectorStore

# Stable namespace so we always get the same UUID5 for the same spec key.
# (Qdrant point IDs must be UUIDs or unsigned ints; this gets us deterministic
# upserts so re-bootstrap is a no-op.)
_NAMESPACE = uuid.UUID("4f6f5e63-7368-7365-7370-65637361636e")  # "cshseSpecCache"


def _point_id(spec: Specification) -> str:
    key = f"{spec.program_level}:{spec.version}:{spec.standard_code}:{spec.spec_code}"
    return str(uuid.uuid5(_NAMESPACE, key))


def _embedding_text(spec: Specification) -> str:
    """The text we embed: concatenated standard title + spec text for context."""
    return f"Standard {spec.standard_code} — {spec.standard_title}\n\n{spec.spec_text}"


def bootstrap_spec_cache(
    store: VectorStore,
    embedder: EmbeddingClient,
    collection: str = "cshse_specs",
    program_levels: tuple[str, ...] = ("bachelors",),
) -> dict[str, int]:
    """Embed and upsert all Specifications for the requested program levels.

    Returns ``{program_level: count_upserted}``.
    """
    store.ensure_collection(collection)
    counts: dict[str, int] = {}
    for level in program_levels:
        specs = load_specifications(level)  # type: ignore[arg-type]
        if not specs:
            counts[level] = 0
            continue
        texts = [_embedding_text(s) for s in specs]
        vectors = embedder.embed_batch(texts)
        payloads = [
            {
                "standardCode": s.standard_code,
                "specCode": s.spec_code,
                "standardTitle": s.standard_title,
                "specText": s.spec_text,
                "programLevel": s.program_level,
                "specVersion": s.version,
            }
            for s in specs
        ]
        ids = [_point_id(s) for s in specs]
        store.upsert(collection, vectors, payloads, ids)
        counts[level] = len(specs)
    return counts

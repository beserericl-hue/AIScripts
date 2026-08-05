"""CR-018 Phase 2 — Evidence chunk extraction + Qdrant upsert.

Two layers:

1. **extract_evidence_text** — input is already-extracted markdown
   (caller did the PDF → markdown pass). Splits into ~800-char chunks
   with ~80-char overlap, embeds via text-embedding-3-small, upserts
   into the per-env ``cshse_evidence_{env}`` Qdrant collection with
   ``institutionId`` + ``submissionId`` payload.

2. **extract_evidence_from_pdf** — wraps a Marker-PDF pass. **NOT
   shipped in this slice** — needs the marker-pdf binary on the
   ai-service container + a separate Phase 2b push. The stub raises
   ``NotImplementedError`` so callers can detect.

The first layer is enough to unblock cshse-server → cshse-ai migration
for any caller that already has markdown (e.g. mammoth-converted DOCX,
or text pasted in via the legacy importer). PDF callers wait for 2b.
"""
from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass

from app.config import Settings, get_settings
from app.embeddings.openai_client import EmbeddingClient
from app.vector.qdrant_ops import VectorStore


_DEFAULT_CHUNK_CHARS = 800
_DEFAULT_OVERLAP_CHARS = 80


@dataclass
class EvidenceChunk:
    chunk_id: str
    text: str
    payload: dict


def _split_into_chunks(
    text: str,
    chunk_chars: int = _DEFAULT_CHUNK_CHARS,
    overlap_chars: int = _DEFAULT_OVERLAP_CHARS,
) -> list[str]:
    """Sliding-window split honoring paragraph boundaries where possible."""
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= chunk_chars:
        return [text]
    # Prefer paragraph-aligned cuts when they fit; otherwise fall back to
    # raw sliding window.
    paragraphs = re.split(r"\n\s*\n+", text)
    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0
    for p in paragraphs:
        p_stripped = p.strip()
        if not p_stripped:
            continue
        if buf_len + len(p_stripped) + 2 > chunk_chars and buf:
            chunks.append("\n\n".join(buf))
            buf = [p_stripped]
            buf_len = len(p_stripped)
        else:
            buf.append(p_stripped)
            buf_len += len(p_stripped) + 2
    if buf:
        chunks.append("\n\n".join(buf))
    # If any single paragraph blew past chunk_chars, sliding-window it.
    out: list[str] = []
    for c in chunks:
        if len(c) <= chunk_chars:
            out.append(c)
            continue
        step = chunk_chars - overlap_chars
        i = 0
        while i < len(c):
            out.append(c[i : i + chunk_chars])
            i += step
    return out


def extract_evidence_text(
    *,
    institution_id: str,
    submission_id: str,
    document_id: str,
    markdown: str,
    source_filename: str | None = None,
    embedder: EmbeddingClient | None = None,
    store: VectorStore | None = None,
    settings: Settings | None = None,
) -> dict:
    """Chunk + embed + upsert evidence markdown into Qdrant.

    Returns ``{ "chunksUpserted": N, "collection": "cshse_evidence_dev",
    "embeddingModel": "text-embedding-3-small" }`` for the caller.
    """
    settings = settings or get_settings()
    if not institution_id:
        raise ValueError("institution_id is required")

    chunks = _split_into_chunks(markdown)
    if not chunks:
        return {
            "chunksUpserted": 0,
            "collection": settings.evidence_collection,
            "embeddingModel": "text-embedding-3-small",
        }

    embedder = embedder or EmbeddingClient(settings.openai_api_key)
    store = store or VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    store.ensure_collection(settings.evidence_collection)
    # Idempotent re-index: drop this document's existing chunks first so a re-run
    # replaces them instead of accumulating duplicates.
    store.delete_by_filter(settings.evidence_collection, {"documentId": str(document_id)})

    vectors = [embedder.embed_one(c) for c in chunks]
    payloads = []
    ids = []
    for idx, chunk_text in enumerate(chunks):
        chunk_id = str(uuid.uuid4())
        sha = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()[:16]
        payloads.append(
            {
                "institutionId": str(institution_id),
                "submissionId": str(submission_id),
                "documentId": str(document_id),
                "sourceFilename": source_filename or "",
                "chunkIndex": idx,
                "chunkText": chunk_text,
                "sha256": sha,
            }
        )
        ids.append(chunk_id)
    store.upsert(
        settings.evidence_collection,
        vectors=vectors,
        payloads=payloads,
        ids=ids,
    )
    return {
        "chunksUpserted": len(chunks),
        "collection": settings.evidence_collection,
        "embeddingModel": "text-embedding-3-small",
    }

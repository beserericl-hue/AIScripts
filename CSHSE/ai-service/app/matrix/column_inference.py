"""Matrix column → course inference (CR-025).

The wizard's Matrix step asks the coordinator to map every column in
each curriculum matrix to a course code from their program catalog.
Mammoth strips merged-cell formatting so the raw HTML from the DOCX
loses the column-header row that named the courses. The coordinator
is left with "Col 1", "Col 2"…  and no clear way to find what each
column actually was — exactly the broken-screen problem the user
flagged 2026-05-21.

This module does three things:

  1. ``infer_columns`` — given the raw ``<table>`` HTML (where the
     merged-cell course headers ARE still present in the XML even
     if mammoth's DOM doesn't surface them) plus the surrounding
     narrative paragraphs, asks Claude Haiku to guess the column
     → course mapping. Returns confidence-ranked suggestions per
     column.

  2. ``ingest_matrix_context`` — at import time, embeds the 4-6
     paragraphs of narrative surrounding each curriculum-matrix
     anchor into ``cshse_matrix_context_{env}`` (per-institution
     payload). These paragraphs frequently name course codes that
     don't appear inside the table itself.

  3. ``record_confirmed_mapping`` — when the coordinator confirms an
     AI suggestion (or supplies their own override), the resulting
     mapping is upserted into ``cshse_matrix_columns_{env}`` keyed
     by institution. Next import for the same institution reads
     these back as confidence-boosting RAG hits, so the second run
     is effectively zero-touch.

Scope policy: per-institution. A correction Stevenson makes never
shapes Kennesaw State's inference.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from typing import Any

from anthropic import Anthropic

from app.config import Settings, get_settings
from app.embeddings.openai_client import EmbeddingClient
from app.vector.qdrant_ops import VectorStore


# ----------------------------------------------------------------- types


@dataclass
class ColumnSuggestion:
    """One AI-suggested mapping for one column."""
    column_index: int
    suggested_course: str | None
    confidence: float
    rationale: str


@dataclass
class InferenceResult:
    matrix_slug: str
    suggestions: list[ColumnSuggestion]
    raw_response: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "matrixSlug": self.matrix_slug,
            "suggestions": [
                {
                    "columnIndex": s.column_index,
                    "suggestedCourse": s.suggested_course,
                    "confidence": round(s.confidence, 3),
                    "rationale": s.rationale,
                }
                for s in self.suggestions
            ],
        }


# ----------------------------------------------------------------- helpers


_TABLE_TAG_RE = re.compile(r"<table[^>]*>.*?</table>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(s: str) -> str:
    return _WS_RE.sub(" ", _TAG_RE.sub(" ", s or "")).strip()


def _course_candidates_from_html(raw_html: str) -> list[str]:
    """Best-effort recovery of course codes from the raw <table> HTML.

    Mammoth flattens merged-cell rows so the DOM only shows individual
    cells. But the original course header row often survives as
    consecutive text fragments inside header cells (``<th>CHS 105</th>``)
    or as a stray paragraph just above the table. We grep for the
    common CSHSE patterns: AAA 999 / AAA999 / AAA 9999.
    """
    text = _strip_html(raw_html)
    # Pull anything that looks like a course code; preserve order; de-dup
    # while keeping first-seen ordering.
    pattern = re.compile(r"\b([A-Z]{2,5})\s?(\d{2,4})\b")
    seen: set[str] = set()
    out: list[str] = []
    for m in pattern.finditer(text):
        code = f"{m.group(1)} {m.group(2)}"
        if code not in seen:
            seen.add(code)
            out.append(code)
    return out


def _build_inference_prompt(
    *,
    raw_table_html: str,
    column_count: int,
    surrounding_context: str,
    known_courses: list[str],
    rag_examples: list[dict[str, Any]],
) -> str:
    """Compose the Haiku prompt.

    We deliberately quote the raw HTML so the model has access to any
    merged-cell or hidden-cell content that mammoth's DOM walker missed.
    """
    catalog_block = (
        "Known courses from this institution's catalog (treat as authoritative when one fits):\n  "
        + ", ".join(known_courses)
        if known_courses
        else "No prior catalog entries — infer course codes from the table + narrative below."
    )
    rag_block = ""
    if rag_examples:
        lines = ["Previously-confirmed column→course mappings for this institution:"]
        for ex in rag_examples:
            lines.append(
                f"  • Col {ex.get('columnIndex')} = {ex.get('course')} "
                f"(matrix={ex.get('matrixSlug')}, confidence at confirmation={ex.get('priorConfidence', 0.0):.2f})"
            )
        rag_block = "\n".join(lines)

    truncated_html = raw_table_html[:8000] if raw_table_html else ""
    truncated_ctx = surrounding_context[:4000] if surrounding_context else ""

    return f"""You are mapping curriculum-matrix columns to course codes for a CSHSE accreditation
self-study. Each column in the matrix represents one course; the merged-cell header
row that originally named the columns may have been lost by the DOCX→HTML conversion.

Your job: for each of the {column_count} columns (0-indexed) return your best guess
at the course code, with a confidence between 0.0 and 1.0 and a one-sentence
rationale explaining where you found the signal.

{catalog_block}

{rag_block}

Raw matrix HTML (XML-flat — merged cells may show as separate <td>):
```html
{truncated_html}
```

Surrounding narrative paragraphs (often name the courses by code):
```
{truncated_ctx}
```

Output strict JSON only, no prose around it, with this exact shape:
{{
  "suggestions": [
    {{
      "columnIndex": 0,
      "suggestedCourse": "CHS 105",
      "confidence": 0.92,
      "rationale": "Row 2 of the table starts with 'CHS 105 — Human Services and Social Policy' spanning columns 0-1."
    }},
    ...
  ]
}}

Rules:
  - One entry per column from 0 to {column_count - 1}, in that order.
  - If you cannot guess a course for a column, return suggestedCourse=null with confidence=0.0 and a rationale of "no signal".
  - Course codes follow the form "AAA 999" (two-to-five capital letters, one space, 2-4 digits).
  - Confidence is your own subjective probability; do not invent codes you have no signal for."""


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def _parse_response(text: str) -> list[ColumnSuggestion]:
    """Extract the suggestions array from Haiku's response."""
    raw = text.strip()
    fence = _JSON_FENCE_RE.search(raw)
    if fence:
        raw = fence.group(1).strip()
    data = json.loads(raw)
    items = data.get("suggestions") or []
    out: list[ColumnSuggestion] = []
    for it in items:
        course = it.get("suggestedCourse")
        if isinstance(course, str):
            course = course.strip() or None
        conf = float(it.get("confidence") or 0.0)
        conf = max(0.0, min(1.0, conf))
        out.append(
            ColumnSuggestion(
                column_index=int(it.get("columnIndex") or 0),
                suggested_course=course,
                confidence=conf,
                rationale=str(it.get("rationale") or ""),
            )
        )
    return out


# ----------------------------------------------------------------- public api


def infer_columns(
    *,
    matrix_slug: str,
    raw_table_html: str,
    column_count: int,
    institution_id: str | None,
    program_level: str,
    surrounding_context: str = "",
    known_courses: list[str] | None = None,
    embedder: EmbeddingClient | None = None,
    store: VectorStore | None = None,
    anthropic_client: Anthropic | None = None,
    settings: Settings | None = None,
) -> InferenceResult:
    """Infer column → course mappings for one matrix.

    Cheap RAG step first: search ``cshse_matrix_columns_{env}`` for
    confirmed mappings from this institution against this matrix slug,
    use the top hits as known-good anchors in the Haiku prompt.
    Then ask Haiku.
    """
    settings = settings or get_settings()
    known_courses = known_courses or []

    # 1. RAG hits from prior confirmations for this institution.
    rag_examples: list[dict[str, Any]] = []
    if institution_id and store is not None:
        try:
            store.ensure_collection(settings.matrix_columns_collection)
            hits = store.search(
                settings.matrix_columns_collection,
                query_vector=(embedder or EmbeddingClient(settings.openai_api_key)).embed_one(
                    f"{matrix_slug} {raw_table_html[:1200]}"
                ),
                top_k=10,
                payload_filter={
                    "institutionId": str(institution_id),
                    "matrixSlug": matrix_slug,
                },
            )
            for h in hits:
                p = h.payload or {}
                rag_examples.append(
                    {
                        "columnIndex": p.get("columnIndex"),
                        "course": p.get("course"),
                        "matrixSlug": p.get("matrixSlug"),
                        "priorConfidence": p.get("priorConfidence", 1.0),
                    }
                )
        except Exception:  # noqa: BLE001
            # RAG is best-effort — fall back to a no-history inference.
            rag_examples = []

    # 2. Combine catalog hints: explicit `known_courses` from caller +
    # regex-scraped codes from the raw HTML itself. The model sees a
    # de-duped union; it's still free to override.
    scraped = _course_candidates_from_html(raw_table_html)
    catalog = list(dict.fromkeys([*known_courses, *scraped]))

    # 3. Haiku adjudication.
    if anthropic_client is None:
        if not settings.anthropic_api_key:
            # No model available — return empty suggestions so the client
            # falls back to free-text entry rather than throwing.
            return InferenceResult(
                matrix_slug=matrix_slug,
                suggestions=[
                    ColumnSuggestion(
                        column_index=i,
                        suggested_course=None,
                        confidence=0.0,
                        rationale="anthropic-api-key missing",
                    )
                    for i in range(column_count)
                ],
            )
        anthropic_client = Anthropic(api_key=settings.anthropic_api_key)

    prompt = _build_inference_prompt(
        raw_table_html=raw_table_html,
        column_count=column_count,
        surrounding_context=surrounding_context,
        known_courses=catalog,
        rag_examples=rag_examples,
    )
    msg = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(
        b.text for b in msg.content if getattr(b, "type", "") == "text"
    )
    try:
        suggestions = _parse_response(text)
    except Exception:  # noqa: BLE001
        # Bad JSON — return empty but include the raw text for debugging.
        return InferenceResult(
            matrix_slug=matrix_slug,
            suggestions=[],
            raw_response=text[:2000],
        )

    # Pad / trim to exactly `column_count` entries so the client UI can
    # zip them 1:1 with the inputs.
    by_index: dict[int, ColumnSuggestion] = {s.column_index: s for s in suggestions}
    final: list[ColumnSuggestion] = []
    for i in range(column_count):
        final.append(
            by_index.get(
                i,
                ColumnSuggestion(
                    column_index=i,
                    suggested_course=None,
                    confidence=0.0,
                    rationale="no signal",
                ),
            )
        )
    return InferenceResult(matrix_slug=matrix_slug, suggestions=final)


def ingest_matrix_context(
    *,
    institution_id: str,
    program_level: str,
    matrix_slug: str,
    surrounding_paragraphs: list[str],
    embedder: EmbeddingClient | None = None,
    store: VectorStore | None = None,
    settings: Settings | None = None,
) -> int:
    """Embed surrounding-context paragraphs into the matrix-context collection.

    Returns the number of points upserted. Safe to call repeatedly —
    points are keyed by a stable composite of institution + matrix_slug +
    paragraph index so re-running on a new import for the same matrix
    overwrites in place.
    """
    if not surrounding_paragraphs:
        return 0
    settings = settings or get_settings()
    embedder = embedder or EmbeddingClient(settings.openai_api_key)
    store = store or VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    store.ensure_collection(settings.matrix_context_collection)

    payloads: list[dict[str, Any]] = []
    vectors: list[list[float]] = []
    ids: list[str] = []
    for idx, para in enumerate(surrounding_paragraphs):
        text = (para or "").strip()
        if len(text) < 12:
            continue
        ids.append(f"{institution_id}:{matrix_slug}:{idx}")
        payloads.append(
            {
                "institutionId": str(institution_id),
                "programLevel": program_level,
                "matrixSlug": matrix_slug,
                "paragraphIndex": idx,
                "text": text,
            }
        )
        vectors.append(embedder.embed_one(text))

    if not vectors:
        return 0
    store.upsert(
        settings.matrix_context_collection,
        vectors=vectors,
        payloads=payloads,
        ids=ids,
    )
    return len(vectors)


def record_confirmed_mapping(
    *,
    institution_id: str,
    program_level: str,
    matrix_slug: str,
    column_index: int,
    course: str,
    prior_confidence: float = 1.0,
    embedder: EmbeddingClient | None = None,
    store: VectorStore | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Persist a coordinator-confirmed column → course mapping.

    Idempotent: keyed by (institution, matrix_slug, column_index) so
    re-confirming the same column overwrites in place. The embedded
    vector is just the course code; we don't need it to be sophisticated —
    the payload filter does the actual work.
    """
    settings = settings or get_settings()
    embedder = embedder or EmbeddingClient(settings.openai_api_key)
    store = store or VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    store.ensure_collection(settings.matrix_columns_collection)

    point_id = f"{institution_id}:{matrix_slug}:{column_index}"
    payload = {
        "institutionId": str(institution_id),
        "programLevel": program_level,
        "matrixSlug": matrix_slug,
        "columnIndex": column_index,
        "course": course,
        "priorConfidence": prior_confidence,
    }
    store.upsert(
        settings.matrix_columns_collection,
        vectors=[embedder.embed_one(course)],
        payloads=[payload],
        ids=[point_id],
    )
    return {
        "ok": True,
        "pointId": point_id,
        "collection": settings.matrix_columns_collection,
    }

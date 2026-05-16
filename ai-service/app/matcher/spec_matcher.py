"""Section -> (standard, spec) matcher.

Pipeline per section:
  1. Embed section text via OpenAI.
  2. Qdrant nearest-neighbour search in ``cshse_specs`` with program-level
     filter.
  3. Top-5 candidates sent to Claude Haiku for adjudication with a prompt
     that includes section excerpt + candidate spec definitions.
  4. Parse Claude's JSON response into a ``Recommendation``.

Cost budget per section: 1 embedding call (~0.001¢) + 1 Haiku call (~0.06¢) ≈
0.07¢ per section. A 100-section import ≈ $0.07.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from typing import Literal

from anthropic import Anthropic

from app.embeddings.openai_client import EmbeddingClient
from app.splitter.sections import Section
from app.vector.qdrant_ops import VectorStore

DEFAULT_MODEL = "claude-haiku-4-5"
DEFAULT_TOP_K = 5
SECTION_TEXT_CHAR_LIMIT = 4000

ProgramLevel = Literal["associate", "bachelors", "masters"]


@dataclass
class Candidate:
    standard_code: str
    spec_code: str
    standard_title: str
    spec_text: str
    similarity: float  # cosine [0, 1] from Qdrant


@dataclass
class Recommendation:
    section_id: str
    section_heading: str
    primary_standard: str | None
    primary_spec: str | None
    primary_confidence: float  # 0..1 from the LLM
    alternates: list[dict]  # [{ standardCode, specCode, confidence }]
    rationale: str
    is_supporting_evidence: bool
    candidates: list[dict]  # raw top-K for debug


# ---------------------------------------------------------------- prompt build


def _build_prompt(section: Section, candidates: list[Candidate]) -> str:
    excerpt = section.markdown[:SECTION_TEXT_CHAR_LIMIT].strip()
    lines = [
        "You are an accreditation reviewer at the Council for Standards in Human Service Education (CSHSE).",
        "Given a SECTION of a self-study document and a list of CANDIDATE specifications,",
        "choose the SINGLE BEST matching (standardCode, specCode). If the section is supporting",
        "evidence (resume, CV, syllabus, course catalog, faculty handbook, etc.) rather than a",
        "narrative response, set is_supporting_evidence=true.",
        "",
        f"SECTION HEADING: {section.heading}",
        f"SECTION WORD COUNT: {section.word_count}",
        f"HEURISTIC FLAGS: {json.dumps(section.flags)}",
        "",
        "SECTION CONTENT:",
        excerpt,
        "",
        "CANDIDATES (sorted by embedding similarity, highest first):",
    ]
    for i, c in enumerate(candidates, 1):
        lines.append(
            f"  {i}. Standard {c.standard_code}.{c.spec_code} — {c.standard_title}"
        )
        lines.append(f"     spec_text: {c.spec_text}")
        lines.append(f"     similarity: {c.similarity:.3f}")
    lines.extend([
        "",
        "Respond with STRICT JSON only (no prose, no markdown fences).",
        "",
        "FIELD RULES (read carefully):",
        '  "primary_standard": EXACTLY the standard code as a string of digits, e.g. "1", "2", "11" — NEVER include the word "Standard" or any title.',
        '  "primary_spec":     EXACTLY one lowercase letter, e.g. "a", "b", "c" — NEVER include the standard title or the spec definition.',
        '  "primary_confidence": float 0.0..1.0',
        '  "alternates":       array of objects each with the same field rules: {"standardCode": "<digits>", "specCode": "<letter>", "confidence": <float>}',
        '  "rationale":        1-2 sentence explanation',
        '  "is_supporting_evidence": boolean',
        "",
        "EXAMPLE of a CORRECT response (for a section about student demographics):",
        '{"primary_standard":"1","primary_spec":"e","primary_confidence":0.94,'
        '"alternates":[{"standardCode":"1","specCode":"f","confidence":0.31}],'
        '"rationale":"Section reports enrollment numbers and demographics directly matching the Specification text.","is_supporting_evidence":false}',
    ])
    return "\n".join(lines)


_DIGITS_RE = re.compile(r"\d+")
_LETTER_RE = re.compile(r"[a-z]")


def _normalize_standard(value: object) -> str | None:
    """Coerce Claude's primary_standard to bare digits ('1', '11', etc.).

    Claude sometimes returns 'Standard 2' or '2.b' — strip to first digit run.
    """
    if value is None:
        return None
    m = _DIGITS_RE.search(str(value))
    return m.group(0) if m else None


def _normalize_spec(value: object) -> str | None:
    """Coerce primary_spec to a single lowercase letter ('a'..'h')."""
    if value is None:
        return None
    s = str(value).lower()
    m = _LETTER_RE.search(s)
    return m.group(0) if m else None


def _parse_claude_response(text: str) -> dict:
    """Parse strict-JSON Claude output; tolerate ```json fences if Haiku slips."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # strip ```json ... ``` or ``` ... ```
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].lstrip("\n").lstrip()
    return json.loads(cleaned)


# ---------------------------------------------------------------- main matcher


class SpecMatcher:
    def __init__(
        self,
        store: VectorStore,
        embedder: EmbeddingClient,
        anthropic_key: str,
        specs_collection: str = "cshse_specs",
        model: str = DEFAULT_MODEL,
    ):
        self._store = store
        self._embedder = embedder
        self._anthropic = Anthropic(api_key=anthropic_key) if anthropic_key else None
        self._specs_collection = specs_collection
        self._model = model

    def _candidates_for(
        self, section: Section, program_level: ProgramLevel, top_k: int
    ) -> list[Candidate]:
        text = (section.heading + "\n\n" + section.markdown)[:SECTION_TEXT_CHAR_LIMIT]
        qvec = self._embedder.embed_one(text)
        hits = self._store.search(
            collection=self._specs_collection,
            query_vector=qvec,
            top_k=top_k,
            payload_filter={"programLevel": program_level},
        )
        return [
            Candidate(
                standard_code=str(h.payload.get("standardCode", "")),
                spec_code=str(h.payload.get("specCode", "")),
                standard_title=str(h.payload.get("standardTitle", "")),
                spec_text=str(h.payload.get("specText", "")),
                similarity=float(h.score),
            )
            for h in hits
        ]

    def recommend(
        self,
        section: Section,
        program_level: ProgramLevel,
        top_k: int = DEFAULT_TOP_K,
    ) -> Recommendation:
        candidates = self._candidates_for(section, program_level, top_k)
        if not candidates:
            return Recommendation(
                section_id=section.id,
                section_heading=section.heading,
                primary_standard=None,
                primary_spec=None,
                primary_confidence=0.0,
                alternates=[],
                rationale="No candidate specs available — spec cache may be empty for this program level.",
                is_supporting_evidence=False,
                candidates=[],
            )

        if self._anthropic is None:
            # No LLM available — fall back to top-1 by similarity with confidence
            # equal to the similarity score itself (deterministic baseline).
            best = candidates[0]
            return Recommendation(
                section_id=section.id,
                section_heading=section.heading,
                primary_standard=best.standard_code,
                primary_spec=best.spec_code,
                primary_confidence=best.similarity,
                alternates=[
                    {
                        "standardCode": c.standard_code,
                        "specCode": c.spec_code,
                        "confidence": c.similarity,
                    }
                    for c in candidates[1:3]
                ],
                rationale=f"Embedding-only fallback (no LLM key). Top similarity: {best.similarity:.3f}.",
                is_supporting_evidence=(
                    section.has_resume_signals or section.has_syllabus_signals
                ),
                candidates=[asdict(c) for c in candidates],
            )

        # LLM adjudication
        prompt = _build_prompt(section, candidates)
        msg = self._anthropic.messages.create(
            model=self._model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        try:
            parsed = _parse_claude_response(text)
        except json.JSONDecodeError:
            # Last-ditch fallback so a malformed LLM response doesn't kill the
            # whole import — surface as low-confidence with the embedding pick.
            best = candidates[0]
            return Recommendation(
                section_id=section.id,
                section_heading=section.heading,
                primary_standard=best.standard_code,
                primary_spec=best.spec_code,
                primary_confidence=0.0,
                alternates=[],
                rationale=f"LLM returned non-JSON; using embedding fallback. Raw: {text[:200]}",
                is_supporting_evidence=False,
                candidates=[asdict(c) for c in candidates],
            )

        primary_std = _normalize_standard(parsed.get("primary_standard"))
        primary_spec = _normalize_spec(parsed.get("primary_spec"))
        norm_alternates = []
        for alt in parsed.get("alternates", []) or []:
            ns = _normalize_standard(alt.get("standardCode"))
            np = _normalize_spec(alt.get("specCode"))
            if ns and np:
                norm_alternates.append(
                    {"standardCode": ns, "specCode": np, "confidence": float(alt.get("confidence", 0.0))}
                )

        return Recommendation(
            section_id=section.id,
            section_heading=section.heading,
            primary_standard=primary_std,
            primary_spec=primary_spec,
            primary_confidence=float(parsed.get("primary_confidence", 0.0)),
            alternates=norm_alternates,
            rationale=parsed.get("rationale", ""),
            is_supporting_evidence=bool(parsed.get("is_supporting_evidence", False)),
            candidates=[asdict(c) for c in candidates],
        )

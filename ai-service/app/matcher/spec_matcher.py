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


SectionType = Literal[
    "narrative_response",   # body answers a (standard, spec) prose prompt
    "supporting_evidence",  # CV, syllabus, course catalog, faculty handbook, etc.
    "curriculum_matrix",    # the (course × standard.spec) grid
    "context",              # framing prose that doesn't answer a specific spec
    "unknown",
]

AcceptState = Literal[
    "auto_accept",      # doc letter agrees with recommended subspec + high confidence
    "review_letter_disagrees",  # doc has X.y but recommender picked X.z (or P.q)
    "review_low_confidence",    # primary_confidence below user threshold
    "review_unknown",   # matcher couldn't classify
]


@dataclass
class Recommendation:
    section_id: str
    section_heading: str

    primary_standard: str | None
    primary_spec: str | None
    primary_confidence: float  # 0..1 from the LLM

    alternates: list[dict]
    rationale: str

    section_type: SectionType  # narrative_response | supporting_evidence | curriculum_matrix | context | unknown
    candidates: list[dict]

    # Hints extracted from the document, NOT from a separate "prior spec" load:
    doc_letter: str | None      # e.g. "d" — only the subspec letter the doc itself prints
    doc_standard_hint: str | None  # e.g. "2" — when the section heading says "Standard 2"
    accept_state: AcceptState

    @property
    def is_supporting_evidence(self) -> bool:
        return self.section_type == "supporting_evidence"


# ---------------------------------------------------------------- prompt build


def _build_prompt(section: Section, candidates: list[Candidate]) -> str:
    excerpt = section.markdown[:SECTION_TEXT_CHAR_LIMIT].strip()
    lines = [
        "You are an accreditation reviewer at the Council for Standards in Human Service Education (CSHSE).",
        "",
        "The self-study document was written against a PRIOR version of the CSHSE Handbook.",
        "Your job is to recommend where the section's CURRENT-NARRATIVE-CONTENT belongs in the",
        "CURRENT (2025) CSHSE specification. The document's own section number (e.g. 'd.' or",
        "'Standard 2') is the prior spec's labelling and MAY NOT correspond to the current 2025",
        "spec's structure. Trust the narrative content, not the document's prior label.",
        "",
        "Choose the SINGLE BEST matching (standardCode, specCode) in the CURRENT spec.",
        "",
        "Also classify the SECTION TYPE — pick ONE:",
        "  - narrative_response: the body answers a (standard, spec) prose prompt",
        "  - supporting_evidence: this is a CV, résumé, syllabus, course catalog, faculty",
        "    handbook, accreditation letter, or other artefact that supports a spec rather",
        "    than answering one in prose",
        "  - curriculum_matrix: the (course x standard.spec) grid (Standard 11 typically)",
        "  - context: framing prose that doesn't answer a specific spec (preamble,",
        "    'Specifications for Standard X' header text without substantive response, etc.)",
        "  - unknown: cannot tell",
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
        '  "rationale":        1-2 sentence explanation citing the spec language being addressed',
        '  "section_type":     one of "narrative_response" | "supporting_evidence" | "curriculum_matrix" | "context" | "unknown"',
        "",
        "EXAMPLES of CORRECT responses:",
        'Narrative answering a spec prompt about demographics:',
        '{"primary_standard":"1","primary_spec":"e","primary_confidence":0.94,'
        '"alternates":[{"standardCode":"1","specCode":"f","confidence":0.31}],'
        '"rationale":"Section reports enrollment numbers and demographics directly matching the current 1.e specification.","section_type":"narrative_response"}',
        '',
        'Faculty CV used as evidence for the program-philosophy standard:',
        '{"primary_standard":"3","primary_spec":"a","primary_confidence":0.78,'
        '"alternates":[],"rationale":"Faculty CV is supporting evidence for the qualifications spec; placed under the closest narrative anchor.","section_type":"supporting_evidence"}',
    ])
    return "\n".join(lines)


_DIGITS_RE = re.compile(r"\d+")
_LETTER_RE = re.compile(r"[a-z]")
# Stevenson-style "d.Provide a brief history" leading-letter pattern.
_DOC_LETTER_RE = re.compile(r"^\s*([a-h])\s*[.)]\s*", re.IGNORECASE)
# Explicit "Standard 2" / "Standard 11" mentions inside the heading or body.
_DOC_STANDARD_RE = re.compile(r"\bStandard\s+(\d{1,2})\b", re.IGNORECASE)


def _extract_doc_hints(section: Section) -> tuple[str | None, str | None]:
    """Return the document's own prior-spec hints (NOT loaded from anywhere
    — just lexical signals embedded in this section's heading/body).

    Returns (standard_hint, letter_hint). Either may be None.
    """
    head = section.heading or ""
    body = section.markdown[:500]
    blob = head + "\n" + body

    std_match = _DOC_STANDARD_RE.search(blob)
    std_hint = std_match.group(1) if std_match else None

    letter_match = _DOC_LETTER_RE.match(head) or _DOC_LETTER_RE.match(body)
    letter_hint = letter_match.group(1).lower() if letter_match else None
    return std_hint, letter_hint


def _compute_accept_state(
    primary_std: str | None,
    primary_spec: str | None,
    primary_conf: float,
    doc_std_hint: str | None,
    doc_letter_hint: str | None,
    section_type: str,
    auto_accept_threshold: float = 0.85,
    review_threshold: float = 0.55,
) -> AcceptState:
    if primary_std is None or primary_spec is None:
        return "review_unknown"
    if section_type == "unknown":
        return "review_unknown"
    if primary_conf < review_threshold:
        return "review_low_confidence"

    # If the document EMBEDS a prior label and it disagrees with the current
    # recommendation, surface for user review (your requirement #4).
    doc_label_present = doc_std_hint or doc_letter_hint
    if doc_label_present:
        std_disagrees = doc_std_hint and doc_std_hint != primary_std
        letter_disagrees = doc_letter_hint and doc_letter_hint != primary_spec
        if std_disagrees or letter_disagrees:
            return "review_letter_disagrees"

    if primary_conf >= auto_accept_threshold:
        return "auto_accept"
    return "review_low_confidence"


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
        doc_std_hint, doc_letter_hint = _extract_doc_hints(section)

        if not candidates:
            return Recommendation(
                section_id=section.id,
                section_heading=section.heading,
                primary_standard=None,
                primary_spec=None,
                primary_confidence=0.0,
                alternates=[],
                rationale="No candidate specs available — spec cache may be empty for this program level.",
                section_type="unknown",
                candidates=[],
                doc_letter=doc_letter_hint,
                doc_standard_hint=doc_std_hint,
                accept_state="review_unknown",
            )

        if self._anthropic is None:
            best = candidates[0]
            fallback_section_type: SectionType = (
                "supporting_evidence"
                if (section.has_resume_signals or section.has_syllabus_signals)
                else "narrative_response"
            )
            primary_std = best.standard_code
            primary_spec = best.spec_code
            return Recommendation(
                section_id=section.id,
                section_heading=section.heading,
                primary_standard=primary_std,
                primary_spec=primary_spec,
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
                section_type=fallback_section_type,
                candidates=[asdict(c) for c in candidates],
                doc_letter=doc_letter_hint,
                doc_standard_hint=doc_std_hint,
                accept_state=_compute_accept_state(
                    primary_std,
                    primary_spec,
                    best.similarity,
                    doc_std_hint,
                    doc_letter_hint,
                    fallback_section_type,
                ),
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
            best = candidates[0]
            return Recommendation(
                section_id=section.id,
                section_heading=section.heading,
                primary_standard=best.standard_code,
                primary_spec=best.spec_code,
                primary_confidence=0.0,
                alternates=[],
                rationale=f"LLM returned non-JSON; using embedding fallback. Raw: {text[:200]}",
                section_type="unknown",
                candidates=[asdict(c) for c in candidates],
                doc_letter=doc_letter_hint,
                doc_standard_hint=doc_std_hint,
                accept_state="review_unknown",
            )

        primary_std = _normalize_standard(parsed.get("primary_standard"))
        primary_spec = _normalize_spec(parsed.get("primary_spec"))
        primary_conf = float(parsed.get("primary_confidence", 0.0))
        norm_alternates = []
        for alt in parsed.get("alternates", []) or []:
            ns = _normalize_standard(alt.get("standardCode"))
            np = _normalize_spec(alt.get("specCode"))
            if ns and np:
                norm_alternates.append(
                    {"standardCode": ns, "specCode": np, "confidence": float(alt.get("confidence", 0.0))}
                )

        raw_type = str(parsed.get("section_type", "narrative_response")).lower()
        valid_types = {"narrative_response", "supporting_evidence", "curriculum_matrix", "context", "unknown"}
        section_type: SectionType = raw_type if raw_type in valid_types else "unknown"  # type: ignore[assignment]

        return Recommendation(
            section_id=section.id,
            section_heading=section.heading,
            primary_standard=primary_std,
            primary_spec=primary_spec,
            primary_confidence=primary_conf,
            alternates=norm_alternates,
            rationale=parsed.get("rationale", ""),
            section_type=section_type,
            candidates=[asdict(c) for c in candidates],
            doc_letter=doc_letter_hint,
            doc_standard_hint=doc_std_hint,
            accept_state=_compute_accept_state(
                primary_std,
                primary_spec,
                primary_conf,
                doc_std_hint,
                doc_letter_hint,
                section_type,
            ),
        )

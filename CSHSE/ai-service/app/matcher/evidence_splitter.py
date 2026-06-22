"""Per-spec content split — pull SUPPORTING EVIDENCE out of a spec's narrative.

The per-section matcher gives a single label per section (narrative OR
evidence). But a single spec response often mixes the program's own narrative
answer with embedded EVIDENCE — verbatim policy/handbook/catalog language, or
an enumerated list of materials/artifacts the program cites as proof. Real PC
submissions carry no markup, so this is decided purely by analysing the content.

This module asks Claude to read ONE spec's response and return the evidentiary
passages it contains, copied VERBATIM. We then verify each excerpt actually
appears in the source text (anti-hallucination) before surfacing it as a
supporting-evidence item under the SAME spec. The narrative is left intact —
nothing is removed, the evidence is additionally surfaced — so "everything is
there".
"""
from __future__ import annotations

import json
import random
import re
import time
from dataclasses import dataclass

from anthropic import Anthropic, APIStatusError, InternalServerError, RateLimitError

from app.standards.loader import Specification

DEFAULT_MODEL = "claude-haiku-4-5"
NARRATIVE_CHAR_LIMIT = 8000
MAX_TOKENS = 900
MAX_ITEMS = 8

_RETRYABLE_STATUSES = {429, 500, 502, 503, 504, 529}
_MAX_RETRIES = 5

_KIND_LABEL = {
    "quoted_policy": "Quoted policy / document text",
    "artifact_list": "Cited materials / artifacts",
    "data": "Embedded data",
}


@dataclass
class EvidencePassage:
    kind: str         # quoted_policy | artifact_list | data
    label: str        # short human label
    excerpt: str      # verbatim text from the narrative


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def _build_prompt(spec: Specification, narrative_text: str) -> str:
    return "\n".join([
        "You are a CSHSE accreditation reviewer. Below is ONE specification's",
        "written response from a self-study. Separate the SUPPORTING EVIDENCE that",
        "is embedded in the prose from the program's own NARRATIVE answer.",
        "",
        "SUPPORTING EVIDENCE = passages that are evidentiary rather than the",
        "program's explanation. Three kinds:",
        "  - quoted_policy: verbatim institutional language quoted inside the",
        "    response — policy / handbook / catalog / bylaws / mission / procedure",
        "    text the program reproduces as proof.",
        "  - artifact_list: an enumerated or inline LIST of materials, documents or",
        "    artifacts the program cites as proof (e.g. 'website, catalog, syllabi,",
        "    internship manual, student handbook').",
        "  - data: an inline block of figures / counts / tabular data written as",
        "    text (enrollment numbers, budget figures, credit counts).",
        "",
        "NARRATIVE = the program's own explanatory prose. Do NOT extract narrative",
        "sentences. Do NOT extract 'See Appendix …' pointers. Copy every excerpt",
        "VERBATIM from the response — never paraphrase or invent text.",
        "",
        f"SPECIFICATION {spec.standard_code}.{spec.spec_code} ({spec.standard_title}):",
        f"  {spec.spec_text}",
        "",
        "RESPONSE:",
        narrative_text[:NARRATIVE_CHAR_LIMIT],
        "",
        "Return STRICT JSON only (no prose, no markdown fences):",
        '{"evidence":[{"kind":"quoted_policy|artifact_list|data",'
        '"label":"<=8 word label","excerpt":"verbatim text copied from the response"}]}',
        "If the response is pure narrative with no embedded evidence, return",
        '{"evidence":[]}.',
    ])


def _parse(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].lstrip("\n").lstrip()
    return json.loads(cleaned)


class EvidenceSplitter:
    def __init__(self, anthropic_key: str, model: str = DEFAULT_MODEL):
        if not anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY required")
        self._client = Anthropic(api_key=anthropic_key)
        self._model = model

    def _call_with_retry(self, prompt: str):
        delay = 1.0
        last_exc: Exception | None = None
        for _ in range(_MAX_RETRIES):
            try:
                return self._client.messages.create(
                    model=self._model,
                    max_tokens=MAX_TOKENS,
                    messages=[{"role": "user", "content": prompt}],
                )
            except (InternalServerError, RateLimitError) as exc:
                last_exc = exc
            except APIStatusError as exc:
                if exc.status_code not in _RETRYABLE_STATUSES:
                    raise
                last_exc = exc
            time.sleep(delay + random.uniform(0, 0.5))
            delay = min(delay * 2, 30.0)
        assert last_exc is not None
        raise last_exc

    def split(self, spec: Specification, narrative_text: str) -> list[EvidencePassage]:
        """Return the verbatim supporting-evidence passages embedded in
        ``narrative_text``. Excerpts that don't actually appear in the source
        (hallucinations / paraphrases) are dropped.
        """
        if not (narrative_text or "").strip():
            return []
        try:
            msg = self._call_with_retry(_build_prompt(spec, narrative_text))
        except Exception:
            # Fail soft — a splitter error must never sink the whole import.
            return []
        raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        try:
            parsed = _parse(raw)
        except json.JSONDecodeError:
            return []

        hay = _norm(narrative_text)
        out: list[EvidencePassage] = []
        seen: set[str] = set()
        for it in (parsed.get("evidence") or [])[:MAX_ITEMS]:
            kind = str(it.get("kind") or "").strip()
            if kind not in _KIND_LABEL:
                kind = "quoted_policy"
            excerpt = str(it.get("excerpt") or "").strip()
            if len(excerpt.split()) < 4:
                continue  # too short to be a meaningful evidence passage
            # Anti-hallucination: the excerpt (or a solid prefix of it) must
            # actually appear in the source response.
            ne = _norm(excerpt)
            if ne not in hay and ne[:60] not in hay:
                continue
            if ne[:120] in seen:
                continue
            seen.add(ne[:120])
            label = str(it.get("label") or "").strip()[:80] or _KIND_LABEL[kind]
            out.append(EvidencePassage(kind=kind, label=label, excerpt=excerpt))
        return out

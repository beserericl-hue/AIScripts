"""Cross-reference placement for supporting-evidence files the bulk uploader
could not place (ETSU, Nov 2026: 145 of 300 files left Unassigned).

Why the earlier matcher missed them: it compared a file's words with whole
narratives (the 35k-char 1.b answer "matched" everything) or asked a topic
classifier with no view of what THIS self-study says. But a self-study almost
always describes its own evidence — "minutes of the advisory committee are
attached", "students log hours in Time2Track", "faculty CVs (Appendix C)".

So for each file we:
  1. retrieve the self-study passages most related to the file (its name,
     its delivered folder, course codes, and its own distinctive words);
  2. ask Claude to choose the specification it supports, given the 96
     specification prompts, those passages and an excerpt of the file — or to
     say it is an internal WORKING FILE (an old self-study, an editing copy, a
     CSHSE handbook, correspondence) that should not be filed as evidence.

The result is TENTATIVE: the server pre-selects it and the coordinator
confirms. Pure retrieval + one model call per file; no state.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import Any

MODEL = "claude-opus-5-5"
_EXCERPT_CHARS = 6000
_PASSAGE_CHARS = 420
_TOP_PASSAGES = 8

_STOP = set(
    """a an and are as at be been but by can do does for from has have how in into is it its
    of on or our that the their them they this to was were which will with within who what when
    where why you your all any each other such than then these those not no may must shall should
    also more most program programs student students human services service hs etsu university
    state east tennessee course courses provide provides describe evidence standard standards
    spec specification document documents file files copy final updated draft new version page
    pdf docx doc xlsx xls csv png pptx link links""".split()
)
_COURSE_RE = re.compile(r"\b(?:HDAL|SRVL|HSER|PSYC|SOWK|COUN|CDST)\s?-?\d{3,4}\b", re.I)
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9'&-]{2,}")


def _words(text: str) -> list[str]:
    return [w.lower().strip("'-&") for w in _WORD_RE.findall(text or "") if w.lower() not in _STOP]


def _courses(text: str) -> set[str]:
    return {re.sub(r"[\s-]", "", m.upper()) for m in _COURSE_RE.findall(text or "")}


def _split_passages(narratives: list[dict]) -> list[dict]:
    """Narratives → ~420-char windows on sentence boundaries, tagged std.spec."""
    out: list[dict] = []
    for n in narratives:
        text = re.sub(r"\s+", " ", str(n.get("text") or "")).strip()
        if not text:
            continue
        sents = re.split(r"(?<=[.!?])\s+", text)
        buf = ""
        for s in sents:
            if len(buf) + len(s) > _PASSAGE_CHARS and buf:
                out.append({"std": str(n.get("std")), "spec": n.get("spec"), "text": buf.strip()})
                buf = ""
            buf += " " + s
        if buf.strip():
            out.append({"std": str(n.get("std")), "spec": n.get("spec"), "text": buf.strip()})
    return out


class PassageIndex:
    """IDF-weighted lookup of self-study passages for a file."""

    def __init__(self, narratives: list[dict]):
        self.passages = _split_passages(narratives)
        self._tok = [set(_words(p["text"])) for p in self.passages]
        self._courses = [_courses(p["text"]) for p in self.passages]
        df = Counter(w for t in self._tok for w in t)
        n = max(1, len(self.passages))
        self.idf = {w: math.log((n + 1) / (c + 0.5)) for w, c in df.items()}

    def query(self, name: str, path: str, text: str, k: int = _TOP_PASSAGES) -> list[dict]:
        title_terms = Counter(_words(re.sub(r"\.[a-z0-9]+$", "", name, flags=re.I)))
        folder_terms = Counter(_words(" ".join(path.split("/")[1:-1])))
        body = Counter(_words(text[:8000]))
        # the file's own most distinctive words (rare in the self-study → strong hint)
        body_top = {w for w, _ in sorted(body.items(), key=lambda kv: -kv[1] * self.idf.get(kv[0], 0.0))[:30]}
        courses = _courses(name + " " + path + " " + text[:4000])
        scored = []
        for i, toks in enumerate(self._tok):
            s = 0.0
            for w in toks:
                idf = self.idf.get(w, 0.0)
                if w in title_terms:
                    s += 3.0 * idf
                if w in folder_terms:
                    s += 1.5 * idf
                if w in body_top:
                    s += 1.0 * idf
            s += 6.0 * len(courses & self._courses[i])
            if s > 0:
                scored.append((s, i))
        scored.sort(reverse=True)
        seen, out = set(), []
        for s, i in scored:
            p = self.passages[i]
            key = p["text"][:80]
            if key in seen:
                continue
            seen.add(key)
            out.append({**p, "score": round(s, 1)})
            if len(out) >= k:
                break
        return out


def _catalog_text(specs: list[dict]) -> str:
    lines = []
    for s in specs:
        prompt = re.sub(r"\s+", " ", str(s.get("prompt") or "")).strip()[:260]
        lines.append(f"{s['std']}.{s['spec']} — {prompt}")
    return "\n".join(lines)


_INSTRUCTIONS = """You place a program's supporting-evidence files into the CSHSE accreditation self-study it belongs to.

You get one file (its name, the folder the program coordinator delivered it in, and an excerpt of its text), passages from the program's own self-study narrative that may mention it, and the list of specifications.

Decide which ONE specification this file is evidence for. Weigh, in order:
1. A self-study passage that refers to this file or to exactly what it contains (minutes, a roster, a syllabus, a CV, a manual, a data export). That spec is the answer.
2. What the file plainly is, matched to the specification whose prompt asks for that kind of document (faculty CVs → the faculty credentials spec; advisory committee minutes → the advisory committee spec; a field manual → the field-experience manual spec).
3. The file's subject matter.

Some files are not evidence at all but the program's internal working material: earlier self-studies or drafts of this one, editing copies, CSHSE's own handbooks and standards documents, correspondence with CSHSE, timelines, writing assignments for the self-study team, templates, notes. Label those "working_file" instead of forcing a spec. A file that is evidence but fits no spec well gets your best spec with low confidence.

Confidence: 0.85+ when a passage names the file or its exact content; 0.6–0.8 when the kind of document matches a spec's prompt clearly; below 0.5 when it is a guess.

Answer with one JSON object and nothing else:
{"kind": "evidence" | "working_file", "standard": "<number or null>", "spec": "<letter or null>", "alternate": "<std.spec or null>", "confidence": <0..1>, "reason": "<one sentence a program coordinator can check, naming the passage or document type you relied on>", "passage_spec": "<std.spec of the passage you relied on, or null>"}"""


def _parse_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise ValueError("no JSON object in model reply")
    return json.loads(m.group(0))


def place_one(client: Any, catalog: str, file: dict, passages: list[dict], valid: set[str]) -> dict:
    excerpt = re.sub(r"[ \t]+", " ", str(file.get("text") or ""))[:_EXCERPT_CHARS]
    psg = "\n".join(f"[{p['std']}.{p.get('spec') or ''}] {p['text']}" for p in passages) or "(no passage of the self-study mentions this file)"
    user = (
        f"FILE NAME: {file.get('name')}\n"
        f"DELIVERED IN FOLDER: {file.get('path') or '(top level)'}\n\n"
        f"SELF-STUDY PASSAGES THAT MAY MENTION IT:\n{psg}\n\n"
        f"FILE TEXT (excerpt):\n{excerpt or '(no text could be extracted — judge from the name and folder)'}"
    )
    msg = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        extra_body={"output_config": {"effort": "low"}},
        system=[
            {"type": "text", "text": _INSTRUCTIONS},
            # Stable per program level → cached across every file in the run.
            {"type": "text", "text": "SPECIFICATIONS:\n" + catalog, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": user}],
    )
    if msg.stop_reason == "refusal":
        return {"id": file.get("id"), "error": "model declined"}
    text = "".join(getattr(b, "text", "") for b in msg.content if getattr(b, "type", "") == "text")
    out = _parse_json(text)
    std = str(out.get("standard") or "").strip() or None
    spec = (str(out.get("spec") or "").strip().lower() or None)
    if std and f"{std}.{spec}" not in valid:
        spec = None if std not in {v.split(".")[0] for v in valid} else spec
        if f"{std}.{spec}" not in valid:
            spec = None
    try:
        conf = max(0.0, min(1.0, float(out.get("confidence") or 0)))
    except (TypeError, ValueError):
        conf = 0.0
    kind = "working_file" if out.get("kind") == "working_file" else "evidence"
    return {
        "id": file.get("id"),
        "kind": kind,
        "std": std if kind == "evidence" else None,
        "spec": spec if kind == "evidence" else None,
        "alternate": out.get("alternate"),
        "confidence": round(conf, 2),
        "reason": str(out.get("reason") or "")[:400],
        "passageSpec": out.get("passage_spec"),
        "passages": [f"{p['std']}.{p.get('spec') or ''}" for p in passages[:3]],
    }


def place_files(client: Any, specs: list[dict], narratives: list[dict], files: list[dict], workers: int = 6) -> list[dict]:
    index = PassageIndex(narratives)
    catalog = _catalog_text(specs)
    valid = {f"{s['std']}.{s['spec']}" for s in specs}

    def run(f: dict) -> dict:
        try:
            psg = index.query(str(f.get("name") or ""), str(f.get("path") or ""), str(f.get("text") or ""))
            return place_one(client, catalog, f, psg, valid)
        except Exception as exc:  # noqa: BLE001 — one file must never sink the batch
            return {"id": f.get("id"), "error": f"{type(exc).__name__}: {str(exc)[:200]}"}

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        return list(pool.map(run, files))

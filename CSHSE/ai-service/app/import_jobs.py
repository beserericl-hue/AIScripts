"""In-process job tracker + FIFO queue for AI Import Wizard jobs.

The cshse-ai service is intentionally a single worker in v1 (see UI spec
§20.10) — jobs queue FIFO behind the active one. Each job runs the
existing dispatcher pipeline (template or self-study) and POSTs:

  - per-stage progress events to the CSHSE server's ``ai-event`` webhook
    as the pipeline advances (queue moves, stage starts/completes,
    progress milestones, errors)
  - a terminal event to the ``ai-callback`` webhook when the job
    reaches ``parsed`` / ``failed`` / ``canceled``

State lives in-process; on cshse-ai restart, in-flight jobs are lost
(the CSHSE server will time them out via the queued/parsing timeout
banner — see UI spec §21.3). v2 moves state to Redis if persistence
across worker restarts becomes important.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import tempfile
import time
import traceback
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from threading import Lock, Thread
from typing import Any, Callable, Literal

import boto3
import httpx
from botocore.config import Config as BotoConfig

from app.config import get_settings


def _is_transient_runtime_error(exc: BaseException) -> bool:
    """Same classifier the spec_matcher uses, lifted to the module level so
    the per-section error handlers can route transient hiccups to
    ``job.warnings`` rather than ``job.errors``.

    The matcher itself already retries Anthropic API failures and falls
    back to embedding-only placement, so anything reaching the outer
    try/except here is rare. We still treat network/timeout/5xx patterns
    as warnings (the section IS placed, just with a low-confidence
    embedding fallback) to keep the wizard's error banner reserved for
    genuine pipeline failures.
    """
    name = type(exc).__name__
    if name in {
        "APIConnectionError",
        "APITimeoutError",
        "InternalServerError",
        "RateLimitError",
        "TimeoutError",
        "ConnectionError",
        "ConnectionResetError",
    }:
        return True
    status = getattr(exc, "status_code", None)
    if isinstance(status, int) and status >= 500:
        return True
    text = (str(exc) or "").lower()
    return any(
        snippet in text
        for snippet in (
            "server disconnected",
            "connection reset",
            "connection aborted",
            "remote end closed",
            "timeout",
            "temporarily unavailable",
            "bad gateway",
            "service unavailable",
        )
    )

JobStatus = Literal["queued", "parsing", "parsed", "failed", "canceled"]


# ---------------------------------------------------------------- types


@dataclass
class StageProgress:
    name: str
    state: str  # "queued" | "running" | "done" | "skipped" | "n/a" | "failed"
    detail: str = ""
    eta_seconds: int | None = None
    started_at: str | None = None
    completed_at: str | None = None


@dataclass
class FormatVerdict:
    format: str  # "template" | "self_study"
    confidence: float
    signals: dict[str, Any]
    reasoning: str


@dataclass
class JobRecord:
    """One AI import job's full server-side state."""
    job_id: str
    import_id: str
    s3_key: str
    submission_id: str
    program_level: str
    force_format: str | None
    callback_url: str
    event_callback_url: str
    created_at: float
    # Per-institution scope key for the corrections RAG (matcher few-shot).
    # Optional — pre-correction-feedback callers (older Node servers) won't
    # send it; the matcher just skips few-shot retrieval in that case.
    institution_id: str | None = None
    status: JobStatus = "queued"
    queue_position: int | None = None
    queue_depth: int | None = None
    eta_seconds: int | None = None
    format: FormatVerdict | None = None
    stages: list[StageProgress] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    # Warnings: per-section issues the pipeline recovered from automatically
    # (e.g., matcher transient API errors that retried successfully, or that
    # fell through to the embedding-only fallback). Kept for diagnostics but
    # NOT surfaced as the top-level wizard error banner — the user only sees
    # `errors` in the red error panel; warnings live in the JSON for support.
    warnings: list[str] = field(default_factory=list)
    # Terminal payload (filled when status flips to "parsed")
    buckets: dict[str, Any] | None = None
    tags: list[Any] | None = None
    placeholder_sections: list[Any] | None = None
    matrices: list[Any] | None = None
    # CR-033 Phase 2b — per-faculty CV extractions (one entry per
    # detected CV). Same wire format as CVDetection.cv_to_dict().
    cvs: list[Any] | None = None
    # CR-033 Phase 2c part 2 — standalone-CV mode. True when the upload
    # has CV signals but no Standards/Specs structure (i.e. the coordinator
    # uploaded just a CV.docx). The wizard switches to a simplified
    # single-card Review when this flag is set.
    standalone_cv: bool = False
    # CR-040 Phase 2b — per-paper / per-syllabus extractions. Same
    # wire format as EvidenceDocDetection.evidence_doc_to_dict().
    evidence_docs: list[Any] | None = None
    # CR-039 Phase 2b — section_id → routing_hint map (e.g.
    # "introduction:document", "introduction:standard-3"). Surfaced via
    # the callback so cshse-server can seed the wizard's Introduction
    # buckets without re-running the heading-based detector client-side.
    introduction_hints: dict[str, str] | None = None
    # CR-039 — STRUCTURED Introduction buckets ('document' / 'standard-N' →
    # {scope, standardCode, items[]}). This is what the wizard's Introduction
    # rail renders (Submission.aiReviewState.introductions). Hints alone left it
    # empty; the server maps this straight through (payload.introductions).
    introductions: dict[str, Any] | None = None
    # CR-040 Phase 3 — post-parse coverage report. Counts per
    # destination + a list of unassigned sections so the wizard can
    # surface a "Missing from import" rail entry.
    coverage_report: dict | None = None
    started_at: float | None = None
    completed_at: float | None = None

    def snapshot(self) -> dict[str, Any]:
        """JSON-serializable snapshot for /ai/import/:jobId + webhooks."""
        return {
            "jobId": self.job_id,
            "importId": self.import_id,
            "status": self.status,
            "queuePosition": self.queue_position,
            "queueDepth": self.queue_depth,
            "etaSeconds": self.eta_seconds,
            "format": asdict(self.format) if self.format else None,
            "stages": [asdict(s) for s in self.stages],
            "errors": list(self.errors),
            "warnings": list(self.warnings),
            "buckets": self.buckets,
            "tags": self.tags,
            "placeholderSections": self.placeholder_sections,
            "matrices": self.matrices,
            # CR-033 Phase 2b — per-faculty CVs detected by cv_detector.
            "cvs": self.cvs or [],
            # CR-033 Phase 2c part 2 — standalone-CV mode flag.
            "standaloneCv": bool(self.standalone_cv),
            # CR-040 Phase 2b — appendix papers + syllabi detected by
            # appendix_paper_detector.
            "evidenceDocs": self.evidence_docs or [],
            # CR-039 Phase 2b — section_id → routing_hint map from
            # introduction_detector. cshse-server consumes this to seed
            # the wizard's Introduction buckets (Phase 2c will also use
            # it as a matcher-prompt override).
            "introductionHints": self.introduction_hints or {},
            "introductions": self.introductions or {},
            # CR-040 Phase 3 — coverage report (per-destination counts +
            # missing fragments).
            "coverageReport": self.coverage_report or {},
        }


# ---------------------------------------------------------------- registry


_JOBS: dict[str, JobRecord] = {}
_QUEUE: list[str] = []  # FIFO order of job_ids waiting on the worker
_LOCK = Lock()
_WORKER_BUSY = False


def _now() -> float:
    return time.time()


def _hmac_sign(body: bytes, secret: str) -> str:
    """Match ai-service/app/auth.py's verify_hmac_signature format.

    Format: ``t=<unix>,v1=<hex>`` where digest = HMAC-SHA256 of
    ``<t>.<body>`` using the shared secret. Outbound webhooks from
    cshse-ai to the CSHSE server use this so the server can verify
    origin in the same way cshse-ai verifies inbound calls.
    """
    if not secret:
        return ""
    ts = str(int(_now()))
    digest = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


def _post_webhook(url: str, payload: dict[str, Any]) -> None:
    """Best-effort POST to a callback URL with HMAC signature.

    Webhook failures are logged but never raise — the job continues.
    The server will reconcile via the snapshot endpoint if a webhook
    is missed.
    """
    if not url:
        return
    try:
        body = json.dumps(payload).encode()
        settings = get_settings()
        sig = _hmac_sign(body, settings.node_service_hmac_secret)
        headers = {"Content-Type": "application/json"}
        if sig:
            headers["X-Service-Signature"] = sig
        with httpx.Client(timeout=10.0) as client:
            r = client.post(url, content=body, headers=headers)
            if r.status_code >= 400:
                print(f"[import_jobs] webhook {url} returned {r.status_code}: {r.text[:200]}")
    except Exception as exc:  # noqa: BLE001
        print(f"[import_jobs] webhook {url} failed: {type(exc).__name__}: {exc}")


def _publish_status(job: JobRecord) -> None:
    """Post an event-callback for a job's current snapshot."""
    _post_webhook(job.event_callback_url, job.snapshot())


def _publish_terminal(job: JobRecord) -> None:
    """Post the terminal callback (when status is parsed / failed / canceled)."""
    _post_webhook(job.callback_url, job.snapshot())


def _update_queue_positions() -> None:
    """Recompute queue_position / queue_depth on every waiting job; publish."""
    depth = len(_QUEUE)
    for idx, jid in enumerate(_QUEUE):
        j = _JOBS.get(jid)
        if not j or j.status != "queued":
            continue
        new_pos = idx + 1
        if j.queue_position != new_pos or j.queue_depth != depth:
            j.queue_position = new_pos
            j.queue_depth = depth
            _publish_status(j)


# ---------------------------------------------------------------- pipeline glue


def _resolve_s3_to_local(s3_key: str, out_path: Path) -> None:
    """Download an S3 object to ``out_path``.

    Uses the standard AWS env var convention; pulls bucket name from
    ``CSHSE_S3_BUCKET`` (defaults to the Tigris bucket name we use in
    production). Path-style addressing because Tigris doesn't support
    virtual-host style.
    """
    bucket = os.environ.get("CSHSE_S3_BUCKET", "cshse-filestorage-qlyj5pn")
    endpoint = os.environ.get("AWS_ENDPOINT_URL_S3") or os.environ.get("AWS_ENDPOINT_URL")
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )
    s3.download_file(bucket, s3_key, str(out_path))


def _stage_started(job: JobRecord, name: str, detail: str = "") -> None:
    stage = StageProgress(name=name, state="running", detail=detail, started_at=_iso(_now()))
    job.stages.append(stage)
    _publish_status(job)


def _stage_done(job: JobRecord, name: str, detail: str = "") -> None:
    for s in reversed(job.stages):
        if s.name == name:
            s.state = "done"
            if detail:
                s.detail = detail
            s.completed_at = _iso(_now())
            break
    _publish_status(job)


def _stage_skipped(job: JobRecord, name: str, detail: str = "") -> None:
    job.stages.append(StageProgress(name=name, state="skipped", detail=detail))
    _publish_status(job)


def _iso(t: float) -> str:
    import datetime as _dt
    return _dt.datetime.fromtimestamp(t, tz=_dt.timezone.utc).isoformat()


def _run_pipeline(job: JobRecord) -> None:
    """The actual pipeline body. Runs in a worker thread.

    Detects format, dispatches to the template walker or the DOCX-direct
    self-study runner, captures intermediate state into the JobRecord,
    and fires webhooks at each stage transition.
    """
    job.status = "parsing"
    job.queue_position = None
    job.queue_depth = None
    job.started_at = _now()
    _publish_status(job)

    tmp_dir = Path(tempfile.mkdtemp(prefix="cshse-ai-import-"))
    try:
        # Stage 1: download from S3
        _stage_started(job, "download_s3", "fetching from object store")
        docx_path = tmp_dir / "source.docx"
        try:
            _resolve_s3_to_local(job.s3_key, docx_path)
        except Exception as exc:  # noqa: BLE001
            job.errors.append(f"download_s3 failed: {type(exc).__name__}: {exc}")
            job.status = "failed"
            _publish_status(job)
            _publish_terminal(job)
            return
        size_mb = docx_path.stat().st_size / 1024 / 1024
        _stage_done(job, "download_s3", f"{size_mb:.1f} MB")

        # Stage 2: format detection
        _stage_started(job, "format_detect", "")
        from app.splitter.format_detector import detect_format
        if job.force_format in ("template", "self_study"):
            from app.splitter.format_detector import FormatDetection
            job.format = FormatVerdict(
                format=job.force_format,
                confidence=1.0,
                signals={"forced": True},
                reasoning="Format forced by caller (--force-format).",
            )
        else:
            det = detect_format(str(docx_path))
            job.format = FormatVerdict(
                format=det.format,
                confidence=det.confidence,
                signals=dict(det.signals),
                reasoning=det.reasoning,
            )
        _stage_done(job, "format_detect", f"{job.format.format} ({job.format.confidence:.2f})")

        # Stages 3-N: dispatch to the right pipeline.
        if job.format.format == "template":
            _run_template_pipeline(job, docx_path)
        else:
            _run_self_study_pipeline(job, docx_path)

        if job.status not in ("failed", "canceled"):
            # CR-037 Defense 1 — ai-service self-validates before the
            # terminal callback. Defenses 2 + 3 (server rewrite, client
            # gate) ship today, but the cleanest place to catch an
            # empty-bucket parse is right here, before we even publish
            # `parsed`. If every content kind summed to zero, the matcher
            # didn't actually place anything — flip to `failed` with an
            # actionable error rather than handing the server a
            # technically-successful-but-empty terminal callback.
            #
            # Counts every kind the rail surfaces so a CV-only import or
            # paper-only import (legitimate empty-bucket-but-not-empty
            # cases) still passes.
            buckets_count = 0
            for b in (job.buckets or {}).values():
                buckets_count += len((b or {}).get("narratives") or [])
                buckets_count += len((b or {}).get("evidenceText") or [])
                buckets_count += len((b or {}).get("evidenceFiles") or [])
                buckets_count += len((b or {}).get("matrixCells") or [])
            content_total = (
                buckets_count
                + len(job.tags or [])
                + len(job.matrices or [])
                + len(job.cvs or [])
                + len(job.evidence_docs or [])
                + len(job.introduction_hints or {})
            )
            if content_total == 0:
                job.errors.append(
                    "AI matcher returned zero items. The document may be "
                    "malformed or every section may have failed to match. "
                    "Re-upload after fixing the source; contact support if "
                    "this persists."
                )
                job.status = "failed"
                job.completed_at = _now()
                _publish_status(job)
                _publish_terminal(job)
            else:
                job.status = "parsed"
                job.completed_at = _now()
                _publish_status(job)
                _publish_terminal(job)

    except Exception as exc:  # noqa: BLE001
        job.errors.append(f"pipeline failed: {type(exc).__name__}: {exc}")
        job.errors.append(traceback.format_exc()[-1000:])
        job.status = "failed"
        job.completed_at = _now()
        _publish_status(job)
        _publish_terminal(job)
    finally:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass


def _run_template_pipeline(job: JobRecord, docx_path: Path) -> None:
    """Template-format path. Mirrors scripts/build_template_preview.run_template_preview
    but builds in-memory result instead of writing an Obsidian file."""
    from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
    from app.coverage.spec_coverage import CoverageReviewer
    from app.embeddings.openai_client import EmbeddingClient
    from app.embeddings.spec_cache import bootstrap_spec_cache
    from app.matcher.spec_matcher import SpecMatcher
    from app.splitter.template_walker import walk_template_docx
    from app.standards.loader import load_specifications
    from app.vector.qdrant_ops import VectorStore

    settings = get_settings()

    _stage_started(job, "template_walker", "walking paragraphs")
    sections, raw_sections = walk_template_docx(str(docx_path), base_id=job.job_id)
    placeholders = [r for r in raw_sections if r.placeholder]
    job.placeholder_sections = [
        {
            "paragraphIndex": r.paragraph_index,
            "heading": r.heading,
            "standardHint": r.standard_hint,
            "specHint": r.spec_hint,
        }
        for r in placeholders
    ]
    _stage_done(
        job,
        "template_walker",
        f"{len(raw_sections)} sections ({len(sections)} authored, {len(placeholders)} placeholder)",
    )

    # Introduction routing seed (template path). The walker deterministically
    # tags the document Introduction (front matter + intro prompts + glossary →
    # introduction:document) and each Standard's framing (the "Standard N: …
    # shall…" root → introduction:standard-N). Layer the lexical heading
    # detector on top to catch any intro heading (Mission/Glossary/Overview)
    # the region scan missed. These route to the Introduction buckets below.
    from app.splitter.introduction_detector import detect_introductions
    job.introduction_hints = job.introduction_hints or {}
    for sec in sections:
        h = (sec.flags or {}).get("templateIntroductionHint")
        if h:
            job.introduction_hints[sec.id] = h
    for sid, h in detect_introductions(sections).items():
        job.introduction_hints.setdefault(sid, h)

    _stage_started(job, "matcher", f"0 / {len(sections)}")
    store = VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    embedder = EmbeddingClient(settings.openai_api_key)
    bootstrap_spec_cache(store, embedder, program_levels=(job.program_level,))
    matcher = SpecMatcher(store=store, embedder=embedder, anthropic_key=settings.anthropic_api_key)

    recommendations: dict[str, Any] = {}
    done_count = 0
    # CR-028 — outer safety net on each future. The per-call timeouts
    # on Anthropic/OpenAI/Qdrant should already prevent any single section
    # from blocking longer than ~60s, but if those slip we still need
    # the threadpool to drain. 180s is generous (3 minutes); after that
    # we treat the section as soft-failed and continue, so as_completed
    # can never deadlock the whole stage.
    PER_SECTION_TIMEOUT_S = 180
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(matcher.recommend, s, job.program_level, institution_id=job.institution_id): s for s in sections}
        for fut in as_completed(futures):
            sec = futures[fut]
            try:
                recommendations[sec.id] = fut.result(timeout=PER_SECTION_TIMEOUT_S)
            except FuturesTimeoutError:
                # Worker hasn't returned in PER_SECTION_TIMEOUT_S - mark the
                # future cancelled (best-effort; if it's wedged in a C
                # extension it ignores cancel but the loop continues).
                fut.cancel()
                job.warnings.append(
                    f"matcher {sec.id}: outer timeout after {PER_SECTION_TIMEOUT_S}s - section soft-failed"
                )
            except Exception as exc:  # noqa: BLE001
                # The matcher itself wraps the Anthropic call in a retry +
                # embedding fallback path, so a real exception escaping out
                # to here means a hard runtime error (qdrant init, parser
                # crash, etc.) - not a transient API hiccup. We classify
                # by reading the exception name + message; transient
                # patterns become warnings (background diagnostic), hard
                # failures become errors (red banner).
                if _is_transient_runtime_error(exc):
                    job.warnings.append(f"matcher {sec.id}: {type(exc).__name__}: {exc}")
                else:
                    job.errors.append(f"matcher {sec.id}: {type(exc).__name__}: {exc}")
            done_count += 1
            # Update detail every few rows so the UI sees movement
            if done_count % 2 == 0 or done_count == len(sections):
                for s in reversed(job.stages):
                    if s.name == "matcher":
                        s.detail = f"{done_count} / {len(sections)}"
                        break
                _publish_status(job)
    _stage_done(job, "matcher", f"{len(recommendations)} / {len(sections)}")

    _stage_started(job, "coverage_review", "queued")
    specs = load_specifications(job.program_level)
    spec_index = {(s.standard_code, s.spec_code): s for s in specs}
    buckets: dict[str, dict[str, Any]] = {}
    for (std, sp), spec in spec_index.items():
        buckets[f"{std}.{sp}"] = {
            "standardCode": std,
            "specCode": sp,
            "standardTitle": spec.standard_title,
            "specPrompt": spec.spec_text,
            "narratives": [],
            "evidenceText": [],
            "evidenceFiles": [],
            "matrixCells": [],
            "coverageScore": None,
            "coverageCovered": None,
            "coverageGaps": [],
            "coverageStrengths": [],
        }

    tags: list[dict[str, Any]] = []
    # Introduction routing (mirrors the self-study path). A walker-provided hint
    # (templateIntroductionHint) is AUTHORITATIVE — the document intro + glossary
    # and each Standard's framing always route to the Introduction buckets, never
    # to a spec. A matcher-only intro (section_type='introduction') routes too.
    INTRO_OVERRIDE_THRESHOLD = 0.75
    intro_routed_count = 0
    # Structured Introduction buckets the wizard's Introduction rail actually
    # reads (Submission.aiReviewState.introductions, keyed 'document' /
    # 'standard-N' with items[]). cshse-ai only ever sent intro HINTS + tags,
    # so aiReviewState.introductions stayed {} and the rail was empty. Build the
    # structure here and route intros to it ONLY (not tags) so they don't also
    # show in Unplaced.
    intro_struct: dict[str, dict[str, Any]] = {}
    for sec in sections:
        rec = recommendations.get(sec.id)
        walker_hint = (sec.flags or {}).get("templateIntroductionHint")
        intro_hint = walker_hint or (job.introduction_hints or {}).get(sec.id)
        if not intro_hint and rec is not None and rec.section_type == "introduction":
            intro_hint = (
                f"introduction:standard-{rec.primary_standard}"
                if rec.primary_standard else "introduction:document"
            )
        if intro_hint and (
            walker_hint
            or rec is None
            or rec.section_type == "introduction"
            or rec.primary_confidence < INTRO_OVERRIDE_THRESHOLD
        ):
            job.introduction_hints[sec.id] = intro_hint
            key = intro_hint.split("introduction:", 1)[-1]  # 'document' | 'standard-N'
            scope = "standard" if key.startswith("standard-") else "document"
            std_code = key.split("-", 1)[1] if scope == "standard" else None
            ib = intro_struct.setdefault(
                key, {"scope": scope, "standardCode": std_code, "items": []}
            )
            ib["items"].append(_section_to_item(sec, rec))
            intro_routed_count += 1
            continue
        if rec is None or rec.primary_standard is None or rec.primary_spec is None:
            tags.append(_recommendation_to_tag(sec, rec))
            continue
        key = f"{rec.primary_standard}.{rec.primary_spec}"
        bucket = buckets.get(key)
        if bucket is None:
            tags.append(_recommendation_to_tag(sec, rec))
            continue
        item = _section_to_item(sec, rec)
        if rec.primary_confidence < 0.50 or rec.section_type in ("context", "unknown"):
            tags.append(_recommendation_to_tag(sec, rec))
        elif rec.section_type == "narrative_response":
            if sec.word_count < 1000:
                bucket["narratives"].append(item)
            else:
                bucket["evidenceText"].append(item)
        elif rec.section_type == "supporting_evidence":
            looks_file = sec.word_count >= 250
            if looks_file and rec.primary_confidence >= 0.70:
                bucket["evidenceFiles"].append(item)
            else:
                bucket["evidenceText"].append(item)
        else:
            tags.append(_recommendation_to_tag(sec, rec))

    # Deterministic supporting evidence the per-section matcher never sees:
    #  (1) Embedded TABLES (faculty rosters, advisory-board attendee lists,
    #      credit-hour grids) — the paragraph walk drops tables, so attach each
    #      to its containing spec's bucket as an evidenceFiles item (HTML kept).
    #  (2) "See Appendix …" references — PC import reminders, as evidenceText.
    import uuid as _uuid

    def _table_caption(text: str) -> str:
        # A human title for the table: its first meaningful header row, with
        # repeated header cells collapsed (a header spanning columns repeats),
        # e.g. "Example of a CIP Code", "Name · Role", "Attendees". Never
        # "(data table)" — that reads as noise on the review card.
        for line in (text or "").splitlines():
            cells = [c.strip() for c in line.split("|") if c.strip()]
            if not cells:
                continue
            seen: set[str] = set()
            uniq: list[str] = []
            for c in cells:
                if c.lower() not in seen:
                    seen.add(c.lower())
                    uniq.append(c)
            cap = " · ".join(uniq)
            if len(cap) > 1:
                return cap[:70]
        return ""

    tbl_count = apx_count = 0
    for raw in raw_sections:
        std, sp = raw.standard_hint, raw.spec_hint
        if not (std and sp):
            continue  # tables under intro / standard-root carry no spec anchor
        bucket = buckets.get(f"{std}.{sp}")
        if bucket is None:
            continue
        for tb in (raw.evidence_tables or []):
            txt = (tb.get("text") or "").strip()
            if not txt:
                continue
            caption = _table_caption(txt)
            title = f"Table: {caption}" if caption else f"Supporting table — Standard {std}.{sp}"
            bucket["evidenceFiles"].append({
                "sectionId": f"{job.job_id}:tbl:{_uuid.uuid4().hex[:8]}",
                "heading": title,
                "snippet": txt[:2000],
                "htmlSnippet": tb.get("html"),
                "wordCount": len(txt.split()),
                "confidence": 0.9,
                "acceptState": "review_unknown",
                "rationale": f"Embedded table under Standard {std}.{sp} — supporting evidence the per-section matcher can't see.",
            })
            tbl_count += 1
        seen_refs: set[str] = set()
        for ref in (raw.appendix_refs or []):
            r = ref.strip()
            if not r or r.lower() in seen_refs:
                continue
            seen_refs.add(r.lower())
            bucket["evidenceText"].append({
                "sectionId": f"{job.job_id}:apx:{_uuid.uuid4().hex[:8]}",
                "heading": "Import reminder — appendix reference",
                "snippet": f"\U0001F4CE {r}\n(Reminder: import this appendix document as supporting evidence.)",
                "htmlSnippet": None,
                "wordCount": len(r.split()),
                "confidence": 1.0,
                "acceptState": "review_unknown",
                "rationale": "Appendix reference — the coordinator should import the named document as supporting evidence.",
            })
            apx_count += 1
    if tbl_count or apx_count:
        job.warnings.append(
            f"template evidence: extracted {tbl_count} embedded table(s) and "
            f"{apx_count} appendix import-reminder(s) into supporting evidence"
        )

    # LLM content split — read INSIDE each spec's full narrative (everything from
    # its heading to the next spec) and pull out embedded supporting evidence:
    # quoted policy/document text and lists of materials/artifacts. The narrative
    # is left intact; the evidence is additionally surfaced under the SAME spec.
    _stage_started(job, "evidence_split", "queued")
    from app.matcher.evidence_splitter import EvidenceSplitter, _KIND_LABEL, _norm as _norm_ev
    split_specs = [
        s for (std, sp), s in spec_index.items()
        if buckets[f"{std}.{sp}"]["narratives"]
    ]
    ev_added = 0
    if split_specs:
        try:
            splitter = EvidenceSplitter(settings.anthropic_api_key)

            def _split_one(spec):
                bk = buckets[f"{spec.standard_code}.{spec.spec_code}"]
                narrative_text = "\n\n".join(
                    (n.get("snippet") or "") for n in bk["narratives"]
                ).strip()
                # Tiny answers carry nothing to separate — skip to save calls.
                if len(narrative_text.split()) < 40:
                    return spec, []
                return spec, splitter.split(spec, narrative_text)

            completed = 0
            with ThreadPoolExecutor(max_workers=6) as ex:
                futures = {ex.submit(_split_one, s): s for s in split_specs}
                for fut in as_completed(futures):
                    spec, passages = fut.result()
                    bk = buckets[f"{spec.standard_code}.{spec.spec_code}"]
                    existing = {(_norm_ev(e.get("snippet")))[:120] for e in bk["evidenceText"]}
                    for p in passages:
                        key = _norm_ev(p.excerpt)[:120]
                        if key in existing:
                            continue
                        existing.add(key)
                        bk["evidenceText"].append({
                            "sectionId": f"{job.job_id}:evs:{_uuid.uuid4().hex[:8]}",
                            "heading": p.label or _KIND_LABEL.get(p.kind, "Supporting evidence"),
                            "snippet": p.excerpt[:2000],
                            "htmlSnippet": None,
                            "wordCount": len(p.excerpt.split()),
                            "confidence": 0.8,
                            "acceptState": "review_unknown",
                            "rationale": (
                                f"Embedded {p.kind} pulled from the "
                                f"{spec.standard_code}.{spec.spec_code} narrative."
                            ),
                        })
                        ev_added += 1
                    completed += 1
                    if completed % 5 == 0 or completed == len(split_specs):
                        for st in reversed(job.stages):
                            if st.name == "evidence_split":
                                st.detail = f"{completed} / {len(split_specs)}"
                                st.state = "running"
                                break
                        _publish_status(job)
            _stage_done(
                job, "evidence_split",
                f"{ev_added} evidence passage(s) from {len(split_specs)} spec(s)",
            )
        except Exception as exc:  # noqa: BLE001 — never let the split sink the import
            job.warnings.append(f"evidence_split: {type(exc).__name__}: {exc}")
            _stage_done(job, "evidence_split", f"skipped ({type(exc).__name__})")
    else:
        _stage_skipped(job, "evidence_split", "no narratives")

    # Coverage review only on filled specs; synthesize for empties.
    filled = [s for (std, sp), s in spec_index.items() if buckets[f"{std}.{sp}"]["narratives"] or buckets[f"{std}.{sp}"]["evidenceText"] or buckets[f"{std}.{sp}"]["evidenceFiles"]]
    if filled:
        reviewer = CoverageReviewer(settings.anthropic_api_key)
        completed = 0
        with ThreadPoolExecutor(max_workers=6) as ex:
            def _review_one(spec):
                bucket = buckets[f"{spec.standard_code}.{spec.spec_code}"]
                narrative_text = "\n\n".join(n["snippet"][:3000] for n in bucket["narratives"]).strip()
                evidence_items = [
                    (e["heading"][:80], e["snippet"][:1500]) for e in bucket["evidenceText"]
                ] + [
                    (f["heading"][:80], f["snippet"][:1500]) for f in bucket["evidenceFiles"]
                ]
                return spec, reviewer.review(spec, narrative_text, evidence_items)

            futures = {ex.submit(_review_one, s): s for s in filled}
            for fut in as_completed(futures):
                spec, rv = fut.result()
                bucket = buckets[f"{spec.standard_code}.{spec.spec_code}"]
                bucket["coverageScore"] = rv.coverage_score
                bucket["coverageCovered"] = rv.is_covered
                bucket["coverageGaps"] = rv.gaps
                bucket["coverageStrengths"] = rv.strengths
                completed += 1
                if completed % 5 == 0 or completed == len(filled):
                    for s in reversed(job.stages):
                        if s.name == "coverage_review":
                            s.detail = f"{completed} / {len(filled)}"
                            s.state = "running"
                            break
                    _publish_status(job)
    _stage_done(job, "coverage_review", f"{len(filled)} reviewed, {len(spec_index) - len(filled)} synthesized")

    # Template format: matrix extraction would need the source HTML, but the
    # template_walker reads from the DOCX path and doesn't keep HTML around.
    # Defer until the template walker is reworked to also surface raw HTML;
    # template DOCXs typically ship the matrix as a separate appendix.
    _stage_skipped(job, "matrix_extract", "template format — needs html capture rework")
    _stage_skipped(job, "gap_fill", "no appendix")

    job.buckets = buckets
    job.tags = tags
    job.introductions = intro_struct
    job.matrices = []


def _run_self_study_pipeline(job: JobRecord, docx_path: Path) -> None:
    """Stevenson-style DOCX-direct pipeline.

    For sub-sprint 1.a we keep this minimal: convert + deep-walk + match
    + bucket + coverage. Gap-fill stays opt-in via an env flag because
    cost / wall-time are heavy on the first end-to-end pass. The wizard
    UI doesn't depend on gap-fill for the happy path test.
    """
    import io
    import mammoth
    from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
    from app.coverage.spec_coverage import CoverageReviewer
    from app.embeddings.openai_client import EmbeddingClient
    from app.embeddings.spec_cache import bootstrap_spec_cache
    from app.matcher.spec_matcher import SpecMatcher
    from app.splitter.deep_walker import deep_walk_with_fallback
    from app.standards.loader import load_specifications
    from app.vector.qdrant_ops import VectorStore

    settings = get_settings()

    _stage_started(job, "mammoth", "DOCX → HTML")
    with open(docx_path, "rb") as f:
        html_str = mammoth.convert_to_html(io.BytesIO(f.read())).value
    html_bytes = html_str.encode("utf-8")
    _stage_done(job, "mammoth", f"{len(html_bytes)/1024/1024:.2f} MB HTML")

    _stage_started(job, "deep_walker", "")
    raw_sections = deep_walk_with_fallback(html_bytes, base_id=job.job_id)
    # Two-tier filter:
    #   - Letter-tagged subspec rows (splitter_tier="table_subspec_row") are
    #     ALWAYS kept: the walker already classified them as direct responses
    #     to a Handbook letter-prefix prompt. Their content may be a single
    #     short sentence (e.g. "Regionally accredited by Middle States.") but
    #     dropping them by word count means the matching spec card stays empty
    #     even though the document clearly addresses it.
    #   - Other sections (prose, generic data tables) keep the 30-word floor.
    sections = [
        s for s in raw_sections
        if s.splitter_tier == "table_subspec_row" or s.word_count >= 30
    ]
    preserved = sum(
        1 for s in raw_sections
        if s.splitter_tier == "table_subspec_row" and s.word_count < 30
    )
    detail = f"{len(raw_sections)} raw, {len(sections)} after filter"
    if preserved:
        detail += f" (preserved {preserved} short letter-tagged responses)"
    _stage_done(job, "deep_walker", detail)

    # CR-033 Phase 2b — pull CV sections out of the matcher's input so
    # they don't compete with regular specs. Two complementary scans:
    #   1. detect_cvs_from_html — pre-scans raw `<p>` tags before the
    #      deep_walker's 5-word floor strips out CV anchors / markers /
    #      contact lines. Catches Stevenson-style CVs where every
    #      signal line is short ("Barry W. Thomas", "EDUCATION",
    #      "thomas.bw@verizon.net").
    #   2. detect_cvs (sliding window over walker sections) — catches
    #      CVs whose paragraphs survive the word floor and reach the
    #      section stream.
    # Detections from (1) feed a fingerprint set used to drop matching
    # walker sections so the CV content never reaches the matcher's
    # bucket router twice.
    from app.splitter.cv_detector import (
        detect_cvs,
        detect_cvs_from_html,
        cv_to_dict,
    )
    cv_detections_pre, dropped_texts = detect_cvs_from_html(html_bytes)
    if dropped_texts:
        dropped_set = {t[:200].strip() for t in dropped_texts if t and t.strip()}
        sections = [
            s for s in sections
            if (s.markdown or "").strip()[:200] not in dropped_set
        ]
    cv_detections_post, sections = detect_cvs(sections)
    cv_detections = cv_detections_pre + cv_detections_post
    cvs_wire = [cv_to_dict(cv) for cv in cv_detections]

    # CR-040 follow-on (2026-05-27) — TOC-anchored second pass for CVs.
    # See toc_detector.py for the rationale: pattern-based detectors
    # miss CVs whose body anchor doesn't match the heuristic, but the
    # Table of Contents has the canonical index. Parse the TOC once
    # here, share the result with the evidence-doc pass below.
    from app.splitter.toc_detector import (
        parse_toc as _parse_toc,
        parse_sub_tocs as _parse_sub_tocs,
        anchor_in_body as _toc_anchor_in_body,
        merge_cv_detections as _merge_cv_dets,
        merge_evidence_doc_detections as _merge_ed_dets,
    )
    # Stevenson-class docs put per-CV entries in a SUB-TOC under
    # "Appendices" rather than the main TOC, so we accumulate both
    # passes before anchoring in the body.
    _main_toc = _parse_toc(html_bytes)
    _sub_toc = _parse_sub_tocs(html_bytes)
    toc_entries = _main_toc + _sub_toc
    toc_detections_all = (
        _toc_anchor_in_body(html_bytes, toc_entries) if toc_entries else []
    )
    pre_toc_cv_count = len(cvs_wire)
    cvs_wire = _merge_cv_dets(cvs_wire, toc_detections_all)
    toc_added_cvs = len(cvs_wire) - pre_toc_cv_count

    if cvs_wire:
        job.cvs = cvs_wire
        _stage_done(
            job,
            "cv_detector",
            f"{len(cvs_wire)} CV(s) detected "
            f"({len(cv_detections_pre)} pre-walker, "
            f"{len(cv_detections_post)} post-walker, "
            f"{toc_added_cvs} added via TOC); "
            f"removed from matcher input",
        )
    else:
        _stage_skipped(job, "cv_detector", "no CV anchors matched")

    # CR-040 Phase 2b — same shape as CR-033: detect appendix papers +
    # syllabi, pull them out of the matcher input, send them through
    # the callback as job.evidence_docs.
    from app.splitter.appendix_paper_detector import (
        detect_evidence_docs,
        detect_evidence_docs_from_html,
        evidence_doc_to_dict,
    )
    # Pre-walker pass — catches papers/syllabi whose header signal sits
    # in a paragraph below the deep_walker's 30-word filter floor
    # (e.g. "Sample Country Report (125 points)" is short, but the
    # body that follows is long). Without this pre-pass, real papers
    # never fire the per-section detector because the header and the
    # body live in different walker sections.
    pre_docs, pre_dropped = detect_evidence_docs_from_html(html_bytes)
    if pre_dropped:
        pre_drop_set = {t[:200].strip() for t in pre_dropped if t and t.strip()}
        sections = [
            s for s in sections
            if (s.markdown or "").strip()[:200] not in pre_drop_set
        ]
    post_docs, sections = detect_evidence_docs(sections)
    evidence_doc_detections = pre_docs + post_docs
    if evidence_doc_detections:
        # CR-040 Phase 2c — generate one .docx per detection and upload
        # to import-scoped S3 keys so the wizard's "View file" button
        # has a real artifact to open. Apply-time copy to
        # submission-scoped keys + SupportingEvidence row creation
        # land in Phase 3. Failures here are soft — a section with no
        # S3 key still ships as a metadata-only card.
        _persist_evidence_docs_to_s3(job, evidence_doc_detections)
    pattern_docs_wire = [
        evidence_doc_to_dict(d) for d in evidence_doc_detections
    ]
    pre_toc_doc_count = len(pattern_docs_wire)
    evidence_docs_wire = _merge_ed_dets(pattern_docs_wire, toc_detections_all)
    toc_added_docs = len(evidence_docs_wire) - pre_toc_doc_count

    n_paper = sum(1 for d in evidence_docs_wire if d.get("docSubKind") == "paper")
    n_syll = sum(1 for d in evidence_docs_wire if d.get("docSubKind") == "syllabus")
    n_pattern_paper = sum(
        1 for d in evidence_doc_detections if d.doc_sub_kind == "paper"
    )
    n_pattern_syll = sum(
        1 for d in evidence_doc_detections if d.doc_sub_kind == "syllabus"
    )

    if evidence_docs_wire:
        job.evidence_docs = evidence_docs_wire
        n_uploaded = sum(1 for d in evidence_doc_detections if d.s3_key)
        # CR-040 follow-on — TOC-added documents don't have a generated
        # .docx (no body slice goes through _persist_evidence_docs_to_s3
        # in this pass), so the count is pattern-only. A separate
        # backfill pass can generate .docx for TOC-anchored entries
        # later if coordinators want View-file working for them.
        _stage_done(
            job,
            "evidence_doc_detector",
            f"{n_paper} paper(s) + {n_syll} syllabus(es) "
            f"({n_pattern_paper}+{n_pattern_syll} from pattern, "
            f"{toc_added_docs} added via TOC); "
            f"{n_uploaded}/{len(evidence_doc_detections)} uploaded to S3",
        )
    else:
        _stage_skipped(job, "evidence_doc_detector", "no paper / syllabus headers matched")

    # CR-039 Phase 2b — compute the Introduction routing-hint map BEFORE
    # the matcher runs. The map is surfaced via the callback so
    # cshse-server can pre-route intro material into the wizard's
    # Introduction buckets. Sections themselves stay in the matcher
    # stream — the matcher will use the hint as a confidence override
    # in Phase 2c (next slice). This commit just gets the hints to the
    # callback so the client UI can render them.
    from app.splitter.introduction_detector import detect_introductions
    intro_hints = detect_introductions(sections)
    job.introduction_hints = intro_hints
    if intro_hints:
        _stage_done(
            job,
            "introduction_detector",
            f"{len(intro_hints)} intro candidate(s) detected via heading match",
        )
    else:
        _stage_skipped(job, "introduction_detector", "no intro headings matched")

    store = VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    embedder = EmbeddingClient(settings.openai_api_key)
    bootstrap_spec_cache(store, embedder, program_levels=(job.program_level,))

    _stage_started(job, "matcher", f"0 / {len(sections)}")
    matcher = SpecMatcher(store=store, embedder=embedder, anthropic_key=settings.anthropic_api_key)
    recommendations: dict[str, Any] = {}
    done_count = 0
    # CR-028 — see _run_self_study_pipeline for the rationale on the outer
    # safety-net timeout.
    PER_SECTION_TIMEOUT_S = 180
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(matcher.recommend, s, job.program_level, institution_id=job.institution_id): s for s in sections}
        for fut in as_completed(futures):
            sec = futures[fut]
            try:
                recommendations[sec.id] = fut.result(timeout=PER_SECTION_TIMEOUT_S)
            except FuturesTimeoutError:
                fut.cancel()
                job.warnings.append(
                    f"matcher {sec.id}: outer timeout after {PER_SECTION_TIMEOUT_S}s - section soft-failed"
                )
            except Exception as exc:  # noqa: BLE001
                # See the same comment on the first matcher loop earlier in
                # the file: transient API errors are already retried + fallen
                # back inside matcher.recommend; exceptions reaching here are
                # hard runtime failures unless the message reads transient.
                if _is_transient_runtime_error(exc):
                    job.warnings.append(f"matcher {sec.id}: {type(exc).__name__}: {exc}")
                else:
                    job.errors.append(f"matcher {sec.id}: {type(exc).__name__}: {exc}")
            done_count += 1
            if done_count % 25 == 0 or done_count == len(sections):
                for s in reversed(job.stages):
                    if s.name == "matcher":
                        s.detail = f"{done_count} / {len(sections)}"
                        break
                _publish_status(job)
    _stage_done(job, "matcher", f"{len(recommendations)} / {len(sections)}")

    # Bucket allocation (mirrors template path; same shape).
    _stage_started(job, "coverage_review", "queued")
    specs = load_specifications(job.program_level)
    spec_index = {(s.standard_code, s.spec_code): s for s in specs}
    buckets: dict[str, dict[str, Any]] = {}
    for (std, sp), spec in spec_index.items():
        buckets[f"{std}.{sp}"] = {
            "standardCode": std,
            "specCode": sp,
            "standardTitle": spec.standard_title,
            "specPrompt": spec.spec_text,
            "narratives": [], "evidenceText": [], "evidenceFiles": [], "matrixCells": [],
            "coverageScore": None, "coverageCovered": None,
            "coverageGaps": [], "coverageStrengths": [],
        }

    tags: list[dict[str, Any]] = []
    # CR-039 Phase 2c — three-source intro routing:
    #
    #   1. introduction_detector heuristic (splitter-side, lexical)
    #      → populates job.introduction_hints[sec.id] = "introduction:document"
    #        or "introduction:standard-N" before the matcher even runs.
    #
    #   2. matcher LLM section_type='introduction' (NEW in Phase 2c)
    #      → the Haiku prompt explicitly classifies intro-shaped sections
    #        as section_type='introduction'. We derive the standard hint
    #        from rec.primary_standard when present, otherwise route to
    #        the document-level intro.
    #
    #   3. heuristic-confirms-low-confidence (existing Phase 2b path)
    #      → if heuristic flagged but matcher's confidence in a real spec
    #        is below 0.75, prefer the intro routing.
    #
    # All three converge on the same dict shape (intro_hint key) and the
    # same routing (tags + rationale marker). Heuristic source wins for
    # the hint string; matcher source fills in when the heuristic missed.
    INTRO_OVERRIDE_THRESHOLD = 0.75
    intro_routed_count = 0
    matcher_intro_count = 0
    for sec in sections:
        rec = recommendations.get(sec.id)
        intro_hint = (job.introduction_hints or {}).get(sec.id)

        # Source 2 — matcher LLM classified this as an introduction.
        # When the heuristic missed it, synthesize the hint from the
        # matcher's primary_standard (per-Standard intro) or fall back
        # to the document-level intro bucket.
        if (
            not intro_hint
            and rec is not None
            and rec.section_type == "introduction"
        ):
            if rec.primary_standard:
                intro_hint = f"introduction:standard-{rec.primary_standard}"
            else:
                intro_hint = "introduction:document"
            # Backfill into job.introduction_hints so the terminal callback
            # carries it and the wizard's Zustand store can route it into
            # the right Introduction bucket without re-checking section_type.
            if job.introduction_hints is None:
                job.introduction_hints = {}
            job.introduction_hints[sec.id] = intro_hint
            matcher_intro_count += 1

        # Source 1 + 3 — heuristic flag with optional low-confidence gate.
        # Source 2 always overrides the matcher's spec placement (the LLM
        # explicitly said "this is an intro, not a spec answer").
        is_matcher_intro = rec is not None and rec.section_type == "introduction"
        if intro_hint and (is_matcher_intro or rec is None or rec.primary_confidence < INTRO_OVERRIDE_THRESHOLD):
            intro_routed_count += 1
            tag = _recommendation_to_tag(sec, rec)
            # Stamp the intro hint onto the tag's rationale so downstream
            # tooling can detect it without re-querying job.introduction_hints.
            tag["rationale"] = (tag.get("rationale") or "") + f" [{intro_hint}]"
            tags.append(tag)
            continue
        if rec is None or rec.primary_standard is None or rec.primary_spec is None:
            tags.append(_recommendation_to_tag(sec, rec))
            continue
        key = f"{rec.primary_standard}.{rec.primary_spec}"
        bucket = buckets.get(key)
        if bucket is None:
            tags.append(_recommendation_to_tag(sec, rec))
            continue
        item = _section_to_item(sec, rec)
        if rec.primary_confidence < 0.50 or rec.section_type in ("context", "unknown"):
            tags.append(_recommendation_to_tag(sec, rec))
        elif rec.section_type == "narrative_response":
            if sec.word_count < 1000:
                bucket["narratives"].append(item)
            else:
                bucket["evidenceText"].append(item)
        elif rec.section_type == "supporting_evidence":
            if sec.word_count >= 250 and rec.primary_confidence >= 0.70:
                bucket["evidenceFiles"].append(item)
            else:
                bucket["evidenceText"].append(item)
        else:
            tags.append(_recommendation_to_tag(sec, rec))
    if intro_routed_count > 0:
        # Add a soft warning so the audit log shows the matcher override
        # rate (per CR-039 telemetry requirements). Phase 2c splits the
        # count between heuristic-driven and matcher-driven overrides so
        # we can track how often each source caught an intro the other
        # would have missed.
        heuristic_count = intro_routed_count - matcher_intro_count
        job.warnings.append(
            f"introduction routing overrode matcher placement for "
            f"{intro_routed_count} section(s) "
            f"(heuristic={heuristic_count}, matcher_llm={matcher_intro_count}, "
            f"confidence threshold {INTRO_OVERRIDE_THRESHOLD})"
        )

    filled = [
        s for (std, sp), s in spec_index.items()
        if buckets[f"{std}.{sp}"]["narratives"] or buckets[f"{std}.{sp}"]["evidenceText"] or buckets[f"{std}.{sp}"]["evidenceFiles"]
    ]
    if filled:
        reviewer = CoverageReviewer(settings.anthropic_api_key)
        completed = 0
        with ThreadPoolExecutor(max_workers=8) as ex:
            def _review_one(spec):
                bucket = buckets[f"{spec.standard_code}.{spec.spec_code}"]
                narrative_text = "\n\n".join(n["snippet"][:3000] for n in bucket["narratives"]).strip()
                evidence_items = [
                    (e["heading"][:80], e["snippet"][:1500]) for e in bucket["evidenceText"]
                ] + [
                    (f["heading"][:80], f["snippet"][:1500]) for f in bucket["evidenceFiles"]
                ]
                return spec, reviewer.review(spec, narrative_text, evidence_items)
            futures = {ex.submit(_review_one, s): s for s in filled}
            for fut in as_completed(futures):
                spec, rv = fut.result()
                bucket = buckets[f"{spec.standard_code}.{spec.spec_code}"]
                bucket["coverageScore"] = rv.coverage_score
                bucket["coverageCovered"] = rv.is_covered
                bucket["coverageGaps"] = rv.gaps
                bucket["coverageStrengths"] = rv.strengths
                completed += 1
                if completed % 10 == 0 or completed == len(filled):
                    for s in reversed(job.stages):
                        if s.name == "coverage_review":
                            s.detail = f"{completed} / {len(filled)}"
                            break
                    _publish_status(job)
    _stage_done(job, "coverage_review", f"{len(filled)} reviewed, {len(spec_index) - len(filled)} synthesized")

    # Matrix extract: parse the two CSHSE matrix anchors (MatrixHSR + Matrix2)
    # and emit per-matrix wire dicts so the wizard's "Matrices (N)" view can
    # show the full table and per-spec deep-links rather than fragmenting
    # matrix rows into individual data-table cards under random specs.
    matrices = _extract_matrices_safe(job, html_bytes)
    _stage_skipped(job, "gap_fill", "deferred to sub-sprint 1.b")

    job.buckets = buckets
    job.tags = tags
    job.matrices = matrices

    # CR-033 Phase 2c part 2 — detect standalone-CV uploads. When the
    # coordinator drops just a CV.docx (no Standards/Specs structure),
    # we land here with zero populated buckets and >=1 CV detection.
    # The wizard switches to a one-card Review when this flag is set.
    populated_buckets = sum(
        1 for b in buckets.values()
        if (b.get("narratives") or b.get("evidenceText") or b.get("evidenceFiles"))
    )
    if populated_buckets == 0 and (job.cvs or []):
        job.standalone_cv = True
        job.warnings.append(
            f"standalone_cv: {len(job.cvs)} CV(s) detected with no spec content — "
            "wizard will render the single-card Review path"
        )

    # CR-040 Phase 3 — final coverage check. Pulls section ids out of
    # every destination set and emits a per-section accounting plus a
    # MissingFragment list the wizard can surface on a new
    # "Missing from import" rail entry. Soft-fails so a verifier bug
    # never blocks a successful parse.
    try:
        from app.splitter.coverage_verifier import verify_coverage

        bucketed_ids: set[str] = set()
        for bk, b in buckets.items():
            for kind in ("narratives", "evidenceText", "evidenceFiles"):
                for item in b.get(kind, []) or []:
                    sid = item.get("sectionId") if isinstance(item, dict) else getattr(item, "sectionId", None)
                    if sid:
                        bucketed_ids.add(sid)
        tag_ids = {t.get("sectionId") for t in tags if isinstance(t, dict)}
        tag_ids.discard(None)
        intro_ids = set((job.introduction_hints or {}).keys())
        cv_ids = {d.get("sectionId") for d in (job.cvs or []) if isinstance(d, dict)}
        cv_ids.discard(None)
        ed_ids = {d.get("sectionId") for d in (job.evidence_docs or []) if isinstance(d, dict)}
        ed_ids.discard(None)

        report = verify_coverage(
            raw_sections=raw_sections,
            bucketed_section_ids=bucketed_ids,
            tag_section_ids=tag_ids,
            intro_section_ids=intro_ids,
            cv_section_ids=cv_ids,
            evidence_doc_section_ids=ed_ids,
        )
        job.coverage_report = report.to_dict()
        if report.missing_fragments:
            job.warnings.append(
                f"coverage_verifier: {len(report.missing_fragments)} section(s) unaccounted for "
                f"(coverage {report.coverage_percent}%)"
            )
        _stage_done(
            job,
            "coverage_verifier",
            f"{report.coverage_percent}% coverage, "
            f"{len(report.missing_fragments)} missing fragment(s)",
        )
    except Exception as exc:  # noqa: BLE001
        job.warnings.append(
            f"coverage_verifier soft-failed: {type(exc).__name__}: {exc}"
        )


def _extract_matrices_safe(job: "JobRecord", html_bytes: bytes) -> list[dict[str, Any]]:
    """Run the curriculum-matrix extractor against the source HTML; never raise.

    Matrix extraction is a best-effort enrichment: if the program level has
    no matching template, if the anchors aren't present, or if the extractor
    fails for any reason, we log to the job stage and return ``[]`` rather
    than aborting the pipeline.
    """
    from app.matrix.template_loader import (
        align_template_to_handbook,
        load_matrix_template,
    )
    from app.matrix.wire_format import build_wire_matrices
    from app.standards.loader import load_specifications

    _stage_started(job, "matrix_extract", "")
    try:
        template = load_matrix_template(job.program_level)
        handbook = load_specifications(job.program_level)
        aligned = align_template_to_handbook(template, handbook)
        matrices, _consumed = build_wire_matrices(html_bytes, aligned)
    except FileNotFoundError as exc:
        _stage_skipped(job, "matrix_extract", f"no template for {job.program_level}: {exc}")
        return []
    except Exception as exc:  # noqa: BLE001
        job.errors.append(f"matrix_extract failed: {type(exc).__name__}: {exc}")
        _stage_skipped(job, "matrix_extract", f"failed: {type(exc).__name__}")
        return []

    if not matrices:
        _stage_done(job, "matrix_extract", "no matrices detected")
        return []

    total_cells = sum(len(m.get("cells", [])) for m in matrices)
    _stage_done(
        job,
        "matrix_extract",
        f"{len(matrices)} matrix(es), {total_cells} cells",
    )
    return matrices


def _persist_evidence_docs_to_s3(job: "JobRecord", detections: list) -> None:
    """CR-040 Phase 2c — generate one .docx per evidenceDoc detection
    and upload to import-scoped S3 keys.

    Best-effort: a missing AWS env, a single failed upload, or a missing
    body (rare — detection requires ≥200 words OR ≥1 image) all soft-fail
    so detections still surface as metadata-only cards.
    """
    if not detections:
        return
    if not os.environ.get("AWS_ACCESS_KEY_ID"):
        job.warnings.append(
            "evidence_doc_detector: AWS_ACCESS_KEY_ID not set; "
            "skipping .docx uploads (cards will surface metadata-only)"
        )
        return
    from app.export.docx_writer import build_evidence_docx
    from app.export.s3_writer import upload_evidence_docx

    # Phase 2c uses placeholder std/spec values for the .docx subtitle
    # because the matcher hasn't run yet at this stage. Phase 3 reruns
    # the upload (or copies the existing object) once the coordinator
    # has reviewed + resolved the spec routing at Apply time.
    placeholder_std = "?"
    placeholder_spec = "?"

    for d in detections:
        if not d.body:
            continue
        try:
            exported = build_evidence_docx(
                title=d.title,
                body_text=d.body,
                standard_code=placeholder_std,
                spec_code=placeholder_spec,
                source_filename=f"import-{job.import_id}",
            )
            uploaded = upload_evidence_docx(
                exported,
                institution_id=job.institution_id or "_unknown",
                submission_id=job.submission_id,
                uploaded_by="ai-import-wizard",
                dry_run=False,
            )
            d.s3_key = uploaded.s3_key
            d.s3_bucket = uploaded.s3_bucket
            d.file_size = uploaded.docx_size
            d.sha256 = uploaded.sha256
        except Exception as exc:  # noqa: BLE001
            job.warnings.append(
                f"evidence_doc {d.section_id}: docx/S3 failed — "
                f"{type(exc).__name__}: {exc}"
            )


def _section_to_item(sec, rec) -> dict[str, Any]:
    snippet = sec.markdown
    if snippet.startswith("# "):
        snippet = snippet.split("\n", 2)[-1] if "\n" in snippet else ""
    return {
        "sectionId": sec.id,
        "heading": sec.heading[:200],
        "snippet": snippet.strip(),
        # HTML preserved by table-aware walkers; renderer prefers this when present.
        "htmlSnippet": getattr(sec, "html_snippet", None),
        "wordCount": sec.word_count,
        "confidence": rec.primary_confidence,
        "acceptState": rec.accept_state,
        "rationale": rec.rationale,
        # CR-031 — document-order index; used by the wizard's
        # nearestPlacedNeighbor helper to figure out which placed item
        # sits just above an unplaced one.
        "byteOffsetStart": getattr(sec, "byte_offset_start", 0),
    }


def _recommendation_to_tag(sec, rec) -> dict[str, Any]:
    snippet = sec.markdown
    if snippet.startswith("# "):
        snippet = snippet.split("\n", 2)[-1] if "\n" in snippet else ""
    return {
        "tagId": f"tag-{uuid.uuid4().hex[:8]}",
        "sectionId": sec.id,
        "summary": sec.heading[:120],
        "fullText": snippet[:2000],
        "htmlSnippet": getattr(sec, "html_snippet", None),
        "suggestedStd": rec.primary_standard if rec else None,
        "suggestedSpec": rec.primary_spec if rec else None,
        "confidence": rec.primary_confidence if rec else 0.0,
        "sourceHeading": sec.heading[:120],
        "acceptState": rec.accept_state if rec else "review_unknown",
        "rationale": rec.rationale if rec else "Matcher returned no recommendation.",
        # CR-031 — same document-order index, also on unplaced tags so
        # the wizard can join them against placed buckets.
        "byteOffsetStart": getattr(sec, "byte_offset_start", 0),
    }


# ---------------------------------------------------------------- queue worker


def _worker_loop() -> None:
    """Single-worker pump. Picks the next queued job, runs the pipeline, repeats.

    The worker thread is started lazily on the first enqueue. It never
    exits — pythonic version of a service worker.
    """
    global _WORKER_BUSY
    while True:
        with _LOCK:
            if not _QUEUE:
                _WORKER_BUSY = False
                _LOCK.release()
                time.sleep(0.05)
                _LOCK.acquire()
                continue
            job_id = _QUEUE.pop(0)
            job = _JOBS.get(job_id)
            if not job or job.status == "canceled":
                _update_queue_positions()
                continue
            _WORKER_BUSY = True
            _update_queue_positions()
        try:
            _run_pipeline(job)
        except Exception as exc:  # noqa: BLE001
            job.errors.append(f"worker crash: {type(exc).__name__}: {exc}")
            job.status = "failed"
            _publish_terminal(job)
        finally:
            with _LOCK:
                _WORKER_BUSY = False


_WORKER_STARTED = False


def _ensure_worker() -> None:
    global _WORKER_STARTED
    with _LOCK:
        if _WORKER_STARTED:
            return
        t = Thread(target=_worker_loop, name="cshse-ai-import-worker", daemon=True)
        t.start()
        _WORKER_STARTED = True


# ---------------------------------------------------------------- public API


def enqueue_job(
    *,
    import_id: str,
    s3_key: str,
    submission_id: str,
    program_level: str,
    force_format: str | None,
    callback_url: str,
    event_callback_url: str,
    institution_id: str | None = None,
) -> dict[str, Any]:
    """Create + enqueue a new import job. Returns the initial snapshot."""
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    job = JobRecord(
        job_id=job_id,
        import_id=import_id,
        s3_key=s3_key,
        submission_id=submission_id,
        program_level=program_level,
        force_format=force_format,
        callback_url=callback_url,
        event_callback_url=event_callback_url,
        created_at=_now(),
        institution_id=institution_id,
    )
    with _LOCK:
        _JOBS[job_id] = job
        _QUEUE.append(job_id)
        _update_queue_positions()
    _publish_status(job)
    _ensure_worker()
    return job.snapshot()


def get_job(job_id: str) -> dict[str, Any] | None:
    job = _JOBS.get(job_id)
    return job.snapshot() if job else None


def cancel_job(job_id: str) -> bool:
    """Cancel a queued or running job.

    Queued jobs are removed from the queue and never run. Running jobs
    flip status to ``canceled`` — the pipeline checks this between
    stages and bails. Terminal jobs are unchanged (no-op, returns False).
    """
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return False
        if job.status in ("parsed", "failed", "canceled"):
            return False
        was_queued = job_id in _QUEUE
        if was_queued:
            _QUEUE.remove(job_id)
        job.status = "canceled"
        job.completed_at = _now()
        _update_queue_positions()
    _publish_status(job)
    _publish_terminal(job)
    return True

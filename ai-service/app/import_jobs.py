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
    status: JobStatus = "queued"
    queue_position: int | None = None
    queue_depth: int | None = None
    eta_seconds: int | None = None
    format: FormatVerdict | None = None
    stages: list[StageProgress] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    # Terminal payload (filled when status flips to "parsed")
    buckets: dict[str, Any] | None = None
    tags: list[Any] | None = None
    placeholder_sections: list[Any] | None = None
    matrices: list[Any] | None = None
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
            "buckets": self.buckets,
            "tags": self.tags,
            "placeholderSections": self.placeholder_sections,
            "matrices": self.matrices,
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
    from concurrent.futures import ThreadPoolExecutor, as_completed
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

    _stage_started(job, "matcher", f"0 / {len(sections)}")
    store = VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    embedder = EmbeddingClient(settings.openai_api_key)
    bootstrap_spec_cache(store, embedder, program_levels=(job.program_level,))
    matcher = SpecMatcher(store=store, embedder=embedder, anthropic_key=settings.anthropic_api_key)

    recommendations: dict[str, Any] = {}
    done_count = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(matcher.recommend, s, job.program_level): s for s in sections}
        for fut in as_completed(futures):
            sec = futures[fut]
            try:
                recommendations[sec.id] = fut.result()
            except Exception as exc:  # noqa: BLE001
                job.errors.append(f"matcher {sec.id}: {exc}")
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
    for sec in sections:
        rec = recommendations.get(sec.id)
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

    # Template format: no matrix extraction in-doc, no gap-fill (no appendix).
    _stage_skipped(job, "matrix_extract", "template format")
    _stage_skipped(job, "gap_fill", "no appendix")

    job.buckets = buckets
    job.tags = tags
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
    from concurrent.futures import ThreadPoolExecutor, as_completed
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
    sections = [s for s in raw_sections if s.word_count >= 30]
    _stage_done(job, "deep_walker", f"{len(raw_sections)} raw, {len(sections)} after filter")

    store = VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    embedder = EmbeddingClient(settings.openai_api_key)
    bootstrap_spec_cache(store, embedder, program_levels=(job.program_level,))

    _stage_started(job, "matcher", f"0 / {len(sections)}")
    matcher = SpecMatcher(store=store, embedder=embedder, anthropic_key=settings.anthropic_api_key)
    recommendations: dict[str, Any] = {}
    done_count = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(matcher.recommend, s, job.program_level): s for s in sections}
        for fut in as_completed(futures):
            sec = futures[fut]
            try:
                recommendations[sec.id] = fut.result()
            except Exception as exc:  # noqa: BLE001
                job.errors.append(f"matcher {sec.id}: {exc}")
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
    for sec in sections:
        rec = recommendations.get(sec.id)
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

    # Matrix + gap-fill: deferred to v1.b/1.d (need appendix walker output;
    # MVP wizard happy path doesn't need them, see UI spec §19).
    _stage_skipped(job, "matrix_extract", "deferred to sub-sprint 1.b")
    _stage_skipped(job, "gap_fill", "deferred to sub-sprint 1.b")

    job.buckets = buckets
    job.tags = tags
    job.matrices = []


def _section_to_item(sec, rec) -> dict[str, Any]:
    snippet = sec.markdown
    if snippet.startswith("# "):
        snippet = snippet.split("\n", 2)[-1] if "\n" in snippet else ""
    return {
        "sectionId": sec.id,
        "heading": sec.heading[:200],
        "snippet": snippet.strip(),
        "wordCount": sec.word_count,
        "confidence": rec.primary_confidence,
        "acceptState": rec.accept_state,
        "rationale": rec.rationale,
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
        "suggestedStd": rec.primary_standard if rec else None,
        "suggestedSpec": rec.primary_spec if rec else None,
        "confidence": rec.primary_confidence if rec else 0.0,
        "sourceHeading": sec.heading[:120],
        "acceptState": rec.accept_state if rec else "review_unknown",
        "rationale": rec.rationale if rec else "Matcher returned no recommendation.",
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

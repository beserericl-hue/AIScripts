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
import io
import json
import os
import re
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
    # MCC third-format payload (mcc_narrative). Structured walker output:
    # introduction, 20 standards (section title + shall + text + references),
    # and the appendix catalog with page ranges. cshse-server materializes
    # standard narratives + appendix PDF slices + reference→standard tags.
    mcc: dict | None = None
    # MCC — a CLEAN source HTML rebuilt from the walker output (headings +
    # link-anchored paragraphs, each spec/intro chunk wrapped in a
    # data-section-id div matching its narrative). The server stores it as the
    # import's GridFS content so the Review "Compare / Show in source" pane
    # renders formatted source with working links that matches the imported
    # panes exactly — instead of the legacy flattened run-on PDF parse.
    source_html: str | None = None
    started_at: float | None = None
    completed_at: float | None = None
    # CR-073 — the data-driven parser rule engine loaded for this import
    # (active, in-scope ``parserrules``). Not serialized in ``snapshot()``;
    # applied as a default-preserving post-pass before anchoring. ``None`` when
    # the rule store is empty/unreachable (parse proceeds unchanged).
    rule_engine: Any = field(default=None, repr=False, compare=False)

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
            # MCC third-format structured payload (null for the other formats).
            "mcc": self.mcc or None,
            # MCC clean source HTML (null until built at the end of the MCC
            # pipeline, so progress snapshots stay small; only the terminal
            # callback carries it).
            "sourceHtml": self.source_html,
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


def _upload_bytes_to_s3(s3_key: str, data: bytes, content_type: str) -> tuple[str, str]:
    """Upload ``data`` to the CSHSE bucket at ``s3_key``. Returns (bucket, key).

    Used by the MCC pipeline to store each appendix as its own native PDF slice
    so the server can back a SupportingEvidence record with storageType='s3'
    (viewed natively — no OCR-flattening for the human).
    """
    bucket = os.environ.get("CSHSE_S3_BUCKET", "cshse-filestorage-qlyj5pn")
    endpoint = os.environ.get("AWS_ENDPOINT_URL_S3") or os.environ.get("AWS_ENDPOINT_URL")
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )
    s3.put_object(Bucket=bucket, Key=s3_key, Body=data, ContentType=content_type)
    return bucket, s3_key


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


def _ensure_all_items_anchored(job: "JobRecord") -> None:
    """Guarantee the Compare source HTML has a ``data-section-id`` anchor for
    EVERY review item — narrative, supporting-evidence, or introduction — no
    matter which pipeline or which section it was parsed into.

    The Compare pane locates an item by matching its ``sectionId`` to a
    ``data-section-id`` anchor in the source document; without that anchor it
    falls back to a fuzzy text search and, for short/reformatted items, shows
    "section not located — showing top". The template pipeline builds no source
    HTML at all and MCC anchors only its narratives, so evidence items went
    unanchored. This appends an anchored ``<section>`` for any item whose id is
    not already present, leaving richly-formatted existing anchors untouched.
    """
    import re as _re

    html = job.source_html or ""
    have: set[str] = set(_re.findall(r'data-section-id="([^"]+)"', html))
    extra: list[str] = []

    def _emit(item: dict) -> None:
        sid = (item or {}).get("sectionId")
        if not sid or sid in have:
            return
        have.add(sid)
        heading = _html_escape((item.get("heading") or "").strip())
        body = item.get("htmlSnippet")
        if not (isinstance(body, str) and body.strip()):
            body = "<p>" + _html_escape((item.get("snippet") or "").strip()) + "</p>"
        head_html = f"<h3>{heading}</h3>" if heading else ""
        extra.append(f'<section data-section-id="{_html_escape(sid)}">{head_html}{body}</section>')

    for ib in (job.introductions or {}).values():
        for item in (ib or {}).get("items", []) or []:
            _emit(item)
    for bk in (job.buckets or {}).values():
        for kind in ("narratives", "evidenceText", "evidenceFiles"):
            for item in (bk or {}).get(kind, []) or []:
                _emit(item)
    for item in (job.tags or []):
        _emit(item)

    if not extra:
        return
    block = '<div data-anchors="review-items">' + "".join(extra) + "</div>"
    if "</body>" in html:
        job.source_html = html.replace("</body>", block + "</body>", 1)
    elif html.strip():
        job.source_html = html + block
    else:
        job.source_html = (
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
            'body{font-family:Arial,sans-serif;line-height:1.6;padding:20px;max-width:100%;}'
            'section{margin:0 0 1.25rem;}h3{margin:0 0 .35rem;font-size:1rem;}'
            '</style></head><body>' + block + '</body></html>'
        )


def _ensure_coverage(job: "JobRecord") -> None:
    """Guarantee a coverage assessment exists for EVERY filled spec, regardless
    of which pipeline ran. Template + self-study run the reviewer inline; MCC
    (and any future format) don't — so backfill any filled bucket that still has
    no assessment. Requirement: no document is parsed without a coverage review,
    so the red/yellow/green dot and its "why" tooltip always have data behind it.
    Already-assessed buckets are skipped (idempotent — no double cost)."""
    from app.coverage.spec_coverage import review_specs

    buckets = job.buckets or {}
    items: list[dict] = []
    for key, b in buckets.items():
        if not b:
            continue
        # Skip specs the reviewer already scored (template/self-study inline pass).
        if b.get("coverageScore") is not None or b.get("coverageCovered") is not None:
            continue
        narr = b.get("narratives") or []
        evt = b.get("evidenceText") or []
        evf = b.get("evidenceFiles") or []
        if not (narr or evt or evf):
            continue  # empty spec → no dot shown → nothing to assess
        std, spec = b.get("standardCode"), b.get("specCode")
        if not std or not spec:
            continue
        narrative_text = "\n\n".join((n.get("snippet") or "")[:3000] for n in narr).strip()
        evidence_items = [
            ((e.get("heading") or "")[:80], (e.get("snippet") or "")[:1500]) for e in [*evt, *evf]
        ]
        items.append({
            "key": key, "standard_code": str(std), "spec_code": str(spec),
            "narrative_text": narrative_text, "evidence_items": evidence_items,
        })

    if not items:
        return

    _stage_started(job, "coverage_review", f"0 / {len(items)}")

    def _progress(done: int, total: int) -> None:
        for s in reversed(job.stages):
            if s.name == "coverage_review":
                s.detail, s.state = f"{done} / {total}", "running"
                break
        if done % 5 == 0:
            _publish_status(job)

    settings = get_settings()
    reviews = review_specs(job.program_level, settings.anthropic_api_key, items, on_progress=_progress)
    by_key = {(r.standard_code, r.spec_code): r for r in reviews}
    applied = 0
    for it in items:
        r = by_key.get((it["standard_code"], it["spec_code"]))
        if not r:
            continue
        b = buckets[it["key"]]
        b["coverageScore"] = r.coverage_score
        b["coverageCovered"] = r.is_covered
        b["coverageGaps"] = r.gaps
        b["coverageStrengths"] = r.strengths
        applied += 1
    _stage_done(job, "coverage_review", f"{applied} reviewed")


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
        if job.force_format in ("template", "self_study", "mcc_narrative"):
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

        # CR-073 — load the active, in-scope parser rules for this format/scope.
        # STRICTLY default-preserving: an empty/unreachable rule store yields []
        # and the post-pass (below, before anchoring) becomes a strict no-op.
        # Never blocks or slows the parse (3s Mongo timeout, try/except → []).
        # The server already resolves forceFormat before calling us, so the
        # existing force logic above stays intact; we only EXPOSE
        # rule_engine.force_format() for parity — we don't re-apply it here.
        try:
            from app.rules.engine import RuleEngine, fetch_active_rules

            _rules = fetch_active_rules(
                job.format.format, job.institution_id, job.program_level
            )
            job.rule_engine = RuleEngine(_rules)
        except Exception as exc:  # noqa: BLE001 — the rule store must never break a parse
            job.warnings.append(
                f"rule-engine load: {type(exc).__name__}: {exc}"
            )
            job.rule_engine = None

        # Stages 3-N: dispatch to the right pipeline.
        if job.format.format == "mcc_narrative":
            _run_mcc_pipeline(job, docx_path)
        elif job.format.format == "template":
            _run_template_pipeline(job, docx_path)
        else:
            _run_self_study_pipeline(job, docx_path)

        # CR-073 — apply the data-driven parser rules as a default-preserving
        # post-pass over the assembled buckets. A strict NO-OP unless an active
        # rule's signature EXPLICITLY matches an item (the seeded baseline rules
        # carry structural signatures the post-pass doesn't evaluate, so they
        # move nothing → output stays byte-identical to today). Runs BEFORE
        # anchoring so any moved item still gets its Compare data-section-id.
        if job.status not in ("failed", "canceled") and getattr(job, "rule_engine", None):
            try:
                summary = job.rule_engine.apply_post_pass(job)
                # CR-073 — surface the post-pass outcome in warnings (JSON-only support
                # channel) ONLY when a rule actually acted, so normal parses stay clean.
                if summary.get("moved") or summary.get("reclassified") or summary.get("placedTags"):
                    job.warnings.append(
                        f"rule-engine post-pass: moved={summary.get('moved', 0)} "
                        f"reclassified={summary.get('reclassified', 0)} "
                        f"placedTags={summary.get('placedTags', 0)} "
                        f"applied={summary.get('appliedRuleIds', [])}"
                    )
            except Exception as exc:  # noqa: BLE001 — never sink the import
                job.warnings.append(
                    f"rule-engine post-pass ERROR: {type(exc).__name__}: {exc}"
                )

        # Compare relies on a data-section-id anchor per item. Template builds no
        # source HTML and MCC anchors only narratives — ensure EVERY item is
        # anchored so the Compare pane locates it (never "section not located").
        # Scoped to the DOCX pipelines whose source HTML is job.source_html; the
        # self-study path serves the original upload HTML and is left untouched.
        if job.status not in ("failed", "canceled") and job.format.format in ("template", "mcc_narrative"):
            try:
                _ensure_all_items_anchored(job)
            except Exception as exc:  # noqa: BLE001 — never sink the import
                job.warnings.append(f"anchor-source: {type(exc).__name__}: {exc}")

        # Guarantee a coverage assessment for every format (backfills MCC, which
        # doesn't run the reviewer inline). Requirement: no import without coverage.
        if job.status not in ("failed", "canceled"):
            try:
                _ensure_coverage(job)
            except Exception as exc:  # noqa: BLE001 — never sink the import over coverage
                job.warnings.append(f"coverage backfill: {type(exc).__name__}: {exc}")

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
                # MCC payload: standards + appendix files count as content.
                + len((job.mcc or {}).get("standards") or [])
                + len((job.mcc or {}).get("appendixCatalog") or [])
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


def _html_escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


_URL_INLINE_RE = re.compile(r"(https?://[^\s)]+)")


def _anchor(href: str, label: str) -> str:
    return (
        f'<a href="{_html_escape(href)}" target="_blank" rel="noopener noreferrer">'
        f"{_html_escape(label)}</a>"
    )


# A line that STARTS a new list item / sub-point — the only place we keep a
# hard break when reflowing PDF-wrapped text.
_LIST_MARK_RE = re.compile(
    r"^(?:[a-z]\.\d+[.)]?|[ivxlc]+[.)]|\d+[.)]|[-•*•]\s|\([a-z0-9]+\))",
    re.I,
)


def _reflow(paragraph: str) -> str:
    """Join PDF hard-wrapped lines back into flowing prose.

    PDF text extraction breaks a sentence at every visual line, so the raw
    text has a newline every ~12 words. Rendering those as <br/> makes the
    narrative look choppy and "compressed". Reflow: collapse a line into the
    previous one with a space, EXCEPT when the line clearly starts a new list
    item / sub-point (kept as a real break so lists stay readable)."""
    lines = [ln.strip() for ln in paragraph.split("\n") if ln.strip()]
    if not lines:
        return ""
    out = [lines[0]]
    for ln in lines[1:]:
        out.append(("\n" if _LIST_MARK_RE.match(ln) else " ") + ln)
    return "".join(out)


def _text_to_html(text: str, link_map: dict | None = None) -> str:
    """Escape narrative text and make its links CLICKABLE, preserving the
    document's own link text:
      * every hyperlink whose visible text appears in this passage (from the PDF
        link map, text->href) becomes a real ``<a>`` on that exact text — so
        "(Supporting Link: MCC Accreditation Page)" links to the accreditation
        page, matching the source document;
      * bare ``http(s)://`` URLs are auto-linked too.
    PDF hard line-wraps are reflowed into flowing paragraphs (see ``_reflow``);
    only blank-line paragraph breaks and genuine list items keep a break."""
    # Collapse whitespace in link-text keys so they still match the reflowed
    # (single-spaced) body text. Longest first so a short text can't shadow a
    # longer overlapping one.
    link_map = {
        _norm_space(k): v for (k, v) in (link_map or {}).items() if k and k.strip()
    }
    ordered = sorted(link_map.keys(), key=len, reverse=True)

    def render_para(p: str) -> str:
        # Split the paragraph on the known link texts, escaping the non-link
        # spans and anchoring the link spans.
        if ordered:
            pattern = "|".join(re.escape(t) for t in ordered)
            parts = re.split(f"({pattern})", p)
        else:
            parts = [p]
        out = []
        for seg in parts:
            if seg in link_map:
                out.append(_anchor(link_map[seg], seg))
            else:
                esc = _html_escape(seg).replace("\n", "<br/>")
                esc = _URL_INLINE_RE.sub(lambda m: _anchor(m.group(1), m.group(1)), esc)
                out.append(esc)
        return "".join(out)

    paras = [_reflow(p) for p in re.split(r"\n\s*\n", text or "") if p.strip()]
    html_paras = [f"<p>{render_para(p)}</p>" for p in paras if p]
    return "".join(html_paras) or "<p></p>"


def _split_standard_by_letter(std_text: str) -> list[tuple[str | None, str, str]]:
    """Split a standard's narrative into (letter, heading, body) chunks on the
    institution's OWN top-level sub-points (``a.``, ``b.`` …). The MCC document
    follows the CSHSE Handbook order, so its sub-point letter maps 1:1 to the
    CSHSE specification letter (``a`` → ``<std>.a``). Dotted sub-points
    (``b.1.``, ``b.2.``) fold into their parent letter so a spec keeps ALL of its
    content. Text before the first letter (the shall statement / framing) is
    returned with letter=None. Nothing is dropped."""
    lines = (std_text or "").splitlines()
    if lines and re.match(r"\s*Standard\s*#\s*\d+", lines[0]):
        lines = lines[1:]
    chunks: list[tuple[str | None, str, list[str]]] = []
    cur_letter: str | None = None
    cur_head = "Overview"
    cur_body: list[str] = []
    # Only a TOP-LEVEL "a. " opens a new spec chunk. A dotted "a.1." stays inside
    # the current chunk (it's a sub-point of the same spec).
    top_re = re.compile(r"^\s*([a-z])\.\s+(?=[A-Za-z(])")
    dotted_re = re.compile(r"^\s*[a-z]\.\d")
    for line in lines:
        m = top_re.match(line)
        if m and not dotted_re.match(line):
            if cur_body:
                chunks.append((cur_letter, cur_head, cur_body))
            cur_letter = m.group(1)
            cur_head = _norm_space(line)[:120]
            cur_body = [line[m.end():]]
        else:
            cur_body.append(line)
    if cur_body:
        chunks.append((cur_letter, cur_head, cur_body))
    return [(lt, h, "\n".join(b).strip()) for (lt, h, b) in chunks if "\n".join(b).strip()]


def _norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def _ocr_pdf_bytes(pdf_bytes: bytes, max_pages: int = 40, dpi: int = 200) -> str:
    """OCR a (scanned) PDF's pages → text, for the HIDDEN AI-scoring layer only.

    Rasterizes with PyMuPDF (no poppler needed) and reads with tesseract via
    pytesseract. Fully optional: if any dependency or the tesseract binary is
    missing, returns "" so the pipeline degrades gracefully to the embedded
    text layer. Capped at ``max_pages`` to bound wall-time on large scans.
    """
    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
    except Exception:  # noqa: BLE001
        return ""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:  # noqa: BLE001
        return ""
    out: list[str] = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        try:
            pix = page.get_pixmap(dpi=dpi)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            out.append(pytesseract.image_to_string(img) or "")
        except Exception:  # noqa: BLE001
            continue
    try:
        doc.close()
    except Exception:  # noqa: BLE001
        pass
    return "\n".join(out).strip()


def _run_mcc_pipeline(job: JobRecord, src_path: Path) -> None:
    """MCC narrative (third format) path — maps the PDF into the existing wizard
    review shapes so the current Review UI renders it unchanged:

      * ``introductions.document`` ← the single documentIntroduction blob.
      * ``buckets["<std>.<spec>"]`` ← each standard's narrative chunks placed on
        the canonical Associate sub-specs (Pass 3: embedding-scored within the
        known standard, with a deterministic fallback so content is never lost).
      * ``evidenceDocs[]`` ← each appendix sliced to its own **native PDF**,
        uploaded to S3 (storageType='s3'), routed to the standard(s) that cite
        it; ``extractedText`` rides along as HIDDEN metadata for AI scoring.
      * ``job.mcc`` ← the full structured walker output (diagnostics + server).
    """
    import uuid as _uuid

    from app.splitter.mcc_narrative_walker import walk_mcc_pdf, slice_pdf_pages, extract_uri_links, denoise_matrix_cells, is_matrix_row
    from app.standards.loader import load_specifications

    settings = get_settings()

    # ---- Pass 1 + 2 -----------------------------------------------------
    _stage_started(job, "mcc_walker", "reading PDF (pypdf)")
    result = walk_mcc_pdf(str(src_path), expected_standards=20)
    job.mcc = result.to_dict()
    job.warnings.extend(result.warnings)
    located = sum(1 for e in result.appendix_catalog if e.page_start is not None)
    _stage_done(
        job,
        "mcc_walker",
        f"{len(result.standards)} standards, {len(result.appendix_catalog)} appendices "
        f"({located} page-located), {result.page_count} pages",
    )

    # ---- Introduction ---------------------------------------------------
    _stage_started(job, "mcc_introduction", "")
    from app.splitter.mcc_narrative_walker import extract_link_map as _extract_link_map
    _intro_end = result.standards[0].page_start if (result.standards and result.standards[0].page_start) else 12
    intro_link_map = _extract_link_map(str(src_path), 0, _intro_end)

    # Trim a trailing Standard-1 section header that bled into the introduction
    # from the document's Part/Standard lead-in — e.g. the intro text ends with
    # "…Disability Support Services)\n\nI. General Program Characteristics\n
    # A. Institutional Requirements and Primary Program Objective". That header
    # IS Standard 1's section_title; leaving it in the intro duplicates the
    # heading and makes the Compare view look misaligned (the reviewer sees the
    # Standard-1 title inside the previous section, and Standard 1 seems to be
    # "missing its title"). Cut the intro back to the end of its own content.
    intro_text = result.introduction
    if result.standards:
        _st = (getattr(result.standards[0], "section_title", "") or "").strip()
        if _st and _st in intro_text[-400:]:
            _head = intro_text[: intro_text.rfind(_st)].rstrip()
            # also drop a preceding roman-numeral Part header line if present
            _m = re.search(r"\n\s*[IVXLC]+\.\s+\S[^\n]*$", _head)
            if _m:
                _head = _head[: _m.start()]
            intro_text = _head.rstrip()

    job.introductions = {
        "document": {
            "scope": "document",
            "standardCode": None,
            "items": [
                {
                    "sectionId": f"{job.job_id}:mccintro",
                    "heading": "Program Introduction",
                    "snippet": intro_text[:4000],
                    "htmlSnippet": _text_to_html(intro_text, intro_link_map),
                    "wordCount": len(intro_text.split()),
                    "confidence": None,
                    "acceptState": "review_unknown",
                    "rationale": "MCC General Introduction (headings preserved).",
                }
            ],
        }
    }
    _stage_done(job, "mcc_introduction", f"{len(intro_text)} chars")

    # Clean source-HTML reconstruction (for the Compare / Show-in-source pane).
    # Built in document order, reusing each chunk's exact sectionId +
    # htmlSnippet so the source pane matches the imported panes verbatim and
    # the compare anchor lands precisely on the spec.
    def _esc(s: str) -> str:
        return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    _intro_item = job.introductions["document"]["items"][0]
    source_parts: list[str] = [
        f'<section data-section-id="{_esc(_intro_item["sectionId"])}">'
        f'<h1>Program Introduction</h1>{_intro_item["htmlSnippet"]}</section>'
    ]

    # ---- Pass 3: place each standard's OWN sub-points on the matching spec ---
    # The MCC narrative follows the CSHSE Handbook order, so the institution's
    # sub-point letter (a., b., …) maps 1:1 to the canonical spec letter
    # (<std>.a). Deterministic + exact — the imported spec content is verbatim
    # the document's sub-point, so the Compare view matches the source.
    from app.splitter.mcc_narrative_walker import parse_references as _parse_refs

    _stage_started(job, "mcc_subspec_match", f"0 / {len(result.standards)}")
    specs = load_specifications(job.program_level)
    specs_by_std: dict[str, dict[str, Any]] = {}
    for sp in specs:
        specs_by_std.setdefault(str(sp.standard_code), {})[sp.spec_code] = sp

    buckets: dict[str, dict[str, Any]] = {}
    # THIRD PASS bookkeeping. The reference pass reads every "(Supporting
    # Document: … appendix <CODE>)" note in every sub-point and links each
    # appendix to EVERY specification that lists it — not just the first. An
    # appendix cited in 1.b's program overview AND in 4.a's curriculum evidence
    # must appear under BOTH (first-citing-only made 1.b hoard 20 files while
    # the specs that actually rely on them showed none).
    #   code_to_spec  → the FIRST citing (std, spec) — the file card's default.
    #   code_to_specs → ALL citing (std, spec) pairs — drives multi-spec linking.
    #   code_to_stds  → all standards (for the "referenced by" summary).
    code_to_spec: dict[str, tuple[str | None, str | None]] = {}
    code_to_specs: dict[str, list[tuple[str, str]]] = {}
    code_to_stds: dict[str, list[str]] = {}

    def _note_refs(refs, std_code, letter):
        for ref in refs:
            if ref.kind == "file" and ref.code:
                code_to_stds.setdefault(ref.code, [])
                if std_code and std_code not in code_to_stds[ref.code]:
                    code_to_stds[ref.code].append(std_code)
                if ref.code not in code_to_spec:
                    code_to_spec[ref.code] = (std_code, letter)
                if std_code and letter:
                    pair = (std_code, letter)
                    lst = code_to_specs.setdefault(ref.code, [])
                    if pair not in lst:
                        lst.append(pair)

    def _bucket(std_code: str, spec) -> dict[str, Any]:
        key = f"{std_code}.{spec.spec_code}"
        if key not in buckets:
            buckets[key] = {
                "standardCode": std_code,
                "specCode": spec.spec_code,
                "standardTitle": spec.standard_title,
                "specPrompt": spec.spec_text,
                "narratives": [], "evidenceText": [], "evidenceFiles": [],
                "matrixCells": [], "coverageScore": None, "coverageCovered": None,
                "coverageGaps": [], "coverageStrengths": [],
            }
        return buckets[key]

    def _add_std_intro(std_code: str, heading: str, body: str, link_map: dict, rationale: str):
        key = f"standard-{std_code}"
        item = {
            "sectionId": f"{job.job_id}:mccstdintro:{std_code}:{_uuid.uuid4().hex[:6]}",
            "heading": heading,
            "snippet": body[:4000],
            "htmlSnippet": _text_to_html(body, link_map),
            "wordCount": len(body.split()),
            "confidence": None,
            "acceptState": "review_unknown",
            "rationale": rationale,
        }
        if key in job.introductions:
            job.introductions[key]["items"].append(item)
        else:
            job.introductions[key] = {"scope": "standard", "standardCode": std_code, "items": [item]}
        return item

    # Document-introduction references (e.g. "MCC Education Guide appendix A1").
    _note_refs(result.intro_references, None, None)

    done = 0
    for std in result.standards:
        std_code = str(std.n)
        spec_letters = specs_by_std.get(std_code) or {}
        _std_title = getattr(std, "section_title", None) or getattr(std, "title", "") or ""
        source_parts.append(
            f'<h1>Standard #{_esc(std_code)}'
            f'{": " + _esc(_std_title) if _std_title else ""}</h1>'
        )
        for (letter, heading, body) in _split_standard_by_letter(std.text):
            # Matrix denoise (belt-and-suspenders alongside the walker clamp):
            # a curriculum-matrix row that leaked into the narrative is dropped
            # (the grid lives in Appendix A6, sliced to its own native file);
            # otherwise strip any stray cell runs from the prose + heading.
            if is_matrix_row(body) or is_matrix_row(heading):
                continue
            body = denoise_matrix_cells(body)
            heading = denoise_matrix_cells(heading)
            if not body.strip():
                continue
            refs = _parse_refs(body)
            spec = spec_letters.get(letter) if letter else None
            chunk_html = _text_to_html(body, std.link_map)
            if spec is not None:
                section_id = f"{job.job_id}:mccn:{std_code}:{letter}"
                bk = _bucket(std_code, spec)
                bk["narratives"].append({
                    "sectionId": section_id,
                    "heading": heading,
                    "snippet": body[:4000],
                    "htmlSnippet": chunk_html,
                    "wordCount": len(body.split()),
                    "confidence": 0.95,
                    "acceptState": "review_unknown",
                    "rationale": f"Matched to Specification {std_code}.{letter} by the document's own sub-point letter (“{spec.spec_text[:70]}…”).",
                })
                _note_refs(refs, std_code, letter)
            else:
                # Framing / shall statement / a letter with no canonical spec →
                # the Standard introduction so nothing is lost.
                item = _add_std_intro(std_code, heading, body, std.link_map,
                                      "Standard framing / overview (not a lettered specification).")
                section_id = item["sectionId"]
                _note_refs(refs, std_code, None)
            source_parts.append(
                f'<section data-section-id="{_esc(section_id)}">'
                f'<h2>{_esc(heading)}</h2>{chunk_html}</section>'
            )
        done += 1
        if done % 5 == 0:
            for s in reversed(job.stages):
                if s.name == "mcc_subspec_match":
                    s.detail = f"{done} / {len(result.standards)}"
                    break
            _publish_status(job)
    job.buckets = buckets
    _stage_done(job, "mcc_subspec_match", f"{len(buckets)} spec buckets filled")

    # ---- Appendix files: slice → S3 → evidenceDocs + tag to standard/sub-spec -
    _stage_started(job, "mcc_appendix_files", f"0 / {located}")

    from pypdf import PdfReader as _PdfReader

    evidence_docs: list[dict[str, Any]] = []
    uploaded = 0
    for entry in result.appendix_catalog:
        if entry.page_start is None or entry.page_end is None:
            continue
        try:
            pdf_bytes = slice_pdf_pages(str(src_path), entry.page_start, entry.page_end)
            s3_key = f"imports/mcc/{job.submission_id}/{job.import_id}/appendix-{entry.code}.pdf"
            try:
                bucket_name, key = _upload_bytes_to_s3(s3_key, pdf_bytes, "application/pdf")
            except Exception as exc:  # noqa: BLE001
                bucket_name, key = None, None
                job.warnings.append(f"Appendix {entry.code}: S3 upload failed ({exc}).")
            # Hidden text layer for AI scoring. Never surfaced to the reader.
            # Prefer the embedded text layer (fast); fall back to OCR when the
            # slice is a scan (thin/empty text) so the AI can still read it.
            try:
                _sl = _PdfReader(io.BytesIO(pdf_bytes))
                extracted = "\n".join((p.extract_text() or "") for p in _sl.pages).strip()
            except Exception:  # noqa: BLE001
                extracted = ""
            n_pages = max(1, entry.page_end - entry.page_start)
            ocr_used = False
            if len(extracted) < 40 * n_pages:  # avg < 40 chars/page ⇒ scanned
                ocr_text = _ocr_pdf_bytes(pdf_bytes)
                if len(ocr_text) > len(extracted):
                    extracted, ocr_used = ocr_text, True
            ref_stds = list(code_to_stds.get(entry.code, []))
            # Standard + sub-standard from the sub-point that CITES this appendix
            # in the narrative — this is the "third pass" the file cards need so
            # they pre-fill and a reader sees the file under the right spec.
            route_std, route_spec = code_to_spec.get(entry.code, (None, None))
            # EVERY spec that lists this appendix (third-pass multi-link). Copy so
            # augmenting below doesn't mutate the shared code_to_specs list.
            ref_specs = list(code_to_specs.get(entry.code, []))
            ref_specs_labels = [f"{s}.{p}" for (s, p) in ref_specs]
            ref_summary = (
                f"Referenced by {', '.join(ref_specs_labels)}."
                if ref_specs_labels
                else "Referenced in the program introduction." if entry.code in code_to_spec
                else "Not referenced inline."
            )
            # Classification flags the file card uses:
            #  - intro_ref: cited only in the program introduction (no lettered
            #    spec) → the card offers/pre-selects the "Introduction" option.
            #  - is_matrix: a curriculum-matrix appendix → also surfaced for the
            #    Curriculum Matrices section.
            intro_ref = route_std is None and entry.code in code_to_spec
            is_matrix = "curriculum matrix" in (entry.title or "").lower() or entry.kind == "matrix"

            # RULE: a document links BOTH to where it is CITED in the narrative
            # (ref_specs above) AND to every specification IT cites in its OWN
            # content — so the AI evaluator reads the file when it grades each of
            # those specs. There can be many links. The curriculum matrix is the
            # prime case: its grid rows ARE the curriculum content standards
            # (11..N), so it backs all of them.
            _content_stds = {
                str(n)
                for n in (int(m.group(1)) for m in re.finditer(r"Standard\s*#?\s*(\d{1,2})\b", extracted))
                if 1 <= n <= len(result.standards)
            }
            if is_matrix:
                # A CSHSE curriculum matrix maps courses to the Knowledge/Theory/
                # Skills/Values standards (11 through the last) — link the whole
                # contiguous range even if OCR dropped a row header.
                _content_stds |= {str(n) for n in range(11, len(result.standards) + 1)}
            _seen_stds = {str(s) for s in ref_stds}
            for _n in sorted(_content_stds, key=int):
                if _n not in _seen_stds:
                    ref_stds.append(_n)
                    ref_specs.append((_n, None))  # standard-level (whole standard)
                    _seen_stds.add(_n)
            # Refresh the human summary to reflect ALL links (cited-by + backs).
            _cited = [f"{s}.{p}" if p else f"Std {s}" for (s, p) in ref_specs]
            if _cited:
                ref_summary = f"Referenced by / backs {', '.join(_cited)}."

            evidence_docs.append({
                # STABLE per (submission, appendix code) — NOT job-specific — so a
                # re-import yields the same sectionId → the review-state merge
                # replaces it and materialize UPSERTS the same `rev:` evidence
                # record instead of creating a duplicate.
                "sectionId": f"mccap:{job.submission_id}:{entry.code}",
                "docSubKind": "paper",
                "title": f"Appendix {entry.code}: {entry.title}",
                "summary": f"Appendix section {entry.section} — {entry.kind}. " + ref_summary,
                "byteOffsetStart": None,
                "pageCountEstimate": (entry.page_end - entry.page_start),
                "imageCount": 0,
                "courseCode": None,
                "points": None,
                "s3Key": key,
                "s3Bucket": bucket_name,
                "fileSize": len(pdf_bytes),
                "sha256": None,
                "mimeType": "application/pdf",
                "fileName": f"Appendix {entry.code} - {entry.title}.pdf"[:180],
                "mccCode": entry.code,
                "mccKind": entry.kind,
                # The client's file card reads resolvedStd/resolvedSpec to pre-fill
                # the Standard / Sub-standard selectors; routing mirrors it.
                "resolvedStd": "introduction" if intro_ref else route_std,
                "resolvedSpec": route_spec,
                # intro-referenced files pre-classify to "Introduction"; the
                # client dropdown reads resolvedStd=='introduction'.
                "routing": {
                    "std": route_std,
                    "spec": route_spec,
                    "source": "mcc",
                    "introduction": intro_ref,
                    "isCurriculumMatrix": is_matrix,
                },
                "introductionRef": intro_ref,
                "isCurriculumMatrix": is_matrix,
                "referencedByStandards": ref_stds,
                # THIRD PASS — every specification that lists this appendix in a
                # "(Supporting Document …)" note. Materialize links the file under
                # EACH of these specs in the File Library, so a spec shows exactly
                # the documents its own text cites (no more, no fewer).
                "referencedBySpecs": [{"std": s, "spec": p} for (s, p) in ref_specs],
                # HIDDEN — AI-eval only, never rendered to the reader.
                "extractedText": extracted[:200000],
                "hasText": bool(extracted),
                "ocr": ocr_used,
            })
            if key:
                uploaded += 1
        except Exception as exc:  # noqa: BLE001
            job.warnings.append(f"Appendix {entry.code}: slice/upload error ({exc}).")
    job.evidence_docs = evidence_docs
    _stage_done(job, "mcc_appendix_files", f"{uploaded}/{len(evidence_docs)} appendices uploaded to S3")

    # ---- THIRD PASS (visible): reference linking ------------------------------
    # Report the reference pass explicitly so the coordinator can SEE it ran and
    # how it linked each appendix to the specs that cite it in the text.
    _total_links = sum(len(v) for v in code_to_specs.values())
    _multi = sum(1 for v in code_to_specs.values() if len(v) > 1)
    _stage_started(job, "mcc_reference_pass", "reading (Supporting Document) notes")
    _stage_done(
        job,
        "mcc_reference_pass",
        f"{_total_links} appendix→spec links across {len(code_to_specs)} files "
        f"({_multi} cited by more than one spec)",
    )

    # ---- Assemble the clean source HTML (Compare / Show-in-source pane) ------
    if evidence_docs:
        rows = "".join(
            f'<li><strong>{_esc(e["mccCode"])}</strong> — {_esc(e["title"].split(": ",1)[-1])}'
            + (f' → Spec {_esc(str(e["resolvedStd"]))}.{_esc(str(e["resolvedSpec"]))}' if e.get("resolvedStd") and e.get("resolvedSpec") else "")
            + "</li>"
            for e in evidence_docs
        )
        source_parts.append(f"<h1>Appendix Index</h1><ul>{rows}</ul>")
    job.source_html = (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
        "body{font-family:Arial,sans-serif;line-height:1.6;padding:20px;max-width:100%;}"
        "h1{color:#1a365d;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:28px;}"
        "h2{color:#2d3748;margin-top:20px;} p{margin:8px 0;} a{color:#2563eb;}"
        "ul,ol{margin:8px 0;padding-left:24px;} section{margin-bottom:8px;}"
        "</style></head><body>" + "".join(source_parts) + "</body></html>"
    )


class _MccSubspecRecommender:
    """Best canonical sub-spec (within a known standard) for a narrative chunk,
    scored by embedding cosine similarity → confidence. Fully optional: if the
    embedding client can't be built or a call fails, ``pick`` returns
    ``(None, None, "")`` and the caller falls back to positional placement."""

    def __init__(self, settings, specs_by_std: dict[str, list]):
        self._specs_by_std = specs_by_std
        self._embedder = None
        self._spec_vecs: dict[str, list[tuple[Any, list[float]]]] = {}
        try:
            from app.embeddings.openai_client import EmbeddingClient
            self._embedder = EmbeddingClient(settings.openai_api_key)
        except Exception:  # noqa: BLE001
            self._embedder = None

    def _vecs_for(self, std_code: str):
        if std_code in self._spec_vecs:
            return self._spec_vecs[std_code]
        specs = self._specs_by_std.get(std_code) or []
        out: list[tuple[Any, list[float]]] = []
        if self._embedder is not None and specs:
            try:
                for sp in specs:
                    v = self._embedder.embed_one(sp.spec_text[:1500])
                    out.append((sp, v))
            except Exception:  # noqa: BLE001
                out = []
        self._spec_vecs[std_code] = out
        return out

    def pick(self, std_code: str, chunk_text: str):
        vecs = self._vecs_for(std_code)
        if not vecs or self._embedder is None:
            return None, None, ""
        try:
            q = self._embedder.embed_one(chunk_text[:1500])
        except Exception:  # noqa: BLE001
            return None, None, ""

        def _cos(a, b):
            import math
            dot = sum(x * y for x, y in zip(a, b))
            na = math.sqrt(sum(x * x for x in a)) or 1.0
            nb = math.sqrt(sum(y * y for y in b)) or 1.0
            return dot / (na * nb)

        scored = sorted(((sp, _cos(q, v)) for sp, v in vecs), key=lambda t: t[1], reverse=True)
        best_spec, best = scored[0]
        conf = round(max(0.0, min(1.0, (best + 1) / 2)), 2)  # cosine[-1,1] → [0,1]
        rationale = (
            f"Best match to Specification {std_code}.{best_spec.spec_code} "
            f"(“{best_spec.spec_text[:80]}…”) by semantic similarity. Confirm or reassign."
        )
        return best_spec, conf, rationale


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
    # Spec-definition catalog (normalized def sentence -> (std, spec)) so the
    # walker can split a spec whose letter marker the document dropped (global /
    # type-level; see template_walker.split_bunched_specs).
    from app.splitter.template_walker import _norm_spec_text as _norm_def
    _spec_defs = {
        _norm_def(sp.spec_text): (str(sp.standard_code), str(sp.spec_code))
        for sp in load_specifications(job.program_level)
        if (sp.spec_text or "").strip()
    }
    sections, raw_sections = walk_template_docx(
        str(docx_path), base_id=job.job_id, spec_defs=_spec_defs
    )
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
        # An explicit spec hint (the document literally labels this "Standard N,
        # spec x.") is AUTHORITATIVE — a matcher that misreads a short response as
        # "introduction" must NOT steal it into the Introduction. Only the walker's
        # own templateIntroductionHint may route a hinted section to intro.
        flags = sec.flags or {}
        has_spec_hint = bool(flags.get("templateStandardHint") and flags.get("templateSpecHint"))
        intro_hint = walker_hint or (job.introduction_hints or {}).get(sec.id)
        if not intro_hint and not has_spec_hint and rec is not None and rec.section_type == "introduction":
            intro_hint = (
                f"introduction:standard-{rec.primary_standard}"
                if rec.primary_standard else "introduction:document"
            )
        if intro_hint and (walker_hint or not has_spec_hint) and (
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

        # TEMPLATE structure is AUTHORITATIVE for routing. When the walker knows
        # the exact std + spec from the document (a table/heading literally
        # labels "Standard 6" → spec "a."), route there directly — do NOT let the
        # semantic matcher second-guess it (which otherwise sends low-confidence
        # sections to Unplaced or the wrong spec, so whole specs went missing on
        # the tabular official template). The matcher's section_type is still
        # used to sort narrative vs supporting-evidence within the bucket.
        std_hint = (sec.flags or {}).get("templateStandardHint")
        spec_hint = (sec.flags or {}).get("templateSpecHint")
        if std_hint and spec_hint:
            hkey = f"{std_hint}.{spec_hint}"
            hbucket = buckets.get(hkey)
            if hbucket is None:
                # The template document defines a spec the level catalog lacks
                # (the ai-service associate catalog is derived from baccalaureate
                # and misses some specs, e.g. Field Experience 20.f–j). Trust the
                # document — create the bucket so no content is dropped. Robust
                # to whatever spec layout a school's official template uses.
                hbucket = {
                    "standardCode": std_hint, "specCode": spec_hint,
                    "standardTitle": "", "specPrompt": (sec.heading or "")[:600],
                    "narratives": [], "evidenceText": [], "evidenceFiles": [],
                    "matrixCells": [], "coverageScore": None, "coverageCovered": None,
                    "coverageGaps": [], "coverageStrengths": [],
                }
                buckets[hkey] = hbucket
            item = _section_to_item(sec, rec)
            # A template hint-routed section IS the spec's Response prose (the
            # walker produces one section per spec: prompt heading + response
            # body). It's the NARRATIVE regardless of the matcher's section_type —
            # the matcher misreads some responses (e.g. an accreditation answer)
            # as "supporting_evidence", which dropped them out of the narrative.
            # Genuine evidence (embedded tables, "See Appendix" files) is attached
            # to the bucket separately by the deterministic pass below.
            hbucket["narratives"].append(item)
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
        "heading": sec.heading[:600],
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

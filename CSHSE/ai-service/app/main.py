import os

import httpx
from anthropic import Anthropic
from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient

from app.auth import verify_hmac_signature
from app.config import Settings, get_settings
from app.import_jobs import cancel_job, enqueue_job, get_job

GIT_SHA = os.environ.get("RAILWAY_GIT_COMMIT_SHA", "unknown")[:8]
VERSION = "0.1.0"

app = FastAPI(title="cshse-ai", version=VERSION)


@app.get("/health")
def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "version": VERSION,
        "git": GIT_SHA,
        "env": s.cshse_env,
    }


@app.get("/health/rules")
def health_rules(format: str = "template", institutionId: str | None = None, programLevel: str | None = None) -> dict:
    """CR-073 — verify the rule ENGINE can reach the parserRules store and see
    the rules it would apply for a given format/institution. Diagnostic only."""
    from app.rules.engine import _client, fetch_active_rules
    s = get_settings()
    client = _client()
    mongo_ok = client is not None
    rules = fetch_active_rules(format, institutionId, programLevel)
    return {
        "mongoConfigured": bool(s.mongo_url),
        "mongoReachable": mongo_ok,
        "activeRuleCount": len(rules),
        "ruleIds": [r.get("ruleId") for r in rules][:50],
        "format": format,
        "institutionId": institutionId,
    }


@app.get("/health/qdrant")
def health_qdrant() -> dict:
    s = get_settings()
    client = QdrantClient(url=s.qdrant_url, api_key=s.qdrant_api_key or None)
    collections = client.get_collections()
    return {
        "reachable": True,
        "collection_count": len(collections.collections),
        "collections": [c.name for c in collections.collections],
    }


@app.get("/health/anthropic")
def health_anthropic() -> dict:
    s = get_settings()
    if not s.anthropic_api_key:
        return {"reachable": False, "reason": "no key configured"}
    client = Anthropic(api_key=s.anthropic_api_key)
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=8,
        messages=[{"role": "user", "content": "ping"}],
    )
    return {"reachable": True, "model": msg.model}


@app.get("/health/openai")
def health_openai() -> dict:
    s = get_settings()
    if not s.openai_api_key:
        return {"reachable": False, "reason": "no key configured"}
    with httpx.Client(timeout=10.0) as c:
        r = c.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {s.openai_api_key}"},
        )
        r.raise_for_status()
    return {"reachable": True}


# ============================================================================
# AI Import Wizard endpoints (Sprint 1)
# ============================================================================
#
# Called by the CSHSE Express server, never by the browser directly. Both the
# inbound POST /ai/import/start and the outbound webhooks
# (ai-event / ai-callback) are protected by HMAC signature so the two services
# can trust each other without sharing a secret with the user.


class StartImportRequest(BaseModel):
    s3Key: str = Field(..., description="Tigris/S3 object key for the uploaded DOCX.")
    submissionId: str
    importId: str
    programLevel: str = Field(default="bachelors")
    forceFormat: str | None = Field(default=None, description="'template' | 'self_study' | 'mcc_narrative' to skip auto-detect.")
    callbackUrl: str = Field(..., description="Terminal-state webhook on the CSHSE server.")
    eventCallbackUrl: str = Field(..., description="Per-stage progress webhook on the CSHSE server.")
    institutionId: str | None = Field(
        default=None,
        description=(
            "Per-institution scope key. Used by the corrections RAG so a "
            "school's accumulated corrections shape ONLY its own future "
            "matcher runs. Omitting it disables few-shot retrieval for "
            "the job (safer than leaking cross-school examples)."
        ),
    )


class CorrectionIngestRequest(BaseModel):
    correctionId: str
    institutionId: str
    programLevel: str
    expectedStd: str
    expectedSpec: str
    expectedSectionType: str = "narrative_response"
    sourceHeading: str = ""
    sourceText: str
    correctionType: str = "missed-by-matcher"


class PlacementRecommendRequest(BaseModel):
    """CR-073 — text → (std, spec) placement probe.

    The ground-truth placement primitive behind autonomous rule synthesis: give
    it a piece of narrative text (and optionally its heading) and it returns the
    matcher's best (standard, spec) recommendation, exactly as the import
    pipeline would place it. Advisory only — never 500s the caller.
    """
    text: str
    heading: str = ""
    programLevel: str
    institutionId: str | None = None


class CoverageSpecItem(BaseModel):
    standardCode: str
    specCode: str
    narrativeText: str = ""
    evidence: list[dict] = Field(default_factory=list, description="[{heading, snippet}] supporting-evidence items")


class CoverageReviewRequest(BaseModel):
    """On-demand coverage review over already-parsed specs — the "Check coverage"
    backfill so a submission whose import didn't run the reviewer (e.g. an older
    MCC import) gets per-spec score/gaps/strengths WITHOUT re-reading the doc."""
    programLevel: str
    specs: list[CoverageSpecItem]


class MatrixInferColumnsRequest(BaseModel):
    """CR-025 — coordinator-facing column inference for the wizard's matrix step."""
    matrixSlug: str
    institutionId: str | None = None
    programLevel: str = "bachelors"
    rawTableHtml: str = ""
    columnCount: int
    surroundingContext: str = ""
    knownCourses: list[str] | None = None


class MatrixConfirmColumnRequest(BaseModel):
    """CR-025 — one row of confirmed column → course mapping."""
    institutionId: str
    programLevel: str = "bachelors"
    matrixSlug: str
    columnIndex: int
    course: str
    priorConfidence: float = 1.0


class MatrixInferRowSpecRequest(BaseModel):
    """CR-030 — infer the subspec for a matrix row when standard is known.

    The wizard's matrix step shows "Spec 12.?" when the extractor matched
    the row's standard via template heuristics but couldn't pin the
    subspec letter. This endpoint asks Haiku which subspec from the
    Handbook best matches the row's prompt.
    """
    rowPrompt: str
    standardCode: str
    programLevel: str = "bachelors"
    surroundingContext: str = ""


@app.post("/ai/import/start", status_code=status.HTTP_202_ACCEPTED)
async def start_import(req: StartImportRequest, request: Request) -> dict:
    """Accept an import job from the CSHSE server and enqueue it.

    Returns the initial job snapshot — either ``status: "parsing"`` if a
    worker slot is immediately available, or ``status: "queued"`` with
    a position. Subsequent updates flow through the event webhook.
    """
    body = await request.body()
    verify_hmac_signature(request, body)

    if req.programLevel not in ("associate", "bachelors", "masters"):
        raise HTTPException(status_code=400, detail=f"invalid programLevel: {req.programLevel}")
    if req.forceFormat is not None and req.forceFormat not in ("template", "self_study", "mcc_narrative"):
        raise HTTPException(status_code=400, detail=f"invalid forceFormat: {req.forceFormat}")

    snapshot = enqueue_job(
        import_id=req.importId,
        s3_key=req.s3Key,
        submission_id=req.submissionId,
        program_level=req.programLevel,
        force_format=req.forceFormat,
        callback_url=req.callbackUrl,
        event_callback_url=req.eventCallbackUrl,
        institution_id=req.institutionId,
    )
    return snapshot


class RedetectRequest(BaseModel):
    """CR-040 follow-on — re-run the standalone-evidence detectors
    (cv_detector, appendix_paper_detector, introduction_detector)
    against an already-uploaded .docx without re-triggering the
    matcher / matrix extraction.

    Used by the wizard's Re-detect button on the Review surface: a
    coordinator who already worked through Review on an import that
    predates a detector deploy can click Re-detect to populate the
    standalone Supporting Evidence tiles without losing their existing
    review progress.
    """
    s3Key: str
    importId: str
    submissionId: str
    institutionId: str | None = None


@app.post("/ai/import/redetect")
async def redetect(req: RedetectRequest, request: Request) -> dict:
    """Synchronous re-detect — pulls the .docx from S3, runs walker +
    standalone detectors only, returns {cvs, evidenceDocs, introductionHints}.

    No matcher, no matrix extractor, no callback. The caller (cshse-server)
    persists the result to SelfStudyImport.aiCVs / aiEvidenceDocs /
    aiIntroductionHints and triggers the CR-043 aiReviewMerge.

    Designed to run in <10s for a typical 50-page DOCX — the detectors
    are lexical heuristics + a single deep-walker pass.
    """
    body = await request.body()
    verify_hmac_signature(request, body)

    # Imports kept local so a misconfigured deploy doesn't fail at module
    # load time — the redetect path can stay quiet behind 503s instead.
    import io
    import os
    import shutil
    import tempfile
    from pathlib import Path
    import boto3
    import mammoth
    from botocore.client import Config as BotoConfig
    from app.splitter.deep_walker import deep_walk_with_fallback
    from app.splitter.cv_detector import (
        detect_cvs,
        detect_cvs_from_html,
        cv_to_dict,
    )
    from app.splitter.appendix_paper_detector import (
        detect_evidence_docs,
        detect_evidence_docs_from_html,
        evidence_doc_to_dict,
    )
    from app.splitter.introduction_detector import detect_introductions
    # CR-040 follow-on (2026-05-27) — TOC-anchored two-pass detector.
    # User feedback: pattern-based detectors miss real CVs/syllabi/papers
    # whose body signals don't match the anchor heuristic (different
    # section-marker capitalisation, credentials on a separate line,
    # etc.). The Table of Contents is the ground truth — parse it and
    # use it as a canonical index, then slice body content between TOC
    # anchors. Merge with pattern-based output (pattern wins on
    # overlap; TOC adds anything pattern missed).
    from app.splitter.toc_detector import (
        parse_toc,
        parse_sub_tocs,
        anchor_in_body,
        merge_cv_detections,
        merge_evidence_doc_detections,
    )

    # Pull the DOCX from S3 to a temp file.
    bucket = os.environ.get("CSHSE_S3_BUCKET", "cshse-filestorage-qlyj5pn")
    endpoint = os.environ.get("AWS_ENDPOINT_URL_S3") or os.environ.get("AWS_ENDPOINT_URL")
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )
    tmp_dir = Path(tempfile.mkdtemp(prefix=f"redetect-{req.importId}-"))
    docx_path = tmp_dir / "source.docx"
    try:
        try:
            s3.download_file(bucket, req.s3Key, str(docx_path))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=502,
                detail=f"s3 fetch failed for {req.s3Key}: {type(exc).__name__}: {exc}",
            )

        # mammoth: DOCX → HTML bytes (same shape as _run_self_study_pipeline).
        with open(docx_path, "rb") as f:
            html_str = mammoth.convert_to_html(io.BytesIO(f.read())).value
        html_bytes = html_str.encode("utf-8")

        # deep_walker — produces filtered Section list from the HTML bytes.
        sections = deep_walk_with_fallback(html_bytes, base_id=req.importId)

        # CV detector — same two-phase pattern as _run_self_study_pipeline.
        cv_pre, dropped_texts = detect_cvs_from_html(html_bytes)
        if dropped_texts:
            dropped_set = {t[:200].strip() for t in dropped_texts if t and t.strip()}
            sections = [
                s for s in sections
                if (s.markdown or "").strip()[:200] not in dropped_set
            ]
        cv_post, sections = detect_cvs(sections)
        cv_detections = cv_pre + cv_post
        cvs_wire = [cv_to_dict(cv) for cv in cv_detections]

        # Evidence-doc detector — same two-phase pattern.
        ed_pre, ed_dropped = detect_evidence_docs_from_html(html_bytes)
        if ed_dropped:
            ed_drop_set = {t[:200].strip() for t in ed_dropped if t and t.strip()}
            sections = [
                s for s in sections
                if (s.markdown or "").strip()[:200] not in ed_drop_set
            ]
        ed_post, sections = detect_evidence_docs(sections)
        evidence_docs = ed_pre + ed_post
        evidence_docs_wire = [evidence_doc_to_dict(d) for d in evidence_docs]

        # CR-040 follow-on (2026-05-27) — TOC-anchored second pass.
        # Pattern-based detectors above miss real items when the body
        # signal doesn't match the anchor heuristic. The Table of
        # Contents is the document's own ground-truth index — parse it
        # and slice body content between TOC anchors, then merge.
        # Pattern-based entries win on overlap (they keep their
        # original sectionIds the rest of the pipeline references);
        # TOC adds anything pattern missed.
        #
        # 2026-05-27 follow-up: real Stevenson-class docs don't list
        # individual CV / syllabus / paper names in the MAIN TOC.
        # Instead, the main TOC has a single line "Appendices (List
        # of Supporting Documents) ... 112", and the per-item
        # enumeration is a SUB-TOC at that page. parse_sub_tocs
        # scans the entire body for those sub-TOC blocks and
        # contributes their entries. Without this, a Stevenson
        # re-detect found 0 added CVs via TOC because the main TOC
        # had nothing CV-shaped in it.
        main_toc_entries = parse_toc(html_bytes)
        sub_toc_entries = parse_sub_tocs(html_bytes)
        toc_entries = main_toc_entries + sub_toc_entries
        toc_detections = anchor_in_body(html_bytes, toc_entries) if toc_entries else []
        toc_counts_pre = {
            "cvs": len(cvs_wire),
            "papers": sum(1 for d in evidence_docs if d.doc_sub_kind == "paper"),
            "syllabi": sum(1 for d in evidence_docs if d.doc_sub_kind == "syllabus"),
        }
        cvs_wire = merge_cv_detections(cvs_wire, toc_detections)
        evidence_docs_wire = merge_evidence_doc_detections(
            evidence_docs_wire, toc_detections
        )

        # Introduction hints (lexical heuristic only; no matcher LLM here).
        intro_hints = detect_introductions(sections)

        toc_added = {
            "cvs": len(cvs_wire) - toc_counts_pre["cvs"],
            "papers": sum(
                1 for d in evidence_docs_wire if d.get("docSubKind") == "paper"
            ) - toc_counts_pre["papers"],
            "syllabi": sum(
                1 for d in evidence_docs_wire if d.get("docSubKind") == "syllabus"
            ) - toc_counts_pre["syllabi"],
        }

        return {
            "ok": True,
            "cvs": cvs_wire,
            "evidenceDocs": evidence_docs_wire,
            "introductionHints": intro_hints or {},
            "counts": {
                "cvs": len(cvs_wire),
                "papers": sum(
                    1 for d in evidence_docs_wire if d.get("docSubKind") == "paper"
                ),
                "syllabi": sum(
                    1 for d in evidence_docs_wire if d.get("docSubKind") == "syllabus"
                ),
                "introHints": len(intro_hints or {}),
            },
            # CR-040 follow-on — diagnostics for the redetect banner.
            # Tells the coordinator how many items the TOC-anchored pass
            # added on top of pattern detection, plus the number of TOC
            # entries parsed.
            "tocDiagnostics": {
                "tocEntriesFound": len(toc_entries),
                "tocAnchoredDetections": len(toc_detections),
                "tocAdded": toc_added,
            },
        }
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass


class InspectTocRequest(BaseModel):
    """CR-040 follow-on (2026-05-27) — debug endpoint to inspect what
    the TOC detector ACTUALLY sees in a real document.

    User feedback after the first redetect deploys missed CVs on the
    real Stevenson doc: my synthetic test fixtures didn't match the
    real document's TOC structure. This endpoint pulls the .docx from
    S3, runs ONLY parse_toc + parse_sub_tocs + anchor_in_body, and
    returns the full structure so a test can verify what's there
    instead of guessing.

    Same HMAC + S3 gating as /ai/import/redetect.

    ``searchTerms`` (optional) — list of strings to grep for in the
    converted HTML. For each match, the response includes the
    surrounding 5 paragraph contexts so a diagnostic can see WHERE
    a known-to-be-present name (e.g. "Thomas K. Swisher") actually
    appears in the body, and what structure surrounds it. Used to
    verify whether the pattern detector's body anchors should fire.
    """
    s3Key: str
    searchTerms: list[str] | None = None


@app.post("/ai/debug/inspect-toc")
async def inspect_toc(req: InspectTocRequest, request: Request) -> dict:
    """Pull the DOCX from S3 and return the full TOC structure.

    Response shape:
      {
        "ok": true,
        "mainTocEntries": [{"label", "kind", "section_hint", "raw"}, ...],
        "subTocEntries":  [{"label", "kind", "section_hint", "raw"}, ...],
        "anchoredDetections": [
          {"label", "kind", "section_hint", "course_code",
           "byte_offset_start", "body_text_preview" (first 300 chars)},
          ...
        ],
        "counts": {
          "mainTocByKind":    {"cv": N, "syllabus": N, "paper": N, "unknown": N},
          "subTocByKind":     {...},
          "anchoredByKind":   {...},
          "totalTocEntries":  N,
          "totalAnchored":    N,
        }
      }

    No pattern-detector, no matcher, no callback. Strictly read-only
    inspection so a test can call this against the deployed S3
    and report what's actually in the user's document.
    """
    body = await request.body()
    verify_hmac_signature(request, body)

    import io
    import os
    import shutil
    import tempfile
    from pathlib import Path
    import boto3
    import mammoth
    from botocore.client import Config as BotoConfig
    from app.splitter.toc_detector import (
        parse_toc,
        parse_sub_tocs,
        anchor_in_body,
    )
    from app.splitter.cv_detector import detect_cvs_from_html

    bucket = os.environ.get("CSHSE_S3_BUCKET", "cshse-filestorage-qlyj5pn")
    endpoint = os.environ.get("AWS_ENDPOINT_URL_S3") or os.environ.get("AWS_ENDPOINT_URL")
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )
    tmp_dir = Path(tempfile.mkdtemp(prefix="inspect-toc-"))
    docx_path = tmp_dir / "source.docx"
    try:
        try:
            s3.download_file(bucket, req.s3Key, str(docx_path))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=502,
                detail=f"s3 fetch failed for {req.s3Key}: {type(exc).__name__}: {exc}",
            )

        with open(docx_path, "rb") as f:
            html_str = mammoth.convert_to_html(io.BytesIO(f.read())).value
        html_bytes = html_str.encode("utf-8")

        main_entries = parse_toc(html_bytes)
        sub_entries = parse_sub_tocs(html_bytes)
        all_entries = main_entries + sub_entries
        anchored = anchor_in_body(html_bytes, all_entries) if all_entries else []

        # CR-040 follow-on (2026-05-27) — also report what the PATTERN
        # detector finds in the body. The TOC pass alone doesn't reflect
        # what the user sees in the redetect rail; the pattern detector
        # is the source of most real-world CV detections, so a true
        # diagnostic needs both.
        pattern_cvs, _ = detect_cvs_from_html(html_bytes)

        # Search-term scan — find where caller-specified strings
        # appear in the converted HTML so a diagnostic can compare
        # actual body structure to what the pattern detector wants.
        search_results: list[dict] = []
        if req.searchTerms:
            from bs4 import BeautifulSoup
            soup_for_search = BeautifulSoup(html_bytes, "html.parser")
            for tag in soup_for_search(["script", "style", "head"]):
                tag.decompose()
            # Collect paragraph-level text in document order.
            paragraphs_for_search = []
            for tag in soup_for_search.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"]):
                if any(p.name == "table" for p in tag.parents):
                    continue
                txt = tag.get_text(separator=" ", strip=True)
                if txt:
                    paragraphs_for_search.append(txt)
            for term in req.searchTerms:
                term_lower = term.lower()
                matches = []
                for idx, p in enumerate(paragraphs_for_search):
                    if term_lower in p.lower():
                        # Surrounding context — 3 paragraphs before, 5 after.
                        ctx_start = max(0, idx - 3)
                        ctx_end = min(len(paragraphs_for_search), idx + 6)
                        context = paragraphs_for_search[ctx_start:ctx_end]
                        matches.append({
                            "paragraphIndex": idx,
                            "matchedLine": p[:200],
                            "context": [c[:200] for c in context],
                        })
                        if len(matches) >= 5:
                            break  # cap to 5 occurrences per term
                search_results.append({
                    "term": term,
                    "matchCount": len(matches),
                    "matches": matches,
                })

        def _count_by_kind(entries):
            out: dict = {"cv": 0, "syllabus": 0, "paper": 0, "unknown": 0}
            for e in entries:
                out[e.kind] = out.get(e.kind, 0) + 1
            return out

        def _count_anchored_by_kind(dets):
            out: dict = {"cv": 0, "syllabus": 0, "paper": 0}
            for d in dets:
                out[d.kind] = out.get(d.kind, 0) + 1
            return out

        return {
            "ok": True,
            "mainTocEntries": [
                {
                    "label": e.label,
                    "kind": e.kind,
                    "section_hint": e.section_hint,
                    "raw": e.raw,
                }
                for e in main_entries
            ],
            "subTocEntries": [
                {
                    "label": e.label,
                    "kind": e.kind,
                    "section_hint": e.section_hint,
                    "raw": e.raw,
                }
                for e in sub_entries
            ],
            "anchoredDetections": [
                {
                    "label": d.label,
                    "kind": d.kind,
                    "section_hint": d.section_hint,
                    "course_code": d.course_code,
                    "byte_offset_start": d.byte_offset_start,
                    "body_text_preview": (d.body_text or "")[:300],
                }
                for d in anchored
            ],
            # CR-040 follow-on (2026-05-27) — also surface what the
            # PATTERN detector (cv_detector.detect_cvs_from_html) finds.
            # The TOC pass alone doesn't reflect the rail count the
            # coordinator sees; the pattern detector is the primary
            # source for CV detection on documents whose TOC doesn't
            # enumerate CVs (the Stevenson handbook case).
            "patternCvs": [
                {
                    "facultyName": cv.faculty_name,
                    "snippet": cv.snippet,
                    "byte_offset_start": cv.byte_offset_start,
                    "section_marker_count": cv.section_marker_count,
                }
                for cv in pattern_cvs
            ],
            "counts": {
                "mainTocByKind": _count_by_kind(main_entries),
                "subTocByKind": _count_by_kind(sub_entries),
                "anchoredByKind": _count_anchored_by_kind(anchored),
                "totalTocEntries": len(all_entries),
                "totalAnchored": len(anchored),
                "patternCvCount": len(pattern_cvs),
            },
            "searchResults": search_results,
            "documentBytes": len(html_bytes),
        }
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass


@app.get("/ai/import/{job_id}")
async def get_import(job_id: str, request: Request) -> dict:
    """Synchronous snapshot of a job's current state.

    Used by the CSHSE server as a fallback when its SSE stream to the
    client drops and the client falls back to polling (UI spec §11.3).
    Also handy for debugging from the Railway shell.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    snapshot = get_job(job_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail=f"job {job_id} not found")
    return snapshot


@app.post("/ai/corrections/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_correction_endpoint(req: CorrectionIngestRequest, request: Request) -> dict:
    """Embed a coordinator correction and store it in Qdrant.

    Called by the CSHSE Node server immediately after the coordinator
    saves a correction via /api/imports/:importId/corrections. The point
    is upserted into ``cshse_corrections_{env}`` keyed by correctionId,
    payload-filtered by institutionId + programLevel.

    On future imports the matcher will retrieve similar examples from
    this collection and inject them as few-shot hints in the Haiku
    prompt. Best-effort: failure here doesn't lose the correction (Mongo
    is the source of truth); a future reconciler can replay.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.corrections.store import ingest_correction
    try:
        return ingest_correction(req.model_dump())
    except Exception as exc:  # noqa: BLE001
        # Surface the error so the Node server logs it, but don't 500 if
        # the rest of the system is healthy — the row is already in Mongo.
        raise HTTPException(
            status_code=502,
            detail=f"correction ingest failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/placement/recommend", status_code=status.HTTP_200_OK)
async def placement_recommend_endpoint(req: PlacementRecommendRequest, request: Request) -> dict:
    """CR-073 — recommend a (std, spec) placement for a piece of text.

    Ground-truth placement primitive for autonomous rule synthesis. Builds a
    minimal synthetic ``Section`` from ``text``/``heading`` and runs the SAME
    ``SpecMatcher`` the import pipeline uses (embeddings + Handbook specs + the
    Haiku classifier). HMAC-gated exactly like /ai/corrections/ingest.

    ADVISORY: any failure (Qdrant/Anthropic/OpenAI down, spec cache empty)
    returns ``{std:null, spec:null, sectionType:"unknown", confidence:0,
    error:"..."}`` with HTTP 200 — it must never 500 the caller.
    """
    body = await request.body()
    verify_hmac_signature(request, body)

    try:
        from app.splitter.sections import Section
        from app.embeddings.openai_client import EmbeddingClient
        from app.embeddings.spec_cache import bootstrap_spec_cache
        from app.matcher.spec_matcher import SpecMatcher
        from app.vector.qdrant_ops import VectorStore

        settings = get_settings()

        text = req.text or ""
        section = Section(
            id="placement-probe",
            heading=req.heading or "",
            heading_level=1,
            markdown=text,
            byte_offset_start=0,
            byte_offset_end=len(text),
            word_count=len(text.split()),
            contains_table=False,
            contains_image=False,
            has_resume_signals=False,
            has_syllabus_signals=False,
            splitter_tier="probe",
            flags={},
            html_snippet=None,
            images=[],
        )

        # Same construction as the template import pipeline, scoped to the one
        # program level so we don't warm caches we won't use.
        store = VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
        embedder = EmbeddingClient(settings.openai_api_key)
        bootstrap_spec_cache(store, embedder, program_levels=(req.programLevel,))
        matcher = SpecMatcher(
            store=store, embedder=embedder, anthropic_key=settings.anthropic_api_key
        )

        rec = matcher.recommend(section, req.programLevel, institution_id=req.institutionId)
        return {
            "std": rec.primary_standard,
            "spec": rec.primary_spec,
            "sectionType": str(rec.section_type),
            "confidence": rec.primary_confidence,
            "acceptState": str(rec.accept_state),
            "rationale": rec.rationale,
        }
    except Exception as exc:  # noqa: BLE001 — advisory endpoint, never 500
        return {
            "std": None,
            "spec": None,
            "sectionType": "unknown",
            "confidence": 0,
            "error": f"{type(exc).__name__}: {exc}",
        }


@app.post("/ai/coverage/review", status_code=status.HTTP_200_OK)
async def coverage_review_endpoint(req: CoverageReviewRequest, request: Request) -> dict:
    """Run the per-spec coverage reviewer over a batch of already-parsed specs.

    Returns ``{results:[{standardCode, specCode, coverageScore, coverageCovered,
    coverageGaps, coverageStrengths}]}``. Used by the server's "Check coverage"
    action to backfill a submission that has no coverage assessment. HMAC-gated.
    Advisory-ish: on a hard failure returns ``{results:[], error:"..."}`` (200).
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    try:
        from app.coverage.spec_coverage import review_specs

        settings = get_settings()
        items = [
            {
                "standard_code": s.standardCode,
                "spec_code": s.specCode,
                "narrative_text": s.narrativeText or "",
                "evidence_items": [
                    ((e.get("heading") or "")[:80], (e.get("snippet") or "")[:1500]) for e in (s.evidence or [])
                ],
            }
            for s in req.specs
        ]
        reviews = review_specs(req.programLevel, settings.anthropic_api_key, items)
        return {
            "results": [
                {
                    "standardCode": r.standard_code,
                    "specCode": r.spec_code,
                    "coverageScore": r.coverage_score,
                    "coverageCovered": r.is_covered,
                    "coverageGaps": r.gaps,
                    "coverageStrengths": r.strengths,
                }
                for r in reviews
            ]
        }
    except Exception as exc:  # noqa: BLE001 — never 500 the caller
        return {"results": [], "error": f"{type(exc).__name__}: {exc}"}


@app.post("/ai/matrix/infer-columns", status_code=status.HTTP_200_OK)
async def infer_matrix_columns_endpoint(req: MatrixInferColumnsRequest, request: Request) -> dict:
    """CR-025 — infer column → course mappings for one curriculum matrix.

    Server posts this for each matrix on the wizard's Matrix step. We
    read the raw `<table>` HTML (which still carries merged-cell course
    headers in the bytes even if mammoth's DOM walker missed them),
    consult the per-institution `cshse_matrix_columns_{env}` Qdrant
    collection for prior confirmations, and ask Haiku for confidence-
    ranked suggestions.

    Returns suggestions for every column from 0..columnCount-1, padded
    with "no signal" entries for columns the model couldn't guess.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.matrix.column_inference import infer_columns
    from app.vector.qdrant_ops import VectorStore
    from app.embeddings.openai_client import EmbeddingClient
    from app.config import get_settings as _gs

    settings = _gs()
    try:
        result = infer_columns(
            matrix_slug=req.matrixSlug,
            raw_table_html=req.rawTableHtml,
            column_count=req.columnCount,
            institution_id=req.institutionId,
            program_level=req.programLevel,
            surrounding_context=req.surroundingContext,
            known_courses=req.knownCourses or [],
            embedder=EmbeddingClient(settings.openai_api_key) if settings.openai_api_key else None,
            store=VectorStore(settings.qdrant_url, settings.qdrant_api_key or None) if settings.qdrant_url else None,
            settings=settings,
        )
        return result.to_dict()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"matrix column inference failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/matrix/confirm-column", status_code=status.HTTP_201_CREATED)
async def confirm_matrix_column_endpoint(req: MatrixConfirmColumnRequest, request: Request) -> dict:
    """CR-025 — persist a coordinator-confirmed column → course mapping.

    Called when the coordinator clicks "Accept" on an AI suggestion or
    types in their own override. Idempotent: keyed by
    (institution, matrix_slug, column_index). Subsequent imports for
    this institution surface this mapping as a RAG hint to the matcher.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.matrix.column_inference import record_confirmed_mapping
    from app.vector.qdrant_ops import VectorStore
    from app.embeddings.openai_client import EmbeddingClient
    from app.config import get_settings as _gs

    settings = _gs()
    try:
        return record_confirmed_mapping(
            institution_id=req.institutionId,
            program_level=req.programLevel,
            matrix_slug=req.matrixSlug,
            column_index=req.columnIndex,
            course=req.course,
            prior_confidence=req.priorConfidence,
            embedder=EmbeddingClient(settings.openai_api_key) if settings.openai_api_key else None,
            store=VectorStore(settings.qdrant_url, settings.qdrant_api_key or None) if settings.qdrant_url else None,
            settings=settings,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"matrix column confirm failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/matrix/infer-row-spec", status_code=status.HTTP_200_OK)
async def infer_matrix_row_spec_endpoint(req: MatrixInferRowSpecRequest, request: Request) -> dict:
    """CR-030 — given a row's prompt + known standard, pick the best subspec.

    The wizard's matrix step shows '?' for rows whose subspec couldn't be
    inferred from the template prompts. This endpoint reads the Handbook
    spec list for the standard, asks Haiku which subspec best matches,
    and returns a suggestion. The client uses the existing retagMatrixRow
    store action to apply the user's confirmed choice.

    Soft-fails to suggestedSpec=null + confidence=0 if Anthropic is
    unavailable; the client falls back to manual entry.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    from app.matrix.row_spec_inference import infer_row_spec
    try:
        result = infer_row_spec(
            row_prompt=req.rowPrompt,
            standard_code=req.standardCode,
            program_level=req.programLevel,
            surrounding_context=req.surroundingContext,
        )
        return result.to_dict()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"matrix row spec inference failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/import/{job_id}/cancel")
async def cancel_import(job_id: str, request: Request) -> dict:
    """Cancel a queued or running job. Idempotent."""
    body = await request.body()
    verify_hmac_signature(request, body)
    ok = cancel_job(job_id)
    snapshot = get_job(job_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail=f"job {job_id} not found")
    return {"cancelled": ok, "snapshot": snapshot}


# ----------------------------------------------------------------------
# CR-018 — Evidence-review endpoints (Phase 1 stubs)
#
# Phase 1 wires the three endpoints described in the CR but returns
# HTTP 501 with a structured `{phase, ready, detail}` body. Callers
# (server/src/services/cshseAiClient.ts) read `ready=false` as the
# signal that Phase 2 hasn't landed, NOT as a deploy failure. The HMAC
# auth gate runs first, so the stubs also prove the auth wiring is
# correct end-to-end.
# ----------------------------------------------------------------------

from app.evidence import EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY
from app.evidence.extract import extract_evidence_text
from app.evidence.recommend import recommend_evidence
from app.evidence.score import score_evidence
from app.section_eval import evaluate_section


class EvidenceExtractRequest(BaseModel):
    """Evidence-extract input.

    Three input modes (in priority order):

    1. ``markdown`` — caller already converted to text (e.g. via mammoth
       on a DOCX). Cheapest path.
    2. ``pdfBase64`` — inline PDF bytes. The route pulls text with pypdf
       and feeds it into ``extract_evidence_text``.
    3. ``documentS3Key`` + ``documentMimeType: "application/pdf"`` —
       route fetches the PDF from S3/Tigris (using the same env-var
       convention as the import pipeline) and extracts.

    Phase 2b swapped marker-pdf for pypdf — same downstream behavior,
    pure-Python, no container bloat. If structured table extraction is
    needed later, callers should send DOCX instead.
    """
    institutionId: str = Field(..., description="MongoDB ObjectId; required for per-institution Qdrant payload filter.")
    submissionId: str
    documentId: str = Field(default="", description="Originator's doc id (e.g. SupportingEvidence._id) — stamped on every chunk payload for later retrieval.")
    markdown: str | None = Field(default=None, description="Already-extracted markdown body. Highest priority input.")
    pdfBase64: str | None = Field(default=None, description="Inline PDF bytes (base64). Decoded + extracted via pypdf.")
    documentS3Key: str | None = Field(default=None, description="S3/Tigris object key; fetched + extracted server-side when mime is application/pdf.")
    documentMimeType: str = Field(default="text/markdown")
    sourceFilename: str | None = None


class FileExtractRequest(BaseModel):
    """Generic file → plain-text extraction for the bulk supporting-evidence
    placement flow. Supports pdf / docx / xlsx / pptx via inline base64 OR an
    S3/Tigris object key. Unlike ``/ai/evidence/extract`` this does NOT embed
    into Qdrant — it just returns the text so the Node side can reference-match
    it against the imported narratives and call ``/ai/placement/recommend``.
    """
    s3Key: str | None = Field(default=None, description="S3/Tigris object key; fetched server-side.")
    base64: str | None = Field(default=None, description="Inline file bytes (base64). Takes priority over s3Key.")
    mimeType: str = Field(default="", description="MIME type; dispatches the extractor (falls back to filename extension).")
    filename: str = Field(default="", description="Original filename; used for extractor dispatch + returned title.")
    s3Bucket: str | None = None


class EvidenceRecommendRequest(BaseModel):
    institutionId: str
    submissionId: str
    standardCode: str
    specCode: str
    topK: int = Field(default=5, ge=1, le=20)
    programLevel: str = Field(default="bachelors")


class EvidenceScoreRequest(BaseModel):
    institutionId: str
    submissionId: str
    standardCode: str
    specCode: str
    candidateChunks: list[dict]
    matrixRows: list[dict] | None = Field(default=None, description="CR-024 Sprint 4 — matrix rows for the spec, included in the Haiku prompt.")


class SectionEvaluateRequest(BaseModel):
    """CR-049 — evaluate a section against the reader-review criteria."""
    institutionId: str
    submissionId: str
    # CR-049 Sprint 2.5 finish — programLevel is required to scope the
    # corrections-RAG lookup (per-institution + per-program-level so
    # bachelors corrections don't bleed into a masters run).
    programLevel: str = Field(default="bachelors")
    specs: list[dict] = Field(description="One or many { standardCode, specCode, criteria }.")
    narrativeHtml: str = ""
    supportingEvidenceText: list[str] = Field(default_factory=list)
    files: list[dict] = Field(default_factory=list)
    webLinks: list[str] = Field(default_factory=list)


@app.post("/ai/files/extract", status_code=status.HTTP_200_OK)
async def files_extract(req: FileExtractRequest, request: Request) -> dict:
    """Extract plain text from a pdf/docx/xlsx/pptx (base64 or S3 key).

    Used by the bulk supporting-evidence uploader to get a file's text so the
    server can (a) reference-match it against the imported narratives and (b)
    call the placement SpecMatcher. HMAC-gated. Returns
    ``{ text, title, chars }``; a 400 on unsupported/malformed input.
    """
    body = await request.body()
    verify_hmac_signature(request, body)

    from app.evidence.office_extract import extract_text

    data: bytes | None = None
    if req.base64:
        import base64 as _b64
        try:
            data = _b64.b64decode(req.base64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"base64 decode failed: {exc}")
    elif req.s3Key:
        import os as _os
        import boto3
        from botocore.config import Config as BotoConfig

        bucket = req.s3Bucket or _os.environ.get("CSHSE_S3_BUCKET", "cshse-filestorage-qlyj5pn")
        endpoint = _os.environ.get("AWS_ENDPOINT_URL_S3") or _os.environ.get("AWS_ENDPOINT_URL")
        try:
            s3 = boto3.client("s3", endpoint_url=endpoint, config=BotoConfig(s3={"addressing_style": "path"}))
            obj = s3.get_object(Bucket=bucket, Key=req.s3Key)
            data = obj["Body"].read()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"s3 fetch failed: {type(exc).__name__}: {exc}")
    else:
        raise HTTPException(status_code=400, detail="provide base64 or s3Key")

    try:
        text = extract_text(data, mime_type=req.mimeType, filename=req.filename)
    except ValueError as exc:
        # Unsupported type or malformed file — a 400, not a 502.
        raise HTTPException(status_code=400, detail=str(exc))

    title = req.filename.rsplit("/", 1)[-1] if req.filename else ""
    return {"text": text, "title": title, "chars": len(text)}


@app.post("/ai/evidence/extract")
async def evidence_extract(req: EvidenceExtractRequest, request: Request) -> dict:
    body = await request.body()
    verify_hmac_signature(request, body)

    markdown = req.markdown
    pdf_source: str | None = None

    if not markdown and req.pdfBase64:
        import base64
        from app.evidence.pdf_extract import extract_text_from_pdf_bytes
        try:
            pdf_bytes = base64.b64decode(req.pdfBase64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"pdfBase64 decode failed: {exc}")
        try:
            markdown = extract_text_from_pdf_bytes(pdf_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        pdf_source = "pdfBase64"

    if not markdown and req.documentS3Key and req.documentMimeType == "application/pdf":
        from app.evidence.pdf_extract import extract_text_from_s3
        try:
            markdown = extract_text_from_s3(req.documentS3Key)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=502,
                detail=f"pdf s3 fetch/extract failed: {type(exc).__name__}: {exc}",
            )
        pdf_source = "documentS3Key"

    if not markdown:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                **EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY,
                "endpoint": "evidence.extract",
                "reason": (
                    "no extractable body — provide markdown, pdfBase64, or "
                    "documentS3Key with documentMimeType=application/pdf"
                ),
            },
        )

    try:
        out = extract_evidence_text(
            institution_id=req.institutionId,
            submission_id=req.submissionId,
            document_id=req.documentId or req.submissionId,
            markdown=markdown,
            source_filename=req.sourceFilename,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"evidence_extract failed: {type(exc).__name__}: {exc}",
        )

    if pdf_source:
        out["pdfSource"] = pdf_source
        out["extractedChars"] = len(markdown)
    return out


@app.post("/ai/evidence/recommend")
async def evidence_recommend(req: EvidenceRecommendRequest, request: Request) -> dict:
    body = await request.body()
    verify_hmac_signature(request, body)
    try:
        return recommend_evidence(
            institution_id=req.institutionId,
            submission_id=req.submissionId,
            standard_code=req.standardCode,
            spec_code=req.specCode,
            top_k=req.topK,
            program_level=req.programLevel,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"evidence_recommend failed: {type(exc).__name__}: {exc}",
        )


@app.post("/ai/evidence/score")
async def evidence_score(req: EvidenceScoreRequest, request: Request) -> dict:
    body = await request.body()
    verify_hmac_signature(request, body)
    try:
        return score_evidence(
            institution_id=req.institutionId,
            submission_id=req.submissionId,
            standard_code=req.standardCode,
            spec_code=req.specCode,
            candidate_chunks=req.candidateChunks,
            matrix_rows=req.matrixRows,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"evidence_score failed: {type(exc).__name__}: {exc}",
        )


def _build_section_hints_fn(
    *,
    institution_id: str,
    program_level: str,
    narrative_text: str,
    settings: Settings,
):
    """CR-049 Sprint 2.5 finish — closure that retrieves prior
    reader-override hints from the per-institution corrections RAG
    (`cshse_corrections_{env}`) for the (institution, programLevel,
    std, spec) tuple and renders them for the per-spec prompt.

    The closure shape matches `evaluate_section`'s `hints_fn(std, spec)
    → str` injection point so the section evaluator stays decoupled
    from the corrections store.

    Always fail-soft: any Qdrant / embedding / parsing failure returns
    an empty hints block — the eval still completes. Returns ``None``
    if hints are disabled (test/dev env opt-out), and the section
    evaluator then runs without hints.
    """
    if not settings.enable_section_eval_hints:
        return None
    if not institution_id:
        return None

    from app.corrections.store import retrieve_for_section, format_examples_for_prompt

    # Use the narrative as the semantic anchor for the corrections lookup —
    # it's the largest free-text the PC wrote for this section, and the
    # embedding similarity will line it up against prior overrides that
    # touched similar narrative ground. Empty narrative → empty hints.
    query_text = (narrative_text or "").strip()
    if not query_text:
        return None

    def _hints(std: str, spec: str) -> str:
        try:
            examples = retrieve_for_section(
                section_text=query_text,
                institution_id=institution_id,
                program_level=program_level,
                settings=settings,
            )
            # Filter to hints touching THIS spec — section evaluator wants
            # spec-scoped soft hints, not the full institution-wide stream.
            filtered = [
                e for e in examples
                if (e.expected_std == std and e.expected_spec == spec)
            ]
            return format_examples_for_prompt(filtered)
        except Exception:  # noqa: BLE001
            # Best-effort — Qdrant down or embedding miss must never fail eval.
            return ""

    return _hints


@app.post("/ai/section/evaluate")
async def section_evaluate(req: SectionEvaluateRequest, request: Request) -> dict:
    """CR-049 — evaluate a section against the reader-review criteria.

    Returns { perSpec: [{ standardCode, specCode, verdict, rationale,
    criteriaCoverage, improvementSuggestions, sourcesUsed }], links: [...] }.
    """
    body = await request.body()
    verify_hmac_signature(request, body)
    settings = get_settings()
    # Strip HTML for the corrections-lookup anchor (embeddings work on
    # text, not markup). The section evaluator itself still gets the
    # raw HTML for narrative context.
    from app.section_eval.scrape import html_to_text
    narrative_text = html_to_text(req.narrativeHtml or "")
    hints_fn = _build_section_hints_fn(
        institution_id=req.institutionId,
        program_level=req.programLevel,
        narrative_text=narrative_text,
        settings=settings,
    )
    try:
        return evaluate_section(
            institution_id=req.institutionId,
            submission_id=req.submissionId,
            specs=req.specs,
            narrative_html=req.narrativeHtml,
            supporting_evidence_text=req.supportingEvidenceText,
            files=req.files,
            web_links=req.webLinks,
            hints_fn=hints_fn,
            settings=settings,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"section_evaluate failed: {type(exc).__name__}: {exc}",
        )

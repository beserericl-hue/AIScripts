"""CR-018 Phase 2b — PDF → text wrapper for the evidence-review pipeline.

Why pypdf and not marker-pdf? The downstream consumer is
``extract_evidence_text`` which splits into ~800-char chunks for
embedding + RAG. Marker-pdf's strengths (table / formula / figure
preservation) are wasted there, and its weights pull a ~2 GB image into
the ai-service container. pypdf is pure-Python, ~200 KB, no system deps,
and produces clean enough text for embedding.

If a coordinator later needs structured tables out of a PDF, the
docx-import path is the right surface — they should re-upload as DOCX.
"""
from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path


_MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB sanity cap matching the upload cap


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Pull text out of an in-memory PDF and return concatenated markdown.

    Pages are separated by a blank line so the downstream paragraph-aware
    chunker can use page boundaries as soft cuts. Raises ``ValueError``
    on malformed input or oversized payloads so the route handler can
    surface a 400, not a 502.
    """
    if not pdf_bytes:
        raise ValueError("pdf_bytes is empty")
    if len(pdf_bytes) > _MAX_PDF_BYTES:
        raise ValueError(
            f"pdf exceeds {_MAX_PDF_BYTES // (1024 * 1024)} MB cap "
            f"(got {len(pdf_bytes) // (1024 * 1024)} MB)"
        )

    # Import locally so the rest of evidence/ keeps booting even if pypdf
    # is missing in some weird future requirements drift.
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except PdfReadError as exc:
        raise ValueError(f"could not read pdf: {exc}") from exc

    pages: list[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception as exc:  # noqa: BLE001 — pypdf surfaces a variety
            # Skip the bad page rather than abort the whole document — a
            # single corrupt page shouldn't lose the other 200.
            text = f"[page extraction failed: {type(exc).__name__}]"
        pages.append(text.strip())

    return "\n\n".join(p for p in pages if p)


def extract_text_from_s3(
    s3_key: str, bucket: str | None = None, endpoint: str | None = None
) -> str:
    """Stream a PDF from S3, extract, and return the same string shape.

    Reuses the env-var convention from import_jobs._resolve_s3_to_local so
    Tigris + AWS both work without a config branch in the route handler.
    """
    import boto3
    from botocore.config import Config as BotoConfig

    bucket = bucket or os.environ.get("CSHSE_S3_BUCKET", "cshse-filestorage-qlyj5pn")
    endpoint = endpoint or os.environ.get("AWS_ENDPOINT_URL_S3") or os.environ.get("AWS_ENDPOINT_URL")
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )

    # Stream to a temp file so we don't hold the whole PDF in memory twice
    # (once in boto, once in pypdf's BytesIO).
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        s3.download_file(bucket, s3_key, str(tmp_path))
        pdf_bytes = tmp_path.read_bytes()
    finally:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass

    return extract_text_from_pdf_bytes(pdf_bytes)

"""CR-018 Phase 2b — pypdf-based PDF extraction tests.

Generates a tiny PDF in-memory using reportlab (already an indirect
dependency via python-docx for some renderings) or falls back to a
crafted PDF byte string when reportlab is missing. The point is to
verify the extractor returns coherent text for downstream chunking,
not to test pypdf itself.
"""
from __future__ import annotations

import io

import pytest

from app.evidence.pdf_extract import extract_text_from_pdf_bytes


def _make_simple_pdf(pages_text: list[str]) -> bytes:
    """Build a minimal PDF with one text fragment per page.

    Hand-rolls a PDF structure (no reportlab dep) so this test works in
    any CI without extra installs. Uses the Helvetica core font so no
    embedded font dict is needed.
    """
    buf = io.BytesIO()
    objects: list[bytes] = []

    def add_obj(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    # Will fill in /Kids after we know the page object ids.
    page_obj_ids: list[int] = []
    content_obj_ids: list[int] = []

    # Reserve catalog + pages root spots first to keep numbering predictable.
    catalog_id = add_obj(b"<< /Type /Catalog /Pages 2 0 R >>")
    pages_root_id = add_obj(b"")  # placeholder
    font_id = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for text in pages_text:
        # PDF text-show command. Escape parens/backslashes for the literal.
        safe = (
            text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        )
        stream = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET".encode("ascii")
        content = (
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        )
        content_id = add_obj(content)
        page_body = (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 " + str(font_id).encode("ascii") + b" 0 R >> >> "
            b"/Contents " + str(content_id).encode("ascii") + b" 0 R >>"
        )
        page_id = add_obj(page_body)
        page_obj_ids.append(page_id)
        content_obj_ids.append(content_id)

    # Backfill the /Pages root with actual /Kids.
    kids = b" ".join(f"{pid} 0 R".encode("ascii") for pid in page_obj_ids)
    objects[pages_root_id - 1] = (
        b"<< /Type /Pages /Kids [" + kids + b"] /Count "
        + str(len(page_obj_ids)).encode("ascii") + b" >>"
    )

    # Write header + objects + xref + trailer.
    buf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = []
    for idx, body in enumerate(objects, start=1):
        offsets.append(buf.tell())
        buf.write(f"{idx} 0 obj\n".encode("ascii"))
        buf.write(body)
        buf.write(b"\nendobj\n")

    xref_offset = buf.tell()
    buf.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets:
        buf.write(f"{off:010d} 00000 n \n".encode("ascii"))
    buf.write(b"trailer\n")
    buf.write(
        f"<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n".encode("ascii")
    )
    buf.write(b"startxref\n")
    buf.write(f"{xref_offset}\n".encode("ascii"))
    buf.write(b"%%EOF\n")

    return buf.getvalue()


def test_extract_single_page_text() -> None:
    pdf = _make_simple_pdf(["Hello evidence world"])
    text = extract_text_from_pdf_bytes(pdf)
    assert "Hello" in text
    assert "evidence" in text


def test_extract_multi_page_separates_with_blank_line() -> None:
    pdf = _make_simple_pdf(["Page one body", "Page two body", "Page three body"])
    text = extract_text_from_pdf_bytes(pdf)
    # Per-page text should be joined with a blank-line separator so the
    # paragraph-aware chunker can use page boundaries.
    assert "Page one" in text
    assert "Page two" in text
    assert "Page three" in text
    # Two separator blocks between three pages.
    assert text.count("\n\n") >= 2


def test_extract_empty_bytes_raises() -> None:
    with pytest.raises(ValueError):
        extract_text_from_pdf_bytes(b"")


def test_extract_garbage_raises() -> None:
    with pytest.raises(ValueError):
        extract_text_from_pdf_bytes(b"not a pdf at all")


def test_extract_oversized_pdf_raises() -> None:
    # 60 MB > 50 MB cap.
    big = b"%PDF-1.4\n" + b"\0" * (60 * 1024 * 1024)
    with pytest.raises(ValueError, match="cap"):
        extract_text_from_pdf_bytes(big)


def test_pipeline_round_trip_pdf_to_evidence_text() -> None:
    """End-to-end: PDF bytes → text → chunks → upsert.

    Verifies the extractor's output is the right shape for
    extract_evidence_text (no leading/trailing junk that would derail the
    paragraph chunker).
    """
    from app.evidence.extract import extract_evidence_text

    class _SpyStore:
        def __init__(self) -> None:
            self.upserts: list[dict] = []

        def ensure_collection(self, name: str) -> None:
            pass

        def upsert(self, collection, *, vectors, payloads, ids):
            self.upserts.append({"collection": collection, "payloads": payloads, "ids": ids})

    class _FakeEmbedder:
        def embed_one(self, text: str) -> list[float]:
            return [0.1, 0.2, 0.3]

    pdf = _make_simple_pdf(["First page narrative.", "Second page narrative."])
    markdown = extract_text_from_pdf_bytes(pdf)

    spy = _SpyStore()
    out = extract_evidence_text(
        institution_id="inst-Z",
        submission_id="sub-9",
        document_id="doc-pdf-1",
        markdown=markdown,
        embedder=_FakeEmbedder(),
        store=spy,
    )
    assert out["chunksUpserted"] >= 1
    assert spy.upserts
    # Institution stamping invariant must still hold post-extraction.
    for payload in spy.upserts[0]["payloads"]:
        assert payload["institutionId"] == "inst-Z"

"""Unit tests for the DOCX exporter."""
from __future__ import annotations

import io

from docx import Document

from app.export.docx_writer import _slugify, build_evidence_docx
from app.export.s3_writer import upload_evidence_docx


def test_slugify_basics():
    # Em-dash is dropped; periods are kept (filename-safe)
    assert _slugify("Dr. Gigi Franyo — CV") == "Dr._Gigi_Franyo_CV"
    assert _slugify("Faculty CV/Resume.docx") == "Faculty_CVResume.docx"
    assert _slugify("") == "item"
    assert _slugify("  ") == "item"
    # Caps cap at max_len
    assert len(_slugify("x" * 200, max_len=40)) == 40


def test_build_evidence_docx_round_trips():
    item = build_evidence_docx(
        title="John Rosicky CV",
        body_text="Education:\nPh.D., Counseling Psychology, 2010\n\nWork Experience:\nProfessor, Stevenson, 2012-present",
        standard_code="6",
        spec_code="a",
        source_filename="2024 CSHSE Self-Study Stevenson University.docx",
        source_version=1,
    )
    # File should be valid DOCX
    doc = Document(io.BytesIO(item.docx_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text]
    # Title + subtitle + body paragraphs + footer
    assert any("John Rosicky CV" in p for p in paragraphs)
    assert any("Standard 6.a" in p for p in paragraphs)
    assert any("Ph.D., Counseling Psychology" in p for p in paragraphs)
    assert any("Stevenson, 2012-present" in p for p in paragraphs)
    assert item.suggested_filename == "6-a-John_Rosicky_CV.docx"
    assert len(item.sha256) == 64


def test_upload_evidence_dry_run_produces_full_doc():
    item = build_evidence_docx(
        title="Brochure",
        body_text="A short program brochure for prospective students.",
        standard_code="1",
        spec_code="f",
        source_filename="stevenson.docx",
    )
    result = upload_evidence_docx(
        item,
        institution_id="6977d979870733bbb6de1a07",
        submission_id="6986239a6612bf17f04a3217",
        uploaded_by="69768d944fd61f9313be39ef",
        bucket="cshse-filestorage-test",
        dry_run=True,
    )
    se = result.supporting_evidence_doc
    assert se["standardCode"] == "1"
    assert se["specCode"] == "f"
    assert se["evidenceType"] == "document"
    assert se["file"]["storageType"] == "s3"
    assert se["file"]["s3Bucket"] == "cshse-filestorage-test"
    assert se["versionNumber"] == 1
    assert se["isCurrentVersion"] is True
    assert se["file"]["s3Key"].startswith("6977d979870733bbb6de1a07/")
    assert se["file"]["s3Key"].endswith("/1-f-Brochure.docx")
    assert "ai-import-wizard" in se["tags"]

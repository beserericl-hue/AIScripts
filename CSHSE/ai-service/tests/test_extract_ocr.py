"""OCR only on the backfill pass: images and text-less PDFs (ETSU screenshots/scans)."""
import pytest

from app.evidence import office_extract as ox


def test_image_needs_ocr_flag(monkeypatch):
    with pytest.raises(ValueError):
        ox.extract_text(b"\x89PNG....", filename="12 Theories of HD.png")
    monkeypatch.setattr(ox, "_ocr_image_bytes", lambda data: "Erikson Piaget")
    assert ox.extract_text(b"\x89PNG....", filename="12 Theories of HD.png", ocr=True) == "Erikson Piaget"


def test_pdf_without_text_layer_falls_back_to_ocr_only_when_asked(monkeypatch):
    import app.evidence.pdf_extract as pe
    monkeypatch.setattr(pe, "extract_text_from_pdf_bytes", lambda data: "  \n ")
    monkeypatch.setattr(ox, "_ocr_pdf_bytes", lambda data: "Module 3 privacy settings")
    assert ox.extract_text(b"%PDF-1.4", filename="14 Privacy.pdf").strip() == ""
    assert ox.extract_text(b"%PDF-1.4", filename="14 Privacy.pdf", ocr=True) == "Module 3 privacy settings"


def test_pdf_with_text_layer_is_not_ocrd(monkeypatch):
    import app.evidence.pdf_extract as pe
    monkeypatch.setattr(pe, "extract_text_from_pdf_bytes", lambda data: "A real text layer with plenty of words in it.")
    monkeypatch.setattr(ox, "_ocr_pdf_bytes", lambda data: pytest.fail("should not OCR"))
    assert "real text layer" in ox.extract_text(b"%PDF-1.4", filename="x.pdf", ocr=True)

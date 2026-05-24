"""CR-040 Phase 2 — image-capture regression tests.

Previously ``deep_walker`` hardcoded ``contains_image=False`` on every
emitted Section, silently dropping every figure embedded in a DOCX.
``extract_images_from_tag`` is the new helper that walks an HTML tag and
pulls ``<img>`` descendants into ``ImageRef`` records honoring the
per-image + per-section byte caps.
"""
from __future__ import annotations

import base64

import pytest
from bs4 import BeautifulSoup

from app.splitter.sections import (
    IMAGE_BYTES_PER_IMAGE_CAP,
    ImageRef,
    extract_images_from_tag,
)


def _data_url(content: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}"


def test_extracts_a_single_inline_image() -> None:
    html = f'<p>Body text <img alt="figure 1" src="{_data_url(b"PNGBYTES")}"/> after.</p>'
    p = BeautifulSoup(html, "html.parser").find("p")
    imgs = extract_images_from_tag(p, base_byte_offset=100)
    assert len(imgs) == 1
    img = imgs[0]
    assert img.mime == "image/png"
    assert img.alt_text == "figure 1"
    assert img.byte_offset == 100  # base + index 0
    assert img.data_base64 == base64.b64encode(b"PNGBYTES").decode("ascii")
    assert img.truncated is False


def test_extracts_multiple_images_in_document_order() -> None:
    html = (
        '<div>'
        f'<img src="{_data_url(b"A", mime="image/png")}"/>'
        f'<img src="{_data_url(b"B", mime="image/jpeg")}"/>'
        f'<img src="{_data_url(b"C", mime="image/png")}"/>'
        '</div>'
    )
    root = BeautifulSoup(html, "html.parser").find("div")
    imgs = extract_images_from_tag(root, base_byte_offset=10)
    assert [i.mime for i in imgs] == ["image/png", "image/jpeg", "image/png"]
    assert [i.byte_offset for i in imgs] == [10, 11, 12]


def test_truncates_oversized_image_but_keeps_record() -> None:
    # Build a payload that decodes to just over the per-image cap.
    raw = b"\0" * (IMAGE_BYTES_PER_IMAGE_CAP + 1024)
    html = f'<p><img src="{_data_url(raw)}"/></p>'
    p = BeautifulSoup(html, "html.parser").find("p")
    imgs = extract_images_from_tag(p)
    assert len(imgs) == 1
    assert imgs[0].truncated is True
    # The base64 stays under the cap (rounded down to a multiple of 4 chars).
    decoded = base64.b64decode(imgs[0].data_base64)
    assert len(decoded) <= IMAGE_BYTES_PER_IMAGE_CAP


def test_handles_external_url_src_as_placeholder() -> None:
    html = '<p><img src="https://example.test/figure.png" alt="external"/></p>'
    p = BeautifulSoup(html, "html.parser").find("p")
    imgs = extract_images_from_tag(p)
    assert len(imgs) == 1
    assert imgs[0].mime == "image/unknown"
    assert imgs[0].data_base64 == "https://example.test/figure.png"
    assert imgs[0].alt_text == "external"


def test_drops_images_after_section_byte_budget_exhausted() -> None:
    """Section-level cap is enforced — beyond ~10 MB total, remaining
    images are silently dropped rather than risking matcher-worker OOM.
    Uses three 4MB images (each under the per-image cap) so the cap
    measured is unambiguously the per-section budget."""
    medium = b"\0" * (4 * 1024 * 1024)  # 4MB — under per-image cap (5MB)
    html = (
        '<div>'
        f'<img src="{_data_url(medium)}"/>'
        f'<img src="{_data_url(medium)}"/>'
        f'<img src="{_data_url(medium)}"/>'
        '</div>'
    )
    root = BeautifulSoup(html, "html.parser").find("div")
    imgs = extract_images_from_tag(root)
    # First (4MB) accepted (total=4MB); second (4MB → total=8MB) still
    # under cap, accepted; third (4MB → total=12MB) exceeds 10MB cap → STOPS.
    assert len(imgs) == 2


def test_empty_or_imageless_tag_returns_empty_list() -> None:
    html = "<p>Just text — no figures at all.</p>"
    p = BeautifulSoup(html, "html.parser").find("p")
    assert extract_images_from_tag(p) == []
    assert extract_images_from_tag(None) == []


def test_section_to_dict_serializes_image_list() -> None:
    """Wire-format must surface images so cshse-server can route through S3."""
    from app.splitter.sections import Section, to_dict

    sec = Section(
        id="t",
        heading="h",
        heading_level=2,
        markdown="m",
        byte_offset_start=1,
        byte_offset_end=1,
        word_count=1,
        contains_table=False,
        contains_image=True,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="prose_outside_table",
        images=[
            ImageRef(
                mime="image/png",
                byte_offset=1,
                data_base64="abc",
                alt_text="x",
            )
        ],
    )
    d = to_dict(sec)
    assert d["imageCount"] == 1
    assert d["images"][0] == {
        "mime": "image/png",
        "byteOffset": 1,
        "dataBase64": "abc",
        "altText": "x",
        "truncated": False,
    }

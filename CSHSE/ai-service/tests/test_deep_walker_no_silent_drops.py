"""CR-039 Phase 2c part 2 — walker silent-drop audit pins.

Problem 3 from the CR: short intro paragraphs (mission statements,
school overview, glossary) were vanishing entirely — they never reached
Unplaced, never reached the matcher, never reached the wizard. This
suite pins the fixed behavior so the regression can't re-emerge:

- Short paragraphs (>=5 words) are emitted, not dropped silently.
- Non-`<p>` block containers (`<div>`, `<section>`, `<blockquote>`)
  emit when they hold leaf text.
- Standalone heading tags emit as ``prose_outside_table_heading`` so
  introduction_detector can route them.
- No double-emit when a `<div>` wraps a `<p>` (parent skipped).
"""
from __future__ import annotations

from app.splitter.deep_walker import deep_walk_with_fallback


def _sections(html: str):
    return deep_walk_with_fallback(html.encode("utf-8"), base_id="t")


def test_short_paragraph_no_longer_dropped() -> None:
    # 12 words — under the old 50-word floor, now captured.
    html = (
        "<html><body>"
        "<p>The program prepares students for human services careers.</p>"
        "</body></html>"
    )
    secs = _sections(html)
    bodies = [s.markdown for s in secs]
    assert any("prepares students" in b for b in bodies), (
        "12-word paragraph silently dropped (regression of CR-039 Problem 3)"
    )


def test_mission_statement_captured() -> None:
    # Coordinator-typical mission statement: 17 words, no heading.
    html = (
        "<html><body>"
        "<p>Our mission is to advance human services education by integrating "
        "theory, practice, and community engagement.</p>"
        "</body></html>"
    )
    secs = _sections(html)
    assert any("mission" in s.markdown.lower() for s in secs)


def test_standalone_heading_captured_with_heading_tier() -> None:
    html = (
        "<html><body>"
        "<h2>About the Program</h2>"
        "<p>Established 1999, the program serves 200 students annually.</p>"
        "</body></html>"
    )
    secs = _sections(html)
    headings = [s for s in secs if s.splitter_tier == "prose_outside_table_heading"]
    assert any(
        s.heading == "About the Program" for s in headings
    ), "<h2> heading not emitted as heading-tier section"


def test_div_wrapping_p_does_not_double_emit() -> None:
    html = (
        "<html><body>"
        "<div><p>Inside the div is fifteen words of meaningful introductory "
        "prose for the audit.</p></div>"
        "</body></html>"
    )
    secs = _sections(html)
    # Only the <p> should emit — the <div> wrapper is skipped because it
    # has a block-level child.
    matching = [s for s in secs if "Inside the div" in s.markdown]
    assert len(matching) == 1, (
        f"expected exactly one section for the wrapped paragraph; "
        f"got {len(matching)} (parent <div> double-emit regression)"
    )


def test_blockquote_captured_when_outside_table() -> None:
    html = (
        "<html><body>"
        "<blockquote>Quotation from the institutional mission statement "
        "anchoring our program objectives.</blockquote>"
        "</body></html>"
    )
    secs = _sections(html)
    assert any("Quotation" in s.markdown for s in secs)


def test_paragraph_inside_table_still_skipped() -> None:
    # CR-039 fix relaxes the prose floor but must NOT cross into table content,
    # which has its own walker path (`deep_walk`). A `<p>` inside a `<td>` is
    # owned by the table walker.
    html = (
        "<html><body>"
        "<table><tr><td><p>Cell paragraph that should belong to the "
        "table walker output, not the prose fallback.</p></td></tr></table>"
        "</body></html>"
    )
    secs = _sections(html)
    prose_with_cell_text = [
        s for s in secs
        if s.splitter_tier.startswith("prose_outside_table") and "Cell paragraph" in s.markdown
    ]
    assert not prose_with_cell_text, (
        "paragraph inside a <td> leaked into the prose fallback"
    )


def test_empty_paragraph_skipped() -> None:
    # Pure whitespace must not produce a section.
    html = "<html><body><p>   </p><p></p></body></html>"
    secs = _sections(html)
    assert all(s.markdown.strip() for s in secs), "emitted an empty-text section"


def test_one_word_paragraph_dropped() -> None:
    # Below the 5-word floor; would be noise.
    html = "<html><body><p>Hi.</p></body></html>"
    secs = _sections(html)
    assert not any(s.markdown.strip() == "Hi." for s in secs)

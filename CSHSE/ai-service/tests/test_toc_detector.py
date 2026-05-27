"""CR-040 follow-on (2026-05-27) — TOC-anchored detector unit tests.

These pin the recall behavior the pattern-based detectors were
missing on Stevenson:

  * Two CVs whose body anchor never fired (Thomas K. Swisher,
    Lauri A. Weiner) but which the Table of Contents explicitly
    lists must show up via TOC-anchored detection.
  * Syllabi grouped under a TOC "Syllabi" heading must classify
    correctly even when the entry line is bare ("CHS 220").
  * Papers under a "Papers / Projects" heading inherit the kind
    from the section hint.
  * The merge layer dedupes against pattern-based detector output
    so we never double-count.
"""
from __future__ import annotations

import pytest

from app.splitter.toc_detector import (
    TocEntry,
    TocAnchoredDetection,
    parse_toc,
    parse_sub_tocs,
    anchor_in_body,
    merge_cv_detections,
    merge_evidence_doc_detections,
    normalize_person_key,
    normalize_course_key,
    _clean_toc_line,
    _classify_entry,
)


# ----------------------------------------------------------------------
# Small unit helpers
# ----------------------------------------------------------------------


class TestCleanTocLine:
    """The TOC line cleaner has to strip:
      * dotted leaders ("John Rosicky .... 45")
      * tab + page number ("John Rosicky\\t45")
      * ellipsis leaders
      * underscore leaders
      * trailing "Page N" suffix
    """

    @pytest.mark.parametrize("raw, expected", [
        ("John Rosicky ......... 45", "John Rosicky"),
        ("John Rosicky\t45", "John Rosicky"),
        ("John Rosicky…… 45", "John Rosicky"),
        ("John Rosicky______ 45", "John Rosicky"),
        ("CVs page 12", "CVs"),
        ("Standard 6 ........ 100", "Standard 6"),
        ("  bare line  ", "bare line"),
    ])
    def test_clean_toc_line(self, raw, expected):
        assert _clean_toc_line(raw) == expected


class TestClassifyEntry:
    """Per-entry kind classification is the keystone — section_hint
    overrides everything, then course code, then keyword tokens,
    then a 2-5 title-case fallback for plain person names.
    """

    def test_section_hint_wins(self):
        assert _classify_entry("anything goes", "cv") == "cv"
        assert _classify_entry("CHS 220 Spring 2019", "paper") == "paper"

    def test_course_code_detects_syllabus(self):
        assert _classify_entry("CHS 220 Spring 2019", None) == "syllabus"
        assert _classify_entry("ENG101", None) == "syllabus"

    def test_explicit_syllabus_keyword(self):
        assert _classify_entry("Course Syllabus for Counseling", None) == "syllabus"

    def test_explicit_cv_keyword(self):
        assert _classify_entry("Curriculum Vitae — Mary Smith", None) == "cv"
        assert _classify_entry("Faculty CV", None) == "cv"

    def test_explicit_paper_keyword(self):
        assert _classify_entry("Sample Research Paper", None) == "paper"
        assert _classify_entry("Country Report Project", None) == "paper"

    def test_plain_name_with_no_hint_returns_unknown(self):
        """CR-040 follow-on (2026-05-27) — the title-case-tokens → CV
        fallback was removed after the real Stevenson handbook's TOC
        produced 6 false positives ("Human Services Club", "Honor
        Society", "Professional Expectations", "Professional
        Development Award", etc.) — all 2-4 token title-case phrases
        that aren't CVs. Without an explicit CV section_hint or a
        "Curriculum Vitae" keyword in the text, plain title-case
        entries are now classified as "unknown" and don't make it
        into the anchored detections pass. The pattern detector
        handles bare-name CV anchors in the body."""
        # Bare names with no CV context → unknown (was "cv" before).
        assert _classify_entry("John Rosicky", None) == "unknown"
        assert _classify_entry("Thomas K. Swisher, J.D., Ph.D.", None) == "unknown"
        # Explicit CV keyword still wins.
        assert _classify_entry("Curriculum Vitae — Mary Smith", None) == "cv"
        # And section_hint overrides everything.
        assert _classify_entry("John Rosicky", "cv") == "cv"

    def test_topic_phrases_no_longer_misclassify_as_cv(self):
        """Stevenson handbook TOC false positives — these must classify
        as 'unknown', not 'cv'. They're the bug the fallback removal
        was specifically designed to fix."""
        assert _classify_entry("Human Services Club", None) == "unknown"
        assert _classify_entry("Honor Society", None) == "unknown"
        assert _classify_entry("Professional Expectations", None) == "unknown"
        assert _classify_entry("Professional Development Award", None) == "unknown"
        assert _classify_entry("Department Chair's Letter", None) == "unknown"

    def test_random_phrase_is_unknown(self):
        assert _classify_entry("introduction to the program", None) == "unknown"


class TestNormalizeKeys:
    def test_person_strips_credentials_and_dots(self):
        assert normalize_person_key("Thomas K. Swisher, J.D., Ph.D.") == "thomas k swisher"
        assert normalize_person_key("LAURI A. WEINER, HS-BCP") == "lauri a weiner"
        assert normalize_person_key("Barry W. Thomas") == "barry w thomas"

    def test_person_dedupes_case_variants(self):
        assert normalize_person_key("Barry W. Thomas") == normalize_person_key("barry w thomas")

    def test_course_code_canonical(self):
        assert normalize_course_key("CHS 220") == "chs 220"
        assert normalize_course_key("CHS220") == "chs 220"


# ----------------------------------------------------------------------
# Pass 1 — TOC parsing
# ----------------------------------------------------------------------


_STEVENSON_LIKE_TOC_HTML = """
<html><body>
  <h1>Table of Contents</h1>
  <p>Standard 1 ............ 1</p>
  <p>Standard 2 ............ 12</p>
  <p>Standard 6 ............ 80</p>
  <p>CVs</p>
  <p>John Rosicky ............ 100</p>
  <p>Carol A. Dietrich ............ 110</p>
  <p>Roxanne M. Epps ............ 120</p>
  <p>Barry W. Thomas ............ 130</p>
  <p>Thomas K. Swisher, J.D., Ph.D. ............ 140</p>
  <p>LAURI A. WEINER, HS-BCP ............ 150</p>
  <p>Syllabi</p>
  <p>CHS 220 ............ 200</p>
  <p>CHS 305 ............ 210</p>
  <p>Papers / Projects</p>
  <p>Sample Country Report ............ 300</p>
  <p>Final Research Project ............ 320</p>
  <h2>Introduction</h2>
  <p>This self-study presents the Stevenson University Human Services program in
     extensive detail, covering all six CSHSE standards. The narrative is
     organised by standard and includes references to the appendix where
     supporting evidence is collected. Faculty curricula vitae appear in
     Appendix A; course syllabi in Appendix B; student work samples in
     Appendix C.</p>
</body></html>
""".encode("utf-8")


class TestParseToc:
    def test_finds_all_known_entries(self):
        entries = parse_toc(_STEVENSON_LIKE_TOC_HTML)
        labels = [e.label for e in entries]
        # All six faculty CVs must be parsed.
        assert "John Rosicky" in labels
        assert "Thomas K. Swisher, J.D., Ph.D." in labels
        assert "LAURI A. WEINER, HS-BCP" in labels
        # Both syllabi.
        assert "CHS 220" in labels
        assert "CHS 305" in labels
        # Both papers.
        assert "Sample Country Report" in labels

    def test_section_hint_propagates(self):
        entries = parse_toc(_STEVENSON_LIKE_TOC_HTML)
        by_label = {e.label: e for e in entries}
        # Plain-name entries under "CVs" inherit cv hint.
        assert by_label["John Rosicky"].kind == "cv"
        assert by_label["John Rosicky"].section_hint == "cv"
        # Bare course codes under "Syllabi" classify as syllabus.
        assert by_label["CHS 220"].kind == "syllabus"
        assert by_label["CHS 220"].section_hint == "syllabus"
        # Generic title under "Papers / Projects" classifies as paper.
        assert by_label["Sample Country Report"].kind == "paper"
        assert by_label["Sample Country Report"].section_hint == "paper"

    def test_stops_at_body_introduction(self):
        entries = parse_toc(_STEVENSON_LIKE_TOC_HTML)
        # The long Introduction paragraph after the TOC must NOT be
        # parsed as an entry. Confirm by checking no entry has 'self-study'
        # in its label.
        for e in entries:
            assert "self-study" not in e.label.lower()

    def test_no_toc_returns_empty_list(self):
        html = b"<html><body><p>No TOC here.</p></body></html>"
        assert parse_toc(html) == []

    def test_credential_suffixes_preserved_in_label(self):
        """The displayed label keeps the credential suffix so the
        right-hand preview shows what the document actually says.
        Matching strips it; the LABEL keeps it."""
        entries = parse_toc(_STEVENSON_LIKE_TOC_HTML)
        labels = [e.label for e in entries]
        assert "Thomas K. Swisher, J.D., Ph.D." in labels
        assert "LAURI A. WEINER, HS-BCP" in labels


# ----------------------------------------------------------------------
# Pass 2 — body anchoring
# ----------------------------------------------------------------------


_STEVENSON_LIKE_FULL_HTML = """
<html><body>
  <h1>Table of Contents</h1>
  <p>CVs</p>
  <p>John Rosicky ............ 100</p>
  <p>Thomas K. Swisher, J.D., Ph.D. ............ 140</p>
  <p>LAURI A. WEINER, HS-BCP ............ 150</p>
  <p>Syllabi</p>
  <p>CHS 220 ............ 200</p>
  <p>Papers / Projects</p>
  <p>Sample Country Report ............ 300</p>
  <h2>Introduction</h2>
  <p>This self-study presents the Stevenson University Human Services
     program in extensive detail. The narrative is organised by standard.
     Faculty CVs are in Appendix A. Syllabi in Appendix B. Student work
     samples in Appendix C. This sentence makes the paragraph long enough
     to qualify as body prose so the parser knows the TOC region has
     ended and the body has begun.</p>
  <h2>Appendix A — CVs</h2>
  <p>John Rosicky</p>
  <p>1051 Omar Dr.</p>
  <p>Crownsville, MD 21032</p>
  <p>EDUCATION</p>
  <p>1990  University of Maryland  B.A. Sociology</p>
  <p>Thomas K. Swisher, J.D., Ph.D.</p>
  <p>11886 Simpson Road</p>
  <p>Clarksville, MD 21029</p>
  <p>(443) 996-6659</p>
  <p>EDUCATION</p>
  <p>1983  University of Virginia  B.S. Secondary Education</p>
  <p>1986  University of Baltimore  Juris Doctorate</p>
  <p>LAURI A. WEINER, HS-BCP</p>
  <p>7905 Winterset Avenue</p>
  <p>Baltimore, Maryland 21208</p>
  <p>lweiner@stevenson.edu</p>
  <p>(410) 371-4729 (c)</p>
  <p>Education</p>
  <p>J.D., University of Maryland School of Law, Baltimore, Maryland, 1992</p>
  <h2>Appendix B — Syllabi</h2>
  <p>CHS 220 Spring 2019</p>
  <p>Course description: Introduction to Human Services Practice.</p>
  <h2>Appendix C — Student Work</h2>
  <p>Sample Country Report</p>
  <p>A multi-page country analysis prepared by a graduating senior.</p>
</body></html>
""".encode("utf-8")


class TestAnchorInBody:
    def test_anchors_every_toc_entry_present_in_body(self):
        toc_entries = parse_toc(_STEVENSON_LIKE_FULL_HTML)
        detections = anchor_in_body(_STEVENSON_LIKE_FULL_HTML, toc_entries)
        labels = [d.label for d in detections]
        # The six faculty + 1 syllabus + 1 paper should all anchor in body.
        assert "John Rosicky" in labels
        assert "Thomas K. Swisher, J.D., Ph.D." in labels
        assert "LAURI A. WEINER, HS-BCP" in labels
        assert "CHS 220" in labels
        assert "Sample Country Report" in labels

    def test_classifies_anchored_entries_by_section_hint(self):
        toc_entries = parse_toc(_STEVENSON_LIKE_FULL_HTML)
        detections = anchor_in_body(_STEVENSON_LIKE_FULL_HTML, toc_entries)
        by_label = {d.label: d for d in detections}
        assert by_label["John Rosicky"].kind == "cv"
        assert by_label["Thomas K. Swisher, J.D., Ph.D."].kind == "cv"
        assert by_label["LAURI A. WEINER, HS-BCP"].kind == "cv"
        assert by_label["CHS 220"].kind == "syllabus"
        assert by_label["Sample Country Report"].kind == "paper"

    def test_body_text_starts_at_anchor(self):
        toc_entries = parse_toc(_STEVENSON_LIKE_FULL_HTML)
        detections = anchor_in_body(_STEVENSON_LIKE_FULL_HTML, toc_entries)
        by_label = {d.label: d for d in detections}
        # Body slice for Thomas Swisher must include the EDUCATION section
        # AND must end before the next anchor (LAURI A. WEINER).
        swisher = by_label["Thomas K. Swisher, J.D., Ph.D."]
        assert "EDUCATION" in swisher.body_text
        assert "University of Virginia" in swisher.body_text
        assert "LAURI A. WEINER" not in swisher.body_text  # cut at next anchor

    def test_course_code_extracted_for_syllabus(self):
        toc_entries = parse_toc(_STEVENSON_LIKE_FULL_HTML)
        detections = anchor_in_body(_STEVENSON_LIKE_FULL_HTML, toc_entries)
        chs220 = next(d for d in detections if d.label == "CHS 220")
        assert chs220.course_code == "CHS 220"


# ----------------------------------------------------------------------
# Merge layer
# ----------------------------------------------------------------------


class TestMergeCvDetections:
    def test_toc_adds_missing_cv(self):
        pattern = [
            {
                "sectionId": "p-1",
                "facultyName": "John Rosicky",
                "snippet": "...",
                "htmlSnippet": None,
                "byteOffsetStart": 0,
                "routing": {"source": "matcher"},
                "sectionMarkerCount": 3,
            },
        ]
        toc = [
            TocAnchoredDetection(
                label="Thomas K. Swisher, J.D., Ph.D.",
                kind="cv",
                body_html="<p>Thomas K. Swisher</p>",
                body_text="Thomas K. Swisher\nEDUCATION",
                byte_offset_start=42,
                section_hint="cv",
            )
        ]
        merged = merge_cv_detections(pattern, toc)
        assert len(merged) == 2
        names = [m["facultyName"] for m in merged]
        assert "John Rosicky" in names
        assert "Thomas K. Swisher, J.D., Ph.D." in names

    def test_pattern_wins_on_overlap(self):
        """If the pattern detector already found a CV, the TOC-anchored
        version with the same normalized name does NOT add a duplicate."""
        pattern = [
            {
                "sectionId": "p-1",
                "facultyName": "barry w thomas",
                "snippet": "barry's CV",
                "htmlSnippet": None,
                "byteOffsetStart": 0,
                "routing": {"source": "matcher"},
                "sectionMarkerCount": 3,
            },
        ]
        toc = [
            TocAnchoredDetection(
                label="Barry W. Thomas",
                kind="cv",
                body_html="<p>Barry W. Thomas</p>",
                body_text="...",
                byte_offset_start=42,
                section_hint="cv",
            )
        ]
        merged = merge_cv_detections(pattern, toc)
        assert len(merged) == 1
        assert merged[0]["sectionId"] == "p-1"  # pattern's original id preserved

    def test_non_cv_toc_detection_is_ignored(self):
        toc = [
            TocAnchoredDetection(
                label="CHS 220",
                kind="syllabus",
                body_html="...",
                body_text="...",
                byte_offset_start=0,
            )
        ]
        merged = merge_cv_detections([], toc)
        assert merged == []


class TestMergeEvidenceDocDetections:
    def test_syllabus_dedupes_by_course_code(self):
        pattern = [
            {
                "sectionId": "p-1",
                "docSubKind": "syllabus",
                "title": "CHS 220 Spring 2019",
                "summary": "...",
                "byteOffsetStart": 0,
                "pageCountEstimate": 5,
                "imageCount": 0,
                "courseCode": "CHS 220",
                "points": None,
                "s3Key": None,
                "s3Bucket": None,
                "fileSize": None,
                "sha256": None,
            }
        ]
        toc = [
            TocAnchoredDetection(
                label="CHS 220",
                kind="syllabus",
                body_html="...",
                body_text="...",
                byte_offset_start=10,
                section_hint="syllabus",
                course_code="CHS 220",
            )
        ]
        merged = merge_evidence_doc_detections(pattern, toc)
        assert len(merged) == 1
        assert merged[0]["sectionId"] == "p-1"

    def test_paper_adds_when_not_in_pattern(self):
        toc = [
            TocAnchoredDetection(
                label="Sample Country Report",
                kind="paper",
                body_html="...",
                body_text="A multi-page country report.",
                byte_offset_start=10,
                section_hint="paper",
            )
        ]
        merged = merge_evidence_doc_detections([], toc)
        assert len(merged) == 1
        assert merged[0]["docSubKind"] == "paper"
        assert merged[0]["title"] == "Sample Country Report"

    def test_cv_toc_detection_does_not_leak_into_evidence_docs(self):
        toc = [
            TocAnchoredDetection(
                label="John Rosicky",
                kind="cv",
                body_html="...",
                body_text="...",
                byte_offset_start=0,
            )
        ]
        merged = merge_evidence_doc_detections([], toc)
        assert merged == []


# ----------------------------------------------------------------------
# End-to-end: full HTML → final merged CV count
# ----------------------------------------------------------------------


class TestParseSubTocs:
    """CR-040 follow-on (2026-05-27) — sub-TOC scanner.

    Stevenson real-world TOC structure: the main TOC has a single
    line "Appendices (List of Supporting Documents) ... 112", and
    the per-CV / per-syllabus enumeration lives deeper in the body
    as a sub-TOC block. parse_sub_tocs scans for those blocks.
    """

    _STEVENSON_SUB_TOC_HTML = (
        "<html><body>"
        # Main TOC with no per-CV entries.
        "<h1>Table of Contents</h1>"
        "<p>Standard 1 ............ 14</p>"
        "<p>Standard 2 ............ 17</p>"
        "<p>Appendices (List of Supporting Documents) ............ 112</p>"
        # Body prose intervenes.
        "<h2>Introduction</h2>"
        "<p>A long enough self-study introduction paragraph to push past "
        "the 200-character prose-gate so the main TOC walker bails here. "
        "Stevenson University's Human Services baccalaureate program "
        "submission for CSHSE accreditation review.</p>"
        # Standard 1 body section
        "<h2>Standard 1 - Institutional Requirements</h2>"
        "<p>Lengthy prose describing the program's institutional accreditation, "
        "mission alignment, and faculty governance structure — this paragraph "
        "needs to exceed the 200-character heuristic so the body region is "
        "clearly inside the prose and not a TOC.</p>"
        # Sub-TOC: Appendices listing
        "<h2>List of Faculty CVs</h2>"
        "<p>John Rosicky ............ 113</p>"
        "<p>Carol A. Dietrich ............ 117</p>"
        "<p>Thomas K. Swisher, J.D., Ph.D. ............ 121</p>"
        "<p>LAURI A. WEINER, HS-BCP ............ 125</p>"
        "<p>Mary Beth Olson, M.A. ............ 130</p>"
        # Sub-TOC: Course Syllabi
        "<h2>List of Course Syllabi</h2>"
        "<p>CHS 220 — Introduction to Human Services ............ 200</p>"
        "<p>CHS 305 — Family Systems ............ 220</p>"
        # Sub-TOC: Student Work
        "<h2>List of Student Papers</h2>"
        "<p>Sample Country Report ............ 300</p>"
        "<p>Final Research Project ............ 320</p>"
        "</body></html>"
    ).encode("utf-8")

    def test_parses_all_cv_names_from_sub_toc(self):
        entries = parse_sub_tocs(self._STEVENSON_SUB_TOC_HTML)
        labels = [e.label for e in entries]
        assert "John Rosicky" in labels
        assert "Carol A. Dietrich" in labels
        assert "Thomas K. Swisher, J.D., Ph.D." in labels
        assert "LAURI A. WEINER, HS-BCP" in labels
        assert "Mary Beth Olson, M.A." in labels

    def test_sub_toc_entries_have_cv_section_hint(self):
        entries = parse_sub_tocs(self._STEVENSON_SUB_TOC_HTML)
        cv_entries = [e for e in entries if "rosicky" in e.label.lower() or "weiner" in e.label.lower()]
        assert all(e.section_hint == "cv" for e in cv_entries)
        assert all(e.kind == "cv" for e in cv_entries)

    def test_sub_toc_finds_syllabi(self):
        entries = parse_sub_tocs(self._STEVENSON_SUB_TOC_HTML)
        syllabi = [e for e in entries if e.kind == "syllabus"]
        # CHS 220 + CHS 305 — both course-codes detected from sub-TOC.
        labels = [e.label for e in syllabi]
        assert any("CHS 220" in l for l in labels)
        assert any("CHS 305" in l for l in labels)

    def test_sub_toc_finds_papers(self):
        entries = parse_sub_tocs(self._STEVENSON_SUB_TOC_HTML)
        papers = [e for e in entries if e.kind == "paper"]
        labels = [e.label for e in papers]
        assert any("Country Report" in l for l in labels)
        assert any("Research Project" in l for l in labels)

    def test_no_sub_toc_returns_empty(self):
        html = b"<html><body><p>Just prose, no sub-TOC anywhere.</p></body></html>"
        assert parse_sub_tocs(html) == []

    def test_sub_toc_bare_name_roster_under_cv_heading(self):
        """CR-040 follow-on (2026-05-27) — real Stevenson document
        diagnostic via /api/test/inspect-toc revealed the production
        doc's sub-TOC format is NOT dotted-leader-with-page-number.
        Instead, "Faculty Curriculum Vitae" is followed by a roster
        of bare name lines, each with a credentials suffix:

          Faculty Curriculum Vitae
          Full-Time Faculty
          John Rosicky, Ph.D.
          Tom Swisher, J.D., Ph.D.
          Lauri Weiner, J.D., M.A. Couns .
          Mayaugust Finkenberg, Ed.D.
          Part-Time Faculty
          Carol Dietrich , MSW
          ...

        parse_sub_tocs must accept this format (no page numbers, no
        dotted leaders). Pin all 9 names recovered.
        """
        html = (
            "<html><body>"
            "<h1>Table of Contents</h1>"
            "<p>Standard 1 ............ 14</p>"
            "<p>Standard 6 ............ 80</p>"
            "<h2>Introduction</h2>"
            "<p>A self-study introduction with body prose that is long "
            "enough to trip the 200-character prose-paragraph gate so "
            "the main TOC walker bails here. We need at least 200 "
            "characters which is more than this sentence alone provides. "
            "Adding another sentence brings us comfortably over the gate.</p>"
            "<h2>Standard 6 - Personnel</h2>"
            "<p>Standard 6 body prose discussing personnel qualifications "
            "and the faculty roster that follows.</p>"
            "<h2>Faculty Curriculum Vitae</h2>"
            "<p>Full-Time Faculty</p>"
            "<p>John Rosicky, Ph.D.</p>"
            "<p>Tom Swisher, J.D., Ph.D.</p>"
            "<p>Lauri Weiner, J.D., M.A. Couns.</p>"
            "<p>Mayaugust Finkenberg, Ed.D.</p>"
            "<p>Part-Time Faculty</p>"
            "<p>Carol Dietrich, MSW</p>"
            "<p>Bunny Ebling, LCSW</p>"
            "<p>Roxanne Epps, MSW</p>"
            "<p>Barbara Guthrie, M.Sp.Ed.</p>"
            "<h2>Appendix B</h2>"
            "<p>Other body content following the faculty list.</p>"
            "</body></html>"
        ).encode("utf-8")
        entries = parse_sub_tocs(html)
        labels = [e.label for e in entries]
        # All 9 faculty names recovered without dotted-leader page numbers.
        assert any("John Rosicky" in l for l in labels)
        assert any("Tom Swisher" in l for l in labels)
        assert any("Lauri Weiner" in l for l in labels)
        assert any("Mayaugust Finkenberg" in l for l in labels)
        assert any("Carol Dietrich" in l for l in labels)
        assert any("Bunny Ebling" in l for l in labels)
        assert any("Roxanne Epps" in l for l in labels)
        assert any("Barbara Guthrie" in l for l in labels)
        # All are CVs under the section hint.
        for e in entries:
            if any(
                kw in e.label
                for kw in ("Rosicky", "Swisher", "Weiner", "Finkenberg",
                          "Dietrich", "Ebling", "Epps", "Guthrie")
            ):
                assert e.kind == "cv", (
                    f"Expected {e.label!r} classified as cv, got {e.kind!r}"
                )

    def test_sub_toc_requires_two_toc_shaped_lines(self):
        """A heading "Faculty CVs" followed by ONE name line and then
        prose should NOT trip a sub-TOC — that's just a regular CV
        body section, not a sub-TOC."""
        html = (
            "<html><body>"
            "<h2>Faculty CVs</h2>"
            "<p>John Rosicky</p>"
            "<p>1051 Omar Drive, Crownsville, MD 21032. EDUCATION 1990 "
            "University of Maryland B.A. Sociology. This is body content "
            "of a CV not a sub-TOC because there are no page-number "
            "trailers and this paragraph is long enough to count as prose.</p>"
            "</body></html>"
        ).encode("utf-8")
        entries = parse_sub_tocs(html)
        assert entries == []


class TestEndToEnd:
    def test_stevenson_like_html_yields_three_cvs_from_toc(self):
        """With NO pattern detections, the TOC-anchored pass alone must
        recover all three CVs (John, Thomas, Lauri) from the body —
        which is the scenario the redetect button hits when the pattern
        anchor heuristic fails on a real document."""
        toc_entries = parse_toc(_STEVENSON_LIKE_FULL_HTML)
        toc_detections = anchor_in_body(_STEVENSON_LIKE_FULL_HTML, toc_entries)
        merged_cvs = merge_cv_detections([], toc_detections)
        cv_names = {m["facultyName"] for m in merged_cvs}
        assert "John Rosicky" in cv_names
        assert "Thomas K. Swisher, J.D., Ph.D." in cv_names
        assert "LAURI A. WEINER, HS-BCP" in cv_names

    def test_stevenson_real_shape_main_toc_includes_standard_entries(self):
        """Real Stevenson-class self-studies list "Standard 1 –
        Institutional Requirements..." as TOC ENTRIES (not body
        sections). Earlier draft of parse_toc bailed at the first
        Standard line, never reaching the appendix entries deeper
        in the TOC. This test pins the fix.
        """
        html = (
            "<html><body>"
            "<h1>Table of Contents</h1>"
            "<p>Certification of the Self-Study ............ 4</p>"
            "<p>Appendices (List of Supporting Documents) ............ 112</p>"
            "<p>Course Syllabi and Materials ............ 114</p>"
            "<p>Introductory Information ............ 5</p>"
            "<p>Glossary of Terms ............ 13</p>"
            "<p>Part I: General Program Characteristics</p>"
            "<p>Standard 1 - Institutional Requirements and Primary Program Objective ............ 14</p>"
            "<p>Standard 2 - Philosophical Base of Program ............ 17</p>"
            "<p>Standard 6 - Personnel ............ 80</p>"
            "<p>Faculty CVs</p>"
            "<p>John Rosicky ............ 100</p>"
            "<p>Thomas K. Swisher, J.D., Ph.D. ............ 140</p>"
            "<p>LAURI A. WEINER, HS-BCP ............ 150</p>"
            "<h2>Introduction</h2>"
            "<p>This long body paragraph marks where the table of contents "
            "actually ends and the body prose begins. It is long enough "
            "to trip the 200-character prose gate so the parser stops "
            "walking entries here rather than further down.</p>"
            "</body></html>"
        ).encode("utf-8")
        entries = parse_toc(html)
        labels = [e.label for e in entries]
        # Standards line up — they're ENTRIES, not body markers.
        assert any("Standard 1" in l for l in labels)
        assert any("Standard 2" in l for l in labels)
        assert any("Standard 6" in l for l in labels)
        # CV entries DEEPER in the same TOC must also be parsed.
        assert "John Rosicky" in labels
        assert "Thomas K. Swisher, J.D., Ph.D." in labels
        assert "LAURI A. WEINER, HS-BCP" in labels

    def test_routing_source_marked_as_toc(self):
        """Detections added by the TOC path carry routing.source='toc' so
        the wizard UI can show the provenance badge — useful for the
        coordinator to see which detections came from pattern matching
        vs which were recovered from the TOC."""
        toc_entries = parse_toc(_STEVENSON_LIKE_FULL_HTML)
        toc_detections = anchor_in_body(_STEVENSON_LIKE_FULL_HTML, toc_entries)
        merged = merge_cv_detections([], toc_detections)
        for m in merged:
            assert m["routing"]["source"] == "toc"

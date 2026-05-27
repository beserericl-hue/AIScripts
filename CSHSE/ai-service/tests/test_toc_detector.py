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

    def test_plain_name_fallback_to_cv(self):
        assert _classify_entry("John Rosicky", None) == "cv"
        assert _classify_entry("Thomas K. Swisher, J.D., Ph.D.", None) == "cv"
        assert _classify_entry("LAURI A. WEINER", None) == "cv"

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

"""A template Standard ROOT row with only CSHSE's standard statement (heading,
no body) must not become an Introduction draft; one with program text must."""
from types import SimpleNamespace as NS

from app.import_jobs import _section_has_body


def sec(markdown="", html=None):
    return NS(markdown=markdown, html_snippet=html, heading="Standard 4: The program shall…")


def test_heading_only_section_has_no_body():
    assert not _section_has_body(sec(""))
    assert not _section_has_body(sec("# Standard 4: The program shall…"))
    assert not _section_has_body(sec("", "<p></p>"))
    assert not _section_has_body(sec("", "<p>&nbsp;</p>"))


def test_section_with_program_text_or_table_has_body():
    assert _section_has_body(sec("# Standard 4\nOur program evaluates itself every year."))
    assert _section_has_body(sec("", "<p>Our program evaluates itself.</p>"))
    assert _section_has_body(sec("", "<table><tr><td></td></tr></table>"))

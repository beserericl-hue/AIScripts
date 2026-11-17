"""Kennesaw State 2026-11-17 regressions for the AI reviewers.

1. Data shown in pictures (charts / tables pasted as images) must reach the
   reviewer as attached figures — 1.e race/ethnicity/age/gender charts were
   reported "not provided".
2. Long narratives must be sent whole — 7.c (~11.7k chars) was cut at 3k and
   reported "cuts off mid-sentence".
3. Conditional specs ("If the program is less than five years old…") must be
   judged not-applicable when the condition doesn't hold — 3.a.
"""
from __future__ import annotations

import base64
import io
from types import SimpleNamespace

from PIL import Image

from app.figures import narrative_text_and_figures, split_figures


def _png(w: int, h: int, color=(200, 30, 30)) -> str:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _bmp(w: int, h: int) -> str:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 120, 200)).save(buf, format="BMP")
    return base64.b64encode(buf.getvalue()).decode()


CHART = _png(400, 240)
ICON = _png(8, 8)


class _FakeMessages:
    def __init__(self, reply: str):
        self.calls: list[dict] = []
        self._reply = reply

    def create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=self._reply)])


class _FakeClient:
    def __init__(self, reply: str):
        self.messages = _FakeMessages(reply)


def _blocks(call: dict):
    content = call["messages"][0]["content"]
    return content if isinstance(content, list) else [{"type": "text", "text": content}]


def _prompt_text(call: dict) -> str:
    return "\n".join(b["text"] for b in _blocks(call) if b["type"] == "text")


# --------------------------------------------------------------------------- figures


def test_split_figures_attaches_chart_and_marks_its_position():
    html = (
        "<p>Race and Ethnicity: see graph below.</p>"
        f'<p><img src="data:image/png;base64,{CHART}" alt="Awards by race"></p>'
        "<p>Source USG Awards.</p>"
    )
    text, figs = split_figures(html)
    assert len(figs) == 1 and figs[0].index == 1 and figs[0].media_type == "image/png"
    assert "[Figure 1: Awards by race — attached as an image]" in text
    assert text.index("Race and Ethnicity") < text.index("[Figure 1") < text.index("Source USG")
    assert "base64" not in text and "<" not in text


def test_split_figures_drops_tiny_icons_negative():
    text, figs = split_figures(f'<p>Bullet <img src="data:image/png;base64,{ICON}"> item</p>')
    assert figs == [] and "Figure" not in text and "Bullet" in text


def test_split_figures_converts_unsupported_format_to_png():
    _, figs = split_figures(f'<img src="data:image/bmp;base64,{_bmp(300, 200)}">')
    assert len(figs) == 1 and figs[0].media_type == "image/png"


def test_plain_text_passthrough_negative():
    text, figs = split_figures("Just text, no markup.")
    assert text == "Just text, no markup." and figs == []


def test_narrative_items_number_figures_across_items():
    items = [
        {"snippet": "a", "htmlSnippet": f'<p>one</p><img src="data:image/png;base64,{CHART}">'},
        {"snippet": "plain second item"},
        {"snippet": "c", "htmlSnippet": f'<p>three</p><img src="data:image/png;base64,{CHART}">'},
    ]
    text, figs = narrative_text_and_figures(items)
    assert [f.index for f in figs] == [1, 2]
    assert "[Figure 2 — attached" in text and "plain second item" in text


# --------------------------------------------------------------------------- coverage reviewer


def _spec(code="1", sp="e", text="Describe the student population including the number, gender, race, ethnicity and age of students."):
    from app.standards.loader import Specification

    return Specification(standard_code=code, spec_code=sp, standard_title="T", spec_text=text, program_level="bachelors")


def _reviewer(reply='{"is_covered": true, "coverage_score": 0.9, "gaps": [], "strengths": ["ok"], "suggestion": ""}'):
    from app.coverage.spec_coverage import CoverageReviewer

    r = CoverageReviewer.__new__(CoverageReviewer)
    r._client = _FakeClient(reply)
    r._model = "test"
    return r


def test_coverage_review_attaches_figures(monkeypatch):
    import app.coverage.spec_coverage as sc

    monkeypatch.setattr(sc, "_scrape_narrative_links", lambda t: [])
    items = [{"snippet": "x", "htmlSnippet": f'<p>Race and Ethnicity:</p><img src="data:image/png;base64,{CHART}">'}]
    text, figs = narrative_text_and_figures(items)
    rv = _reviewer()
    rv.review(_spec(), text, [], figures=figs)
    call = rv._client.messages.calls[0]
    kinds = [b["type"] for b in _blocks(call)]
    assert kinds.count("image") == 1
    assert "FIGURES:" in _prompt_text(call) and "Figure 1" in _prompt_text(call)


def test_coverage_review_without_figures_sends_plain_prompt_negative(monkeypatch):
    import app.coverage.spec_coverage as sc

    monkeypatch.setattr(sc, "_scrape_narrative_links", lambda t: [])
    rv = _reviewer()
    rv.review(_spec(), "Plain narrative.", [])
    call = rv._client.messages.calls[0]
    assert isinstance(call["messages"][0]["content"], str)
    assert "FIGURES:" not in call["messages"][0]["content"]


def test_coverage_review_sends_whole_long_narrative(monkeypatch):
    import app.coverage.spec_coverage as sc

    monkeypatch.setattr(sc, "_scrape_narrative_links", lambda t: [])
    long = ("Faculty evaluation detail. " * 450) + "ANNUAL REVIEW END MARKER"  # ~12k chars
    assert len(long) > 11000
    rv = _reviewer()
    rv.review(_spec("7", "c", "Describe the process for faculty and staff evaluation."), long, [])
    assert "ANNUAL REVIEW END MARKER" in _prompt_text(rv._client.messages.calls[0])


def test_coverage_prompt_has_conditional_rule(monkeypatch):
    import app.coverage.spec_coverage as sc

    monkeypatch.setattr(sc, "_scrape_narrative_links", lambda t: [])
    rv = _reviewer()
    rv.review(_spec("3", "a", "If the program is less than five years old, provide documentation…"), "Program established in 1999.", [])
    assert "CONDITIONAL SPECIFICATIONS" in _prompt_text(rv._client.messages.calls[0])


def test_review_specs_threads_figures_through(monkeypatch):
    import app.coverage.spec_coverage as sc

    seen = {}

    def fake_review(self, spec, narrative_text, evidence_items=None, library_file_names=None,
                    institution_id=None, submission_id=None, figures=None):
        seen[(spec.standard_code, spec.spec_code)] = len(figures or [])
        return sc.CoverageReview(spec.standard_code, spec.spec_code, True, 1.0, [], [], "", "")

    monkeypatch.setattr(sc.CoverageReviewer, "review", fake_review)
    monkeypatch.setattr(sc.CoverageReviewer, "__init__", lambda self, *a, **k: None)
    _, figs = split_figures(f'<img src="data:image/png;base64,{CHART}">')
    sc.review_specs("bachelors", "k", [
        {"standard_code": "1", "spec_code": "e", "narrative_text": "t", "figures": figs},
        {"standard_code": "1", "spec_code": "a", "narrative_text": "t"},
    ])
    assert seen[("1", "e")] == 1 and seen[("1", "a")] == 0


# --------------------------------------------------------------------------- section evaluator


_EVAL_REPLY = '{"verdict": "pass", "rationale": "ok", "criteriaCoverage": [], "improvementSuggestions": []}'


def test_section_eval_attaches_figures_and_strips_base64():
    from app.section_eval.evaluate import evaluate_section

    client = _FakeClient(_EVAL_REPLY)
    html = f'<p>Race and Ethnicity:</p><p><img src="data:image/png;base64,{CHART}"></p><p>Source.</p>'
    evaluate_section(institution_id="i", submission_id="", specs=[{"standardCode": "1", "specCode": "e", "criteria": "c"}],
                     narrative_html=html, anthropic=client, settings=SimpleNamespace(anthropic_api_key="x"))
    call = client.messages.calls[0]
    assert [b["type"] for b in _blocks(call)].count("image") == 1
    txt = _prompt_text(call)
    assert "[Figure 1 — attached as an image]" in txt and CHART[:40] not in txt and "<img" not in txt


def test_section_eval_sends_whole_long_narrative():
    from app.section_eval.evaluate import evaluate_section

    client = _FakeClient(_EVAL_REPLY)
    html = "<p>" + ("Faculty evaluation detail. " * 450) + "ANNUAL REVIEW END MARKER</p>"
    evaluate_section(institution_id="i", submission_id="", specs=[{"standardCode": "7", "specCode": "c", "criteria": "c"}],
                     narrative_html=html, anthropic=client, settings=SimpleNamespace(anthropic_api_key="x"))
    txt = _prompt_text(client.messages.calls[0])
    assert "ANNUAL REVIEW END MARKER" in txt
    assert "Reply with STRICT JSON only" in txt  # JSON instructions never truncated
    assert "CONDITIONAL SPECIFICATIONS" in txt


def test_section_eval_plain_narrative_unchanged_negative():
    from app.section_eval.evaluate import evaluate_section

    client = _FakeClient(_EVAL_REPLY)
    evaluate_section(institution_id="i", submission_id="", specs=[{"standardCode": "2", "specCode": "a", "criteria": "c"}],
                     narrative_html="<p>Short answer.</p>", anthropic=client, settings=SimpleNamespace(anthropic_api_key="x"))
    call = client.messages.calls[0]
    assert isinstance(call["messages"][0]["content"], str) and "FIGURES:" not in call["messages"][0]["content"]


# --------------------------------------------------------------------------- whole narrative, data mid/late


def _big_narrative() -> str:
    filler = "Program narrative context sentence. " * 1700  # ~61k chars
    return "START MARKER. " + filler + " MIDDLE DATA MARKER: 71.4 percent retention. " + filler + " END DATA MARKER: 62 graduates."


def test_coverage_reads_entire_120k_narrative(monkeypatch):
    import app.coverage.spec_coverage as sc

    monkeypatch.setattr(sc, "_scrape_narrative_links", lambda t: [])
    big = _big_narrative()
    assert len(big) > 120_000
    rv = _reviewer()
    rv.review(_spec("13", "a", "x"), big, [])
    txt = _prompt_text(rv._client.messages.calls[0])
    for m in ("START MARKER", "MIDDLE DATA MARKER", "END DATA MARKER"):
        assert m in txt, m


def test_section_eval_reads_entire_120k_narrative():
    from app.section_eval.evaluate import evaluate_section

    client = _FakeClient(_EVAL_REPLY)
    evaluate_section(institution_id="i", submission_id="", specs=[{"standardCode": "13", "specCode": "a", "criteria": "c"}],
                     narrative_html="<p>" + _big_narrative() + "</p>", anthropic=client,
                     settings=SimpleNamespace(anthropic_api_key="x"))
    txt = _prompt_text(client.messages.calls[0])
    for m in ("START MARKER", "MIDDLE DATA MARKER", "END DATA MARKER", "Reply with STRICT JSON only"):
        assert m in txt, m


def test_short_snippet_replaced_by_full_html_text():
    full = "Opening. " + ("detail " * 2000) + "LATE FACT: 607 students changed majors."
    items = [{"snippet": full[:4000], "htmlSnippet": f"<p>{full}</p>"}]
    text, _ = narrative_text_and_figures(items)
    assert "LATE FACT" in text


def test_thin_html_never_replaces_fuller_snippet_negative():
    snip = "Full narrative text " * 200
    text, _ = narrative_text_and_figures([{"snippet": snip, "htmlSnippet": "<p>Heading only</p>"}])
    assert text.startswith("Full narrative text")


def test_cited_links_survive_html_to_text():
    items = [{"snippet": "see catalog", "htmlSnippet": '<p>See the <a href="https://catalog.kennesaw.edu/x?a=1&amp;b=2">catalog</a>.</p>'}]
    text, _ = narrative_text_and_figures(items)
    assert "Cited web links: https://catalog.kennesaw.edu/x?a=1&b=2" in text


# --------------------------------------------------------------------------- spec text hygiene


def test_catalog_has_no_leaked_next_standard_context():
    from app.standards.loader import load_specifications

    counts = {}
    for lvl in ("associate", "bachelors", "masters"):
        specs = load_specifications(lvl)
        counts[lvl] = len(specs)
        for s in specs:
            assert "Context:" not in s.spec_text, (lvl, s.standard_code, s.spec_code)
            assert not s.spec_text.endswith("(available at"), (lvl, s.standard_code, s.spec_code)
    assert counts == {"associate": 86, "bachelors": 96, "masters": 87}
    b = {(s.standard_code, s.spec_code): s.spec_text for s in load_specifications("bachelors")}
    assert b[("18", "e")] == "Budget and financial management."
    assert b[("19", "h")].endswith("(available at https://www.nationalhumanservices.org/ethical-standards-for-hsprofessionals).")


def test_clean_spec_text_leaves_normal_text_alone_negative():
    from app.standards.loader import clean_spec_text

    t = "Provide syllabi for required seminars. Seminars must meet at least every two weeks."
    assert clean_spec_text(t) == t
    t2 = "Describe 1. intake and 2. assessment skills."  # numbered list, no 'Context:'
    assert clean_spec_text(t2) == t2


def test_section_eval_strips_leaked_context_from_criteria():
    from app.section_eval.evaluate import evaluate_section

    client = _FakeClient(_EVAL_REPLY)
    crit = "Budget and financial management. 9. Client-Related Values and Attitudes Context: There are values and ethics intrinsic to the profession."
    evaluate_section(institution_id="i", submission_id="", specs=[{"standardCode": "18", "specCode": "e", "criteria": crit}],
                     narrative_html="<p>Budget course HS 4400.</p>", anthropic=client, settings=SimpleNamespace(anthropic_api_key="x"))
    txt = _prompt_text(client.messages.calls[0])
    assert "Budget and financial management." in txt and "Client-Related Values" not in txt

"""CR-049 Phase 1 — section evaluator unit tests.

Tests the pure helpers (html→text, evaluable classification, response parse)
and evaluate_section with an injected fake Anthropic client (no network, no
real LLM), mirroring app/evidence tests.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

from app.config import Settings
from app.section_eval.scrape import (
    html_to_text,
    classify_evaluable,
    scrape_link,
    LinkResult,
    MIN_EVALUABLE_CHARS,
)
from app.section_eval.evaluate import _parse_response, evaluate_section


# --- scrape: html_to_text -------------------------------------------------

def test_html_to_text_strips_tags_and_chrome():
    html = "<html><head><style>x{}</style></head><body><nav>menu</nav>"
    html += "<p>Real <b>content</b> here.</p><script>evil()</script></body></html>"
    out = html_to_text(html)
    assert "Real content here." in out
    assert "evil" not in out and "menu" not in out and "x{}" not in out


def test_html_to_text_empty():
    assert html_to_text("") == ""
    assert html_to_text("   ") == ""


# --- scrape: classify_evaluable ------------------------------------------

def test_classify_image_is_needs_human_review():
    res = classify_evaluable("image/png", "")
    assert res.evaluable is False
    assert "non-text" in res.reason


def test_classify_short_text_needs_review():
    res = classify_evaluable("text/html", "too short")
    assert res.evaluable is False
    assert "no readable text" in res.reason


def test_classify_good_text_is_evaluable():
    text = "x" * (MIN_EVALUABLE_CHARS + 10)
    res = classify_evaluable("text/html; charset=utf-8", text)
    assert res.evaluable is True
    assert res.text == text


# --- scrape_link with an injected client ----------------------------------

class _FakeResp:
    def __init__(self, text: str, content_type: str):
        self.text = text
        self.headers = {"content-type": content_type}


class _FakeClient:
    def __init__(self, resp=None, raise_exc=None):
        self._resp = resp
        self._raise = raise_exc

    def get(self, url):
        if self._raise:
            raise self._raise
        return self._resp


def test_scrape_link_text_page_evaluable():
    body = "<p>" + ("Faculty governance policy. " * 20) + "</p>"
    res = scrape_link("https://x.edu/policy", client=_FakeClient(_FakeResp(body, "text/html")))
    assert res.url == "https://x.edu/policy"
    assert res.evaluable is True
    assert "Faculty governance" in res.text


def test_scrape_link_image_needs_review():
    res = scrape_link("https://x.edu/orgchart.png", client=_FakeClient(_FakeResp("", "image/png")))
    assert res.evaluable is False
    assert "non-text" in res.reason


def test_scrape_link_fetch_error_degrades_to_review():
    res = scrape_link("https://x.edu/down", client=_FakeClient(raise_exc=RuntimeError("boom")))
    assert res.evaluable is False
    assert "could not fetch" in res.reason


def test_scrape_link_empty_url():
    res = scrape_link("")
    assert res.evaluable is False
    assert res.reason == "empty url"


# --- evaluate: _parse_response --------------------------------------------

def test_parse_response_strict_json():
    raw = json.dumps({
        "verdict": "pass",
        "rationale": "meets criteria",
        "criteriaCoverage": [{"criterion": "c1", "met": True, "note": "ok"}],
        "improvementSuggestions": [],
    })
    out = _parse_response(raw)
    assert out["verdict"] == "pass"
    assert out["criteriaCoverage"][0]["criterion"] == "c1"


def test_parse_response_extracts_from_prose():
    raw = 'Here you go: {"verdict": "fail", "rationale": "missing"} thanks'
    out = _parse_response(raw)
    assert out["verdict"] == "fail"


def test_parse_response_invalid_verdict_defaults_to_needs_improvement():
    out = _parse_response('{"verdict": "banana", "rationale": "x"}')
    assert out["verdict"] == "needs_improvement"


def test_parse_response_garbage_fail_soft():
    out = _parse_response("totally not json")
    assert out["verdict"] == "needs_improvement"
    assert "could not parse" in out["rationale"].lower()


def test_parse_response_empty():
    out = _parse_response("")
    assert out["verdict"] == "needs_improvement"


# --- evaluate_section with a fake Anthropic client ------------------------

class _FakeAnthropic:
    """Returns a canned verdict per call; records the prompt for assertions."""
    def __init__(self, verdict="pass"):
        self._verdict = verdict
        self.prompts: list[str] = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, *, model, max_tokens, messages):
        self.prompts.append(messages[0]["content"])
        payload = json.dumps({
            "verdict": self._verdict,
            "rationale": "canned",
            "criteriaCoverage": [],
            "improvementSuggestions": ["do x"],
        })
        return SimpleNamespace(content=[SimpleNamespace(text=payload)])


def test_evaluate_section_single_spec():
    fake = _FakeAnthropic(verdict="pass")
    out = evaluate_section(
        institution_id="inst-1",
        submission_id="sub-1",
        specs=[{"standardCode": "1", "specCode": "a", "criteria": "Program is regionally accredited."}],
        narrative_html="<p>We are accredited by MSCHE.</p>",
        supporting_evidence_text=["Accreditation letter excerpt."],
        anthropic=fake,
        settings=Settings(anthropic_api_key="test"),
    )
    assert len(out["perSpec"]) == 1
    row = out["perSpec"][0]
    assert row["verdict"] == "pass"
    assert row["standardCode"] == "1" and row["specCode"] == "a"
    assert row["sourcesUsed"]["narrative"] is True
    assert row["sourcesUsed"]["evidence"] == 1
    # criteria text made it into the prompt
    assert "regionally accredited" in fake.prompts[0]


def test_evaluate_section_many_specs():
    fake = _FakeAnthropic(verdict="needs_improvement")
    out = evaluate_section(
        institution_id="inst-1",
        submission_id="sub-1",
        specs=[
            {"standardCode": "1", "specCode": "a", "criteria": "c1"},
            {"standardCode": "2", "specCode": "c", "criteria": "c2"},
        ],
        narrative_html="<p>text</p>",
        anthropic=fake,
        settings=Settings(anthropic_api_key="test"),
    )
    assert len(out["perSpec"]) == 2
    assert all(r["verdict"] == "needs_improvement" for r in out["perSpec"])


def test_evaluate_section_flags_unevaluable_link_for_review():
    fake = _FakeAnthropic(verdict="pass")

    def fake_scrape(url):
        return LinkResult(url=url, evaluable=False, reason="non-text content (image/png) — open to review")

    out = evaluate_section(
        institution_id="inst-1",
        submission_id="sub-1",
        specs=[{"standardCode": "3", "specCode": "a", "criteria": "org structure"}],
        narrative_html="<p>See org chart.</p>",
        web_links=["https://x.edu/orgchart.png"],
        anthropic=fake,
        settings=Settings(anthropic_api_key="test"),
        scrape_fn=fake_scrape,
    )
    row = out["perSpec"][0]
    # link surfaced for human review, not failed
    assert row["sourcesUsed"]["linksNeedingReview"] == ["https://x.edu/orgchart.png"]
    assert out["links"][0]["evaluable"] is False
    # the prompt told the model the link is not text-evaluable
    assert "NOT TEXT-EVALUABLE" in fake.prompts[0]


def test_evaluate_section_no_api_key_degrades():
    out = evaluate_section(
        institution_id="inst-1",
        submission_id="sub-1",
        specs=[{"standardCode": "1", "specCode": "a", "criteria": "c"}],
        narrative_html="<p>x</p>",
        anthropic=None,
        settings=Settings(anthropic_api_key=""),
    )
    row = out["perSpec"][0]
    assert row["verdict"] == "needs_improvement"
    assert "degraded" in row["rationale"]


def test_evaluate_section_requires_institution():
    try:
        evaluate_section(institution_id="", submission_id="s", specs=[])
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_evaluate_section_injects_correction_hints_into_prompt():
    # CR-049 Phase 4b — prior reader-override hints are surfaced to the
    # evaluator (the learning loop's read side).
    fake = _FakeAnthropic(verdict="pass")
    calls: list[tuple[str, str]] = []

    def hints_fn(std: str, spec: str) -> str:
        calls.append((std, spec))
        return "Previously-corrected: reader marked 1.a as pass despite a non-text org-chart link."

    evaluate_section(
        institution_id="inst-1",
        submission_id="sub-1",
        specs=[{"standardCode": "1", "specCode": "a", "criteria": "org structure"}],
        narrative_html="<p>See org chart.</p>",
        anthropic=fake,
        settings=Settings(anthropic_api_key="test"),
        hints_fn=hints_fn,
    )
    assert calls == [("1", "a")]
    assert "Previously-corrected: reader marked 1.a as pass" in fake.prompts[0]


def test_evaluate_section_hints_fn_failure_is_swallowed():
    fake = _FakeAnthropic(verdict="pass")

    def boom(std, spec):
        raise RuntimeError("qdrant down")

    out = evaluate_section(
        institution_id="inst-1",
        submission_id="sub-1",
        specs=[{"standardCode": "1", "specCode": "a", "criteria": "c"}],
        narrative_html="<p>x</p>",
        anthropic=fake,
        settings=Settings(anthropic_api_key="test"),
        hints_fn=boom,
    )
    # eval still completes despite the hint retrieval failing
    assert out["perSpec"][0]["verdict"] == "pass"

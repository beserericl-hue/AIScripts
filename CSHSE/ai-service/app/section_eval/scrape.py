"""CR-049 — web-link scraping for section evaluation.

User direction (2026-05-29): a supporting-evidence web link is fetched, its
HTML is stripped to raw text, and that text is judged against the standard's
evidence criteria. Pages that aren't text-evaluable (an org chart, an image,
a diagram, a login wall) are NOT failed — they're flagged
``needs_human_review`` so a reader can open them and judge visually.

Design notes:
- Raw fetch + readability extraction only; **no headless browser** in v1.
- The pure helpers (:func:`html_to_text`, :func:`classify_evaluable`) carry
  the logic and are unit-tested without the network; :func:`scrape_link`
  is the thin networked wrapper.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from bs4 import BeautifulSoup

# Caps so one bad link can't blow the evaluation budget.
DEFAULT_TIMEOUT_S = 10.0
MAX_TEXT_CHARS = 6000
# Below this, a page is treated as "no readable text" → needs_human_review.
MIN_EVALUABLE_CHARS = 80

# Content types we can't read as text — flag for human review, don't fail.
_NON_TEXT_PREFIXES = ("image/", "video/", "audio/", "font/")
_NON_TEXT_TYPES = {
    "application/pdf",  # evidence PDFs go through the file path, not the link path
    "application/octet-stream",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
}


@dataclass
class LinkResult:
    url: str
    evaluable: bool
    text: str = ""
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "evaluable": self.evaluable,
            "text": self.text,
            "reason": self.reason,
        }


def html_to_text(html: str) -> str:
    """Strip HTML to readable plain text.

    Drops script/style/nav/footer chrome, collapses whitespace, and caps
    length. Returns "" for empty/whitespace-only input.
    """
    if not html or not html.strip():
        return ""
    soup = BeautifulSoup(html, "html.parser")
    # Drop scripts/styles + common page chrome so the evaluator sees content,
    # not the site's nav/footer boilerplate.
    for tag in soup(["script", "style", "noscript", "template", "svg", "nav", "footer", "aside", "header"]):
        tag.decompose()
    text = soup.get_text(separator=" ")
    # Collapse runs of whitespace to single spaces, trim.
    text = " ".join(text.split())
    return text[:MAX_TEXT_CHARS]


def classify_evaluable(content_type: Optional[str], text: str) -> LinkResult:
    """Decide whether a fetched page can be evaluated as text.

    Non-text content types (images, video, binaries) and pages with too
    little readable text are flagged ``needs_human_review`` rather than
    scored — e.g. an org-chart image a reader should open directly.
    The ``url`` is filled in by the caller.
    """
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct:
        if any(ct.startswith(p) for p in _NON_TEXT_PREFIXES) or ct in _NON_TEXT_TYPES:
            return LinkResult(url="", evaluable=False, reason=f"non-text content ({ct}) — open to review")
    if len((text or "").strip()) < MIN_EVALUABLE_CHARS:
        return LinkResult(url="", evaluable=False, reason="no readable text on the page — open to review")
    return LinkResult(url="", evaluable=True, text=text)


def scrape_link(url: str, *, timeout: float = DEFAULT_TIMEOUT_S, client=None) -> LinkResult:
    """Fetch ``url``, strip to text, and classify.

    Network failures degrade gracefully to ``needs_human_review`` (the link
    is never auto-failed on a fetch error). ``client`` is an injectable
    httpx-like client for testing.
    """
    if not url or not str(url).strip():
        return LinkResult(url=url or "", evaluable=False, reason="empty url")

    owns_client = client is None
    try:
        if client is None:
            import httpx  # local import keeps the module import-light

            client = httpx.Client(timeout=timeout, follow_redirects=True)
        resp = client.get(url)
        content_type = resp.headers.get("content-type", "")
        body = resp.text or ""
    except Exception as exc:  # noqa: BLE001 — any fetch failure → human review
        return LinkResult(url=url, evaluable=False, reason=f"could not fetch ({type(exc).__name__}) — open to review")
    finally:
        if owns_client and client is not None and hasattr(client, "close"):
            try:
                client.close()
            except Exception:  # noqa: BLE001
                pass

    text = html_to_text(body)
    result = classify_evaluable(content_type, text)
    result.url = url
    return result

"""CR-049 — AI section evaluation against the reader-review criteria.

Evaluates a whole self-study section (narrative + supporting-evidence text +
submitted files + scraped web links) against the CSHSE rubric criteria and
returns a per-spec verdict (pass / needs_improvement / fail) + rationale.

Replaces the n8n validation webhook. Reuses the CR-018 evidence building
blocks; adds a web-link scraper. The reader-side override → learning loop
feeds the existing corrections RAG store (separate phase).
"""
from app.section_eval.evaluate import evaluate_section
from app.section_eval.scrape import html_to_text, classify_evaluable, scrape_link

__all__ = ["evaluate_section", "html_to_text", "classify_evaluable", "scrape_link"]

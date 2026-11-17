"""Embedded figures (charts, graphs, pictures of tables) in narrative HTML.

Self-studies often put required data in pictures — e.g. a race/ethnicity bar
chart for spec 1.e. The narrative ``snippet`` is text-only, so the AI reviewers
used to never see that data and reported it "not provided" (Kennesaw State,
2026-11-17). This module splits narrative HTML into:

  * plain text with a ``[Figure N]`` marker where each picture sat, and
  * the pictures themselves, ready to attach as Claude image blocks so the
    reviewer can read the chart/table contents.

Only inline ``data:image/...;base64`` pictures can be attached (that is how the
importer embeds document images). Formats Claude can't read directly (EMF/TIFF/
BMP…) are converted to PNG with Pillow when possible; anything unreadable keeps
its marker with a note so the reviewer knows a figure exists.
"""
from __future__ import annotations

import base64
import html as _html
import io
import re
from dataclasses import dataclass

# Claude accepts these media types directly.
_SUPPORTED = {"image/png", "image/jpeg", "image/gif", "image/webp"}
MAX_FIGURES = 8                 # per spec — bounds cost/latency
_MAX_SIDE = 1568                # Claude downsizes beyond this anyway
_MAX_B64_BYTES = 3_500_000      # well under the 5 MB per-image API limit
_MIN_SIDE = 40                  # skip spacer pixels / tiny bullets / icons

_IMG_RE = re.compile(r"<img\b[^>]*?>", re.IGNORECASE | re.DOTALL)
_SRC_RE = re.compile(r"""src\s*=\s*(["'])(.*?)\1""", re.IGNORECASE | re.DOTALL)
_DATA_RE = re.compile(r"^data:(image/[a-z0-9.+-]+);base64,(.*)$", re.IGNORECASE | re.DOTALL)
_ALT_RE = re.compile(r"""alt\s*=\s*(["'])(.*?)\1""", re.IGNORECASE | re.DOTALL)
_BLOCK_RE = re.compile(r"</?(p|div|br|li|tr|h[1-6]|table|ul|ol|section|blockquote)\b[^>]*>", re.IGNORECASE)
_CELL_RE = re.compile(r"</t[dh]\s*>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class Figure:
    index: int          # 1-based, matches the [Figure N] marker
    media_type: str
    data: str           # base64 (no data: prefix)


def _normalize(media_type: str, b64: str) -> tuple[str, str] | None:
    """Return a (media_type, base64) Claude can read, resized if large; None
    when the picture is unreadable or too small to carry information."""
    mt = media_type.lower().replace("image/jpg", "image/jpeg")
    try:
        raw = base64.b64decode(re.sub(r"\s+", "", b64), validate=False)
    except Exception:  # noqa: BLE001
        return None
    if not raw:
        return None
    try:
        from PIL import Image  # Pillow ships in the ai-service image
    except Exception:  # noqa: BLE001 — no Pillow: pass supported types through
        enc = base64.b64encode(raw).decode()
        return (mt, enc) if mt in _SUPPORTED and len(enc) <= _MAX_B64_BYTES else None
    try:
        im = Image.open(io.BytesIO(raw))
        im.load()
    except Exception:  # noqa: BLE001 — e.g. EMF Pillow can't rasterize
        enc = base64.b64encode(raw).decode()
        return (mt, enc) if mt in _SUPPORTED and len(enc) <= _MAX_B64_BYTES else None
    w, h = im.size
    if w < _MIN_SIDE or h < _MIN_SIDE:
        return None
    needs_resize = max(w, h) > _MAX_SIDE
    if mt in _SUPPORTED and not needs_resize and len(raw) * 4 / 3 <= _MAX_B64_BYTES:
        return mt, base64.b64encode(raw).decode()
    if needs_resize:
        scale = _MAX_SIDE / float(max(w, h))
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))))
    if im.mode not in ("RGB", "RGBA", "L"):
        im = im.convert("RGBA")
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    enc = base64.b64encode(buf.getvalue()).decode()
    if len(enc) > _MAX_B64_BYTES:
        buf = io.BytesIO()
        im.convert("RGB").save(buf, format="JPEG", quality=80)
        enc = base64.b64encode(buf.getvalue()).decode()
        mt = "image/jpeg"
    else:
        mt = "image/png"
    return (mt, enc) if len(enc) <= _MAX_B64_BYTES else None


def html_to_text(html: str) -> str:
    """Tags → text, keeping paragraph/row/cell structure readable."""
    t = _BLOCK_RE.sub("\n", html)
    t = _CELL_RE.sub(" | ", t)
    t = _TAG_RE.sub("", t)
    t = _html.unescape(t)
    t = re.sub(r"[ \t ]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n\n", t)
    return t.strip()


def split_figures(html: str, start_index: int = 1, max_figures: int = MAX_FIGURES) -> tuple[str, list[Figure]]:
    """Split narrative HTML into (text with [Figure N] markers, figures).

    Plain text input (no tags) is returned unchanged with no figures. Pictures
    beyond ``max_figures`` keep a marker noting they were not attached.
    """
    if not html:
        return "", []
    if "<" not in html:
        return html, []
    figures: list[Figure] = []
    counter = [start_index]

    def _sub(m: re.Match) -> str:
        tag = m.group(0)
        src_m = _SRC_RE.search(tag)
        alt_m = _ALT_RE.search(tag)
        alt = _html.unescape(alt_m.group(2)).strip() if alt_m else ""
        data_m = _DATA_RE.match(src_m.group(2).strip()) if src_m else None
        if not data_m:
            # Linked (non-inline) picture: can't attach, but say it exists.
            return f"\n[Figure (linked image{': ' + alt if alt else ''}) — not readable by the reviewer]\n"
        norm = _normalize(data_m.group(1), data_m.group(2))
        if norm is None:
            return ""  # spacer/icon/unreadable — not meaningful content
        n = counter[0]
        counter[0] += 1
        label = f"Figure {n}" + (f": {alt}" if alt else "")
        if len(figures) >= max_figures:
            return f"\n[{label} — not attached (figure limit reached)]\n"
        figures.append(Figure(index=n, media_type=norm[0], data=norm[1]))
        return f"\n[{label} — attached as an image]\n"

    text = _IMG_RE.sub(_sub, html)
    return html_to_text(text), figures


_HREF_RE = re.compile(r"""href\s*=\s*(["'])(https?://.*?)\1""", re.IGNORECASE)


def narrative_text_and_figures(narratives: list[dict], max_figures: int = MAX_FIGURES) -> tuple[str, list[Figure]]:
    """Join a bucket's narrative items (``{snippet, htmlSnippet}``) into one
    text + figure list covering the WHOLE narrative.

    ``htmlSnippet`` is preferred whenever present: it is the complete section
    (some pipelines stored a shortened text ``snippet``) and keeps each
    picture's position. Cited web links (``href``) are appended so the reviewer
    can still fetch them once the markup is stripped. Falls back to ``snippet``.
    """
    parts: list[str] = []
    figs: list[Figure] = []
    links: list[str] = []
    for n in narratives or []:
        if not isinstance(n, dict):
            parts.append(str(n or ""))
            continue
        h = n.get("htmlSnippet") or ""
        snip = n.get("snippet") or ""
        if h and "<" in h:
            t, f = split_figures(h, start_index=len(figs) + 1, max_figures=max(0, max_figures - len(figs)))
            # Guard: never let a thin/odd HTML rendering replace a fuller snippet.
            parts.append(t if len(t) >= 0.8 * len(snip) else snip)
            figs.extend(f)
            for m in _HREF_RE.finditer(h):
                u = _html.unescape(m.group(2)).strip()
                if u not in links:
                    links.append(u)
        else:
            parts.append(snip)
    text = "\n\n".join(p for p in parts if p).strip()
    if links:
        text += "\n\nCited web links: " + " ".join(links[:8])
    return text, figs


def image_blocks(figures: list[Figure]) -> list[dict]:
    """Claude content blocks: a label before each picture so the model can tie
    it to the [Figure N] marker in the text."""
    blocks: list[dict] = []
    for f in figures:
        blocks.append({"type": "text", "text": f"Figure {f.index}:"})
        blocks.append({"type": "image", "source": {"type": "base64", "media_type": f.media_type, "data": f.data}})
    return blocks


FIGURES_RULE = (
    "FIGURES: pictures embedded in the narrative (charts, graphs, screenshots of tables) are "
    "attached as images labeled 'Figure N', matching the [Figure N] markers in the text. READ "
    "them — data shown in a figure (e.g. a race/ethnicity chart, an age or gender breakdown, an "
    "enrollment table) counts as PROVIDED in the narrative exactly as if it were typed. Never "
    "report data as missing when an attached figure shows it."
)

CONDITIONAL_RULE = (
    "CONDITIONAL SPECIFICATIONS: some specifications apply only under a stated condition (e.g. "
    "'If the program is less than five years old, provide…', 'If applicable…'). When the "
    "narrative or evidence shows the condition does NOT apply (e.g. the program was established "
    "more than five years ago), the specification is SATISFIED as not applicable: treat it as "
    "fully covered / pass, list no gaps, and state 'Not applicable — <reason>' as the strength. "
    "Do not require the conditional documentation. Only when it is unclear whether the condition "
    "applies, suggest the program state its establishment date explicitly."
)

"""The parser rule engine — lazy Mongo reader + default-preserving post-pass.

Two public surfaces:

  * ``fetch_active_rules(format, institution_id, program_level)`` — reads the
    active, in-scope rows from the ``parserrules`` collection. WRAPPED end to
    end in try/except → returns ``[]`` on ANY problem (empty MONGO_URL,
    unreachable Mongo, query error). A 3s server-selection timeout keeps a dead
    store from ever slowing a parse.

  * ``RuleEngine(rules)`` — applies those rules to an assembled ``JobRecord``
    as a post-pass. ``apply_post_pass`` is a strict NO-OP unless a rule's
    ``match.signature`` explicitly matches an item AND the rule carries a
    routing or classification directive. It never touches an item no rule
    targets, and it is never a catch-all.
"""
from __future__ import annotations

import logging
import threading
from typing import Any

from app.config import get_settings

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------- Mongo client

_client_lock = threading.Lock()
_client_singleton: Any = None
_client_initialised = False


def _client():
    """Lazy singleton ``pymongo.MongoClient``.

    Returns ``None`` when ``settings.mongo_url`` is empty, pymongo is missing,
    or a connection can't be established within the 3s server-selection
    timeout. Never raises — the rule store must not break a parse.
    """
    global _client_singleton, _client_initialised
    settings = get_settings()
    if not settings.mongo_url:
        return None
    with _client_lock:
        if _client_initialised:
            return _client_singleton
        _client_initialised = True
        try:
            from pymongo import MongoClient  # imported lazily so a missing dep is survivable

            client = MongoClient(settings.mongo_url, serverSelectionTimeoutMS=3000)
            # Force server selection now so an unreachable Mongo fails here
            # (and we log + return None) rather than at first query.
            client.admin.command("ping")
            _client_singleton = client
        except Exception as exc:  # noqa: BLE001 — any failure → no rule store
            _logger.warning(
                "[rule-engine] Mongo unavailable (%s: %s); rules disabled",
                type(exc).__name__,
                exc,
            )
            _client_singleton = None
        return _client_singleton


def _db_name_from_url(url: str) -> str | None:
    """Extract the default DB name from a mongodb URL, if present."""
    try:
        # strip scheme, take path segment before any query string
        tail = url.split("://", 1)[-1]
        path = tail.split("/", 1)[1] if "/" in tail else ""
        name = path.split("?", 1)[0].strip()
        return name or None
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------- rule fetch


def fetch_active_rules(
    format: str,
    institution_id: str | None,
    program_level: str | None,
) -> list[dict]:
    """Load the ACTIVE, in-scope parser rules for one import.

    Filters:
      * ``status == "active"``
      * ``match.format in {format, "any"}``
      * scope: ``level == "global"`` OR (``level == "institution"`` AND
        ``str(scope.institutionId) == institution_id``)
      * drop when ``scope.programLevel`` is set and ``!= program_level``

    Sorted by ``confidence`` desc. Returns plain dicts.

    WRAPPED in try/except → ``[]`` on ANY error. Parsing must NEVER break
    because of the rule store.
    """
    try:
        client = _client()
        if client is None:
            return []

        settings = get_settings()
        db_name = _db_name_from_url(settings.mongo_url) or "CSHSE"
        col = client[db_name]["parserrules"]

        query = {
            "status": "active",
            "match.format": {"$in": [format, "any"]},
        }
        rules: list[dict] = []
        for doc in col.find(query):
            scope = doc.get("scope") or {}
            level = scope.get("level", "global")
            if level == "institution":
                inst = scope.get("institutionId")
                if institution_id is None or str(inst) != str(institution_id):
                    continue
            # else: global scope — always in scope
            prog = scope.get("programLevel")
            if prog and prog != program_level:
                continue
            rules.append(doc)

        rules.sort(key=lambda r: (r.get("confidence") or 0.0), reverse=True)
        _logger.info(
            "[rule-engine] loaded %d active rules for format=%s institution=%s",
            len(rules),
            format,
            institution_id,
        )
        return rules
    except Exception as exc:  # noqa: BLE001 — never let the store break a parse
        _logger.warning(
            "[rule-engine] fetch_active_rules failed (%s: %s); returning []",
            type(exc).__name__,
            exc,
        )
        return []


# ---------------------------------------------------------------- engine

# classification → bucket list. The last group lands in evidenceFiles and also
# stamps a ``docSubKind`` marker on the item.
_CLASS_TO_LIST: dict[str, str] = {
    "narrative": "narratives",
    "evidence-text": "evidenceText",
    "appendix": "evidenceFiles",
    "syllabus": "evidenceFiles",
    "cv": "evidenceFiles",
    "matrix": "evidenceFiles",
    "evidence-file": "evidenceFiles",
}
_CLASS_SUBKINDS = {"appendix", "syllabus", "cv", "matrix", "evidence-file"}

# The three signature keys the post-pass understands. A rule whose signature
# has none of these matches NOTHING here (this is what keeps the seeded
# baseline rules — which carry structural regex signatures — a strict no-op).
_KNOWN_SIG_KEYS = ("sectionIdEquals", "textContains", "currentBucket")


def _empty_bucket(std: str, spec: str) -> dict[str, Any]:
    """Mirror the existing create-missing-bucket shape used in import_jobs."""
    return {
        "standardCode": std,
        "specCode": spec,
        "narratives": [],
        "evidenceText": [],
        "evidenceFiles": [],
    }


def _item_text(item: dict) -> str:
    """Lower-cased text used for ``textContains`` matching.

    Bucket items carry text under ``heading``/``snippet``/``htmlSnippet``;
    unplaced tags (``job.tags``) carry it under ``fullText``/``summary`` (see
    ``import_jobs._recommendation_to_tag``). We concatenate ALL of them so the
    same ``textContains`` needle matches whichever shape the item is.
    """
    parts = [
        str(item.get("heading") or ""),
        str(item.get("snippet") or ""),
        str(item.get("htmlSnippet") or ""),
        # unplaced-tag shape carries text under different keys
        str(item.get("fullText") or ""),
        str(item.get("summary") or ""),
    ]
    return "\n".join(parts).lower()


# Sentinel bucket key for unplaced tags. It is never a real "<std>.<spec>"
# bucket, so a ``currentBucket`` signature can never spuriously match a tag.
_TAGS_KEY = "__tags__"


def _tag_to_bucket_item(tag: dict) -> dict[str, Any]:
    """Convert an unplaced ``job.tags`` entry into a bucket-item dict.

    Maps the tag shape (``fullText``/``summary``/``sourceHeading`` + routing
    hints, see ``import_jobs._recommendation_to_tag``) to the bucket-item shape
    the wizard renders (``heading``/``snippet``/``htmlSnippet``/``wordCount`` …).
    """
    full = str(tag.get("fullText") or "")
    return {
        "sectionId": tag.get("sectionId"),
        "heading": tag.get("summary") or tag.get("sourceHeading") or "",
        "snippet": full,
        "htmlSnippet": tag.get("htmlSnippet"),
        "wordCount": len(full.split()),
        "confidence": tag.get("confidence"),
        "acceptState": tag.get("acceptState"),
        "rationale": tag.get("rationale"),
        "byteOffsetStart": tag.get("byteOffsetStart"),
    }


class RuleEngine:
    """Applies a fetched rules list to a JobRecord's assembled buckets."""

    #: bucket sub-lists we scan / write
    _LIST_NAMES = ("narratives", "evidenceText", "evidenceFiles")

    def __init__(self, rules: list[dict] | None):
        self._rules: list[dict] = list(rules or [])

    # ------------------------------------------- marker-less-spec recovery
    def wants_markerless_split(self) -> bool:
        """True when an active rule enables institution-scoped recovery of a
        spec whose letter marker the document dropped (``extract.enable
        MarkerlessSplit``). Off unless a rule for THIS institution turns it on —
        never global. Consumed by the template walker."""
        for rule in self._rules:
            if (rule.get("extract") or {}).get("enableMarkerlessSplit") is True:
                return True
        return False

    def wants_appendix_evidence(self) -> bool:
        """True when an active rule enables inline-appendix extraction on the
        TEMPLATE pipeline (``extract.enableAppendixEvidence``): detect embedded
        faculty CVs + appendix papers/syllabi and route them to supporting
        evidence instead of standard narratives. Off unless a rule for THIS
        institution turns it on — never global — because the CV / paper
        detectors can over-fire on some template documents (mis-reading
        narrative as a syllabus), so the SU opts in per institution after
        confirming the extraction in a Parser Train run. Consumed by
        _run_template_pipeline."""
        for rule in self._rules:
            if (rule.get("extract") or {}).get("enableAppendixEvidence") is True:
                return True
        return False

    # ------------------------------------------------------------ forceFormat
    def force_format(self) -> str | None:
        """First active rule's ``extract.forceFormat``, if any.

        Mirrors the server-side hook; harmless (the server already resolves
        force before calling the ai-service). Provided for parity/inspection.
        """
        for rule in self._rules:
            ff = (rule.get("extract") or {}).get("forceFormat")
            if ff:
                return ff
        return None

    # ------------------------------------------------------------ post-pass
    def apply_post_pass(self, job) -> dict:
        """Reassign items a rule EXPLICITLY targets. Otherwise a strict no-op.

        Scans placed bucket / introduction items AND unplaced ``job.tags``.
        A tag matched by a rule that carries a ROUTING directive is MOVED out of
        ``job.tags`` and INTO ``buckets["<std>.<spec>"]`` as a proper bucket
        item (routing unplaced content is the #1 thing a new-document rule does).

        Returns ``{"moved": N, "reclassified": N, "placedTags": N,
        "appliedRuleIds": [...]}``.
        """
        summary = {"moved": 0, "reclassified": 0, "placedTags": 0, "splitSpecs": 0, "appliedRuleIds": []}
        if not self._rules:
            # STRICT no-op — buckets, introductions AND tags left untouched.
            return summary

        buckets0 = getattr(job, "buckets", None)
        if isinstance(buckets0, dict):
            # SPLIT pass (CR-073) — un-bunch a spec whose content the walker merged
            # into an adjacent spec (e.g. AACC 15.b bunched into 15.a). Runs first so
            # the split-out narrative then participates in anchoring. Default-
            # preserving: only rules carrying an ``extract.split`` act.
            self._apply_splits(buckets0, summary)

        buckets = getattr(job, "buckets", None)
        if not isinstance(buckets, dict):
            buckets = {}
        introductions = getattr(job, "introductions", None)
        if not isinstance(introductions, dict):
            introductions = {}
        tags = getattr(job, "tags", None)
        if not isinstance(tags, list):
            tags = None

        # Snapshot every scannable (item, source-location). We capture the live
        # list object so removal later is by identity against the real bucket.
        # location = (item, key, list_obj, list_name, is_tag)
        snapshot: list[tuple[dict, str, list, str, bool]] = []
        for key, bucket in buckets.items():
            if not isinstance(bucket, dict):
                continue
            for list_name in self._LIST_NAMES:
                lst = bucket.get(list_name)
                if isinstance(lst, list):
                    for it in lst:
                        if isinstance(it, dict):
                            snapshot.append((it, key, lst, list_name, False))
        for key, intro in introductions.items():
            if not isinstance(intro, dict):
                continue
            lst = intro.get("items")
            if isinstance(lst, list):
                for it in lst:
                    if isinstance(it, dict):
                        snapshot.append((it, key, lst, "items", False))
        # Unplaced tags — the live ``job.tags`` list. Matched on ``fullText`` /
        # ``summary`` (via _item_text) and ``sectionId`` (sectionIdEquals). A
        # ``currentBucket`` signature can't match (sentinel key never == a real
        # bucket). Only a routing rule can place one (see below).
        if tags is not None:
            for it in tags:
                if isinstance(it, dict):
                    snapshot.append((it, _TAGS_KEY, tags, "tags", True))

        # Build a plan. Each item is handled by at most one rule (rules are
        # already ordered by confidence desc). We only record a plan when the
        # rule actually CHANGES the item's location — no directive, no touch.
        plans: list[dict] = []
        processed: set[int] = set()  # object ids already claimed by a rule
        applied: list[str] = []

        for rule in self._rules:
            extract = rule.get("extract") or {}
            classification = extract.get("classification")
            params = extract.get("params") or {}
            target_std = params.get("std")
            target_spec = params.get("spec")
            has_routing = bool(target_std) and bool(target_spec)
            # A rule must carry a ROUTING or CLASSIFICATION directive to act.
            if not (has_routing or classification):
                continue
            sig = (rule.get("match") or {}).get("signature") or {}
            # Never a catch-all: the signature must use a key we evaluate.
            if not any(k in sig for k in _KNOWN_SIG_KEYS):
                continue

            for item, src_key, src_list, src_list_name, is_tag in snapshot:
                if id(item) in processed:
                    continue
                if not self._signature_matches(sig, item, src_key):
                    continue

                # An unplaced tag can ONLY be placed by a routing rule — it has
                # no home bucket to reclassify within. A classification-only
                # rule that matches a tag is a no-op (nowhere to route it).
                if is_tag and not has_routing:
                    continue

                dest_key = f"{target_std}.{target_spec}" if has_routing else src_key
                dest_list_name = self._dest_list_name(
                    classification, has_routing, src_list_name
                )
                # No actual change → don't touch, don't count, don't mark applied.
                if dest_key == src_key and dest_list_name == src_list_name:
                    continue

                processed.add(id(item))
                plans.append(
                    {
                        "item": item,
                        "src_key": src_key,
                        "src_list": src_list,
                        "src_list_name": src_list_name,
                        "dest_key": dest_key,
                        "dest_list_name": dest_list_name,
                        "classification": classification,
                        "ruleId": rule.get("ruleId"),
                        "is_tag": is_tag,
                    }
                )

        # Apply the plan against the live buckets.
        for plan in plans:
            item = plan["item"]
            src_list = plan["src_list"]
            is_tag = plan.get("is_tag", False)
            # Remove from source by identity — mirrors the bucket-list removal
            # for tags too (removed from the live ``job.tags`` list).
            for i, existing in enumerate(src_list):
                if existing is item:
                    del src_list[i]
                    break
            # A tag becomes a proper bucket item; a placed item moves as-is.
            placed = _tag_to_bucket_item(item) if is_tag else item
            # Ensure destination bucket exists (create-missing mirror).
            dest_key = plan["dest_key"]
            dest_bucket = buckets.get(dest_key)
            if not isinstance(dest_bucket, dict):
                std, _, spec = dest_key.partition(".")
                dest_bucket = _empty_bucket(std, spec)
                buckets[dest_key] = dest_bucket
            dest_list = dest_bucket.get(plan["dest_list_name"])
            if not isinstance(dest_list, list):
                dest_list = []
                dest_bucket[plan["dest_list_name"]] = dest_list
            # Stamp a docSubKind marker for file-kind classifications.
            classification = plan["classification"]
            if classification in _CLASS_SUBKINDS:
                placed["docSubKind"] = classification
            dest_list.append(placed)

            if is_tag:
                summary["placedTags"] += 1
            elif dest_key != plan["src_key"]:
                summary["moved"] += 1
            else:
                summary["reclassified"] += 1
            rid = plan["ruleId"]
            if rid and rid not in applied:
                applied.append(rid)

        summary["appliedRuleIds"] = applied
        return summary

    # ------------------------------------------------------------ split pass
    def _apply_splits(self, buckets: dict, summary: dict) -> None:
        """Split a bunched spec out of its host bucket into its own spec.

        A split rule: ``extract.split = {boundary, std, spec}`` (+ optional
        ``match.signature.currentBucket`` naming the host). We locate the host
        bucket's narrative whose text contains ``boundary`` at a non-start
        position, cut it there, leave the head in the host, and emit the tail as
        a NEW narrative in ``buckets["{std}.{spec}"]``. Both halves get fresh
        sectionIds so the later anchoring pass re-anchors each (Compare locates
        both). No boundary match → no change (default-preserving)."""
        for rule in self._rules:
            split = (rule.get("extract") or {}).get("split") or {}
            boundary = str(split.get("boundary") or "").strip()
            tstd, tspec = split.get("std"), split.get("spec")
            if not (boundary and tstd and tspec) or len(boundary) < 12:
                continue
            sig = (rule.get("match") or {}).get("signature") or {}
            host_key = sig.get("currentBucket")
            candidates = [host_key] if host_key else list(buckets.keys())
            done = False
            for hk in candidates:
                bucket = buckets.get(hk)
                if not isinstance(bucket, dict):
                    continue
                narrs = bucket.get("narratives")
                if not isinstance(narrs, list):
                    continue
                for item in list(narrs):
                    if not isinstance(item, dict):
                        continue
                    snip = str(item.get("snippet") or "")
                    idx = snip.find(boundary)
                    if idx <= 0:
                        continue  # not bunched here (must be a non-start boundary)
                    head = snip[:idx].rstrip()
                    tail = snip[idx:].strip()
                    if len(head) < 20 or len(tail) < 20:
                        continue
                    html = item.get("htmlSnippet") or ""
                    hidx = html.find(boundary) if html else -1
                    head_html = html[:hidx] if hidx > 0 else None
                    tail_html = html[hidx:] if hidx > 0 else None
                    base_sid = str(item.get("sectionId") or "split")
                    # head stays in the host (fresh sectionId → re-anchored to the head only)
                    item["snippet"] = head
                    item["htmlSnippet"] = head_html
                    item["wordCount"] = len(head.split())
                    item["sectionId"] = f"{base_sid}:splithead"
                    # tail becomes the new spec's narrative
                    dest_key = f"{tstd}.{tspec}"
                    dest = buckets.get(dest_key)
                    if not isinstance(dest, dict):
                        dest = _empty_bucket(str(tstd), str(tspec))
                        buckets[dest_key] = dest
                    dest.setdefault("narratives", []).append({
                        "sectionId": f"{base_sid}:split:{tstd}.{tspec}",
                        "heading": f"{tstd}.{tspec}. {tail[:120]}",
                        "snippet": tail,
                        "htmlSnippet": tail_html,
                        "wordCount": len(tail.split()),
                        "confidence": item.get("confidence", 0.9),
                        "acceptState": item.get("acceptState", "review_low_confidence"),
                        "rationale": f"Split out of {hk} at the {dest_key} prompt boundary.",
                        "byteOffsetStart": item.get("byteOffsetStart", 0),
                    })
                    summary["splitSpecs"] += 1
                    rid = rule.get("ruleId")
                    if rid and rid not in summary["appliedRuleIds"]:
                        summary["appliedRuleIds"].append(rid)
                    done = True
                    break
                if done:
                    break

    # ------------------------------------------------------------ helpers
    @staticmethod
    def _signature_matches(sig: dict, item: dict, bucket_key: str) -> bool:
        """True only when EVERY present known signature key matches the item.

        A signature with no known key never matches (guarded by the caller);
        an unknown extra key is ignored but does not create a match on its own.
        """
        matched_any = False
        if "sectionIdEquals" in sig:
            matched_any = True
            if str(item.get("sectionId")) != str(sig["sectionIdEquals"]):
                return False
        if "currentBucket" in sig:
            matched_any = True
            if bucket_key != sig["currentBucket"]:
                return False
        if "textContains" in sig:
            matched_any = True
            needle = str(sig["textContains"]).lower()
            if needle not in _item_text(item):
                return False
        return matched_any

    @staticmethod
    def _dest_list_name(
        classification: str | None, has_routing: bool, src_list_name: str
    ) -> str:
        """Resolve the destination bucket sub-list for an item."""
        if classification and classification in _CLASS_TO_LIST:
            return _CLASS_TO_LIST[classification]
        if has_routing:
            # Routing without a mapped classification: a hint-routed section is
            # the spec's narrative (mirrors the template hint-routing rule).
            return "narratives"
        # Reclassify with an unmapped/absent class → keep the source list
        # (produces no change, so it's skipped by the caller).
        return src_list_name if src_list_name in RuleEngine._LIST_NAMES else "narratives"

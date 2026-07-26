"""Data-driven parser RULE ENGINE (CR-073 "Parser Train").

The parser's shape-specific decisions are DATA, not code: rows in the Mongo
``parserrules`` collection say WHEN a document region matches a known shape
(``match``) and HOW to route/classify it (``extract``). This package reads the
ACTIVE rules for a given import's format+scope and applies them as a STRICTLY
default-preserving post-pass over the assembled buckets.

Design guarantees (non-negotiable — see engine.py):
  - The rule store must NEVER break or slow a parse. A missing MONGO_URL, an
    unreachable Mongo, or any query error yields ``[]`` (3s timeout, try/except).
  - The post-pass is a NO-OP when no active rule's signature matches. It only
    ever touches items a rule EXPLICITLY targets — never a catch-all. With the
    seeded baseline rules active the output is byte-identical to the proven
    code path (those rows carry structural signatures the post-pass doesn't
    evaluate, so they match nothing here).
"""
from app.rules.engine import RuleEngine, fetch_active_rules

__all__ = ["RuleEngine", "fetch_active_rules"]

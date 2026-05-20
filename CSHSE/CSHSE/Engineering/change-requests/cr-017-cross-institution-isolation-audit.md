---
name: CR-017 — Cross-institution data isolation audit + documentation
description: Documented data-flow audit confirming no inter-program access, including the AI service path. Required for board confidence.
type: change-request
cr_id: CR-017
status: proposed
priority: P0
source: [[webinar-action-items-2026-05-20#24-07]], [[webinar-action-items-2026-05-20#25-09]], [[webinar-action-items-2026-05-20#26-04]]
sprint_target: Sprint 2
tags: [security, isolation, audit, ai-service, board]
last_reviewed: 2026-05-20
---

# CR-017 — Cross-institution data isolation audit + documentation

## Summary

Paul Datti raised explicit confidentiality concerns: programs not on the CSHSE board must not be able to see another program's data. Eric reaffirmed the system enforces this. We owe the board a documented data-flow audit covering:

- Mongo data access by institution (RBAC + scoping)
- AI service: how Qdrant collections, embeddings, and Claude prompts isolate per-institution
- S3 / GridFS: per-institution scoping
- Cross-institution semantic search feature flag (default off; documented)

## Source quotes

> **[24:07 — Paul]:** "I just wondering how this AI situation is going to work, and I have some security concerns… I worry about the confidentiality of having program information put out there."

> **[24:34 — Eric]:** "That's completely safeguarded, because this is not using an AI like Chat GPT… the security of the system is that there's a database that has just about everything locked down, the database is not even on the internet, it's on it's on a local network that is only reachable by the software."

> **[25:09 — Paul]:** "what about the other programs who are not on the CS HSE board, are they going to be able to access the information from their point of view?"
> **[25:26 — Eric]:** "only the institution can access the institution's information"

> **[26:04 — Eric]:** "we've also done a security audit on here, and there were some holes in here that are have been corrected."

## Decision

Two deliverables:

1. **Data flow audit document** — `[[cross-institution-isolation-audit-2026-05-DD]]` — a `review` page in the vault enumerating every code path that touches institution data and the scoping mechanism for each. Tied to `security-audit-2026-05-10` but specifically about isolation.

2. **Test coverage proving isolation:**
   - Negative tests for every API endpoint: User from institution A cannot reach institution B's data, even with crafted IDs.
   - AI service: Qdrant payload filter assertions ensure `institutionId` filter on every query path.
   - Cross-institution semantic search flag is OFF in code (gated behind admin toggle); tested as default-off.

The audit doc is the deliverable the board can be shown directly. The tests are the regression gate.

## Acceptance

- [ ] Dated audit page in Engineering vault listing every isolation surface.
- [ ] Test suite covering: API endpoints (per controller), AI service queries (per Qdrant collection), evidence upload paths.
- [ ] Pen-test pass against the negative cases.
- [ ] Cross-institution search flag verified OFF in prod.
- [ ] Audit page reviewed + signed off by Eric + a second engineer.

## Files affected

- New vault page `cross-institution-isolation-audit-2026-05-DD.md`
- Negative-case integration tests in `server/tests/` + `ai-service/tests/`
- Where audit reveals a gap: any controller/middleware that needs to add `institutionId` scoping

## Dependencies

- None for the audit itself; gates any user-facing isolation claims to the board.

## Open questions

- Pen test by external party vs in-house? Lean external for board credibility.

---
name: CR-073 — Parser Train (self-improving parser agent, SU human-in-the-loop)
description: A superuser-only "Parser Train" function. It reads any self-study document, analyses it, and sets realtime parser rules (data in a Mongo parserRules store, not code); the SU verifies the result in the existing Review screen (SU-only), runs Compare on every card, and APPROVING a spec/sub-spec activates the rule that parsed it. Notes + screenshots capture what's wrong. The parser learns from each document; existing parsed docs (MCC/AACC/Kennesaw) are never affected.
type: change-request
cr_id: CR-073
status: in-progress
priority: P1
source: "Eric 2026-07-24 'an agent that will take any self study document and produce input into the review panel and have it correctly display and compare with the original … the AI Parser will get smarter with more documents' · the AACC manual-diagnosis loop across [[log]] 2026-07-17→23 · [[ai-parser-architecture]] §7 (contract) §8 (failure modes)"
sprint_target: TBD
tags: [parser, ai-import, agent, self-improving, compare, qa, P1]
last_reviewed: 2026-07-24
---

# CR-073 — Self-improving parser QA/training agent

> **Phase 1 (safety-net foundation) SHIPPED TO DEV + E2E-TESTED 2026-07-25.** The verifier + the immovable baseline are in place (proven parser code untouched, no rule engine yet):
> - `server/src/models/ParserRule.ts` + `parserrules` collection — the realtime rule store; **17 baseline rules seeded on dev** (`server/scripts/seed_baseline_parser_rules.mjs`).
> - `server/src/services/parserContract.ts` (the §7 verifier) + `POST /api/imports/:id/contract-check` — anchors gate + coverage/file-type/loss metrics + findings.
> - **Golden regression E2E** `e2e/tests/73_parser_baseline_golden.spec.ts` + `e2e/fixtures/golden/{aacc,kennesaw,mcc}.json` — re-imports each proven doc and asserts it reproduces its golden. **Green on dev:** AACC (20 std / 85 spec / 369 items), Kennesaw (10/35/209), MCC (@slow, 20 std / 77 spec / 73 appendix files / 169 items) — **0 un-anchored items on all three**. Template placement asserted exact; MCC structural (LLM sub-spec variance tolerated); the anchor gate enforced on all.
> - Dev commits: `8e323be`, `d01686e`, `2b3bf3c`. Not on prod.
>
> **Phase 2 (SU training loop + rule engine) SHIPPED TO DEV 2026-07-26 (`e9686ca`).** The human-in-the-loop and the first realtime rule-engine lever are live on dev:
> - **Sandbox isolation** — `Submission.trainingRun` flag; training runs are excluded from every normal submission list (`submissionController.listSubmissions` `filter.trainingRun = { $ne: true }`). Runs live on a dedicated **Parser Train Sandbox** institution + sandbox PC.
> - **`server/src/controllers/parserTrainController.ts` + `routes/parserTrain.ts`** (SU-only): `POST /api/parser-train` (create sandbox run), `POST /:importId/diagnose` (contract-check + auto-propose `parserRules` for critical gaps), `POST /set-rule` (the SU sets/activates a rule), `POST /:importId/approve-spec` (activate the run's proposed rules — the approval gate), `GET /runs`.
> - **Rule engine (first lever): `server/src/services/parserRuleEngine.ts` `resolveForceFormat`** — at import start (all 3 dispatch sites in `aiImportController`) the server consults **active** per-institution rules and may override `forceFormat`. **Default-preserving by construction:** an explicit choice always wins, and zero matching active rules → the caller's value is returned unchanged, so MCC/AACC/Kennesaw and every real institution parse **exactly** as before. `ai-status` now surfaces the effective `forceFormat` so the steer is verifiable without a re-parse.
> - **Client: SU-only Parser Train page** (`client/src/pages/ParserTrainPage.tsx`) + nav item (superuser, non-impersonating) — create run → import the doc **as the sandbox PC** (per-request impersonation) → diagnose (anchors gate + placement + file-type) → **Open Review screen** for Compare + notes/screenshots → **Approve = activate rules**.
> - **E2E `e2e/tests/74_parser_train.spec.ts`** — full loop on dev: create → import → diagnose (**0 un-anchored items**, format `template`, specs placed) → approve → **isolation** (run absent from `/api/submissions`, present in `/parser-train/runs`) → **rule engine** (an SU-set `forceFormat` rule steers a fresh sandbox import to `self_study`).
> Still open: the *agent* diagnose/refine LLM loop that synthesises full extraction rules (today diagnose auto-proposes only for critical contract findings; `set-rule` is the human channel), richer per-region rule application beyond `forceFormat`, and prod rollout.

> **Phase 3 (the ARCHITECTURE — runtime rule ENGINE + learning loop) SHIPPED TO DEV 2026-07-26 and FULLY E2E-VERIFIED.** This is the self-improving center that Phases 1–2 scaffolded:
> - **ai-service rule ENGINE** — `ai-service/app/rules/engine.py`. At parse time `fetch_active_rules(format, institution, level)` reads the `parserrules` Mongo collection (3s timeout, try/except → `[]` so it can never break a parse) and `RuleEngine.apply_post_pass(job)` reassigns ONLY the items a rule's signature explicitly targets (`sectionIdEquals`/`textContains`/`currentBucket`) to the rule's `extract.params` std.spec and/or `classification`. Wired in `_run_pipeline` after dispatch, before anchoring (moved items still get their Compare `data-section-id`). **Rules are now DATA the engine executes** — not just documentation. `GET /health/rules` diagnostic confirms Mongo reachability + the in-scope rules.
> - **STRICTLY default-preserving — PROVEN.** The 15 seeded baseline rules carry structural signatures the post-pass doesn't evaluate → they move nothing. **Golden regression re-run with the engine LIVE: AACC (85 specs) + Kennesaw (35 specs) reproduce their goldens byte-for-byte, 0 un-anchored.** The engine did not move the baseline.
> - **The LEARNING LOOP** — `server/src/services/parserTrainAgent.ts`. `POST /:importId/auto-refine` runs a real optimization: the agent re-parses the document under each candidate parse setting, clears the sandbox review state between candidates (no cross-job accumulation), waits for anchoring to settle, scores each result against the §7 contract (anchors gate + coverage + unplaced), and writes the WINNING setting back as an ACTIVE institution-scoped `parserRule` the engine consumes. Trajectory persisted to `Submission.parserTrainState`, shown in the Parser Train UI, polled via `GET /:importId/refine-status`.
> - **GUARDRAIL enforced** — `set-rule` blocks activating a GLOBAL rule unless `goldenChecked` (institution rules can't touch the baseline, so they activate freely).
> - **E2E-VERIFIED on dev (all green):** `73` goldens (default-preserving), `74` loop (85 specs, 347 items all anchored, isolation, forceFormat steer), **`75` architecture** — guardrail blocks global activation; the engine consumes an SU-set institution rule and **moves a narrative 1.a → 9.j at parse time**; the learning loop tries `auto=85sp/anchored, template=85sp/anchored, self_study=64sp/MISSING` and **learns "auto"**. Screenshot walkthrough (`76`) → PDF report `e2e/report/parser-train-e2e-report.pdf`.
> Commits (dev): `f2fc888` (engine), `8a8abce` (loop+guardrail), plus race/anchor/accumulation fixes `a145b82`→`8d809cf`. NOT on prod. Remaining: the LLM diagnose that synthesises full extraction rules for arbitrary novel shapes (today the loop owns the format lever end-to-end + SU/agent author routing/classification rules the engine consumes); prod rollout.

## Summary
Every new institutional self-study has surfaced a fresh parser defect that only a human caught by eyeballing the Review panel and the Compare pane (AACC: table-cell blindness, headerless standards, 3-column tables, three answer shapes, hinted-spec theft, response-as-evidence, missing anchors — see [[ai-parser-architecture]] §8). That manual loop — *parse → look → diagnose → change a rule → re-import → look again* — is exactly what an agent should run.

Build a **parser QA/training agent**: given any self-study document, it runs the real parser, **validates the output against the required-output contract** ([[ai-parser-architecture]] §7), and when the contract fails it **diagnoses the cause, proposes and applies a fix (deterministic parser rule and/or a matcher few-shot example), and re-runs until the contract passes** — persisting what it learned so the next document benefits. Net effect: *any* self-study produces correct Review-panel input that displays and Compares against the original, and the parser gets smarter with every document.

## Scope — the full variety of documents (including hybrids)
The agent must do the complete AACC-style analysis ([[ai-parser-aacc-fixes-2026-07-24]]) on **any** shape we receive, and we are receiving a range:

| Shape | Example | Characteristics |
| --- | --- | --- |
| **Exact-spec template** | clean template, prompts + `Response:` as written | matches `load_specifications` 1:1; minimal work |
| **MCC-like** | independent-narrative PDF | `Standard #N` anchors + back-of-doc Appendix Index + scanned appendices ([[mcc-narrative-import-parser]]) |
| **AACC-like** | official template, tables intact | standards/specs/Response in table cells; headerless standards, 3-/multi-column, three answer shapes |
| **Kennesaw-like** | official template, tables removed | paragraph headings (`1.a`, `Standard N:`) + `Response:` bodies |
| **Combination / hybrid** | any mix of the above in one file | e.g. a template whose curriculum standards are tabular but whose intro is free narrative; a template with an MCC-style scanned-appendix tail; some standards written exactly-to-spec and others free-form |

**Requirement:** the agent (a) runs a complete per-document analysis — derive the document's own inventory, diff it against the level standard catalog, read the offending regions — exactly as was done by hand for AACC; (b) **creates or updates deterministic parsing rules** (walker/detector rules + fixtures) and/or matcher few-shots to close every contract gap; (c) re-parses and confirms the output **displays correctly in the Review panel and Compares against the original** (every item marked, §7d). **Hybrids are first-class:** detection must not be forced into one global format when a single document mixes shapes — the agent applies the right rule set **per region/standard** and reconciles into one review state + one anchored source HTML. (Today's `detect_format` picks one format for the whole file — see Open question 5.)

## Parser Train — the superuser function (the human-in-the-loop delivery)
The agent is delivered as **Parser Train**, a **superuser-only** function. It is the human-in-the-loop: the agent proposes rules, the SU verifies and approves them in the Review screen.

1. **Upload + analyse + set rules** — the SU opens **Parser Train** and uploads a self-study document. The rule-driven engine parses it with the current **active** `parserRules`; the agent validates against the §7f contract and, for any region that fails, **synthesises candidate rules** (`status: "proposed"`) and re-parses until the contract passes or it can't (see §"What the realtime learner requires").
2. **Verify in the Review screen (SU-only) — this IS the verification screen** — the result opens in the **existing Review screen**, in a "train" mode visible **only to the superuser**. The SU walks every card, runs **Compare** (parsed section beside the original — every `data-section-id` marker must resolve to *located*), and inspects Standard/Sub-spec placement + file-type classification. Reusing the Review screen means Compare, the coverage rail, and the cards are already there — no new verification UI.
3. **Approve = approve for parsing** — approving a **spec / sub-spec** in the Review screen **confirms that parse is correct and activates the rule(s) that produced it** (`proposed → active`). This is the gate: a rule goes live only when the SU approves the spec it parsed. (In Parser Train, approval activates the RULE — it does **not** materialise to any institution's editor.)
4. **Notes + screenshots for anything wrong** — on any card the SU can add a **note** and attach a **screenshot** describing what's incorrect; that feedback attaches to the region's finding and feeds the agent's *refine* node to revise the rule before re-approval. (This is the human correction signal the loop learns from.)
5. **Isolation — existing documents are never affected** — Parser Train runs on **sandbox training documents** owned by the SU; it never reads or writes any real submission's review state or editor. **Already-parsed documents (MCC, AACC, Kennesaw State) are NOT affected** — newly-activated rules apply to **future imports only**; no existing submission is auto-re-parsed, and stored review states stay immutable.

This resolves Open Questions 1 (autonomy) and 3 (trigger): the run is **SU-initiated**, and rule activation is **SU-approved via the Review screen** — no autonomous code/behaviour change ships without the human approving the spec it parsed.

## Source quotes
- **Eric, 2026-07-24 (the ask):** "an agent that will take any self study document and produce input into the review panel and have it correctly display and compare with the original." · "a method of training the AI parser through an AI Agent (new) that will ensure that the document read in will generate the required outputs." · "the AI Parser will get smarter with more documents that are read." · "include … tags to prevent this issue from happening for every document we read in."
- **Eric, 2026-07-25 (the prime requirement + Parser Train):** "it learns from each document, and builds out the parser rules (perhaps stored in a mongo table), and successfully reads the document. Success is measured by the document being placed in the correct standard and sub spec, correct file (if appendix, syllibi, or CV) is written, and the compare looks at each card and correctly shows the parsed section next to the original file with no missing or errored compares." · "we need this to be a superuser function. Call this SU function **Parser Train** … have the verification screen be the review screen (viewed only by SU) … Approving the spec and the subspec should approve for parsing. Any document already parsed (MCC, AACC, Kennesaw State) should not be affected by this. This will be the human in the loop. We can make notes in the review screen if anything is not correct, and attach screen shots."
- The AACC session (memory [[log]] 2026-07-17→23): each fix was a human running the loop this agent automates.

## The contract the agent enforces (acceptance oracle)
The agent's judge is the required-output contract in [[ai-parser-architecture]] §7, expressed as machine checks against the parse result + source HTML:

1. **Coverage** — every Standard and lettered Specification present in the source appears as a `std.spec` bucket with content (derive the source inventory from the document's own headings/cells, compare to `buckets`). 0 dropped.
2. **Routing** — spec Response under the matching `std.spec` (not a sibling / not Introduction); Introduction/glossary/`Standard N: … shall …` framing under `introductions`; the "does not appear under the wrong spec" negative checks (e.g. intro "major program changes" must NOT be in 4.a).
3. **Kind + file type** — a spec's Response is in `narratives`; genuine evidence in `evidenceText`/`evidenceFiles`; and a supporting FILE is written as the **correct type** — appendix / syllabus / CV / curriculum-matrix — into the matching rail (`evidenceFiles`/`cvs`/`evidenceDocs`/`matrices`).
4. **Level-correctness** — titles/criteria match `programLevel` (associate ≠ baccalaureate Field-Experience numbering).
5. **Anchoring (the tag that prevents the recurring Compare bug)** — **every** review item's `sectionId` has a `data-section-id` anchor in `job.source_html`; a narrative AND a short evidence item both resolve to `located`, never `section not located`.
6. **Loss-bound** — per spec, `plain(imported) ≥ N%` of the source span ([[change-requests/cr-061-importer-must-not-drop-spec-body-content|CR-061]] invariant).

A parse is accepted only when checks 1–6 pass. This is the same gate `e2e/tests/72_tabular_template_import.spec.ts` now encodes for the anchor check.

## Build method — Graph engineering (see [[agent-graph-loop-engineering]])
We build this agent by the method in [[agent-graph-loop-engineering]]. The parse-QA workflow is **predictable** — its steps are known in advance — so by the graph-vs-loop decision rule it is a **graph**: a flowchart the agent must follow, where the wrong paths are impossible and the LLM reasons only in the two boxes where judgement adds value (**diagnose**, **refine**). Everything else — running the parser, the six contract checks, routing on the finding type, the human-approval gate — is encoded as fixed/conditional edges.

The single most important design consequence: **the verifier is the bottleneck**, and our verifier is the [[ai-parser-architecture]] §7 contract. So we *master the node* — build the parse→verify→diagnose→refine loop with the §7 checks as a rock-solid exit test — **before** wiring the full graph. The graph is cyclic (not a DAG): `refine → parse` loops back until the contract passes. **The human-approval node is the SU approving a spec/sub-spec in the Parser Train Review screen** — that is what promotes a rule `proposed → active`. Diagnose uses dynamic fan-out (one refinement per finding). The node/edge topology is drawn in [[agent-graph-loop-engineering]] §"How we apply it".

## Success definition (the prime requirement, from Eric 2026-07-25)
The parser learns from each document and successfully reads it. **Success = for every card:** (1) placed in the **correct Standard + Sub-specification**; (2) if it is a file, the **correct file type is written** (appendix / syllabus / CV / matrix); (3) **Compare shows the parsed section next to the original with no missing and no errored compares** (every `data-section-id` marker resolves to *located*; 0 fuzzy/missing). This is [[ai-parser-architecture]] §7f — the agent's exit test.

## What the realtime learner requires (the answer to "what information improves the parser in realtime")
For the parser to improve **as documents are imported** — not via a code deploy — the shape-specific rules must be **data the engine reads at runtime**, stored in a Mongo collection (`parserRules`), that the agent writes. See [[ai-parser-architecture]] §9 (engine=code / rules=data). To synthesize or update a rule for a region the parser mis-handled, the agent must capture four things:

1. **Input signature** — the region's structural fingerprint, precise enough to recognize the shape again and NOT over-match: `format`, region kind (`table`/`paragraph`/`cell`/`document`), table dimensions + column layout, first-cell / marker regexes (`Standard N:`, letter markers, `Response` variants), header presence, and a raw excerpt. *(This is what "read the document and analyse it" produces — the AACC table fingerprints.)*
2. **Ground truth (the correct output to learn toward)** — from the document's own labels **cross-checked against the level standard catalog** (`load_specifications` / `standardsByLevel.json`): the target Standard + Sub-spec, the correct **classification** (narrative / evidence-text / evidence-file, and for a file: appendix / syllabus / CV / matrix), and the exact **source span** the item was taken from (for the marker).
3. **The gap** — the §7 contract-check failures for this region (which check failed, produced-vs-expected diff). This is *why* a new/updated rule is needed.
4. **The rule + its validation** — the synthesized rule (signature → extraction → classification → marker directive) plus a generated fixture, `confidence`, `scope` (institution vs global), provenance (`importId`, agent run, version), and the **contract re-check result** proving the region now passes §7f.

### The `parserRules` Mongo schema
```jsonc
{
  ruleId, name, version, supersedes,
  scope:  { level: "global" | "institution", institutionId?, programLevel? },
  status: "proposed" | "active" | "retired",
  createdBy: "agent" | "human", createdFromImportId, createdAt,

  // WHEN it fires (the conditional edge — "wrong paths impossible")
  match: {
    format: "template" | "self_study" | "mcc_narrative" | "any",
    region: "table" | "paragraph" | "cell" | "document",
    signature: { firstCellRegex?, columnCount?, hasStandardHeader?,
                 letterMarkerRegex?, responseMarkerRegex?, ... }
  },

  // HOW to extract (the directive the engine applies)
  extract: {
    standardAssignment: "from-header" | "sequential-next" | "catalog-text-match" | "explicit",
    specAssignment:     "first-column-letter" | "catalog-text-match" | "explicit",
    contentCell:        "last-non-marker" | "column-N" | "after-response-marker",
    promptResponseSplit:"response-marker" | "first-paragraph" | "none",
    classification:     "narrative" | "evidence-text" | "appendix" | "syllabus" | "cv" | "matrix" | "intro"
  },

  // Compare marker — ALWAYS emit (the §7d tag)
  anchor: { emit: true, wrap: "section", idFrom: "sectionId" },

  // learning + validation
  examples: [ { importId, excerpt, expectedOutput } ],
  confidence,
  contractChecks: { coverage, routing, kind, level, anchors, lossBound },  // last validation
  metrics: { appliedCount, passRate }
}
```

### How the realtime improvement happens
- The **engine** loads the active `parserRules` for the import's `format`+`scope` and applies matching rules per region (the AACC hardcoded rules become the first-generation seed rows).
- On a contract failure the **agent** (the graph's diagnose+refine nodes) synthesizes/updates a rule from items 1–4, writes it to `parserRules` (status `proposed`; auto-`active` if it passes §7f on the region + doesn't regress the fixtures), and **re-parses the affected region** — so the *current* document self-corrects and *future* documents inherit it.
- **Code vs data:** a new *shape* is a new rule row (realtime, no deploy). A new *primitive* the engine can't express (e.g. a brand-new file container) is the only thing that needs a human-gated code change. Semantic mis-routes still use the Qdrant few-shot channel.

## Baseline capture + golden regression tests (the safety net — build this FIRST)
We already have a **baseline parser** that correctly reads **MCC, AACC, and Kennesaw** (verified on prod). Before the rule store may evolve, we capture that known-good behaviour as the baseline rule set + golden tests. This is the immovable floor: no rule may ever regress a proven document.

1. **Capture the baseline rules (seed the store).** Run each proven document through the current parser and record the rule each region resolved under → write them to `parserRules` as the **`active` v1 baseline** (`scope: global` for generic shapes, `scope: institution` for institution-specific ones). This turns the rules currently *implicit* in `template_walker.py` / `format_detector.py` / the MCC pipeline into *explicit, versioned data* — the starting point every future rule extends, and the engine's first job is to **reproduce the baseline exactly**.
2. **Freeze golden snapshots = "the review screens of the actual documents".** For each proven document, snapshot its **verified prod review state**: the buckets (Standard/Sub-spec placement + content), the **file-type classification** (appendix / syllabus / CV / matrix), the introductions, and the **source-HTML anchor set** (every card's `data-section-id`) + the per-card Compare result (every marker *located*). These frozen fixtures are the golden expectation.
3. **Golden regression E2E.** A baseline suite re-imports each proven document and asserts the parse **matches its golden snapshot**: same bucket keys, same per-spec content (modulo whitespace), same file-type classification, **100% of items anchored → Compare *located* on every card**. This is the "E2E on this system compared against the review screens of the actual documents".
4. **The guardrail.** ANY rule change (a new/updated `parserRules` row from Parser Train) must keep **all** golden tests green before it can go `active`. A rule that fixes a new document but regresses a proven one is **rejected**. This is what makes the self-improving loop safe.

## Decision — the training loop (the graph's nodes + edges)
Standalone agent (a `cshse-ai` module + a CLI/endpoint), invoked per document, offline of the live import path. Each numbered step is a graph node:

1. **Parse** — run the real pipeline (`import_jobs._run_pipeline`) on the document; capture `buckets`, `introductions`, `tags`, `source_html`.
2. **Derive ground truth** — build the source inventory two ways and cross-check: (a) the document's own structure (headings/table cells), (b) the level's standard catalog (`load_specifications` / `standardsByLevel.json`). Standards are the ground truth ([[ai-parser-architecture]] §6).
3. **Validate** — run checks 1–6; produce a structured findings list (which spec, which check, expected vs actual, the offending source span).
4. **Diagnose** — for each finding, an LLM diagnosis step classifies it into a known failure class ([[ai-parser-architecture]] §8) or a new one, and proposes the minimal fix:
   - **Deterministic parser-rule refinement** (preferred) — e.g. "a 4-column response table", "a spec labelled with a roman numeral", "a Response marker written 'RESPONSE –'". Emitted as a proposed edit to `template_walker.py` / `format_detector.py` (or a config table of shapes) with a generated unit-test fixture, for human review before merge. This is how the AACC rules were born; the agent drafts them.
   - **Matcher few-shot example** — for semantic mis-routes, write a correction into the institution's Qdrant store (the existing `POST /api/imports/:id/corrections` RAG channel) so the matcher improves immediately, no code change. This is the "gets smarter with more documents" channel.
   - **Anchor repair** — if only anchoring failed, call the deterministic `_ensure_all_items_anchored` / `reanchor-source` (already exists).
5. **Re-verify** — re-run checks; loop until pass or a human-review gate (never silently ship a parser code change).
6. **Persist learning** — commit the new fixture + rule (human-gated) and/or the few-shot example (auto); append a dated `review` page enumerating findings + fixes (the AACC diagnosis, but automated).

### Three learning channels (why it compounds — and why it's realtime)
- **Structural rules (data, REALTIME):** each new document shape becomes a `parserRules` row (see §"What the realtime learner requires") the rule-engine reads at runtime → the *current* document self-corrects and *every* future document of that shape parses correctly, no deploy. This is the prime realtime channel.
- **Semantic (data, realtime):** each mis-route becomes a Qdrant few-shot for that institution's matcher → immediate, per-institution.
- **New primitives (code, human-gated):** only when the engine genuinely can't express a shape (a brand-new container/format) does it fall back to a code change + fixture, reviewed by a human. Rare by design.

The agent turns the one-off human diagnosis (AACC, 8 rules in one session) into a standing capability that runs on every new institution before a coordinator ever sees a broken panel.

## Acceptance
- **Baseline rule set v1 captured** from the three proven documents (MCC, AACC, Kennesaw) into `parserRules` as `active`; the rule-engine reproduces each proven parse **exactly** (byte-for-byte review state + anchor set).
- **Golden snapshots frozen** for all three proven documents (verified review state + file-type classification + full anchor/located set), and a **golden regression E2E** re-imports each and asserts a match; it is **green on the current parser**.
- **Guardrail enforced** — a Parser Train rule activation is **blocked** if it regresses any golden test.
- **Parser Train is superuser-only** — non-SU users cannot open it, cannot see a training run, and cannot see any train-mode Review screen.
- **Isolation** — a Parser Train run creates/uses only a sandbox training document; running it (and activating rules) leaves the MCC, AACC, and Kennesaw submissions' review state + editor **byte-for-byte unchanged** (asserted). Activated rules apply to future imports only; no existing submission is re-parsed.
- **Verify-in-Review** — the training output opens in the existing Review screen (SU-only train mode) with working Compare on every card (every marker *located*); the SU can add a **note** and attach a **screenshot** to any card, and those persist against the run.
- **Approve = activate rule** — approving a spec/sub-spec in the train-mode Review sets the producing rule `proposed → active`; that rule then applies to the next import of that shape (demonstrated on a re-run).
- Given the AACC, Kennesaw, and MCC documents, the agent runs, reports **0 contract failures** (or, on a seeded-broken parser, correctly finds them + proposes the fixes we shipped).
- Given a **new, unseen** self-study with a novel shape, the agent (a) flags the specific contract failures, (b) proposes a deterministic rule + fixture that makes it pass, and (c) for semantic mis-routes, writes few-shots that fix them without code — demonstrated on one held-out document.
- The anchor check (5) is part of the gate — a parse that routes perfectly but omits an item's `data-section-id` **fails** the agent (prevents the recurring Compare bug for every document).
- A dated `review` page is produced per run (findings + fixes), mirroring the manual AACC record.
- **Variety + hybrid coverage** — the agent passes the contract on the four canonical shapes (exact-spec, MCC-like, AACC-like, Kennesaw-like) AND on at least one **hybrid** fixture (e.g. tabular standards + free-narrative intro in one file), reconciled into a single review state + a single fully-anchored source HTML.

## Files affected (proposed)
- `ai-service/app/agent/parser_qa_agent.py` (new) — orchestrator: parse → validate → diagnose → refine → re-verify.
- `ai-service/app/agent/contract_checks.py` (new) — checks 1–6 over `(buckets, introductions, tags, source_html, level catalog)`.
- **`server/src/models/ParserRule.ts` + `parserRules` collection (new)** — the realtime rule store (schema above). Read by the engine each import; written by the agent.
- `ai-service/app/splitter/rule_engine.py` (new) — loads `parserRules` for the import's format+scope and applies matching rules per region; the current `template_walker` rules become the seed rows.
- **Baseline capture + golden tests (new):** `scripts/capture_baseline_rules.py` (run the proven docs → seed `parserRules` v1 + write golden fixtures), `e2e/fixtures/golden/{mcc,aacc,kennesaw}.json` (frozen verified review state + anchor set), `e2e/tests/parser-baseline-golden.spec.ts` (re-import each proven doc, diff against golden — the guardrail).
- `ai-service/app/agent/diagnose.py` (new) — LLM diagnosis + fix proposals (rule draft / few-shot / anchor repair).
- Reuse: `import_jobs._run_pipeline`, `standards/loader.py`, `matcher/spec_matcher.py`, the `/corrections` RAG channel, `_ensure_all_items_anchored`.
- **Parser Train (server):** `POST /api/parser-train` (SU-only — create a sandbox training run from an uploaded doc, run engine+agent, return the training submissionId); `POST /api/parser-train/:id/approve-spec` (SU approves a spec/sub-spec → activate its `parserRules`); notes/screenshots reuse the existing comment/attachment surface, scoped to the training run. Sandbox submissions carry a `trainingRun: true` flag and are excluded from all normal reader/PC/admin lists.
- **Parser Train (client):** an SU-only "Parser Train" entry; the existing Review screen gains a **train mode** (SU-only) where *approve* means "activate rule" (not materialise-to-editor) and each card exposes note + screenshot.
- Reuse: `import_jobs._run_pipeline`, `standards/loader.py`, `matcher/spec_matcher.py`, the `/corrections` RAG channel, `_ensure_all_items_anchored`, the Review screen + Compare + comments/attachments.
- Docs: this CR + [[ai-parser-architecture]] + [[agent-graph-loop-engineering]].

## Dependencies
- [[ai-parser-architecture]] (the contract it enforces).
- The level-correct standard catalog work — the agent's coverage check is only as good as the catalog; making `load_specifications('associate'|'masters')` truly level-correct (not derived-from-baccalaureate) is a sub-task so check 1 doesn't false-flag legitimate specs. See [[ai-parser-architecture]] §6.
- Qdrant corrections channel (exists).

## Open questions
1. ~~**Autonomy of code changes**~~ — **DECIDED (2026-07-25):** rules are **data** (`parserRules`), and a rule goes `active` only when the **SU approves the spec it parsed** in the Parser Train Review screen. No autonomous activation. New code (a genuinely new primitive) stays human-merged.
2. **Where does coverage ground truth win** when the document and the level catalog disagree (e.g. AACC Std 15 missing its `b.` label in the source)? Flag as a *source defect* (don't fail the parser) vs auto-recover. (Default: flag as source defect, surface to the coordinator.)
3. ~~**Run trigger**~~ — **DECIDED (2026-07-25):** SU-initiated via **Parser Train** on sandbox training documents. Not an automatic gate on live imports; existing submissions are never auto-re-parsed.
4. **Few-shot scope** — per-institution only, or promote a repeated correction to a global/default example? (Default: per-institution; promote after M institutions show the same correction.)
5. **Hybrid / combination documents** — today `detect_format` assigns ONE format to the whole file. When a single document mixes shapes (tabular curriculum standards + free-narrative intro; a template with an MCC-style scanned-appendix tail; some standards exactly-to-spec, others free-form), do we (a) upgrade detection to segment the document and run the right pipeline per region, or (b) keep one primary format and let the walker's per-section rules absorb the variation, or (c) let the agent detect the mismatch and route regions to sub-parsers? (Leaning (c): the agent recognizes a region the primary pipeline mis-handles and applies the matching rule set, reconciling into one review state + one anchored source HTML — because that is exactly the "impose your knowledge, wrong paths impossible" graph node the method calls for.)

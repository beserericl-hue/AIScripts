---
name: CR-045 — Self-Study Editor toolbar workflow alignment
description: PCs report the Self-Study Editor toolbar is disorganized and does not reflect the actual workflow. Seven controls (Standards, Curriculum Matrix, Supporting File Library, Import Document, Importer Wizard, Review, Matrix) sit at the same visual level even though they belong to three different categories (destinations / entry points / staging surfaces). Redesign in four pillars — group by workflow phase (INPUT · STAGE · AUTHOR), hide legacy importer behind a per-PC cogwheel preference (default on), add a phase indicator strip, rename to fix the Matrix naming collision.
type: change-request
cr_id: CR-045
status: shipped
priority: P1
source: User direction 2026-05-27 — "the UI is disorganized and does not reflect the workflow of the self-study ... what they want is to hide the importer or the AI importer depending on user preference"
sprint_target: Sprint 5 follow-on — depends on CR-001 (both importers shipped) and CR-043 (Review/Matrix surfaces promoted out of wizard)
tags: [ui, ux, toolbar, workflow, preferences, accessibility, simplification]
last_reviewed: 2026-05-27
revision_history:
  - 2026-05-27 — initial draft (proposed)
  - 2026-05-27 — removed migration banner (per user direction; not needed)
  - 2026-05-27 — accepted; locked final vocabulary (IMPORT / DRAFTS / SELF-STUDY group labels, Upload Files / Review / Matrix / Curriculum Matrix inner buttons, four-chip wizard phase indicator)
---

# CR-045 — Self-Study Editor toolbar workflow alignment

## Status: ACCEPTED 2026-05-27

Four open questions answered by the user 2026-05-27:

1. **Default value for `hideLegacyImporter`** — `true` for everyone. PCs who want the legacy importer back find the toggle in the cogwheel.
2. **Phase indicator placement** — above the toolbar, new horizontal strip.
3. **"Stage Matrix" naming** — rejected as too techie. Renamed via Approach C: the GROUP LABEL conveys staging; inner button stays `Matrix`. Group labels are `IMPORT` · `DRAFTS` · `SELF-STUDY` in plain English.
4. **Submit step in phase indicator** — both. Chip in indicator + standalone teal CTA, clicking chip scrolls to / focuses the CTA.

Plus one architectural refinement from the user:

> "The importer wizard is really the process of dragging or selecting file(s) to the window, and the entire process is part of the wizard approach, as it directs the workflow to the final draft."

The phase indicator at the top of the screen **is** the wizard. The wizard isn't one button — it's the four-step guided workflow. The inner button under IMPORT is renamed for what the teacher is actually doing: `Upload Files`.

Implementation is one CR shipped as a single PR — the four pillars reinforce each other and splitting them would leave an awkward intermediate state.

## Source quote

User, 2026-05-27, annotated screenshot of the Self-Study Editor for
Stevenson University:

> "There are several complaints from users that this UI is confusing and
> not aligned with the process. The main self study window is the window
> that displays the edited and completed self study. The work process is
> that the user imports from the AI importer or reads a file into the
> regular importer and does a lot of copy and pasting. The complaint is
> that the UI is disorganized and does not reflect the workflow of the
> self study. What they want is to hide the importer or the AI importer
> depending on user preference. Since there is no settings window for the
> PC, the PC can select the cogwheel icon which currently lets the user
> change the password or log out. If the AI importer is the default, then
> there should be a setting in the cogwheel menu that is a checkbox that
> says 'Hide legacy importer' and that should be checked by default. If
> so, the menu item Import File is hidden along with the screens that
> support that function."

## Problem

The current top toolbar puts **seven controls at the same visual level**
even though they belong to three different categories:

| Category | Buttons | What they actually are |
|---|---|---|
| **Destinations** (what gets published) | Standards · Curriculum Matrix · Supporting File Library | The self-study being authored |
| **Entry points** (where content comes from) | Import Document (Legacy) · Importer Wizard (AI) | Sources |
| **Staging surfaces** (between import + edit) | Review · Matrix | Triage queues |

A new PC sees seven equal-looking options with no signal that one is the
destination, one feeds it, and one stages content in between. The
implicit order (Standards · Matrix · Files · Import · Wizard · Review ·
Matrix) makes no sense as either a pipeline or a priority list.

Source layout: `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx:2142-2206`.

Specific problems documented in the audit:

1. **Categorical conflation.** Editing destinations, import sources, and
   staging surfaces sit side-by-side as if they were peers.
2. **Two importers visible by default.** "Import Document" (Legacy) +
   "Importer Wizard" (AI) — most PCs only want one.
3. **Duplicate-feeling "Matrix" entries.** Curriculum Matrix
   (destination) and Matrix (staging) are visually indistinguishable.
4. **No workflow direction.** Left-to-right doesn't reflect the
   pipeline.
5. **No progress indicator across phases.** Counter only reflects the
   final-edit phase.
6. **Settings cogwheel underused.** Only Change Password + Logout (see
   `client/src/components/Layout.tsx:226-260`).
7. **No PC-specific defaults.** Can't opt-in/opt-out of either importer.
8. **Hidden next-step discoverability.** Successful state of the wizard
   ends on "Next: Review" buried at the bottom, not in the toolbar.

## Decision

Approve all four pillars together; ship as one CR.

### Final vocabulary

The user rejected technical group labels (`STAGE`, `Stage Matrix`, etc.)
as too engineer-y. These are teachers, not computer scientists. The
locked vocabulary uses plain English at every layer:

| Layer | Plain-English label |
|---|---|
| Phase chip 1 | **1. Import** |
| Phase chip 2 | **2. Drafts** |
| Phase chip 3 | **3. Self-Study** |
| Phase chip 4 | **4. Submit** |
| Group label over importer | **IMPORT** |
| Group label over Review + Matrix | **DRAFTS** |
| Group label over Standards + Curriculum Matrix + Files | **SELF-STUDY** |
| Inner button (was "Importer Wizard") | **Upload Files** |
| Inner button (was "Matrix" in staging) | **Matrix** |
| Inner button (was "Curriculum Matrix" in final) | **Curriculum Matrix** |
| Cogwheel preference | **Hide legacy importer** |

The word "wizard" no longer appears as a button label — the **phase
indicator strip at the top of the screen IS the wizard.** The four
phase chips show the teacher where they are in the guided workflow.

### Pillar 1 — Group the toolbar by workflow phase

Replace the flat seven-button row with three semantic groups, each in
its own visual container:

```
IMPORT                DRAFTS                       SELF-STUDY
┌──────────────┐     ┌──────────────────────┐    ┌─────────────────────────┐
│ Upload Files │     │ Review  (15) ready   │    │ Standards     ◀ active  │
└──────────────┘     │ Matrix       (2)     │    │ Curriculum Matrix       │
                      └──────────────────────┘    │ Files                   │
                                                   └─────────────────────────┘
```

Left-to-right matches data flow. Each group carries a small label tag
(`IMPORT`, `DRAFTS`, `SELF-STUDY`) above it. Subtle dividers between
groups.

### Pillar 2 — Hide the legacy importer behind a per-PC preference

Default state for all PCs: legacy importer **hidden**. AI importer is
the only visible source. New users see one clean import button.

Cogwheel menu (`Layout.tsx:234-260`) adds a Preferences section:

```
⚙ User settings
├── PREFERENCES
│   └── ☑ Hide legacy importer        (default: on)
├── ────────────────────────────────
├── 🔑 Change Password
└── ⏏ Logout
```

When `hideLegacyImporter === true` (default):
- "Import Document" button is removed from the INPUT group.
- `showImportModal` state + the legacy modal component are not rendered
  (no dead React subtree).
- "AI" badge disappears from the AI Importer button (no longer needed
  to disambiguate).

When the PC unchecks the preference:
- "Import Document" reappears in the INPUT group.
- Both importers carry "Legacy" / "AI" badges to disambiguate.

**Persistence.** Add `preferences: { hideLegacyImporter?: boolean }`
subdoc to `User` (`server/src/models/User.ts`). Default `true` on new
reads — non-breaking because Mongoose defaults populate at read time.

### Pillar 3 — Add a phase indicator strip (the wizard's progress bar)

Above the toolbar. **This strip IS the wizard.** Each chip is a step
the teacher is being guided through.

```
[✓ 1. Import]  →  [◉ 2. Drafts (15)]  →  [3. Self-Study (1/29)]  →  [4. Submit]
```

States per step:
- `✓ done` — completed
- `◉ active` — current view in this phase
- `· open` — accessible but not started
- `· N/M ready` — quantitative readiness (Submit shows validation %)

Clicking jumps to the most-likely-useful view in that phase. The
fourth chip (`Submit`) ALSO has a standalone teal CTA in the
upper-right (existing behavior); clicking the chip scrolls to /
focuses the CTA.

### Pillar 4 — Eliminate the "Matrix" naming collision via group labels

The group labels (`DRAFTS` vs `SELF-STUDY`) disambiguate the two
"Matrix" buttons without renaming either one. The inner button names
stay short and plain:

| Where | Inner button label |
|-------|--------------------|
| `DRAFTS` group | **Matrix** (the AI-detected draft rows) |
| `SELF-STUDY` group | **Curriculum Matrix** (the published deliverable) |

A teacher reads `DRAFTS > Matrix` as "the draft matrix rows" and
`SELF-STUDY > Curriculum Matrix` as "the final curriculum matrix in
my self-study". Same word at the leaf level; the group context makes
the meaning unambiguous.

## Acceptance

**Server**
- `User.preferences.hideLegacyImporter` field exists, default `true`.
- `PATCH /api/auth/me/preferences` accepts `{ hideLegacyImporter?: boolean }`, returns updated preferences, 401 unauth.
- `GET /api/auth/me` includes `preferences` block.

**Client**
- Cogwheel menu shows Preferences section above Change Password.
- Toggling `Hide legacy importer` calls the PATCH endpoint and updates local state.
- When `hideLegacyImporter === true`, "Import Document" button is not in the DOM.
- When `false`, button appears in `IMPORT` group with `Legacy` badge.
- Toolbar renders three labeled groups (`IMPORT` · `DRAFTS` · `SELF-STUDY`) with dividers.
- `PhaseIndicator` strip renders above the toolbar with four chips: `1. Import`, `2. Drafts (N)`, `3. Self-Study (X/Y)`, `4. Submit`.
- Clicking a phase chip sets `activeView` to the canonical view for that phase. Clicking `4. Submit` scrolls to / focuses the existing teal Submit CTA in the upper-right.
- The previous "Importer Wizard" toolbar button is renamed `Upload Files`. The `AI` badge is removed (no sibling to disambiguate against).
- The previous AUTHOR-group "Curriculum Matrix" and DRAFTS-group "Matrix" inner labels stay as `Curriculum Matrix` and `Matrix` respectively — the group labels disambiguate them.

**Tests**
- `server/tests/unit/userController.test.ts` covers the PATCH /me/preferences endpoint (valid / invalid / unauth).
- `client/src/features/selfStudy/Editor/SelfStudyEditor.test.tsx` — legacy button hidden when pref=true, visible when pref=false.
- `client/src/components/Layout.test.tsx` — checkbox toggle calls updatePreferences.
- New `e2e/tests/33_legacy_importer_preference.spec.ts` — seed PC, legacy hidden by default; cogwheel → uncheck → legacy appears.
- Existing `e2e/tests/30_both_importers.spec.ts` updated to seed with `hideLegacyImporter: false` so it continues to exercise both paths.

## Files affected

- `server/src/models/User.ts` — add `preferences` subdoc.
- `server/src/controllers/userController.ts` (or `authController.ts`) — extend `/me` GET to return preferences; add PATCH `/me/preferences`.
- `server/tests/unit/userController.test.ts` — new tests.
- `client/src/store/authStore.ts` — hydrate `preferences` from `/me`; expose `updatePreferences` mutation.
- `client/src/components/Layout.tsx` — Preferences section in cogwheel menu (`Layout.tsx:234-260`).
- `client/src/components/Layout.test.tsx` — toggle behavior.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — toolbar regroup (`SelfStudyEditor.tsx:2142-2206`); conditional legacy button; drop "AI" badge when legacy hidden; mount `PhaseIndicator`.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.test.tsx` — new test cases.
- `client/src/features/selfStudy/Editor/PhaseIndicator.tsx` — **new** component.
- `client/src/features/selfStudy/Editor/PhaseIndicator.test.tsx` — **new** unit test.
- `e2e/tests/33_legacy_importer_preference.spec.ts` — **new** spec.
- `e2e/tests/30_both_importers.spec.ts` — update seed payload.

## Dependencies

- [[cr-001-both-importers-required]] — shipped. Establishes that the
  legacy importer must remain available, just not necessarily visible
  by default.
- [[cr-043-decouple-review-from-wizard-persist-across-reimport]] —
  shipped. Created the Review / Matrix toolbar buttons this CR
  regroups.
- [[cr-042-memberclick-sso-api-entry-point]] — shipped. Adds the
  `/me/preferences` PATCH endpoint shape we'll follow.

## Effort estimate

Per-PC machine-time scaling (the user's `2 days = 1 hour` rule):

| Task | Machine time |
|---|---|
| Server preferences plumbing + endpoint + tests | ~30 min |
| Client cogwheel preference toggle + auth-store wiring | ~30 min |
| Toolbar regrouping in SelfStudyEditor.tsx + tests | ~45 min |
| PhaseIndicator component + tests | ~30 min |
| E2E spec for the preference | ~30 min |
| **Total** | **~2 hours 45 min** |

## Open questions

All four resolved 2026-05-27 (see top of page). This section retained
as historical record:

1. **Default value for `hideLegacyImporter`** — RESOLVED: `true` for everyone.
2. **Phase indicator placement** — RESOLVED: above the toolbar.
3. **"Stage Matrix" naming** — REJECTED (all four candidates too techie). RESOLVED via Approach C: group labels carry the staging concept; inner button stays `Matrix`. Group labels are plain-English `IMPORT` / `DRAFTS` / `SELF-STUDY`. The first button is renamed `Upload Files`.
4. **Submit step in phase indicator** — RESOLVED: both chip + standalone CTA.

## Out of scope (future work)

- A dedicated **Settings page** for the PC (currently only admins have `/admin`). The cogwheel covers the immediate need.
- **Multi-user institution preferences** for institutions with several PCs preferring different importers. Current proposal is per-user.
- **Wizard auto-advance** — clicking the AI Importer button opens the wizard at the most recent step. Worth doing but separable.
- **Phase-completion checkmarks in empty states** ("Step 1: Import — nothing imported yet").

## Reference

Full audit document: `CSHSE/Engineering/ui-audit-self-study-editor-2026-05-27.md`
(staged for promotion into the wiki proper if reviewers want it
preserved separately; this CR page captures the actionable summary).

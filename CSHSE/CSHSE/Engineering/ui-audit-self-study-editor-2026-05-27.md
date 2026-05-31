# Self-Study Editor UI — Critical Audit + Redesign Proposal

**Date:** 2026-05-27
**Author:** Engineering (in response to PC user feedback)
**Status:** PROPOSAL — awaiting sign-off before implementation

---

## 1. Problem Statement

Program Coordinators (PCs) are reporting that the Self-Study Editor's toolbar
is **disorganized and does not reflect the actual workflow** of authoring a
self-study. The complaint is consistent across multiple users:

> "The UI is disorganized and does not reflect the workflow of the self-study."

The visible top toolbar puts seven controls at the same visual level:

```
[Standards] [Curriculum Matrix] [Supporting File Library] [Import Document Legacy] [Importer Wizard AI ready to review]
[Review ready] [Matrix 2]
```

Plus a Settings cogwheel that only contains *Change Password* and *Logout* —
no application preferences live there yet.

The mental model the PC actually holds is a **linear pipeline** with four
phases:

```
1. IMPORT  →  2. REVIEW  →  3. EDIT  →  4. SUBMIT
```

But the UI presents the seven toolbar buttons as if they're all equal,
parallel options. A new PC has no idea where to start, what comes next, or
which controls belong to the same phase.

This document audits the current UI, identifies the root organizational
problems, and proposes a concrete redesign that aligns to the PC's actual
workflow.

---

## 2. Critical Audit — what the toolbar is showing today

### 2.1 The seven controls and their actual roles

| # | Label | Type | What it actually does |
|---|-------|------|------|
| 1 | **Standards** | View | Renders the final self-study being authored, spec-by-spec, with the rich-text editor for narrative + table editing. The published deliverable. |
| 2 | **Curriculum Matrix** | View | Renders the curriculum-matrix editor (course × spec grid). Part of the published deliverable. |
| 3 | **Supporting File Library** | View | Renders the file-evidence library. Part of the published deliverable. |
| 4 | **Import Document** (Legacy) | Action (modal) | Opens the legacy paste-and-tag modal. Used to be the only importer. |
| 5 | **Importer Wizard** (AI) | View | Opens the AI Importer Wizard — upload a DOCX, the AI parses + classifies content. |
| 6 | **Review** (ready) | View | The persisted Review surface — staging area for AI-imported items waiting to be approved/discarded before they land in the Standards editor. |
| 7 | **Matrix** (2) | View | The persisted Matrix surface — staging area for AI-extracted curriculum-matrix rows. |

Controls **1–3** are *destinations* (the self-study being authored).
Controls **4–5** are *entry points* (where content comes from).
Controls **6–7** are *staging surfaces* (between import and destination).

The current toolbar **collapses all three categories into a flat row** with
no visual hierarchy.

### 2.2 Specific UX problems

1. **Categorical conflation.** Editing destinations, import sources, and
   staging surfaces sit side-by-side as if they were peers. A PC seeing
   "Standards" and "Importer Wizard" in the same row has no signal that
   one is a destination and the other is the way content gets there.

2. **Two importers, two paradigms, both visible by default.** The legacy
   "Import Document" paste-and-tag flow and the AI-based "Importer Wizard"
   appear together with a "Legacy" badge on one and "AI" on the other.
   Most PCs only want one. Showing both forces every PC to make a meta-
   decision about which to use on every visit.

3. **Duplicate-feeling "Matrix" entries.** "Curriculum Matrix" (destination)
   and "Matrix" (staging) are visually indistinguishable in the toolbar.
   A PC who clicks "Matrix" expecting to see the final matrix gets the
   staging UI instead, and vice versa.

4. **Hidden workflow direction.** The buttons are arranged left-to-right
   but the actual data-flow direction isn't reflected. Why is Standards
   first? Because alphabet? Because importance? Because it's the
   destination? The current order ([Standards] [Matrix] [Files] [Import]
   [Wizard] [Review] [Matrix]) makes no sense as either a pipeline OR a
   priority list.

5. **No progress indicator across phases.** A PC working through the
   pipeline has no view-level cue telling them "you've imported, you're
   reviewing now, then you'll edit". The "1/29 Standards · 1/83 Validated"
   counter only reflects the final-edit phase.

6. **Settings cogwheel is underused.** The cogwheel currently has only
   Change Password + Logout. It's the obvious place for per-PC
   preferences, but the application doesn't yet treat it that way.

7. **No PC-specific defaults.** A site-wide PC who never uses the legacy
   importer has to look past it on every visit. There's no opt-in/opt-out
   for which import paradigm the PC uses.

8. **Discoverability of the next step.** After completing an import, the
   PC sees "Review (ready)" appear with a badge, but nothing actively
   directs them to click it. The successful state of the wizard ends on
   a "Next: Review" button buried at the bottom of the wizard, not in
   the toolbar.

---

## 3. Proposed Redesign — three pillars

### Pillar 1 · Group the toolbar by workflow phase

Replace the flat seven-button row with three semantic groups, each in
its own visual container, with explicit labels:

```
┌─ INPUT ────────────┐ ┌─ STAGE ───────────────┐ ┌─ AUTHOR ─────────────────────────────┐
│ 🪄 Import          │ │ 👁 Review     (15)   │ │ 📝 Standards  📊 Matrix  📁 Files    │
│   (uploaded file)  │ │ 📊 Stage Matrix (2)  │ │   1/29 Validated · 1/83 Sub-specs   │
└────────────────────┘ └──────────────────────┘ └──────────────────────────────────────┘
```

- **INPUT** — where content enters the system. AI Importer Wizard (and
  Legacy paste-and-tag, if enabled by preference).
- **STAGE** — where imported content waits for PC triage before landing in
  the published deliverable. Persisted across sessions. Badge counts show
  unread items.
- **AUTHOR** — the published self-study being written. Standards (narrative),
  Curriculum Matrix (course-spec grid), Supporting File Library (evidence).
  This is what gets submitted to the reader.

Visual treatment options:
- Background-tinted card per group (faint cshse-50)
- A small label tag above each group ("INPUT", "STAGE", "AUTHOR")
- Subtle dividers between groups (vertical bars)

The implicit order — left to right — matches the data flow: file goes IN,
gets STAGED, gets AUTHORED.

### Pillar 2 · Hide the legacy importer behind a per-PC preference

Default state for all PCs: legacy importer is **hidden**, AI importer is
the only visible source. New users see one clean import button.

Cogwheel menu adds a Preferences section:

```
⚙ Settings
  ┌─ Preferences ────────────────────────┐
  │ ☑ Hide legacy importer (default on) │
  │ ☐ Show stage badges in title bar    │   ← future preferences hook
  └──────────────────────────────────────┘
  Change Password
  Logout
```

When `hideLegacyImporter === true` (default):
- The "Import Document" button is removed from the INPUT group.
- The `showImportModal` state and the legacy modal component are not
  rendered (no dead React subtree).
- The "AI" badge disappears from the AI Importer button (no longer needed —
  it's the only one).

When the PC unchecks the preference (e.g., long-tenured PC who prefers the
paste-and-tag flow):
- "Import Document" reappears in the INPUT group.
- Both importers carry their "Legacy" / "AI" badges to disambiguate.

**Persistence.** Add a `preferences: { hideLegacyImporter?: boolean }`
subdoc to `User`. Default `true` on new users; `false` on existing users
(non-breaking migration — current PCs keep what they have until they
toggle it).

### Pillar 3 · Add a phase indicator + active-step cue

Above the toolbar (or replacing the breadcrumb), show a four-step
indicator:

```
[1. Import]  →  [2. Review]  →  [3. Author]  →  [4. Submit]
   ✓ done       ◉ active        · open          · 1/29 ready
```

States per step:
- `✓ done` — completed (e.g., an import has finished)
- `◉ active` — the user's current view falls in this phase
- `· open` — accessible but not started yet
- `· N/M ready` — quantitative readiness (final Submit phase shows
  validation progress)

Clicking a phase chip jumps to the most-likely-useful view inside that
phase:
- Click `Import` → opens AI Importer Wizard (or last-used import view)
- Click `Review` → opens Review surface (no-op if empty)
- Click `Author` → opens Standards editor
- Click `Submit` → opens the Submit modal (disabled if not ready)

### Pillar 4 · Eliminate the "Matrix" naming collision

Today the toolbar has both **Curriculum Matrix** (destination) and
**Matrix** (staging). Rename the staging one to something unambiguous:

| Today | Proposed |
|-------|----------|
| Curriculum Matrix (in AUTHOR) | **Matrix** |
| Matrix (in STAGE) | **Stage Matrix** OR **Matrix queue** |

A PC who imports a docx with curriculum tables sees "Stage Matrix (2)"
in the STAGE group — clearly the temporary queue. The final published
table lives in AUTHOR under "Matrix".

---

## 4. Concrete proposed toolbar layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Self-Study Portal              E Louis Beser    [Program Coordinator]   [⚙]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Self-Study Editor                                                              │
│  Stevenson University - BACCALAUREATE DEGREE IN HUMAN SERVICES                 │
│                                                                                 │
│  [✓ 1. Import]  →  [◉ 2. Review (15)]  →  [3. Author (1/29)]  →  [4. Submit]   │
│                                                                                 │
│  INPUT                STAGE                       AUTHOR                        │
│  ┌──────────────┐    ┌──────────────────────┐    ┌─────────────────────────┐  │
│  │ 🪄 Importer  │    │ 👁 Review (15) READY │    │ 📝 Standards  ◀ active  │  │
│  └──────────────┘    │ 📊 Stage Matrix (2)  │    │ 📊 Matrix               │  │
│                       └──────────────────────┘    │ 📁 Files                │  │
│                                                    └─────────────────────────┘  │
│                                                                                 │
│  1/29 Standards · 1/83 Validated      [Submit Self-Study for Review (disabled)] │
└─────────────────────────────────────────────────────────────────────────────────┘
```

When `hideLegacyImporter === false`:
```
INPUT
┌──────────────────────────┐
│ 🪄 Importer Wizard  AI   │
│ 📥 Import Document LEGACY│
└──────────────────────────┘
```

---

## 5. Implementation plan

### 5.1 Server changes

**File:** `server/src/models/User.ts`

Add a `preferences` subdoc:

```typescript
preferences: {
  hideLegacyImporter: { type: Boolean, default: true },
  // room for future preferences
}
```

**File:** `server/src/controllers/userController.ts` (new endpoint or extend
existing `/api/auth/me` PATCH)

```
PATCH /api/auth/me/preferences
Body: { hideLegacyImporter?: boolean }
Returns: { ok: true, preferences: {...} }
```

**Migration.** No backfill required — Mongoose `default: true` applies to
new reads. Existing PCs see the legacy importer hidden by default on
next page load. (One small communication caveat — see §6.)

### 5.2 Client changes

**File:** `client/src/components/Layout.tsx`

Extend the cogwheel `showUserMenu` block with a Preferences section:

```tsx
<div className="border-t border-gray-100 my-1" />
<div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500">
  Preferences
</div>
<label className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
  <input
    type="checkbox"
    checked={preferences.hideLegacyImporter}
    onChange={(e) => updatePreferences({ hideLegacyImporter: e.target.checked })}
  />
  Hide legacy importer
</label>
```

**File:** `client/src/store/authStore.ts` (or wherever user state lives)

Hydrate `preferences` from `/api/auth/me`, expose `updatePreferences`
mutation that PATCHes the new endpoint and updates local state.

**File:** `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx`

Three changes:

1. **Hide the legacy button when preference is true.** Wrap the existing
   `Import Document` button in `{!preferences.hideLegacyImporter && ...}`.
   Likewise hide `showImportModal` rendering.

2. **Group the toolbar buttons into three semantic clusters.** Replace
   the existing `<div className="flex flex-wrap items-center gap-1
   border-l pl-3 border-gray-200">` with three sibling divs, each
   tagged with a header label.

3. **Drop the "AI" badge on the wizard button when legacy is hidden.**
   The badge is only needed to disambiguate from a sibling.

**File:** `client/src/features/selfStudy/Editor/PhaseIndicator.tsx` (new)

A small component that takes `submission` + `activeView` and derives
the current phase, with click handlers per chip.

**File:** `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx`

Mount `<PhaseIndicator>` above the toolbar.

### 5.3 Tests

- **Server unit:** `userController.test.ts` — PATCH `/me/preferences` with
  valid/invalid bodies. Returns 401 if unauthenticated; persists; reads
  back via GET `/me`.

- **Client unit:** `SelfStudyEditor.test.tsx` — when
  `preferences.hideLegacyImporter === true`, the "Import Document" button
  is not rendered. When `false`, it is rendered with the "Legacy" badge.

- **Client unit:** `Layout.test.tsx` — checking the preference toggle
  calls `updatePreferences` and the cogwheel reflects the new state.

- **E2E:** `33_legacy_importer_preference.spec.ts` (new) — seed a PC,
  verify legacy button hidden by default; click cogwheel → uncheck
  preference; legacy button appears.

- **E2E regression:** existing `30_both_importers.spec.ts` — explicitly
  set `hideLegacyImporter: false` in the seed payload so the spec
  continues to exercise both paths.

---

## 6. Migration considerations

**E2E test fixtures.** Tests that currently click "Import Document"
need to seed the user with `hideLegacyImporter: false`. The seed
router already supports arbitrary overrides — add the field to the
fixture JSON.

**Telemetry / discovery.** Optional: log the first time a PC opens the
cogwheel post-redesign so we can see adoption.

(No deploy-time banner — users will discover the toggle via the
cogwheel menu itself.)

---

## 7. Out-of-scope (future work)

- A dedicated **Settings page** for the PC (currently only admins have
  `/admin`). The cogwheel covers the immediate need; a full settings
  page can land later.
- **Multi-importer preference** for institutions that have several PCs
  with different preferences. The current proposal is per-user.
- **Wizard auto-advance** — clicking the AI Importer button could open
  the wizard at the most recent step (Upload, Parse, Review) instead of
  always starting at Upload. Worth doing but separable.
- **Theming the phase indicator** — once the phase indicator is in, we
  could surface phase-completion checkmarks even in the empty state
  ("Step 1: Import — nothing imported yet").

---

## 8. Open questions for sign-off

1. **Default value for `hideLegacyImporter`** — is `true` (default-hidden
   for everyone) correct, or should we treat the legacy flag as
   `false` for existing users (preserve their current view) and `true`
   only for new users? My recommendation: `true` for everyone — it's
   simpler and the PCs you've already talked to want the legacy gone.
   PCs who do want it back will find the toggle in the cogwheel.

2. **Phase indicator placement** — above the toolbar (new horizontal
   strip) or inside the toolbar (replacing the breadcrumb)?
   Recommendation: above, with reduced toolbar height so total chrome
   doesn't grow.

3. **"Stage Matrix" vs alternative names** — possible alternatives:
   "Matrix Queue", "Pending Matrix", "Matrix (staging)". Pick one
   before implementation; my preference is "Stage Matrix" because it
   pairs with "Review" semantically.

4. **Submit step in the phase indicator** — do we want the Submit button
   to live inside the phase indicator (as "[4. Submit]") OR keep it as
   the standalone teal CTA in the upper-right (current layout)?
   Recommendation: keep the standalone CTA but ALSO show it as a phase
   chip — clicking the chip scrolls to / focuses the CTA.

---

## 9. Effort estimate

Per-PC machine-time scaling (the user's `2 days = 1 hour` rule):

- Server preferences plumbing + endpoint + tests: **~30 min**
- Client cogwheel preference toggle + auth-store wiring: **~30 min**
- Toolbar regrouping in SelfStudyEditor.tsx + tests: **~45 min**
- PhaseIndicator component + tests: **~30 min**
- E2E spec for the preference: **~30 min**

Total: **~2 hours 45 min machine-time** to ship the full redesign with
tests green and deployed to dev.

---

## 10. Recommendation

Approve all four pillars together. Splitting the redesign into smaller
pieces would leave an awkward intermediate state where the toolbar is
half-grouped or the preference exists without the visual reorganization.
The four changes (group, hide, indicator, rename) are individually small
but reinforce each other — they should ship as one CR.

Once approved, suggested CR identifier: **CR-045 — Self-Study Editor
toolbar workflow alignment**.

---

## Appendix A — Component map (current state)

```
SelfStudyEditor.tsx (~3000 LOC)
├── ProgressIndicator (overall validation %)
├── Toolbar (flat 7-button row)
│   ├── Standards button → activeView='standards'
│   ├── Curriculum Matrix button → activeView='curriculum'
│   ├── Supporting File Library button → activeView='files'
│   ├── Import Document button → setShowImportModal(true)   [LEGACY]
│   ├── AIImportTabButton → activeView='ai-import'
│   ├── ReviewSurfaceButton → activeView='review-surface'
│   └── MatrixSurfaceButton → activeView='matrix-surface'
├── Active view (one of):
│   ├── StandardsEditor
│   ├── CurriculumMatrixEditor
│   ├── SupportingFileLibrary
│   ├── AIImportWizard
│   ├── ReviewSurface
│   └── MatrixSurface
├── ImportDocumentModal (showImportModal)
└── Submit modal
```

## Appendix B — Component map (proposed)

```
SelfStudyEditor.tsx
├── PhaseIndicator (new)              ← above toolbar
├── Toolbar (3 semantic groups)
│   ├── INPUT
│   │   ├── AIImportTabButton                   ← always shown
│   │   └── ImportDocumentButton                ← hidden if pref=true
│   ├── STAGE
│   │   ├── ReviewSurfaceButton                 ← badge: ready count
│   │   └── MatrixSurfaceButton (→ "Stage Matrix") ← badge: ready count
│   └── AUTHOR
│       ├── StandardsButton                     ← active style when current
│       ├── MatrixButton (→ "Matrix")
│       └── SupportingFileLibraryButton
├── ProgressIndicator (1/29 · 1/83)             ← right of toolbar
├── SubmitButton                                ← far right
├── Active view (one of):
│   ├── StandardsEditor
│   ├── CurriculumMatrixEditor
│   ├── SupportingFileLibrary
│   ├── AIImportWizard
│   ├── ReviewSurface
│   └── MatrixSurface
└── ImportDocumentModal (rendered iff pref.legacy=false)
```

## Appendix C — Cogwheel menu (proposed)

```
⚙ User settings
├── PREFERENCES
│   └── ☑ Hide legacy importer        (default: on)
├── ─────────────────────────────
├── 🔑 Change Password
└── ⏏ Logout
```

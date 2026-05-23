---
name: Marketing Plan — 2026-05-11 (revised 2026-05-23)
description: Case-study reference video for the CSHSE Accreditation Self-Study Portal. ~3:30 Heygen narration + screen-capture B-roll. Headlines the AI Import Wizard. No CTA, no signup — CSHSE is members-only.
type: marketing
audience: existing CSHSE member institutions + Council staff (reference, not prospect-facing)
horizon: case-study reference video — one asset (3:50 video + filming instructions any operator can follow)
status: ready-to-record
plan_date: 2026-05-11
last_reviewed: 2026-05-23
revision: 2026-05-23 — rewritten to lead with AI Import Wizard; folded in all features shipped through morning of 2026-05-23 (CR-031 unplaced context, CR-032 inline edit, CR-033 discard button, table preservation in + Add from source, slid-window Show in source). Removed all newsletter, subscribe, and "request a walkthrough" CTAs — CSHSE has no signup; this is a member case study only. Made every section operator-runnable from a fresh computer with no local-dev setup.
---

# Marketing Plan — Case Study Reference Video

Production-ready package for a ~3:30 case-study reference video showing the CSHSE Accreditation Self-Study Portal as it exists in the deployed environment. Designed so a contractor or staff member on any computer — with browser access and the deployed-app credentials — can complete the recording without engineering involvement.

> **Product name:** CSHSE Accreditation Self-Study Portal
> **Full org name:** Council for Standards in Human Service Education (CSHSE)
> **Target run time:** ~3:30 · Heygen avatar narration at ~150 wpm · 512 words
> **B-roll source:** screen captures from the running deployed app at https://cshse-develop.up.railway.app
> **Distribution:** case study reference for existing CSHSE members. NOT a sales / prospect asset. NO signup, newsletter, or CTA copy.

For technical context on what the product actually does, see [[overview]], [[product-requirements]], [[../Engineering/ai-import-wizard-e2e-coverage-review-2026-05-22|the AI Import Wizard coverage review]], and the change-request catalog at [[../Engineering/change-requests/index]].

## 1. Page copy (for any CSHSE-hosted reference page that frames the video)

### Hero

**Accreditation, simplified.**

The CSHSE Accreditation Self-Study Portal — a purpose-built workspace for the **Council for Standards in Human Service Education** and its member institutions.

### Body

The Portal turns the most paperwork-intensive part of accreditation into a guided workflow. Built specifically for the **Council for Standards in Human Service Education (CSHSE)** and its member institutions, the Portal supports Associate, Baccalaureate, and Master's-level Human Services programs through every step of the accreditation cycle — preparation, submission, peer review, and Council decision.

### What's in v1

- **AI Import Wizard** — Upload an existing self-study Word document; the Portal reads it, organizes the contents against the CSHSE National Standards, and lets the coordinator review every placement before committing. Edit, discard, or re-route any item inline. Tables and matrices preserved end-to-end.
- **Self-Study Editor** — Rich-text per-Standard narrative editing with the Standard's text right beside you, two-second auto-save, and structured curriculum-matrix and supporting-evidence views.
- **Reader workspace** — Split-screen Yes / No / Not-Applicable assessments, inline comments anchored to specific passages, dual-approval change requests.
- **Lead Reader compilation** — Disagreement detection across reviewers, bulk final determinations.
- **Site visits, change requests, and Board-decision automation** — all on a single audited trail.
- **Member Handbook chat** — Trained on the CSHSE Member Handbook; answers your "how do I" questions twenty-four seven.

**Built for:** Program Coordinators · Readers · Lead Readers · CSHSE administrators.

**SaaS-hosted. Role-secured. Audit-logged.**

---

## 2. Heygen Master Script (paste-ready, single block)

Paste this directly into Heygen as one script. 512 words. ~3:24 at 150 wpm, ~3:40 at 140 wpm. Plan on ~3:30 with natural pacing.

```
For accredited Human Services programs, the self-study cycle is intense. Hundreds of pages, dozens of Standards, every five years. The Council for Standards in Human Service Education — CSHSE — has been working with its member institutions to reduce that overhead. This is what they built.

The CSHSE Accreditation Self-Study Portal is a purpose-built workspace where Program Coordinators, Readers, Lead Readers, and Council staff work together on one secure platform. Member institutions sign in through the existing CSHSE member portal — no separate account to maintain.

The heart of the Portal is the AI Import Wizard. Instead of formatting a self-study by hand, a coordinator drops their existing Word document — even a three-hundred-page one — and the Wizard reads, organizes, and routes everything against the CSHSE National Standards.

The Document Reader extracts the document's structure. The AI then places each paragraph into the Standard and sub-specification it best matches, using both meaning and the context around it. Tables, syllabi, and curriculum matrices keep their structure throughout.

For faculty curriculum matrices, the Wizard reviews each row one at a time and infers the right sub-specification from the matrix codes. The coordinator keeps, retags, or removes rows individually — no more giant spreadsheets to fix by hand.

Then comes the Review screen, where the coordinator stays in full control. Every placed item appears as a card under its target Standard and sub-specification, color-coded by confidence.

For each card the coordinator can — edit the text in place to trim what isn't needed, discard cards the AI placed incorrectly, click "Show in source" to verify against the original document, or use "Add from source" to pull in text the AI may have missed. Anything the AI couldn't confidently place lands in a separate "Unplaced" bucket, with context showing where it sat in the document so it's easy to triage.

Every edit, every discard, every move survives a browser refresh. Nothing is lost mid-review.

Once the coordinator approves the review, a single click applies everything to the Self-Study Editor — narratives populated, curriculum matrix populated, supporting evidence linked to the right specifications.

From there, the Self-Study Editor is where the coordinator polishes the response — rich-text editing with the Standard's text beside them, two-second auto-save, and the curriculum matrix as a structured spreadsheet. Supporting evidence — syllabi, advisory minutes, surveys, signed certificate pages — lives in the Supporting File Library, organized by Standard, versioned, audit-trailed.

When the self-study is submitted, assigned Readers open a split-screen workspace. They mark each sub-specification Yes, No, or Not Applicable, leave comments anchored to specific passages, and request changes through a dual-approval workflow.

The Lead Reader compiles every Reader's input, highlights disagreements, and sets a final determination ready for the Council Board. Site visits, change requests, and Board decisions all flow through the same audited trail.

For coordinators who need help mid-flow, the built-in chat reads from the CSHSE Member Handbook and answers questions in plain English — twenty-four seven.

This is the CSHSE Self-Study Portal — built for the Council, by people who understand what accreditation actually feels like.
```

---

## 3. Scene-by-Scene Production Plan

11 scenes, each between 15 and 35 seconds. Narration cell is paste-ready for per-scene Heygen production (recommended for cleaner narration-to-video sync — see §5 for the per-scene blocks).

| # | Time | Scene | Narration (recap) | B-roll directions | Text overlay |
|---|------|-------|-------------------|-------------------|--------------|
| 1 | 0:00–0:20 | **Hook + CSHSE intro** | Hundreds of pages, dozens of Standards, every five years. CSHSE has been working to reduce that overhead. | Static title-card screenshot — open the deployed landing page or `Dashboard` view. 8-second slow Ken-Burns zoom (1.0 → 1.05). | Title: **"Accreditation, simplified."** Sub: *"A CSHSE member case study."* |
| 2 | 0:20–0:35 | **Portal intro + sign-in** | A purpose-built workspace. Member institutions sign in through the existing CSHSE member portal. | Open `/login` → enter test coordinator email → land on Dashboard. Show the four role chips (PC, Reader, Lead Reader, Admin) appear in sequence. | Lower-third: **"Council for Standards in Human Service Education"** Pulse-highlights on each role name. |
| 3 | 0:35–0:55 | **AI Import Wizard — Upload** | The heart of the Portal is the AI Import Wizard. Drop your existing Word document. | Open the Self-Study Editor → click **Importer Wizard** → land on Step 1 (Upload). Drag a sample `.docx` into the dropzone. Click **Start**. | Overlay during drop: *"Drag a .docx file here"* On Start click: *"AI Import Wizard — Step 1 of 5"* |
| 4 | 0:55–1:30 | **Parse → Match (Document Reader)** | The Document Reader extracts structure. The AI places each paragraph into the matching Standard. Tables, syllabi, matrices preserved. | Record Step 2 (Parse) — show all five stages ticking green: Document Reader → Reading structure → Building chunks → Embedding → Indexing. Cut to Step 3 (Match) — show the confidence bucket distribution. | Overlay above stage list: *"5-stage Document Reader pipeline"* Highlight as each green check appears. |
| 5 | 1:30–1:55 | **Matrix step — row-by-row** | For faculty matrices, the Wizard reviews each row one at a time and infers the right sub-spec. Keep, retag, or remove individually. | Step 4 (Matrix) — show a row card with the original document row highlighted in yellow + the inferred sub-spec chip (e.g., "Spec 11.b"). Click **Keep this row**. Advance to next row. Click **Remove this row** on one. Open dropdown to **Retag** another. | Overlay: *"Faculty matrices — one row at a time"* On Keep: *"Cells preserved in the Curriculum Matrix"* |
| 6 | 1:55–2:35 | **Review step — coordinator in control** | Every placed item appears as a card, color-coded by confidence. Edit, Discard, Show in source, Add from source, Unplaced bucket — every edit survives a refresh. | Step 5 (Review) — open SpecRail; click into Spec 1.a. Show 3 narrative cards with green confidence stripes. **(a) Click pencil → trim a sentence → Save** — show the "edited" badge appear. **(b) Click Discard on a low-confidence card → confirm** → card disappears. **(c) Click Show in source on another card → modal opens scrolled to the matching paragraph** (highlighted amber). **(d) Click + Add from source on an empty spec → highlight a sentence in the modal → confirm** → new card appears. **(e) Click Unplaced bucket → show one item with the neighbor-context panel showing the spec just above it.** **(f) Hard-refresh the browser → return to Review → all changes persist.** | Overlays as actions happen: *"Edit in place"* · *"Discard with one click"* · *"Verify against the source"* · *"Add what the AI missed"* · *"Unplaced — with context"* · *"Every change persists"* |
| 7 | 2:35–2:50 | **Apply — commit to the Self-Study** | One click applies everything to the Self-Study Editor. | Step 6 (Apply) — show the diff modal totals ("212 narratives · 64 evidence text · 9 evidence files · 412 matrix cells"). Click **Apply to editor**. Land on the populated Self-Study Editor. | Overlay on Apply click: *"One click — narratives, matrix, evidence — all populated."* |
| 8 | 2:50–3:10 | **Self-Study Editor + Matrix + File Library** | Rich-text editing with the Standard beside you, auto-save, structured matrix, organized files. | Self-Study Editor top nav — click **Standards** (show TipTap narrative + Spec side panel + Saved indicator). Click **Curriculum Matrix** (show the populated structured matrix). Click **Supporting File Library** (show files organized by Standard with version badges). | Overlay: *"Two-second auto-save"* (on Saved indicator) · *"Versioned. Audit-trailed."* (on file library) |
| 9 | 3:10–3:30 | **Reader workspace** | Assigned Readers see a split-screen workspace. Mark Y/N/NA. Comments anchored to passages. Dual-approval change requests. | Sign in as Reader role (use a separate browser window if convenient). Open an assigned submission → split-screen view. Right-click a sentence → **Add comment**. Click a Y/N/NA pill on a sub-specification. | Type comment: *"Please cite the advisory minutes referenced here."* Overlay on Y/N/NA: *"Compliance assessment per sub-specification"* |
| 10 | 3:30–3:45 | **Lead Reader compilation** | Lead Reader compiles every Reader's input, highlights disagreements, sets the final determination. | Sign in as Lead Reader (separate browser window). Open the Lead Reader Compilation view. Show the disagreement-detection list (Reader A "Yes", Reader B "No" on the same sub-spec). Click **Set Final Determination → Met**. | Overlay: *"Disagreements surfaced automatically"* On final determination: *"Sent to the Council Board"* |
| 11 | 3:45–3:55 | **Help chat + close** | Built-in chat reads from the CSHSE Member Handbook. Built for the Council, by people who understand what accreditation actually feels like. | Back in Coordinator view → click the HelpChat floating bubble (bottom-right). Type a question. Show the AI response streaming. End on a clean Dashboard view with a slow zoom-out. | Type into chat: *"What is the 45-day reader deadline?"* Final card: *"CSHSE Accreditation Self-Study Portal — Council for Standards in Human Service Education"* |

Note Scene 6 is intentionally the longest. The Review screen is the place where the AI Import Wizard's value lives — the coordinator stays in control over every placement, with multiple recovery affordances. Six sub-actions are filmed in sequence; allow that scene to breathe.

---

## 4. Operator Setup — what you need before you start recording

Designed so a contractor on a fresh laptop can complete the recording without any engineering setup. Follow this checklist in order.

### 4.1 Hardware + software

- **Computer:** any macOS or Windows laptop, 16 GB RAM minimum, 1920×1080 or higher display.
- **Browser:** latest Chrome or Edge. Set to 100% zoom. Disable extensions for the recording session (private/incognito mode is easiest — but you'll need to sign in fresh).
- **Screen recorder:**
  - **macOS:** built-in `Cmd+Shift+5` works for short clips. For 10+ minutes of recording, use **OBS Studio** (free, https://obsproject.com).
  - **Windows:** Xbox Game Bar (built in, Win+G) or **OBS Studio**.
- **Editor:** **DaVinci Resolve** (free, https://www.blackmagicdesign.com/products/davinciresolve/). Cuts, lower-thirds, audio mixing, and Heygen narration overlay all work in the free tier.
- **Static-screenshot tool:** macOS `Cmd+Shift+4` or Windows Snip & Sketch. Save PNG at 2× resolution.
- **Heygen account:** the staff member or contractor running this needs a Heygen Studio login. Avatar choice is in the cshse-marketing brand kit; if no kit exists, the Heygen default "Anna" or "Daniel" avatar reads cleanly.

### 4.2 Accounts you need (request from the CSHSE admin before you start)

You need credentials for **four roles** in the deployed dev environment. The CSHSE administrator can issue these via the existing Admin → Users → Invite flow. Email + password, or a single SSO-enabled MemberClick test account (once CR-042 ships).

| Role | What it's for | Recording uses |
|---|---|---|
| Program Coordinator | The PC view (most of the video) | Scenes 2–8, 11 |
| Reader | Reader workspace | Scene 9 |
| Lead Reader | Lead Reader compilation | Scene 10 |
| Admin | Optional — for impersonation if separate Reader/Lead-Reader logins are unavailable | Fallback for Scenes 9–10 |

Have the credentials in a password manager (1Password, Bitwarden, Apple Keychain) ready to copy-paste. Never type passwords into the visible screen during recording.

### 4.3 Test data you need in the environment

The CSHSE administrator should pre-seed:

- **One test institution** ("E2E Test University" or similar) with a real BACCALAUREATE or ASSOCIATE program.
- **One test submission** in `in_progress` status for that institution, assigned to the test PC + 2 test Readers + 1 test Lead Reader.
- **At least one prior import already applied** so the Self-Study Editor (Scene 8) and the Reader/Lead-Reader views (Scenes 9–10) have realistic content to display.

A sample `.docx` file for the import demo. Two good choices already in the repo:

- `CSHSE/docs/ASSOCIATE Self_Study_Reader Report template_ Associate degree July 2025.docx` — ~150 pages, full structure.
- `CSHSE/docs/Sample to Council from KSU.docx` — real-world submission, more compact.

Download whichever is preferred to the recording computer's Desktop in advance.

### 4.4 Environment

- **App URL:** `https://cshse-develop.up.railway.app/`
- **Recording resolution:** 1920×1080 at 60 fps (or 30 fps if your machine struggles).
- **Browser window:** maximized, no developer tools, no bookmarks bar visible, no other tabs open.
- **OS chrome:** macOS — auto-hide the Dock + Menu bar via Mission Control settings during recording. Windows — taskbar auto-hide.
- **Notifications:** macOS — turn on **Focus / Do Not Disturb** for the recording window. Windows — turn on Focus Assist (alarms only). Silence Slack, Mail, Calendar before you start.
- **Audio:** Heygen produces the voiceover separately, so you don't need a microphone during recording. Mute system audio if your screen recorder is capturing it.

### 4.5 First-run checklist (do this once before any scene)

1. Open Chrome (incognito), full-screen, 100% zoom.
2. Open `https://cshse-develop.up.railway.app/login`.
3. Sign in as the Program Coordinator test account. Confirm you land on the Dashboard.
4. Click into the test submission. Confirm the Self-Study Editor opens.
5. Click the **Importer Wizard** button. Confirm Step 1 (Upload) loads with an empty dropzone.
6. Sign out. You're ready to record Scene 2.

---

## 5. Per-Scene Heygen Scripts (copy-paste blocks)

If producing the Heygen avatar segment-by-segment, paste each block one at a time. Cleaner sync; easier to re-do a single scene without re-rendering the whole avatar.

### Scene 1

```
For accredited Human Services programs, the self-study cycle is intense. Hundreds of pages, dozens of Standards, every five years. The Council for Standards in Human Service Education — CSHSE — has been working with its member institutions to reduce that overhead. This is what they built.
```

### Scene 2

```
The CSHSE Accreditation Self-Study Portal is a purpose-built workspace where Program Coordinators, Readers, Lead Readers, and Council staff work together on one secure platform. Member institutions sign in through the existing CSHSE member portal — no separate account to maintain.
```

### Scene 3

```
The heart of the Portal is the AI Import Wizard. Instead of formatting a self-study by hand, a coordinator drops their existing Word document — even a three-hundred-page one — and the Wizard reads, organizes, and routes everything against the CSHSE National Standards.
```

### Scene 4

```
The Document Reader extracts the document's structure. The AI then places each paragraph into the Standard and sub-specification it best matches, using both meaning and the context around it. Tables, syllabi, and curriculum matrices keep their structure throughout.
```

### Scene 5

```
For faculty curriculum matrices, the Wizard reviews each row one at a time and infers the right sub-specification from the matrix codes. The coordinator keeps, retags, or removes rows individually — no more giant spreadsheets to fix by hand.
```

### Scene 6

```
Then comes the Review screen, where the coordinator stays in full control. Every placed item appears as a card under its target Standard and sub-specification, color-coded by confidence.

For each card the coordinator can — edit the text in place to trim what isn't needed, discard cards the AI placed incorrectly, click "Show in source" to verify against the original document, or use "Add from source" to pull in text the AI may have missed. Anything the AI couldn't confidently place lands in a separate "Unplaced" bucket, with context showing where it sat in the document so it's easy to triage.

Every edit, every discard, every move survives a browser refresh. Nothing is lost mid-review.
```

### Scene 7

```
Once the coordinator approves the review, a single click applies everything to the Self-Study Editor — narratives populated, curriculum matrix populated, supporting evidence linked to the right specifications.
```

### Scene 8

```
From there, the Self-Study Editor is where the coordinator polishes the response — rich-text editing with the Standard's text beside them, two-second auto-save, and the curriculum matrix as a structured spreadsheet. Supporting evidence — syllabi, advisory minutes, surveys, signed certificate pages — lives in the Supporting File Library, organized by Standard, versioned, audit-trailed.
```

### Scene 9

```
When the self-study is submitted, assigned Readers open a split-screen workspace. They mark each sub-specification Yes, No, or Not Applicable, leave comments anchored to specific passages, and request changes through a dual-approval workflow.
```

### Scene 10

```
The Lead Reader compiles every Reader's input, highlights disagreements, and sets a final determination ready for the Council Board. Site visits, change requests, and Board decisions all flow through the same audited trail.
```

### Scene 11

```
For coordinators who need help mid-flow, the built-in chat reads from the CSHSE Member Handbook and answers questions in plain English — twenty-four seven.

This is the CSHSE Self-Study Portal — built for the Council, by people who understand what accreditation actually feels like.
```

---

## 6. Scene-by-scene capture checklist (printable)

Run through this list during recording. Tick each item off as you go.

### Scene 1 — Hook (15 s capture, 20 s in edit with Ken-Burns)

- [ ] One static screenshot of the Dashboard (Program Coordinator view, no test data leaking).
- [ ] In the editor: apply a slow zoom (1.0 → 1.05 scale over 8 s).

### Scene 2 — Sign-in + Dashboard (15 s)

- [ ] Record from clean `/login` page → coordinator signs in → Dashboard appears.
- [ ] Hide the password as you type (use a fake account with a 1-char password, OR paste from clipboard with an off-screen cursor pause).

### Scene 3 — Wizard upload (20 s)

- [ ] Open the Self-Study Editor.
- [ ] Click **Importer Wizard** → land on Step 1 (Upload).
- [ ] Drag the pre-downloaded sample `.docx` into the dropzone.
- [ ] Click **Start**.

### Scene 4 — Parse + Match (35 s)

- [ ] Record Step 2 (Parse) — wait for all five stages to tick green. (If the matcher is slow, you can speed up the recording 2× in the editor.)
- [ ] Wait for Step 3 (Match) screen to appear.
- [ ] Show the bucket distribution summary at the top.

### Scene 5 — Matrix step (25 s)

- [ ] Step 4 (Matrix) — first row card visible with inferred sub-spec chip.
- [ ] Click **Keep this row** → advance.
- [ ] Click **Remove this row** on row 2 → advance.
- [ ] Click **Retag** dropdown on row 3 → pick a different sub-spec → save.

### Scene 6 — Review screen (40 s — the longest scene, six sub-actions)

- [ ] (a) **Edit pencil** — click on a card's pencil → textarea opens → trim one sentence → click Save → "edited" badge appears.
- [ ] (b) **Discard** — click red Discard button → accept the browser confirm dialog → card disappears.
- [ ] (c) **Show in source** — click on another card to select it → click **Show in source** in the right pane → modal opens scrolled to the matching paragraph (highlighted amber).
- [ ] (d) **+ Add from source** — close that modal → click into an empty spec → click **+ Add from source** → in the modal, highlight a paragraph → click **Use this passage** → new card appears.
- [ ] (e) **Unplaced bucket** — scroll the SpecRail to the bottom → click **Unplaced** → show one item with the "Nearest placed neighbor" panel.
- [ ] (f) **Persistence** — press `Cmd+R` / `Ctrl+R` to hard-refresh → re-navigate to Review → confirm all changes from (a)–(d) are still there.

### Scene 7 — Apply (15 s)

- [ ] Navigate to Step 6 (Apply).
- [ ] Show the diff modal totals.
- [ ] Click **Apply to editor**.
- [ ] Land on the Self-Study Editor with content populated.

### Scene 8 — Self-Study Editor + Matrix + File Library (20 s)

- [ ] Click **Standards** tab → show one populated narrative with the Saved indicator.
- [ ] Click **Curriculum Matrix** tab → pan across the populated structured matrix.
- [ ] Click **Supporting File Library** tab → expand one Standard → show file rows with version badges.

### Scene 9 — Reader workspace (20 s)

- [ ] Open a SECOND browser window (not tab — full window) in incognito mode.
- [ ] Sign in as the Reader test account.
- [ ] Open the assigned submission.
- [ ] Record the split-screen view.
- [ ] Right-click a sentence → **Add comment** → type → submit.
- [ ] Click a Y/N/NA pill on one sub-specification.

### Scene 10 — Lead Reader compilation (15 s)

- [ ] In the second browser window, sign out + sign in as Lead Reader.
- [ ] Open the Lead Reader Compilation view.
- [ ] Show the disagreement-detection list with at least one disagreement.
- [ ] Click **Set Final Determination → Met**.

### Scene 11 — Help chat (10 s)

- [ ] Switch back to the Coordinator browser window.
- [ ] Click the HelpChat floating bubble.
- [ ] Type the question shown in the Scene 11 narration table.
- [ ] Wait for the AI response to stream.
- [ ] End on a Dashboard view with a slow zoom-out (1.0 → 0.95 over 4 s).

---

## 7. Editing notes

- **Average shot length:** ~5 seconds. Cut between widescreen overviews and close-up zooms on screenshot details where the narration calls out a specific feature.
- **Lower-third overlays:** use the "Text overlay" column from §3 for each scene. Hold each overlay for 3 seconds.
- **Audio:** Heygen produces the avatar voiceover separately. Sync it to the B-roll in DaVinci Resolve. Add light background music at −25 dB. Royalty-free tracks: YouTube Audio Library or Pixabay Music.
- **Color:** keep saturation consistent. If you record across multiple sessions, use the same browser theme + light mode (light mode reads better on small previews).
- **Speed adjustments:** the Parse step (Scene 4) is the only place where speeding up footage 2× is acceptable — the stage spinner is genuine waiting time that doesn't carry meaning frame-by-frame. Everything else stays at native speed.

---

## 8. Run-time summary

| Asset | Count | Notes |
|---|---|---|
| Total run time | ~3:30 | Heygen pacing at 140-150 wpm; 3:24 at 150, 3:40 at 140 |
| Word count (narration) | 512 | Master script word count (verified) |
| Scenes | 11 | Average ~21 s per scene; Scene 6 is the longest at 40 s |
| Static screenshots needed | 1 | Scene 1 only (Dashboard) |
| Screen-record clips needed | 10 | Scenes 2–11 |
| Required app states | 4 | Coordinator login, Reader login, Lead Reader login (Admin optional) |
| External assets | 1 | Background music (YouTube Audio Library) |
| Estimated production time | ~8 hours | Recording (3h, including retakes) + editing in DaVinci Resolve (5h) |
| App URL | https://cshse-develop.up.railway.app | Production / dev environment |
| Sample DOCX | `CSHSE/docs/ASSOCIATE Self_Study_Reader Report template_ Associate degree July 2025.docx` | Download to recording machine's Desktop before starting |

---

## 9. Distribution

**Single distribution target: cshse.org case-study reference page.** This is NOT a prospect-facing asset. CSHSE is a member-only organization with no public signup or newsletter. The video is a reference for existing members + Council staff.

- Embed the full ~3:30 video on a CSHSE reference page (auto-play muted, click-to-unmute).
- The §1 hero + body copy fits on the same page above the video.
- No newsletter signup. No "request a walkthrough" CTA. No prospect form.
- Optionally cross-post on the CSHSE LinkedIn organization page with captions burned in (still no CTA — Council reach + brand presence only).
- Council Board internal demos use the same asset.

---

## 10. What this video does NOT cover (out of scope by design)

These features exist or are in flight but are not in the video. They'd extend the runtime past 4:00 and dilute the core story.

- **CR-033 CV detection** — proposed, not yet shipped.
- **CR-039 Standard Introductions** — proposed, not yet shipped.
- **CR-040 Appendix papers + syllabi as supporting-evidence files** — proposed, not yet shipped.
- **CR-041 Multi-file batch upload** — proposed, not yet shipped.
- **CR-042 MemberClick public SSO API** — proposed; once shipped, Scene 2's "sign in through the existing CSHSE member portal" line becomes literal rather than aspirational.
- **CR-035 Curriculum Matrix structured population** — proposed; until it lands, Scene 7's diff-modal totals should NOT include the "412 matrix cells" line; substitute "narratives + evidence + files populated."
- **Compliance & security beat** (encryption, audit log, role-based access) — defer to a separate Compliance & Security explainer video.

When any of these ship, re-record only the affected scene and reissue the video with a "v1.1 — 2026-MM-DD" suffix in the file name.

---

## 11. Revision log

- **2026-05-23** — Full rewrite. Replaced 9-scene v1.0 plan (which led with import as one of several features) with 11-scene case-study plan that leads with the AI Import Wizard and dedicates Scene 6 (40 s) to the coordinator-control affordances shipped in CRs 031–033 (Unplaced context, Edit pencil, Discard button, Show-in-source with heading-strip, + Add from source with table preservation, hard-refresh persistence). Removed all newsletter / subscribe / "request a walkthrough" CTAs — CSHSE is members-only and this is a reference asset, not a prospect funnel. Made the entire production plan operable from any computer with browser access and credentials; no local-dev setup required.
- **2026-05-11** — Original plan (preserved in git history at commits before 2026-05-23).

## Related

- [[overview]] — what the portal actually is
- [[product-requirements]] — what the Handbook says it must support; ground-truth for marketing claims
- [[../Engineering/wizard-user-guide-2026-05-20]] — coordinator-facing wizard user guide; informed Scenes 4–7
- [[../Engineering/ai-import-wizard-e2e-coverage-review-2026-05-22]] — full feature inventory the script drew from
- [[../Engineering/change-requests/cr-031-unplaced-neighbor-context]] — Scene 6 (e) reference
- [[../Engineering/change-requests/cr-032-inline-edit-review-cards]] — Scene 6 (a) reference
- [[../Engineering/change-requests/cr-033-cv-supporting-evidence]] — proposed; out of scope for this video; deferred to v1.1
- [[../Engineering/change-requests/index]] — what's shipped vs. what's not

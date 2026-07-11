---
name: Marketing Plan — 2026-05-11 (revised 2026-05-25)
description: Case-study reference video for the CSHSE Self-Study Portal. ~3:30 Heygen narration + screen-capture B-roll. Headlines the AI Import Wizard (now multi-file + persisted Review workspace) plus Council operations — Board Console, Joint Ventures, reliable email. No CTA, no signup — CSHSE is members-only.
type: marketing
audience: existing CSHSE member institutions + Council staff (reference, not prospect-facing)
horizon: case-study reference video — one asset (~3:30 video + filming instructions any operator can follow)
status: ready-to-record
plan_date: 2026-05-11
last_reviewed: 2026-05-25
revision: 2026-05-25 — updated to reflect everything shipped since 2026-05-23 (CR-033 CV cards; CR-039 Standard Introductions; CR-040 papers/syllabi + coverage verifier; CR-041 multi-file batched import; CR-042 MemberClick SSO; CR-043 persistent Review + Matrix on the toolbar; CR-044 typography parity; the 2026-06-16 Board Console + Joint Ventures + SendGrid email deliverability). Same 11 scenes, same ~3:30 runtime; script rewritten to lead with the multi-file wizard + toolbar Review workspace, and to close on Council operations (Board Console + JV) that the prior cut didn't cover.
---

# Marketing Plan — Case Study Reference Video

Production-ready package for a ~3:30 case-study reference video showing the CSHSE Self-Study Portal as it exists in the deployed environment. Designed so a contractor or staff member on any computer — with browser access and the deployed-app credentials — can complete the recording without engineering involvement.

> **Product name:** CSHSE Self-Study Portal
> **Full org name:** Council for Standards in Human Service Education (CSHSE)
> **Target run time:** ~3:30 · Heygen avatar narration at ~150 wpm · 506 words
> **B-roll source:** screen captures from the running deployed app at https://cshse-develop.up.railway.app
> **Distribution:** case study reference for existing CSHSE members. NOT a sales / prospect asset. NO signup, newsletter, or CTA copy.

For technical context on what the product actually does, see [[overview]], [[product-requirements]], [[../Engineering/ai-import-wizard-e2e-coverage-review-2026-05-22|the AI Import Wizard coverage review]], and the change-request catalog at [[../Engineering/change-requests/index]].

## 1. Page copy (for any CSHSE-hosted reference page that frames the video)

### Hero

**Accreditation, simplified.**

The CSHSE Self-Study Portal — a purpose-built workspace for the **Council for Standards in Human Service Education** and its member institutions.

### Body

The Portal turns the most paperwork-intensive part of accreditation into a guided workflow. Built specifically for the **Council for Standards in Human Service Education (CSHSE)** and its member institutions, the Portal supports Associate, Baccalaureate, and Master's-level Human Services programs through every step of the accreditation cycle — preparation, submission, peer review, and Council decision.

### What's in v1

- **AI Import Wizard, multi-file** — Drop one Word document or drop many at once (per-author sections, bulk syllabi, faculty CVs, appendix papers). The Portal reads, organizes, and merges every file into a single Review. Every item is stamped with the filename it came from.
- **Persistent Review workspace** — Review lives on the submission, not inside the wizard. Close the wizard, refresh the browser, drop another file — your approvals, edits, and discards persist. Re-importing a file replaces only that exact document's items; everything else stays as you left it.
- **Faculty CVs · Standard Introductions · Papers · Syllabi** — Detected in the source document and packaged as first-class supporting-evidence files, each with a "View file" affordance.
- **Coverage verifier** — Confirms every byte of the source is accounted for; surfaces a "Missing from import" bucket for anything the parser flagged.
- **Self-Study Editor** — Rich-text per-Standard narrative editing with Standard-level Introductions at the top of each Standard, the Standard's text beside you, two-second auto-save, and a structured curriculum matrix.
- **Reader + Lead Reader workspace** — Split-screen Yes / No / Not-Applicable assessments, inline comments anchored to passages, disagreement detection at compilation.
- **Council Board Console** — Awaiting-decision queue, one-click decision recording, an upcoming-cycles view that fills automatically for every accepted program.
- **Joint Ventures** — First-class support for institutions running shared programs; assign membership right from the Add-Institution form.
- **MemberClick single sign-on** — One CSHSE membership, one identity, across every role.
- **Reliable email** — Invitations, notifications, and resends go through SendGrid; every message carries the CSHSE trust footer.
- **Member Handbook chat** — Trained on the CSHSE Member Handbook; answers your "how do I" questions twenty-four seven.

**Built for:** Program Coordinators · Readers · Lead Readers · CSHSE administrators · Council Board.

**SaaS-hosted. Role-secured. Audit-logged.**

---

## 2. Heygen Master Script (paste-ready, single block)

Paste this directly into Heygen as one script. **506 words. ~3:22 at 150 wpm, ~3:37 at 140 wpm. Plan on ~3:30 with natural pacing.**

```
For accredited Human Services programs, the self-study cycle is intense. Hundreds of pages, dozens of Standards, every five years. The Council for Standards in Human Service Education — CSHSE — has been working with its member institutions to reduce that overhead. This is what they built.

The CSHSE Self-Study Portal is a purpose-built workspace for Program Coordinators, Readers, Lead Readers, and Council staff. Sign in through your existing CSHSE membership — one login, one identity, across every role on every submission.

The AI Import Wizard sits at the heart of the Portal. Drop one Word document — or drop many at once. Each file processes independently, then merges into one combined Review. Add files mid-run. Every card is stamped with its source filename. Hold Review open until every file finishes, or watch it stream in live.

The Document Reader extracts structure. Dedicated detectors pull faculty CVs, Standard Introductions, and appendix papers and syllabi out as first-class supporting-evidence files. A coverage verifier then confirms every byte of the source is accounted for — nothing lost, nothing invented.

For faculty curriculum matrices, the Wizard walks each row one at a time, inferring the sub-specification from the matrix codes. Keep, retag, or remove any row. The structured Curriculum Matrix populates automatically — no giant spreadsheet to fix by hand.

Then comes the Review workspace — now a first-class toolbar surface, not a step inside the wizard. Every item lives on the submission itself. Close the wizard, drop another file, refresh the browser — nothing loses your work. Edit cards in place, verify against the original document, filter by source file, and approve item by item. Re-importing a file replaces only that exact document's items — everything else stays as you left it. Nothing duplicated. Nothing overwritten.

When you're ready, one click applies every approved item into the Self-Study Editor. Narratives populated. Curriculum matrix populated. Introductions written. Supporting evidence linked. Un-approved items stay in Review for the next round.

From there, the Self-Study Editor is where the coordinator polishes the response — Standard-level Introductions at the top of each Standard, rich-text editing beside the Standard's text, two-second auto-save. The Supporting File Library holds every syllabus, paper, CV, and evidence document — versioned, audit-trailed.

When the self-study is submitted, assigned Readers open a split-screen workspace. They mark each sub-specification Yes, No, or Not Applicable, comment inline anchored to specific passages, and request changes through a dual-approval workflow.

The Lead Reader compiles every Reader's input, highlights disagreements, and sets the final determination. From there it flows to the Council Board's Awaiting Decision queue, where staff record the outcome — accepted, tabled, denied. Every accepted program's next reaccreditation cycle appears automatically in the upcoming-cycles view. Every step, audit-trailed.

Around every workflow — a help chat trained on the CSHSE Member Handbook, Joint Ventures management for institutions running shared programs, and deliverable email through SendGrid so invitations and notifications actually reach the inbox. This is the CSHSE Self-Study Portal — built for the Council, by people who understand what accreditation actually feels like.
```

---

## 3. Scene-by-Scene Production Plan

11 scenes, each between 15 and 45 seconds. Narration cell is paste-ready for per-scene Heygen production (recommended for cleaner narration-to-video sync — see §5 for the per-scene blocks).

| # | Time | Scene | Narration (recap) | B-roll directions | Text overlay |
|---|------|-------|-------------------|-------------------|--------------|
| 1 | 0:00–0:20 | **Hook + CSHSE intro** | Hundreds of pages, dozens of Standards, every five years. CSHSE has been working to reduce that overhead. | Static title-card screenshot — open the deployed landing page or `Dashboard` view. 8-second slow Ken-Burns zoom (1.0 → 1.05). | Title: **"Accreditation, simplified."** Sub: *"A CSHSE member case study."* |
| 2 | 0:20–0:35 | **Portal intro + MemberClick SSO** | A purpose-built workspace. Sign in through your existing CSHSE membership — one login, one identity, across every role. | Open `/login` → click the **"Sign in with CSHSE membership"** button (the SSO entry point) → land on Dashboard. Reveal the top-right avatar showing the coordinator's name. Pan across the top nav; briefly open the **"More"** dropdown to show it collapses cleanly at every width. | Lower-third: **"Council for Standards in Human Service Education"** Sub: *"One login. Every role."* |
| 3 | 0:35–1:05 | **AI Import Wizard — multi-file drop** | The AI Import Wizard sits at the heart of the Portal. Drop one Word document — or drop many at once. Each file processes independently, then merges into one Review. Add files mid-run. Every card is stamped with its source filename. Hold Review open until every file finishes, or watch it stream in live. | Open the Self-Study Editor → click **Importer Wizard**. Drag **four** of the Stevenson section splits from `~/Desktop/CSHSE/` into the dropzone (standards-01-05 + 06-09 + 10-13 + 14-21). Show the queued-file list appear (filename + size for each). Show the **"Hold review until all files have processed"** checkbox — leave it checked. Click **Start**. Cut to Parse step showing **per-file progress rows** ticking through queued → parsing → completed. | *"Drop one — or drop many"* On queued list: *"Batched Review. One coordinated pass."* On the hold-for-review checkbox: *"Wait for the full picture, or stream it in live."* |
| 4 | 1:05–1:30 | **Parse → Content-kind detectors + Coverage** | The Document Reader extracts structure. Detectors pull faculty CVs, Standard Introductions, and appendix papers and syllabi out as first-class supporting-evidence files. A coverage verifier then confirms every byte of the source is accounted for — nothing lost, nothing invented. | Parse step — pan down the pipeline stage list. Highlight each of these stages as they tick green: `document_reader → deep_walker → cv_detector → introduction_detector → evidence_doc_detector → matcher → coverage_verifier`. Cut to the **Coverage badge** (green pill: "COVERAGE: 99.4% · 3 fragments"). | Overlay as stages tick: *"CVs"* → *"Introductions"* → *"Papers & Syllabi"* → *"Every byte accounted for"* On coverage badge: *"Coverage verifier — nothing lost, nothing invented"* |
| 5 | 1:30–1:50 | **Matrix step — row-by-row** | For faculty curriculum matrices, the Wizard walks each row one at a time, inferring the sub-specification from the matrix codes. Keep, retag, or remove any row. The structured Curriculum Matrix populates automatically. | Matrix step — first row card visible with inferred sub-spec chip ("Spec 11.b"), original-document row highlighted amber. Click **Keep this row**. Advance. Click **Retag** dropdown → pick a different sub-spec → save. Click **Remove** on a third row. | Overlay: *"Faculty matrices — one row at a time"* On Keep click: *"Cells preserved in the Curriculum Matrix"* |
| 6 | 1:50–2:35 | **Persistent Review workspace (CR-043)** | Now a first-class toolbar surface, not a step inside the wizard. Every item lives on the submission itself. Close the wizard, drop another file, refresh the browser — nothing loses your work. Edit, verify, filter by source file, approve item by item. Re-importing a file replaces only that exact document's items. Nothing duplicated. Nothing overwritten. | Close the wizard panel. Show the **toolbar Review button** enabling with a green "ready" pill. Click it → land on the persisted **Review workspace** (heading: *"Review"*). Scroll SpecRail; click Spec 1.a. Show narrative cards with **source-file chips** (📄 standards-1-5-DepartmentChair.docx). **(a) Filter by source** — open the "Filter by source" dropdown, pick one filename, watch counts collapse to just that file's items. Clear the filter. **(b) Edit + persist** — click a card's Edit pencil → trim a sentence → Save → hard-refresh the browser → return to Review via the toolbar → edit preserved. **(c) Approve one card** → the toolbar Review button's counter ticks: "1 approved". **(d) Reimport demo** — reopen the wizard, drop standards-01-05.docx AGAIN with "reimport" checked → Parse → return to Review; the file-A items are the new versions (approval was cleared, needs re-confirm); the file-B / file-C / file-D items are untouched. | Overlays as actions happen: *"Review — persisted on the submission"* · *"Filter by source file"* · *"Edit survives refresh"* · *"Reimport: strict-match replace. No duplicates."* |
| 7 | 2:35–2:50 | **Apply from the persisted Review** | One click applies every approved item into the Self-Study Editor. Narratives populated. Curriculum matrix populated. Introductions written. Supporting evidence linked. Un-approved items stay in Review for the next round. | On the toolbar Review workspace, click **Apply to editor**. Show the diff modal totals (narratives + evidence text + evidence files + matrix cells + introductions). Confirm → land on the populated Self-Study Editor. Reopen Review; show only the un-approved items remain. | Overlay on Apply click: *"Approved items only — the rest stays for the next round."* |
| 8 | 2:50–3:10 | **Editor + Introductions + File Library + Missing-from-import** | Standard-level Introductions at the top of each Standard, rich-text editing beside the Standard's text, two-second auto-save. Supporting File Library holds every syllabus, paper, CV, and evidence document — versioned, audit-trailed. | Self-Study Editor top nav — click **Standards**. Open Standard 1. Show the **Introduction editor** at the top of the standard (CR-039 IntroductionEditor). Then show one populated spec narrative with the Saved indicator. Click **Curriculum Matrix** — pan across the structured matrix. Click **Supporting File Library** → expand Standard 7 → show CV file rows with **"View file"** buttons (CR-033) → expand Standard 21 → show paper + syllabus file rows (CR-040) each with their "View file" affordance. If Missing-from-import fragments exist, briefly show the red "Missing from import" rail entry. | Overlays: *"Standard Introductions"* · *"Two-second auto-save"* · *"CVs · Papers · Syllabi — 'View file'"* · *"Versioned. Audit-trailed."* |
| 9 | 3:10–3:25 | **Reader workspace** | Assigned Readers see a split-screen workspace. Mark Y / N / NA. Comments anchored to passages. Dual-approval change requests. | Sign in as Reader in a second browser window. Open assigned submission → split-screen view. Right-click a sentence → **Add comment** → type → submit. Click Y / N / NA pill. | Type comment: *"Please cite the advisory minutes referenced here."* Overlay on Y/N/NA: *"Compliance assessment per sub-specification"* |
| 10 | 3:25–3:50 | **Lead Reader → Board Console** | Lead Reader compiles every Reader's input, highlights disagreements, sets the final determination. It flows to the Council Board's Awaiting Decision queue, where staff record the outcome — accepted, tabled, denied. Every accepted program's next reaccreditation cycle appears automatically. Every step, audit-trailed. | Switch to Lead Reader → open Compilation view → show disagreement-detection list → click **Complete review & send to board**. Cut to Admin/Council-staff view → open **`/admin/board`** → show the **Awaiting Decision queue** with the just-submitted program at the top. Click a row → **Record Decision** modal → pick **Accept** → confirm. Scroll to the **Upcoming Cycles** section → show the new entry has automatically appeared with an effective date + expiry (default +7 years). | Overlays: *"Disagreements surfaced automatically"* · *"Board Console — Awaiting Decision"* · *"Upcoming Cycles — filled automatically"* |
| 11 | 3:50–4:00 | **Council ops + close** | Around every workflow — help chat, Joint Ventures, deliverable email. Built for the Council, by people who understand what accreditation actually feels like. | Back in Coordinator view → click the HelpChat floating bubble → type a Handbook question → show streaming response. Cut briefly to Admin → Settings → **Joint Ventures** tab → show a JV with two member institutions. Optional: cut to Admin → Users → send an invitation → show the SendGrid success toast + a preview of the trust-footer email. End on a clean Dashboard view with a slow zoom-out. | Overlays: *"Handbook chat — 24/7"* · *"Joint Ventures — shared programs, first-class support"* · *"Reliable email via SendGrid"* Final card: **"CSHSE Self-Study Portal — Council for Standards in Human Service Education"** |

Note Scene 6 remains intentionally the longest — the persistent Review workspace is the architectural change that makes the multi-author, multi-file workflow work. Four sub-actions are filmed in sequence (filter · edit + refresh · approve · reimport); let that scene breathe. Scene 10 is the second-longest to accommodate both the Lead Reader compilation AND the new Board Console decision-recording beat.

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

You need credentials for **five roles** in the deployed environment. The CSHSE administrator can issue these via the existing Admin → Users → Invite flow. Email + password, or a single SSO-enabled MemberClick test account.

| Role | What it's for | Recording uses |
|---|---|---|
| Program Coordinator | The PC view (most of the video) | Scenes 2–8, 11 |
| Reader | Reader workspace | Scene 9 |
| Lead Reader | Lead Reader compilation | Scene 10 |
| Council Admin / Superuser | Board Console, Joint Ventures, invitation send | Scene 10 (Board Console), Scene 11 (JV + email) |
| Admin (impersonation fallback) | Optional — for impersonation if separate Reader/Lead-Reader logins are unavailable | Fallback for Scenes 9–10 |

Have the credentials in a password manager (1Password, Bitwarden, Apple Keychain) ready to copy-paste. Never type passwords into the visible screen during recording — if you're demoing MemberClick SSO, use the SSO redirect flow instead (see §4.5 first-run checklist).

### 4.3 Test data you need in the environment

The CSHSE administrator should pre-seed:

- **One test institution** ("E2E Test University" or similar) with a real BACCALAUREATE or ASSOCIATE program.
- **One test submission** in `in_progress` status for that institution, assigned to the test PC + 2 test Readers + 1 test Lead Reader.
- **A second test submission** driven all the way to `review_complete` status for the Board Console demo (Scene 10). See `session_context.md` for how one was staged on dev (`POST /submit` + `POST /compilation/finalize`).
- **At least one prior import already applied** so the Self-Study Editor (Scene 8) has realistic content to display — including at least one Standard-level Introduction, one CV in the Supporting File Library, and one paper or syllabus file.
- **A second institution paired via Joint Venture** with the test institution (Scene 11 — Council ops overview).

**Sample DOCX files for the multi-file import demo (Scene 3).** Run the Stevenson splitter once against the Stevenson self-study to produce a folder of section-scoped files:

```bash
python3 CSHSE/scripts/split_stevenson_for_multifile_test.py \
    ~/Desktop/CSHSE/"2024 CSHSE Self-Study Stevenson University.docx"
```

Recording uses these four splits (already produced) — pick any four consecutive standards ranges from:

- `2024 CSHSE Self-Study Stevenson University__01-standards-01-05.docx`
- `2024 CSHSE Self-Study Stevenson University__02-standards-06-09.docx`
- `2024 CSHSE Self-Study Stevenson University__03-standards-10-13.docx`
- `2024 CSHSE Self-Study Stevenson University__04-standards-14-21.docx`

For the CV / paper / syllabus close-ups in Scene 4 + Scene 8, the same splitter output includes:

- `__cv-only__barry-w-thomas.docx`, `__cv-only__carol-a-dietrich.docx`, etc.
- `__paper__sample-country-report.docx`
- `__syllabus__chs-105-human-services-social-policy.docx`

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
3. Click the **"Sign in with CSHSE membership"** button (MemberClick SSO). Confirm you return to the Portal with the test coordinator identity and land on the Dashboard. (If the SSO test account isn't provisioned, fall back to the email + password test login — the video's Scene 2 direction still works; only the on-screen button label differs.)
4. Click into the test submission. Confirm the Self-Study Editor opens.
5. Confirm the **Review** and **Matrix** toolbar buttons are present. If a prior import has been applied, they should be enabled with a "ready" pill.
6. Click the **Importer Wizard** button. Confirm the Upload step opens with an empty dropzone.
7. Sign out. You're ready to record Scene 2.

---

## 5. Per-Scene Heygen Scripts (copy-paste blocks)

If producing the Heygen avatar segment-by-segment, paste each block one at a time. Cleaner sync; easier to re-do a single scene without re-rendering the whole avatar.

### Scene 1

```
For accredited Human Services programs, the self-study cycle is intense. Hundreds of pages, dozens of Standards, every five years. The Council for Standards in Human Service Education — CSHSE — has been working with its member institutions to reduce that overhead. This is what they built.
```

### Scene 2

```
The CSHSE Self-Study Portal is a purpose-built workspace for Program Coordinators, Readers, Lead Readers, and Council staff. Sign in through your existing CSHSE membership — one login, one identity, across every role on every submission.
```

### Scene 3

```
The AI Import Wizard sits at the heart of the Portal. Drop one Word document — or drop many at once. Each file processes independently, then merges into one combined Review. Add files mid-run. Every card is stamped with its source filename. Hold Review open until every file finishes, or watch it stream in live.
```

### Scene 4

```
The Document Reader extracts structure. Dedicated detectors pull faculty CVs, Standard Introductions, and appendix papers and syllabi out as first-class supporting-evidence files. A coverage verifier then confirms every byte of the source is accounted for — nothing lost, nothing invented.
```

### Scene 5

```
For faculty curriculum matrices, the Wizard walks each row one at a time, inferring the sub-specification from the matrix codes. Keep, retag, or remove any row. The structured Curriculum Matrix populates automatically — no giant spreadsheet to fix by hand.
```

### Scene 6

```
Then comes the Review workspace — now a first-class toolbar surface, not a step inside the wizard. Every item lives on the submission itself. Close the wizard, drop another file, refresh the browser — nothing loses your work. Edit cards in place, verify against the original document, filter by source file, and approve item by item. Re-importing a file replaces only that exact document's items — everything else stays as you left it. Nothing duplicated. Nothing overwritten.
```

### Scene 7

```
When you're ready, one click applies every approved item into the Self-Study Editor. Narratives populated. Curriculum matrix populated. Introductions written. Supporting evidence linked. Un-approved items stay in Review for the next round.
```

### Scene 8

```
From there, the Self-Study Editor is where the coordinator polishes the response — Standard-level Introductions at the top of each Standard, rich-text editing beside the Standard's text, two-second auto-save. The Supporting File Library holds every syllabus, paper, CV, and evidence document — versioned, audit-trailed.
```

### Scene 9

```
When the self-study is submitted, assigned Readers open a split-screen workspace. They mark each sub-specification Yes, No, or Not Applicable, comment inline anchored to specific passages, and request changes through a dual-approval workflow.
```

### Scene 10

```
The Lead Reader compiles every Reader's input, highlights disagreements, and sets the final determination. From there it flows to the Council Board's Awaiting Decision queue, where staff record the outcome — accepted, tabled, denied. Every accepted program's next reaccreditation cycle appears automatically in the upcoming-cycles view. Every step, audit-trailed.
```

### Scene 11

```
Around every workflow — a help chat trained on the CSHSE Member Handbook, Joint Ventures management for institutions running shared programs, and deliverable email through SendGrid so invitations and notifications actually reach the inbox. This is the CSHSE Self-Study Portal — built for the Council, by people who understand what accreditation actually feels like.
```

---

## 6. Scene-by-scene capture checklist (printable)

Run through this list during recording. Tick each item off as you go.

### Scene 1 — Hook (15 s capture, 20 s in edit with Ken-Burns)

- [ ] One static screenshot of the Dashboard (Program Coordinator view, no test data leaking).
- [ ] In the editor: apply a slow zoom (1.0 → 1.05 scale over 8 s).

### Scene 2 — Sign-in + Dashboard + Nav consistency (15 s)

- [ ] Record from clean `/login` page → click the **"Sign in with CSHSE membership"** button → land on Dashboard.
- [ ] Reveal the top-right avatar showing the coordinator's identity (proves the SSO round-trip worked).
- [ ] Briefly click the top nav's **"More"** dropdown to show it collapses cleanly (2026-06-16 consistency change).

### Scene 3 — Wizard multi-file drop (30 s)

- [ ] Open the Self-Study Editor.
- [ ] Click **Importer Wizard** → land on the Upload step.
- [ ] Drag **four** Stevenson section splits (standards-01-05 + 06-09 + 10-13 + 14-21) into the dropzone in one motion (or one after another).
- [ ] Show the queued-file list appear (filename + size for each).
- [ ] Show the **"Hold review until all files have processed"** checkbox — keep it checked.
- [ ] Click **Start** → cut to Parse step showing per-file rows.

### Scene 4 — Parse + Content-kind detectors + Coverage (25 s)

- [ ] Pan down the pipeline stage list. Show `cv_detector`, `introduction_detector`, `evidence_doc_detector` each ticking green in turn.
- [ ] Show the coverage badge appear (green pill: "COVERAGE: 99.4% · 3 fragments" or whatever the run produces).
- [ ] Optional: hover the coverage badge to show the "boundary warnings" hover text if applicable.

### Scene 5 — Matrix step (20 s)

- [ ] Matrix step — first row card visible with inferred sub-spec chip.
- [ ] Click **Keep this row** → advance.
- [ ] Click **Retag** dropdown → pick a different sub-spec → save.
- [ ] Click **Remove this row** on a third row.

### Scene 6 — Persistent Review workspace (45 s — the longest scene, four sub-actions)

- [ ] Close the wizard panel by clicking outside it or hitting Escape.
- [ ] Show the top-nav **Review** toolbar button enabling with a green "ready" pill.
- [ ] Click **Review** → land on the persisted Review workspace (heading: *"Review"*).
- [ ] Scroll SpecRail; click Spec 1.a. Show narrative cards with **source-file chips** (📄 filename).
- [ ] (a) **Filter by source** — open the "Filter by source" dropdown, pick one filename, watch counts collapse. Clear the filter.
- [ ] (b) **Edit + persist** — click a card's Edit pencil → trim one sentence → Save → `Cmd+R` / `Ctrl+R` hard-refresh → re-open Review via the toolbar → confirm the edit is still there.
- [ ] (c) **Approve one card** → confirm the toolbar Review button's counter shows *"1 approved"*.
- [ ] (d) **Reimport demo** — reopen the wizard, drop `__01-standards-01-05.docx` AGAIN, check the **"This is a reimport"** checkbox, click Start → wait for parse → return to Review. Show the file-A items are the new versions; the file-B/C/D items are untouched.

### Scene 7 — Apply from Review (15 s)

- [ ] On the toolbar Review workspace, click **Apply to editor**.
- [ ] Show the diff modal totals (narratives · evidence text · evidence files · matrix cells · introductions).
- [ ] Click **Confirm — send to editor**.
- [ ] Land on the Self-Study Editor with content populated.
- [ ] Briefly re-open Review to show un-approved items still there.

### Scene 8 — Editor + Introductions + File Library (20 s)

- [ ] Click **Standards** → open Standard 1 → show the **Introduction editor** at the top of the standard.
- [ ] Show one populated spec narrative with the Saved indicator.
- [ ] Click **Curriculum Matrix** → pan across the populated structured matrix.
- [ ] Click **Supporting File Library** → expand Standard 7 → show one CV file row with **"View file"** button.
- [ ] Expand Standard 21 → show a paper file row + a syllabus file row, each with "View file".
- [ ] If any "Missing from import" fragments exist, briefly show the red rail entry (optional if empty).

### Scene 9 — Reader workspace (15 s)

- [ ] Open a SECOND browser window (not tab — full window) in incognito mode.
- [ ] Sign in as the Reader test account (via MemberClick SSO or fallback login).
- [ ] Open the assigned submission.
- [ ] Record the split-screen view.
- [ ] Right-click a sentence → **Add comment** → type → submit.
- [ ] Click a Y/N/NA pill on one sub-specification.

### Scene 10 — Lead Reader → Board Console (25 s)

- [ ] In the second browser window, sign out + sign in as Lead Reader.
- [ ] Open the Lead Reader Compilation view → show the disagreement-detection list.
- [ ] Click **Complete review & send to board** → confirm the submission moves to `review_complete`.
- [ ] Cut to a third browser window signed in as Council Admin.
- [ ] Navigate to **`/admin/board`** → show the Awaiting Decision queue with the just-submitted program at the top.
- [ ] Click the row → **Record Decision** modal → pick **Accept** → confirm.
- [ ] Scroll to **Upcoming Cycles** → show the new entry appearing with effective + expiry dates.

### Scene 11 — Council ops + close (10 s)

- [ ] Switch back to the Coordinator browser window.
- [ ] Click the HelpChat floating bubble → type a Handbook question → wait for streaming response.
- [ ] Cut briefly to Admin → Settings → **Joint Ventures** tab → show a JV with two member institutions.
- [ ] Optional: cut to Admin → Users → send an invitation → show the SendGrid success toast + a preview of the email with the trust footer.
- [ ] End on a Dashboard view with a slow zoom-out (1.0 → 0.95 over 4 s).

---

## 7. Editing notes

- **Average shot length:** ~5 seconds. Cut between widescreen overviews and close-up zooms on screenshot details where the narration calls out a specific feature.
- **Lower-third overlays:** use the "Text overlay" column from §3 for each scene. Hold each overlay for 3 seconds.
- **Audio:** Heygen produces the avatar voiceover separately. Sync it to the B-roll in DaVinci Resolve. Add light background music at −25 dB. Royalty-free tracks: YouTube Audio Library or Pixabay Music.
- **Color:** keep saturation consistent. If you record across multiple sessions, use the same browser theme + light mode (light mode reads better on small previews).
- **Speed adjustments:** the Parse step in Scene 4 is the only place where speeding up footage 2× is acceptable — the stage spinner is genuine waiting time that doesn't carry meaning frame-by-frame. Everything else stays at native speed. The multi-file Parse in Scene 3 is also speedable if per-file rows sit at "queued" for more than 4 seconds each.
- **Reimport demo cadence (Scene 6d):** you don't need to wait for the actual parser to finish during recording. Record the pre-parse state, cut, then record the post-parse Review state as a separate clip. Splice with a whip-pan or crossfade.

---

## 8. Run-time summary

| Asset | Count | Notes |
|---|---|---|
| Total run time | ~3:30 | Heygen pacing at 140-150 wpm; 3:22 at 150, 3:37 at 140 |
| Word count (narration) | 506 | Master script word count (verified) |
| Scenes | 11 | Average ~22 s per scene; Scene 6 is the longest at 45 s; Scene 10 at 25 s |
| Static screenshots needed | 1 | Scene 1 only (Dashboard) |
| Screen-record clips needed | 10 | Scenes 2–11 |
| Required app states | 5 | Coordinator, Reader, Lead Reader, Council Admin (Board Console), Admin (JV + email) |
| External assets | 1 | Background music (YouTube Audio Library) |
| Estimated production time | ~10 hours | Recording (4h including retakes + multi-file Parse waits) + editing in DaVinci Resolve (6h) |
| App URL | https://cshse-develop.up.railway.app | Deployed dev environment |
| Sample DOCX (multi-file demo) | `~/Desktop/CSHSE/2024 CSHSE Self-Study Stevenson University__*.docx` | 4 Stevenson section splits + optional CV/paper/syllabus splits; run `CSHSE/scripts/split_stevenson_for_multifile_test.py` once to produce them |

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

- **Coverage <90% hard-block calibration** — CR-040 Phase 3b follow-on; needs real-doc calibration data before the coverage badge takes on a hard block-review behavior.
- **Reader-scoring `scoreEvidence` caller** — CR-024 Sprint 4 part 2; the contract is ready, but the Reader-scoring UI itself is a follow-on CR.
- **Wizard Stepper collapse to one-button handoff** — CR-043 shipped with the wizard's internal Review/Matrix/Apply tabs preserved as backwards-compat fallbacks. Once existing specs are ported to the new toolbar surface (~1 day of work), the wizard internals can be deleted and Scene 6 gets slightly cleaner. Not a re-record trigger.
- **CR-003 0-3 compliance rubric** — proposed; when it lands, Scene 9's "Yes / No / Not Applicable" line evolves to "Non-compliant, Partial, Largely compliant, Fully compliant."
- **CR-004 comment threading with identity redaction** — proposed; when it lands, Scene 9's Reader comment demo gains a Julia-as-relay beat.
- **CR-005 PC lockout on final submit** — proposed; adds a lockout confirmation step to Scene 7 when it lands.
- **CR-006 two-stage submission** — proposed; changes Scene 8's flow to include per-Standard submit.
- **Compliance & security beat** (encryption, audit log, role-based access) — defer to a separate Compliance & Security explainer video.

When any of these ship, re-record only the affected scene and reissue the video with a "v1.2 — 2026-MM-DD" suffix in the file name.

---

## 11. Revision log

- **2026-05-25** — Rewritten to match everything shipped since 2026-05-23. Same 11 scenes, same ~3:30 runtime (~506 words vs prior 512), same operator-runnable production plan. Changes: **Scene 2** now names MemberClick SSO literally (CR-042 shipped) and adds the nav-consistency reveal (2026-06-16). **Scene 3** rebuilt around the multi-file batched upload (CR-041 US-1 through US-10) — drops four Stevenson section splits at once, shows queued list + hold-for-review checkbox + per-file Parse rows. **Scene 4** compressed to add three new content-kind detectors (CR-033 CVs, CR-039 Introductions, CR-040 papers + syllabi) plus the coverage-verifier badge (CR-040 Phase 3b). **Scene 6** rewritten around the persisted Review workspace on the toolbar (CR-043): filter by source file (CR-041 US-6), edit + hard-refresh persistence, approve-count on the toolbar button, and a strict-match reimport demo showing "nothing duplicated / nothing overwritten." **Scene 7** now applies from the persisted Review (CR-043 apply endpoint) rather than from the wizard's internal ApplyStep. **Scene 8** adds the Introduction editor at the top of each Standard (CR-039 Phase 2c part 2), the "View file" affordance on CV / paper / syllabus rows (CR-033 + CR-040), and briefly surfaces the "Missing from import" rail entry when present. **Scene 10** extended to include the new Board Console (`/admin/board`) — Awaiting Decision queue, Record Decision modal, Upcoming Cycles auto-populate. **Scene 11** rewritten to close on Council operations: help chat + Joint Ventures management (CR-019) + SendGrid deliverable email (2026-06-16). App name shortened to **CSHSE Self-Study Portal** throughout (2026-06-16). Fixtures updated: the multi-file Scene 3 uses the Stevenson splits from `~/Desktop/CSHSE/` produced by `CSHSE/scripts/split_stevenson_for_multifile_test.py` — see §4.3.
- **2026-05-23** — Full rewrite. Replaced 9-scene v1.0 plan (which led with import as one of several features) with 11-scene case-study plan that leads with the AI Import Wizard and dedicates Scene 6 (40 s) to the coordinator-control affordances shipped in CRs 031–033. Removed all newsletter / subscribe / "request a walkthrough" CTAs — CSHSE is members-only and this is a reference asset, not a prospect funnel. Made the entire production plan operable from any computer with browser access and credentials; no local-dev setup required.
- **2026-05-11** — Original plan (preserved in git history at commits before 2026-05-23).

## Related

- [[overview]] — what the portal actually is
- [[product-requirements]] — what the Handbook says it must support; ground-truth for marketing claims
- [[../Engineering/wizard-user-guide-2026-05-20]] — coordinator-facing wizard user guide; informed Scenes 4–7
- [[../Engineering/ai-import-wizard-e2e-coverage-review-2026-05-22]] — full feature inventory the script drew from
- [[../Engineering/change-requests/cr-041-multi-file-drag-drop-with-batch-review]] — Scene 3 reference (multi-file drop)
- [[../Engineering/change-requests/cr-043-decouple-review-from-wizard-persist-across-reimport]] — Scene 6 + Scene 7 reference (persisted Review + Matrix on the toolbar)
- [[../Engineering/change-requests/cr-039-standard-introduction-buckets]] — Scene 4 + Scene 8 reference (Introduction detectors + editor)
- [[../Engineering/change-requests/cr-040-appendix-papers-as-supporting-evidence-files]] — Scene 4 + Scene 8 reference (papers + syllabi + coverage verifier)
- [[../Engineering/change-requests/cr-033-cv-supporting-evidence]] — Scene 4 + Scene 8 reference (faculty CVs)
- [[../Engineering/change-requests/cr-042-memberclick-sso-api-entry-point]] — Scene 2 reference (MemberClick SSO)
- [[../Engineering/change-requests/index]] — what's shipped vs. what's not

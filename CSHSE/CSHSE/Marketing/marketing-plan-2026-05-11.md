---
name: Marketing Plan — 2026-05-11
description: Website sales copy + 3-minute Heygen avatar video script + filmable production plan (screen-capture B-roll, no live shoot) for the CSHSE Accreditation Self-Study Portal v1 launch.
type: marketing
audience: prospects (institutions seeking CSHSE accreditation), member institutions, CSHSE staff
horizon: v1 launch campaign — single asset (3-min video + landing-page copy + newsletter signup)
status: ready-to-produce
plan_date: 2026-05-11
last_reviewed: 2026-05-11
---

# Marketing Plan — 2026-05-11

Production-ready package for launching the CSHSE Accreditation Self-Study Portal. Three deliverables — website copy, a Heygen-narrated 3-minute video, and a screen-capture B-roll plan that needs no production budget.

> **Product name:** CSHSE Accreditation Self-Study Portal
> **Full org name:** Council for Standards in Human Service Education (CSHSE)
> **Target run time:** 3:00 · Heygen avatar narration at ~150 wpm · ~440 words
> **B-roll source:** screen captures + static screenshots from the running app (dev features OK to show)

For context on what the product actually does, see [[overview]] and [[product-requirements]]. For the feature-by-feature reality the copy describes, see [[evidence-file-storage]], [[import-pipeline]], [[narrative-storage]], [[n8n-integration]].

## 1. Sales Summary (Website Copy)

### Hero

**Accreditation, simplified.**

A purpose-built self-study portal for the **Council for Standards in Human Service Education (CSHSE)** and the human-services programs it accredits.

### Body

The CSHSE Accreditation Self-Study Portal turns the most paperwork-intensive part of accreditation into a guided, collaborative workflow. Built specifically for the **Council for Standards in Human Service Education (CSHSE)** and its member institutions, the portal supports Associate, Baccalaureate, and Master's-level Human Services programs through every step of the cycle — preparation, submission, peer review, and Council decision.

### What's inside

- **Smart document import** — Upload your legacy DOCX or PDF self-study; the portal extracts, tags, and routes each section to its CSHSE Standard and Sub-standard with AI assistance. 300-page documents handled.
- **Per-Standard narrative editing** — Rich-text editor with the Standard's text right beside you, two-second auto-save, and comment anchoring.
- **AI-assisted validation** — Each Sub-standard's narrative is scored against the Standard before reviewers ever see it.
- **Evidence Library organized by Standard** — Drag-and-drop syllabi, advisory minutes, curriculum matrices, surveys; versioned, indexed, S3-backed.
- **Curriculum matrix editor** — Courses × Sub-standards × Introduction / Theory / Knowledge / Skills at Low / Medium / High levels.
- **Reader workspace** — Split-screen Yes / No / Not-Applicable assessments, inline comments, dual-approval change requests.
- **Lead Reader compilation** — Disagreement detection across reviewers, bulk final determinations, reader reminders.
- **Site visits, change requests, and Board-decision automation** — All on a single audited trail.
- **Help chat** — Trained on the CSHSE Member Handbook; answers your "how do I" questions twenty-four seven.
- **Newsletter** — Subscribe for product updates, CSHSE Board deadlines, and accreditation-cycle reminders.

**Built for:** Program Coordinators · Readers · Lead Readers · CSHSE administrators.

**SaaS-hosted. Role-secured. Audit-logged.**

→ *Subscribe to the newsletter* · *Request a walkthrough*

## 2. Heygen Master Script (3 minutes — copy-paste in one block)

Paste this directly into Heygen as a single script if you want the avatar to read straight through; or use the per-scene blocks in §5 for segmented production.

```
Accreditation should let you focus on what matters — your students. But the self-study process behind it can drown a program in paperwork.

The Council for Standards in Human Service Education — CSHSE — accredits Associate, Baccalaureate, and Master's-level Human Services programs across North America. Every five years, programs prepare a comprehensive self-study against the CSHSE National Standards. Today, that means weeks of formatting, file shuffling, and email threads.

The CSHSE Accreditation Self-Study Portal changes that.

It's a purpose-built workspace where Program Coordinators, Readers, Lead Readers, and Council staff work together from one secure platform.

Start by uploading your last self-study — even a three-hundred-page Word document. The portal parses, tags, and routes each section to its matching CSHSE Standard and Sub-standard. Tables, syllabi, curriculum matrices — all preserved.

Edit each Standard's narrative with the Spec text right beside you. The rich-text editor auto-saves every two seconds, so no work is ever lost. Click Save and Validate, and AI scores your response against the Standard before a human reviewer ever sees it.

Drop your supporting evidence — syllabi, advisory minutes, surveys, signed certificate pages — straight into the Supporting File Library. Files are organized by Standard, with versioning, so the latest edition is always front and center.

Build your curriculum matrix in a spreadsheet view that maps every course to every Sub-standard, with Introduction, Theory, Knowledge, and Skills levels.

When you submit, your assigned Readers see a split-screen workspace. They mark each Sub-standard Yes, No, or Not Applicable, leave comments anchored to specific passages, and request changes through a structured dual-approval workflow.

The Lead Reader compiles every Reader's input, highlights disagreements, and sets a final determination ready for the Council Board.

Throughout the process, role-based access keeps reviewer feedback confidential. Site visits, change requests, and Board decisions all flow through the same audited trail.

Stuck? The built-in help chat reads from the CSHSE Member Handbook and answers questions in plain English — twenty-four seven.

This is the platform built for the CSHSE — by people who understand what accreditation actually feels like.

Subscribe to our newsletter for product updates and CSHSE deadlines. Or request a walkthrough today.

Accreditation, simplified — at CSHSE.
```

## 3. Film Plan

| Time | Scene | Narration (Heygen — copy-paste this cell) | B-roll directions (screen-record) | Text overlay / type-in |
|------|-------|-------|---------------------------------------------|------------------------|
| 0:00–0:15 | **1. Hook** | Accreditation should let you focus on what matters — your students. But the self-study process behind it can drown a program in paperwork. | Static title-card screenshot — open the landing page or `LoginPage`; if there's no marketing landing, take a screenshot of the `Dashboard` with the program-coordinator view and overlay the title text. Hold 8 seconds with a slow zoom-in (1.0 → 1.05 scale) using your screen-record app's Ken Burns effect. | Title overlay: **"Accreditation, simplified."** Sub: *"A CSHSE Self-Study Portal."* |
| 0:15–0:35 | **2. The problem + CSHSE intro** | The Council for Standards in Human Service Education — CSHSE — accredits Associate, Baccalaureate, and Master's-level Human Services programs across North America. Every five years, programs prepare a comprehensive self-study against the CSHSE National Standards. Today, that means weeks of formatting, file shuffling, and email threads. | Screen-record at `/admin/specifications` (the SpecManagement page) showing the list of standards documents (Associate, Baccalaureate, Master's). Slowly scroll through. Then cut to a screenshot of a generic Word document or a real `.docx` of a self-study on the desktop — show file size in Finder/Explorer (300+ MB if possible) as the visual punch. | Lower-third: **"Council for Standards in Human Service Education (CSHSE)"** Caption when showing the .docx: *"~300 pages. 21 Standards. 5-year cycle."* |
| 0:35–0:55 | **3. Solution intro** | The CSHSE Accreditation Self-Study Portal changes that. It's a purpose-built workspace where Program Coordinators, Readers, Lead Readers, and Council staff work together from one secure platform. | Screen-record logging in (Login page → Dashboard for Program Coordinator role). Show the dashboard with stats, change requests, site visits, files section. Hover over each section briefly. | Overlay on dashboard: pulse-highlight each of the four role names appearing in sequence — *"Program Coordinator"* → *"Reader"* → *"Lead Reader"* → *"CSHSE Admin"*. |
| 0:55–1:30 | **4. Document import** | Start by uploading your last self-study — even a three-hundred-page Word document. The portal parses, tags, and routes each section to its matching CSHSE Standard and Sub-standard. Tables, syllabi, curriculum matrices — all preserved. | Open the Self-Study editor (`/self-study/{id}`), click **Import Document**. Select a sample DOCX. Record the parsing-status spinner (status: processing → awaiting_selection). Cut to the DocumentViewer with the imported HTML rendered. Drag-select a paragraph; record the SectionTagger modal opening. Pick Standard 11, Sub-standard `a`, click **Save Section**. Show the green "✓ Extracted" placeholder appearing. | Type into SectionTagger: **Title:** *"Curriculum Overview"*. Standard dropdown: *"Standard 11 — Curriculum"*. Sub-standard: *"11.a"*. Overlay: *"AI-assisted section tagging — DOCX, PDF, PPTX supported."* |
| 1:30–1:55 | **5. Narrative editor + AI validation** | Edit each Standard's narrative with the Spec text right beside you. The rich-text editor auto-saves every two seconds, so no work is ever lost. Click Save and Validate, and AI scores your response against the Standard before a human reviewer ever sees it. | Navigate to Standard 11.a in the editor. Show the Spec text in the side panel. Type into the narrative editor — show the autosave indicator flashing **"Saved 2s ago"**. Click **Save and Validate**. Record the modal opening showing the AI score, feedback, suggestions, and missing elements. | Type into narrative editor: *"Our program's curriculum demonstrates integration of knowledge, theory, skills, and values across required core courses including HSV-101 Introduction to Human Services and HSV-220 Case Management..."* Overlay after click: *"AI Score: 88 / 100 — PASS"* |
| 1:55–2:15 | **6. Evidence library** | Drop your supporting evidence — syllabi, advisory minutes, surveys, signed certificate pages — straight into the Supporting File Library. Files are organized by Standard, with versioning, so the latest edition is always front and center. | Click the Files view to open `FileLibrary`. Show the accordion of Part I (1-10) and Part II (11-21). Expand Standard 11 to show files under each Sub-standard. Drag a PDF from the desktop into the upload zone (or click Upload File). Record the upload progress + the file appearing under 11.a with a `v2` badge. | Type into upload form: **Standard:** *"11 — Curriculum"*. **Sub-standard:** *"11.a — Curriculum Overview"*. **Description:** *"HSV-101 syllabus, Spring 2025."* Overlay: *"Organized by Standard. Versioned. Audit-trailed."* |
| 2:15–2:40 | **7. Curriculum matrix + reviewer workspace** | Build your curriculum matrix in a spreadsheet view that maps every course to every Sub-standard, with Introduction, Theory, Knowledge, and Skills levels. When you submit, your assigned Readers see a split-screen workspace. They mark each Sub-standard Yes, No, or Not Applicable, leave comments anchored to specific passages, and request changes through a structured dual-approval workflow. | First half (12s): open `CurriculumMatrixEditor` view. Slowly pan across the imported matrix sections. Second half (13s): switch role to Reader (via superuser impersonation if needed — `/impersonate`). Open an assigned submission. Show the split-screen `NarrativeEditorWithComments`. Right-click on a sentence → "Add Comment." Show the comment appearing in the sidebar. Click a Y/N/NA pill on a Sub-standard. | Type comment: *"Please cite the specific advisory committee minutes referenced here."* Overlay on Y/N/NA click: *"Compliance assessment: Y / N / NA per Sub-standard"* |
| 2:40–2:55 | **8. Lead Reader compilation + help chat** | The Lead Reader compiles every Reader's input, highlights disagreements, and sets a final determination ready for the Council Board. Stuck? The built-in help chat reads from the CSHSE Member Handbook and answers questions in plain English — twenty-four seven. | Switch role to Lead Reader (impersonation). Open the Lead Reader compilation view. Show the disagreement-detection list (one Sub-standard where Reader A said "Yes" and Reader B said "No"). Click **Set Final Determination** → choose "Met." Cut to the HelpChat floating bubble — click it open. Type a question. | Type into HelpChat: *"What is the 45-day reader deadline?"* Show the AI response streaming. Overlay: *"Powered by the CSHSE Member Handbook."* |
| 2:55–3:00 | **9. cshse.org CTA + newsletter** | Subscribe to our newsletter for product updates and CSHSE deadlines. Or request a walkthrough today. Accreditation, simplified — at CSHSE. | Cut to a screenshot of cshse.org (the real CSHSE website). Highlight the newsletter signup section (or the URL bar if signup isn't visible). Overlay a styled card pointing to the specific URL — e.g. `cshse.org/self-study-portal` — coordinate exact slug with CSHSE staff. | Overlay card: **"Visit cshse.org/self-study-portal"** Sub: *"Subscribe · Request a walkthrough."* Final frame: *"CSHSE Accreditation Self-Study Portal — Council for Standards in Human Service Education"*. |

## 4. Filming Instructions (B-Roll Walkthrough)

### Setup before you record
1. **Run the app locally** — `cd server && npm run dev` and `cd client && npm run dev`. Open `http://localhost:3000`.
2. **Use seed data.** If you have the test seed endpoint from [[sprint-plan-2026-05-11|S6.4]], hit `POST /api/test/seed` to populate a fixture institution + submission + readers. Otherwise, create a coordinator account, an institution, and a sample submission manually before filming.
3. **Use the superuser account** to impersonate roles for Scenes 7 and 8 (reader and lead-reader views). Navigate to `/impersonate` → pick the role.
4. **Screen-record at 1920 × 1080**, browser zoomed to 100%, dock hidden, no notifications. macOS: built-in `Cmd+Shift+5` works. Windows: Xbox Game Bar or OBS. Free: OBS Studio on either platform.
5. **For static screenshots**, use `Cmd+Shift+4` (macOS) or Snip & Sketch (Windows). Save as PNG at 2× resolution.
6. **For text overlays and titles**, use Canva (free) or DaVinci Resolve (free) in post.

### Scene-by-scene capture checklist

- **Scene 1:** Take 1 static screenshot of the dashboard. Apply a slow Ken-Burns zoom in your editor. 15 s total.
- **Scene 2:** Record SpecManagement (admin route, requires admin login) for ~10s. Then 1 screenshot of a self-study DOCX with file properties visible. 20 s total.
- **Scene 3:** Record login → dashboard. Don't record the password (use a fake/test account or paused-out cursor). 20 s.
- **Scene 4:** Pre-import a small sample DOCX (any short Word doc works — even a one-page placeholder). Record the import flow. The status polling can be sped up 2× in post for the parsing-spinner segment. 35 s.
- **Scene 5:** Type slowly enough to be visible; use the sample paragraph in the table. The autosave indicator appears in the toolbar — zoom that area. 25 s.
- **Scene 6:** Have a real PDF ready on the desktop to drag in. 20 s.
- **Scene 7:** Two parts. Record matrix view first (12 s), then impersonate Reader (Settings → Switch Role → Reader). Open an assigned review. Add a comment. 25 s total.
- **Scene 8:** Impersonate Lead Reader. Open Lead Reader Reviews → pick a submission → comparison view. Then click HelpChat bubble (bottom-right). 15 s.
- **Scene 9:** Build the newsletter signup card in Canva. Overlay on a screenshot of the Layout header or a plain white background. 5 s.

### Color and audio

- All footage should match in saturation; if you record across multiple days, use the same browser theme + light/dark mode (light mode reads better on small previews).
- Heygen produces the voiceover separately — sync narration to the b-roll in your editor (DaVinci Resolve free works). Add light background music at -25dB. Royalty-free tracks: YouTube Audio Library or Pixabay Music.

### Sequence and pacing

- Average shot length: ~5 s. Cut between widescreen overviews and close-up zooms on the screenshot details where the narration calls out a specific feature.
- Add lower-third text overlays from the table at every scene transition; hold for 3 s.

## 5. Heygen Scripts (Per-Scene Copy-Paste)

If you produce the Heygen avatar segment-by-segment (recommended for cleaner sync), paste these blocks one at a time:

### Scene 1

```
Accreditation should let you focus on what matters — your students. But the self-study process behind it can drown a program in paperwork.
```

### Scene 2

```
The Council for Standards in Human Service Education — CSHSE — accredits Associate, Baccalaureate, and Master's-level Human Services programs across North America. Every five years, programs prepare a comprehensive self-study against the CSHSE National Standards. Today, that means weeks of formatting, file shuffling, and email threads.
```

### Scene 3

```
The CSHSE Accreditation Self-Study Portal changes that. It's a purpose-built workspace where Program Coordinators, Readers, Lead Readers, and Council staff work together from one secure platform.
```

### Scene 4

```
Start by uploading your last self-study — even a three-hundred-page Word document. The portal parses, tags, and routes each section to its matching CSHSE Standard and Sub-standard. Tables, syllabi, curriculum matrices — all preserved.
```

### Scene 5

```
Edit each Standard's narrative with the Spec text right beside you. The rich-text editor auto-saves every two seconds, so no work is ever lost. Click Save and Validate, and AI scores your response against the Standard before a human reviewer ever sees it.
```

### Scene 6

```
Drop your supporting evidence — syllabi, advisory minutes, surveys, signed certificate pages — straight into the Supporting File Library. Files are organized by Standard, with versioning, so the latest edition is always front and center.
```

### Scene 7

```
Build your curriculum matrix in a spreadsheet view that maps every course to every Sub-standard, with Introduction, Theory, Knowledge, and Skills levels. When you submit, your assigned Readers see a split-screen workspace. They mark each Sub-standard Yes, No, or Not Applicable, leave comments anchored to specific passages, and request changes through a structured dual-approval workflow.
```

### Scene 8

```
The Lead Reader compiles every Reader's input, highlights disagreements, and sets a final determination ready for the Council Board. Stuck? The built-in help chat reads from the CSHSE Member Handbook and answers questions in plain English — twenty-four seven.
```

### Scene 9

```
Subscribe to our newsletter for product updates and CSHSE deadlines. Or request a walkthrough today. Accreditation, simplified — at CSHSE.
```

## 6. Honest caveats

- **Newsletter lives on cshse.org, not in the SaaS app.** Confirmed with stakeholders 2026-05-11 — distribution will use CSHSE's existing website and newsletter rather than a new landing page. Scene 9's CTA should point to the existing cshse.org subscribe link; confirm exact URL before filming the overlay. If CSHSE doesn't currently have a visible newsletter signup on their site, request one — or fall back to *"Subscribe at cshse.org →"* as a generic landing-page pointer.
- **Curriculum matrix spreadsheet editor is in [[sprint-plan-2026-05-11|S4.3]] — not shipped at the moment of writing.** Scene 7 records the existing read-only matrix view; if S4.3 has landed by the time you film, capture the editable spreadsheet instead. Update the narration to add: *"...editable in real time, with versioned course history."*
- **AI Score example "88/100 — PASS" is illustrative.** Real scores vary by Spec and narrative. Pick a narrative + Spec combo that you've already tested and that scores above 80 — otherwise re-record.
- **Reader/Lead-Reader impersonation has no audit log today — [[sprint-plan-2026-05-11|S1.2]] addresses this.** Film with a real reader account where possible; impersonation is fine for v1 marketing but be aware it's a compliance hot-button you'll want to address before scaling production.

## 7. Run-time summary

| Asset | Count | Notes |
|-------|-------|-------|
| Total run time | 3:00 | Heygen pacing at ~150 wpm |
| Word count (narration) | ~440 | Master script word count |
| Scenes | 9 | Average ~20 s per scene |
| Static screenshots needed | 3 (min) | Scenes 1, 2, 9 |
| Screen-record clips needed | 7 | Scenes 2 (partial), 3, 4, 5, 6, 7, 8 |
| Required app states | 4 | Coordinator login, Reader (via impersonation), Lead Reader (via impersonation), Admin |
| External assets | 2 | Newsletter signup mock (Canva), background music (YouTube Audio Library) |
| Estimated production time | ~6 hours | Recording (2h) + editing in DaVinci Resolve (4h) |

## 8. Distribution channels

**Primary publishing target: cshse.org (CSHSE's existing website).** No separate product landing page is needed — the video and copy from §1 will be placed onto the CSHSE site.

- **Primary:** cshse.org — embed the full 3:00 on a new "Self-Study Portal" page (auto-play muted, click-to-unmute). Place the §1 hero + body copy on the same page.
- **Primary:** cshse.org existing newsletter — Scene 9's CTA points to whatever signup already lives on cshse.org rather than a new opt-in form. Confirm the URL with CSHSE staff before filming the overlay.
- **Secondary:** LinkedIn (CSHSE's organization page) — full 3:00 with captions burned in.
- **Tertiary:** CSHSE member-institution email blasts — link to the cshse.org page (most email clients block embedded video).
- **Internal:** Council Board demos.
- **YouTube:** unlisted by default on the CSHSE channel (if one exists); flip to public when v1 ships and the matrix editor ([[sprint-plan-2026-05-11|S4.3]]) is captured properly.

### Implications for the script and B-roll

- **Scene 9 newsletter card** — replace the generic Mailchimp-style mock with a screenshot or styled overlay of the **actual cshse.org newsletter signup**. If cshse.org doesn't have a visible newsletter signup, ask CSHSE for the existing subscribe link (most associations have one even if it's not prominent) and overlay a card pointing visitors there: *"Subscribe at cshse.org →"*.
- **Final CTA overlay** — point to a specific cshse.org URL (e.g. `cshse.org/self-study-portal`) rather than a generic "request a walkthrough." Coordinate the URL slug with CSHSE before finalizing.
- **Hero copy on the cshse.org page** — the §1 sales summary is plug-and-play. CSHSE's existing site styling will reskin it.

## 9. Iteration plan

- **v1.0 (this plan)** — ship at v1 launch. Scenes 4–8 reflect current product.
- **v1.1** — re-film Scenes 7 and 8 after [[sprint-plan-2026-05-11|S4.3 matrix editor]] and [[sprint-plan-2026-05-11|S4.1 evidence-AI pills]] land. Update narration accordingly.
- **v1.2** — add a brief "Compliance & Security" beat after Scene 8 once [[sprint-plan-2026-05-11|S1.1 reader-identity redaction]] + [[sprint-plan-2026-05-11|S1.2 impersonation audit]] are shipped. Useful for institutional buyer trust.
- **v2.0** — replace with a real customer-testimonial cut once the first CSHSE accreditation cycle has run through the portal.

## Related

- [[overview]] — what the portal actually is
- [[product-requirements]] — what the Handbook says it must support; ground-truth for marketing claims
- [[evidence-file-storage]] — Scene 6 reference
- [[import-pipeline]] / [[import-marker-mechanism]] — Scene 4 reference
- [[narrative-storage]] — Scene 5 reference
- [[n8n-integration]] — Scene 5 AI-validation reference
- [[frontend-architecture]] — UI surfaces the b-roll captures
- [[sprint-plan-2026-05-11]] — features not yet shipped (matrix editor, AI evidence pills, compliance work) drive the iteration plan above

---
name: Beta Group Training Webinar — Action Items 2026-05-20
description: Discussion log + action items captured from the 1h42m CSHSE Beta Group Training webinar. Every decision is tied to a transcript timestamp. Source for the CRs in Engineering/change-requests.
type: review
tags: [webinar, beta-group, training, action-items, requirements]
audit_date: 2026-05-20
auditor: claude
last_reviewed: 2026-05-20
---

# Beta Group Training Webinar — Action Items (2026-05-20)

**Date:** Wed 2026-05-20, 2:30 PM ET · **Duration:** 1h 42m · **Source:** [`CSHSE Beta Group Training_otter_ai_transcript.pdf`](../../../Downloads/CSHSE%20Beta%20Group%20Training_otter_ai_transcript.pdf)

**Attendees**
- **Eric Beser** (host) — engineering
- **Julia Becerra** — CSHSE accreditation lead (admin / VP for accreditation)
- **Yvonne Chase** — CSHSE board, lead reader workflow
- **Paul Datti** — program coordinator (security questions)
- **Monica Nandan** — Kennesaw State / Kennesaw Associate (template-format school)
- **Nicole Jackson Walker** — coordinator (UX feedback on validation timing)
- **Sara Meinsler** — coordinator
- **Speaker 1** (Anne Arundel Community College) — coordinator
- **Tracee** — guest (briefly)

## TL;DR — what the webinar changed

1. **BOTH importers must coexist** — AI wizard and the legacy per-standard cut-and-paste importer are required, not a choice. Multiple authors at different times need the per-standard path; finished docs use the wizard. ([28:25](#28-25))
2. **The 0-3 compliance score rubric is canonical** — not pass/fail. Non / Partial / Largely / Fully compliant. Partial scores carry to site visits. ([1:05:23](#1-05-23), slide "Comments & the 0-3 score")
3. **PC is locked out after final submit** — read-only + print. PC does NOT see reader names or comments until the board/Julia relays them. ([1:11:35](#1-11-35), [1:17:54](#1-17-54), [1:18:28](#1-18-28))
4. **Readers can't see the self-study until PC clicks final submit** — sequencing is hard-required. ([1:19:38](#1-19-38), [1:20:00](#1-20-00))
5. **Cross-institution data isolation is a stated security requirement** — Paul Datti pushed on this. No inter-program access; only the institution + its readers + lead reader can see the data. AI is a coded workflow, not a ChatGPT-style retriever; data flow needs explicit audit doc. ([24:07](#24-07), [25:09](#25-09), [26:04](#26-04))
6. **Reader-to-reader portal direct messaging** — replaces the current email-back-and-forth flow. Lead reader uses it to ask readers for clarification. ([1:25:35](#1-25-35), [1:25:52](#1-25-52))
7. **Compilation tab — side-by-side reader scores per spec** with disagreement highlighting and lead-reader-final score. Lead reader generates the compilation report. ([slide "Compilation tab"](#compilation-tab), [1:25:52](#1-25-52))
8. **Suggestions consolidation document** — PC can hand to VP for accreditation. All reader suggestions per standard pulled into one document. ([1:04:19](#1-04-19), [1:04:53](#1-04-53))
9. **Drag-and-drop multiple files** — confirmed as user-requested; Eric committed to ship. ([50:36](#50-36))
10. **Embedded hyperlinks must survive paste + remain clickable in narrative** — Eric committed to verify + fix if broken. ([56:14](#56-14), [56:57](#56-57))

## Decisions tagged to transcript timestamps

### Importer — both options confirmed

<a id="22-26"></a>**[22:26 — Julia Becerra]:** "we, what we were doing before was the individual standards, and them being able to cut and paste into each individual standard, which was useful because sometimes you have more than one person that is giving you pieces of that self-study piece of people that are responsible that are giving it to the coordinator at different times, so you may not have all of this at one time"

<a id="23-14"></a>**[23:14 — Julia]:** "I don't think that we want to do that, Eric. Like, I don't, I don't think that's what we were, we had talked about previously, and I, I'm not sure that this is going to be a intuitive way to do this for a lot of people."

<a id="27-23"></a>**[27:23 — Nicole]:** "the cut and paste felt did not feel good, because I felt like there's a lot of… it's prone to more error if you have to cut and paste that whole self-study and put it in sections, so this feels to me just a little bit less arduous to do."

<a id="28-25"></a>**[27:59 / 28:25 — Eric]:** "Let's not remove this feature. Let's keep this one and the second, you know, the wizard in the same system."
**[28:20 — Julia]:** "I'm okay with that. I mean, having the option is fine. It was just different than what we saw before."

→ **Decision: ship both. Wizard for full-doc + multi-author wizard upload; legacy per-standard editor for incremental piecewise entry.** ([CR-001](change-requests/cr-001-both-importers-required.md))

<a id="44-07"></a>**[43:35 — Eric]:** "you can do both. You can work. I would say all of the above. You can import the document, copy and paste the document into these tagged slices that push the data into the standard."
**[44:07 — Monica]:** "either we upload a whole new file of 300 pages or we copy and paste. We have both the options."
**[44:21 — Eric]:** "You have several people doing the work, they can each load their portion of the document, and it will read it in."

→ Confirms: wizard must support multi-author partial-doc uploads. ([CR-002](change-requests/cr-002-multi-author-wizard-upload.md))

<a id="41-11"></a>**[41:11 — Eric]:** "instead of taking the regular importer out, we're going to have the import document, and the wizard is going to be labeled as AI import, so you'll know which ones different."

→ UI labels confirmed.

### Security / cross-institution isolation

<a id="24-07"></a>**[24:07 — Paul Datti]:** "I just wondering how this AI situation is going to work, and I have some security concerns, mainly because, for the same way that we shouldn't enter, you know, students' work into AI to see if it's been generated by a human or not. I worry about the confidentiality of having program information put out there."

<a id="24-34"></a>**[24:34 — Eric]:** "That's completely safeguarded, because this is not using an AI like Chat GPT, or what have you, it's it's programmed into the system itself, so that the security of the system is that there's a database that has just about everything locked down, the database is not even on the internet, it's on it's on a local network that is only reachable by the software."

<a id="25-09"></a>**[25:09 — Paul]:** "and so that will only be reachable by, like, I'm a reviewer, that's true, but what about the other programs who are not on the CS HSE board, are they going to be able to access the information from their point of view?"

<a id="25-26"></a>**[25:26 — Eric]:** "only the institution can access the institution's information"
**[25:43 — Paul]:** "so there will be no inter program access to any of the programs across the country, only their own"
**[25:51 — Eric]:** "If somebody is, is a another standard, only their own can have this."

<a id="26-04"></a>**[26:04 — Eric]:** "we've also done a security audit on here, and there were some holes in here that are have been corrected."

→ Critical requirement, must be explicitly documented in a data-flow audit. ([CR-017](change-requests/cr-017-cross-institution-isolation-audit.md))

### Reader / Lead Reader workflow

<a id="1-04-19"></a>**[1:04:19 — Yvonne]:** "the suggestions from each standard can be pulled together in one document, and the reason that I ask is that sometimes some of those suggestions need to be addressed, need to go through the VP for accreditation, and back to the program to ask them to provide more data in the process of completing the self-study review."

<a id="1-04-53"></a>**[1:04:53 — Eric]:** "I see that as necessary as well, and so my note taker is taking that as an action item to effectively get that in."

→ ([CR-011](change-requests/cr-011-suggestions-consolidation-doc.md))

<a id="1-05-23"></a>**[1:05:23 — Julia]:** "you said that the validation can pass or not pass, but in some cases this what we have kind of meets the standard, but that's why we have the site visit to like verify whether or not the standard was met, so like, in addition, I think to past or not past, we will have to have something that is, like, like a maybe"
**[1:05:53 — Nicole]:** "is it's a partial"
**[1:05:54 — Julia]:** "a partial, yeah, something like that, but, but again, if we have a list of the suggestions, or what have you, we could take that with us when we do the site visits."

<a id="1-06-03"></a>**[1:06:03 — Eric]:** "right now I think it's either failed or passed, but I also, you know, what we did, the import was we have wizard, we have the confidence level that the AI feels that it's meeting the standards… if you have something marked as low confidence or review, that's a topic for the site visit."

→ Maps to the 0-3 rubric (slide "Comments & the 0-3 score"). ([CR-003](change-requests/cr-003-zero-to-three-compliance-rubric.md), [CR-012](change-requests/cr-012-site-visit-partial-compliance-tracking.md))

<a id="1-08-47"></a>**[1:08:47 — Nicole]:** "it might be helpful as they're uploading things to get warnings… you fail to submit, the standard, or you failed to submit the supporting evidence, or that would be lovely."
**[1:09:09 — Julia]:** "right. That's what we were talking about with the confidence level."

→ Confidence-based early warning while PC is editing.

<a id="1-11-35"></a>**[1:11:35 — Yvonne]:** "the application itself, I assume, is locked once they submit it, so a reader would need to go back through Julia to actually let them know what they needed to add at any point, is that correct?"
**[1:12:10 — Eric]:** "That's absolutely correct. That was the process that we started with."

→ PC lockout flow + Julia-as-relay model. ([CR-005](change-requests/cr-005-pc-lockout-on-final-submit.md), [CR-023](change-requests/cr-023-julia-relay-workflow.md))

<a id="1-12-45"></a>**[1:12:45 — Nicole]:** "the AI can't give them that instantaneous. Let's say they do their first section and submit text and upload some documents and forget to maybe answer, you know, B, they answer A, they answer C, forget the answer, B. It doesn't immediately say to them, 'Hey, you're missing this.'"
**[1:13:05 — Eric]:** "there's two types of submissions. Submitting it to the review is what's going to happen. Submit the entire document isn't going to happen until the document is completed, when it's ready, when you guys are ready to submit it, it's going to check to see whether or not this stuff has been submitted for review, whether or not there are missing items. It's going to do an error check."
**[1:13:48 — Eric]:** "when you're done a section and you submit it for review, that is what it's done."

→ Two-stage submission semantics. ([CR-006](change-requests/cr-006-two-stage-submission.md), [CR-008](change-requests/cr-008-pre-submission-validation-popup.md))

<a id="1-15-35"></a>**[1:15:35 — Eric]:** "the reader can see the coordinator can read and reply, but not see the real name of the person who's making comments. If this is truly locked to the user, the program coordinator won't be able to see the self-study until it is unlocked. That's the process you want followed, Julia."
**[1:18:15 — Eric]:** "they won't see the name of the reader, but they'll see the comments."
**[1:18:28 — Julia]:** "Yeah, we don't want that."
**[1:18:31 — Julia]:** "if readers disagree on the comments, we usually bring it before the board, and the board votes on what we think is appropriate moving forward… one of those comments may be irrelevant"

→ Identity redaction + comment-edit affordance for readers; PC does NOT see comments at all until they're sanitized + relayed by Julia. ([CR-004](change-requests/cr-004-comment-threading-identity-redaction.md))

<a id="1-17-22"></a>**[1:17:22 — Eric]:** "you finish your self-study, you click submit, you don't see the self-study anymore until after you've gone through the process of having it read, having the lead reader and your site visit"
**[1:17:54 — Julia]:** "Correct. Once they submit, they do no longer have access to make any changes at all. It's locked."
**[1:18:09 — Julia]:** "I believe they can still see it, and they should still be able to print it if they need to."

→ Lockout = read-only + printable, but no comments + no edits. ([CR-005](change-requests/cr-005-pc-lockout-on-final-submit.md))

<a id="1-19-38"></a>**[1:19:38 — Yvonne]:** "I think that the reader should not have access to the self-study until it's complete and submitted."
**[1:20:00 — Yvonne]:** "the reader does not have access to a program self-study until they've completed it and submitted it."
**[1:20:11 — Eric]:** "That's the process. Yeah, that's the process. So that's what was supposed to happen."

→ Reader-access gating on submission. ([CR-007](change-requests/cr-007-reader-access-after-submit.md))

<a id="1-25-35"></a>**[1:25:35 — Julia]:** "when we did Vera, when we did the previous program, that's that was supposed to be what we could do, is be able to have the conversations through the [portal], as opposed to emailing each other back and forth, which is what we do now, to be able to have that conversation online"

<a id="1-25-52"></a>**[1:25:52 — Eric]:** "got it all right. So that's okay. This has to be implemented, but that's direct messaging through the portal action item, and then the lead reader will generate the compilation report."

→ ([CR-010](change-requests/cr-010-portal-direct-messaging.md))

<a id="1-26-14"></a>**[1:26:14 — Yvonne]:** "under maybe it was under the lead reader, where you had site visits scheduled, is that under the lead reader"
**[1:26:40 — Julia]:** "Yes, lead reader, and usually another one of the readers go with them."
**[1:26:47 — Yvonne]:** "once the program's cleared for a site visit, the lead reader usually works with the program to actually set up the itinerary."

→ Site visit + itinerary builder. ([CR-013](change-requests/cr-013-site-visit-itinerary-builder.md))

### Other UX

<a id="50-36"></a>**[50:36 — Eric]:** "you can upload multiple files a right now. This is point this can point and select a file in a folder, but we are going to change to drag and drop to allow multiple. This was a something that had been suggested."

→ ([CR-014](change-requests/cr-014-drag-drop-multi-file.md))

<a id="56-14"></a>**[56:14 — Monica]:** "if I give you a text document that has an embedded URL already in a hyperlink, will the reader recognize? Oh, this is a hyperlink."
**[56:28 — Eric]:** "Yes, document that you're copying and pasting"
**[56:37 — Monica]:** "Yes, it'll recognize it. Thank you. It'll recognize it. I appreciate it."

<a id="56-57"></a>**[56:57 — Eric]:** "Something I'm going to ask the importer if that's the case, and if it's not, it will be."

→ ([CR-015](change-requests/cr-015-narrative-hyperlink-preservation.md))

<a id="compilation-tab"></a>**[slide "Compilation tab — side-by-side review"]:** per spec — Reader 1, Reader 2, Reader 3, Final. Disagreements highlighted automatically. Use the Comments thread to ask a reader for clarification. Lead reader sets final score. ([CR-009](change-requests/cr-009-compilation-tab-lead-reader.md))

<a id="37-56"></a>**[37:56 — Eric]:** "the way that we want you to do this is for you to screenshot the screen to copy the error, or what you think should be, instead of what is, and write a paragraph about that, what you were doing at the time"

→ In-app bug reporter would be lighter than the current screenshot-email flow. ([CR-016](change-requests/cr-016-in-app-bug-reporter.md))

## What was deferred / not built today

Eric noted these are coming but not in this sprint:
- AI evidence review (per-spec confidence) — was Sprint 4 / S4.x
- Reader-deadline tracker (45-day) — was Sprint 4 / S3.9
- Email host on server (not Gmail) — was Sprint 4 / S3.7
- Reader DOCX report from template — was Sprint 5 / S5.10
- Compilation tab + lead-reader compilation report — partly in S5.10, partly new
- Site visit checklist + itinerary — was Sprint 7 / S7.3 (S6.3 in new numbering)
- Board decisions + cycles — was Sprint 7 / S7.1, S7.2
- Joint Ventures — was Sprint 8

## Source citations

All decisions above are timestamped against the Otter.ai transcript at `/Users/ericbeser/Downloads/CSHSE Beta Group Training_otter_ai_transcript.pdf`. Slides referenced are in the same PDF (deck `wizard-user-guide-2026-05-20.pptx` was used in the demo).

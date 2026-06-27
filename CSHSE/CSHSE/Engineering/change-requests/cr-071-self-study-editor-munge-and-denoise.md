---
name: CR-071 — Self-Study editor: fix Open-Self-Study munge + de-noise + empty state
description: Clicking "Open Self-Study" renders a munged screen (pre-approval content leak needing a refresh) and the editor wastes space (dead band + empty gray block). Fix the state leak, give a clear empty state, and apply the de-noise pass.
type: change-request
cr_id: CR-071
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] (prod screenshot Standard 1/1.a; transcript 16:42–16:44) · 'it's already transferred this nonsense here' / 'that looks like a mess' · 'same problem we had with the review screen' (wasted space)"
sprint_target: Review De-noise (Sprint 2)
tags: [self-study-editor, ui, bug, de-noise, P1]
last_reviewed: 2026-06-26
---

# CR-071 — Self-Study editor: fix Open-Self-Study munge + de-noise + empty state

## Summary
Two problems on the Self-Study editor: (1) clicking **Open Self-Study** rendered a **munged screen** — content that should be empty appeared "already transferred," needing a manual refresh; (2) the editor **wastes space** — a dead band under the Validate/Submit chrome and a large empty gray editor block.

## Source quotes
- "It's **already transferred this nonsense here**"; "that looks like a **mess** … this should be empty … wrong interface." A **refresh** corrected it.
- "**same problem we had with the review screen**" (wasted space). Standard 1/1.a shows the dead band + empty editor.

## Decision
1. **Fix the munge/leak:** root-cause the stale/leaked state on the view switch (materialization timing, a cached query surviving the switch, or pre-hydration render) so Open-Self-Study lands clean on first navigation — no refresh.
2. **Clear empty state:** when a spec has no approved content yet, show "Approve items in Review to populate this spec" (the editor is empty by design until Approve materializes content) so it doesn't read as a bug.
3. **De-noise (mirror CR-064):** collapse the dead band; let the rich-text editor fill available height; compress the stacked header (progress steps + tabs + per-spec toolbar + Validate/Save/Cancel/Clear).

## Acceptance
- Open-Self-Study lands clean on first click (no refresh, no stale content).
- Empty specs show the explanatory empty state, not a blank gray block read as broken.
- The editor area fills the viewport; the dead band is gone.
- E2E: navigate Review→Self-Study without refresh → editor state correct.

## Files affected
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx`
- `client/src/features/selfStudy/Editor/.../NarrativeEditor.tsx`
- materialization/query path that feeds the editor (verify staleTime / refetch on view switch)

## Dependencies
- Shares the de-noise approach with [[cr-064-mode-aware-review-chrome]]. Empty-state ties to the Approve→materialize flow.

## Open questions
- Is the "munge" the same root cause as a known stale-query refetch issue? Confirm in repro.

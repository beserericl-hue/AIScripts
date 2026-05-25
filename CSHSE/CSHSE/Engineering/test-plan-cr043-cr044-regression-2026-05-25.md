---
name: CR-043 + CR-044 — Regression test plan
description: The complete test plan to close the testing gap on CR-043 (decouple Review from wizard) and CR-044 (typography). Enumerates every function + endpoint + UI surface that needs coverage, the fixtures, the expected behaviors, and the spec files a follow-on session must write. Designed so a fresh Claude Code session can read this doc + start implementing without further context.
type: test-plan
status: ready-to-execute
priority: P0
source: User direction 2026-05-25 — "I am totally uncomfortable with no testing. I expect you to develop E2E tests not only to test functions, but to do regression testing as well. These tests must work."
tags: [testing, e2e, playwright, unit, regression, cr-043, cr-044, ai-import]
last_reviewed: 2026-05-25
related:
  - "[[change-requests/cr-043-decouple-review-from-wizard-persist-across-reimport]]"
  - "[[change-requests/cr-044-review-screen-typography-parity]]"
  - "[[ai-import-wizard-e2e-regression-plan-2026-05-22]]"
  - "[[change-requests/cr-034-e2e-seed-endpoint]]"
---

# CR-043 + CR-044 regression test plan

## How to use this document

A new Claude Code session should:

1. Read this entire document.
2. Confirm the environment: `cshse-develop` is up; `E2E_SSO_KEY` is at `/tmp/sso-plain.txt` (or re-bootstrap via the protocol in `session_context.md`).
3. Work through the sections in order: **server unit tests** → **server integration tests** → **E2E tests** → **regression sweep**.
4. Every test in this document MUST pass against the deployed `cshse-develop` before claiming the work is complete.
5. Stevenson fixture files live at `~/Desktop/CSHSE/`. Files prefixed `2024 CSHSE Self-Study Stevenson University__*.docx` are the splits produced by `CSHSE/scripts/split_stevenson_for_multifile_test.py` — use them directly via `page.setInputFiles()` to bypass drag/drop.

## The honest gaps (what's untested today)

CR-043 shipped with 4 of 14 acceptance criteria directly E2E-tested. The other 10 are implemented in code but have zero behavioral assertion. The merge logic at the heart of the CR (`aiReviewMerge.ts`) has no unit tests at all. This document closes that gap.

CR-044 is pure typography — no functional regression risk. We add a single Playwright "renders without crashing" assertion + an axe-style contrast check on the Review surface. That's the entire CR-044 scope.

## Sections

1. [Server unit tests — aiReviewMerge.ts](#section-1)
2. [Server integration tests — aiReviewController.ts](#section-2)
3. [E2E tests — CR-043 acceptance criteria #3-#10, #12-#14](#section-3)
4. [E2E tests — Stevenson multi-file integration (real ~/Desktop/CSHSE/ files)](#section-4)
4B. [Importer end-to-end coverage extension (@slow)](#section-4b) — added 2026-05-25 after Section 4 surfaced 10 production bugs; same-shape probes across every importer surface
5. [Regression sweep — every existing AI Importer spec must still pass](#section-5)
6. [Test fixtures — what to add to seed.ts / fixtures/](#section-6)
7. [Run-and-report protocol](#section-7)

---

<a id="section-1"></a>

## 1. Server unit tests — `aiReviewMerge.ts`

**File:** `server/tests/unit/aiReviewMerge.test.ts` (new)
**Framework:** vitest (matches the existing server test setup)

### Functions that require coverage

| Function | Lines | What it does |
|---|---|---|
| `sha256Hex(input)` | exported | SHA-256 hex of an arbitrary string |
| `buildEmptyReviewState()` | exported (as `emptyState`) | Returns a clean `IAIReviewState` shape |
| `mergeImportIntoReviewState(state, inputs)` | exported | The CR-043 core — per-kind merge with strict same-source dedupe |
| `clearPreCR043State(SelfStudyImportModel, submissionId, excludeImportId?)` | exported | The cutover clear |
| `mergeFlatArray` | internal helper | Flat-array merge (tags, cvs, evidenceDocs, placeholders) |
| `isSameSource` | internal helper | (filename + content hash) equality check |
| `stampItem` | internal helper | Adds `sourceImportId` + `sourceFilename` |
| `dropApprovalsForSection` | internal helper | Strips approved/discarded ids on replace |
| `ensureItemSource` | internal helper | Adds to `state.itemSources` map |

Internal helpers don't need direct tests — exercised through `mergeImportIntoReviewState`.

### Test cases — `sha256Hex`

```ts
describe('sha256Hex', () => {
  it('returns 64 hex chars for any string', () => {
    expect(sha256Hex('hello').length).toBe(64);
    expect(sha256Hex('hello')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('is stable across calls', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
  });
  it('differs for different inputs', () => {
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
  });
  it('accepts a Buffer', () => {
    expect(sha256Hex(Buffer.from('hello'))).toBe(sha256Hex('hello'));
  });
});
```

### Test cases — `buildEmptyReviewState`

```ts
describe('buildEmptyReviewState', () => {
  it('returns the canonical empty shape', () => {
    const s = buildEmptyReviewState();
    expect(s.buckets).toEqual({});
    expect(s.tags).toEqual([]);
    expect(s.cvs).toEqual([]);
    expect(s.evidenceDocs).toEqual([]);
    expect(s.introductions).toEqual({});
    expect(s.placeholderSections).toEqual([]);
    expect(s.approvedIds).toEqual([]);
    expect(s.discardedIds).toEqual([]);
    expect(s.itemSources).toEqual({});
    expect(s.mergeLog).toEqual([]);
    expect(s.lastUpdatedAt).toBeInstanceOf(Date);
  });
});
```

### Test cases — `mergeImportIntoReviewState` (the heart of CR-043)

Each test names the CR-043 acceptance criterion it verifies in a `// AC#N` comment.

#### Group A: Fresh import (reimport=false) — add semantics

```ts
describe('mergeImportIntoReviewState — fresh import', () => {
  it('AC#3: adds new buckets to an empty state', () => {
    const state = buildEmptyReviewState();
    const report = mergeImportIntoReviewState(state, {
      importId: 'import-1',
      sourceFilename: 'file-A.docx',
      sourceContentHash: 'hash-A',
      importedAt: new Date(),
      reimport: false,
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a',
          narratives: [{ sectionId: 'sec-1', snippet: 'narrative one' }],
          evidenceText: [],
          evidenceFiles: []
        }
      },
      tags: [], cvs: [], evidenceDocs: [], introductions: {},
      placeholderSections: []
    });
    expect(state.buckets['1.a'].narratives.length).toBe(1);
    expect(state.buckets['1.a'].narratives[0].sourceImportId).toBe('import-1');
    expect(state.buckets['1.a'].narratives[0].sourceFilename).toBe('file-A.docx');
    expect(state.itemSources['sec-1']).toBeDefined();
    expect(state.itemSources['sec-1'].sourceContentHash).toBe('hash-A');
    expect(report.counts.narratives).toEqual({ kept: 0, replaced: 0, added: 1 });
  });

  it('AC#3: second file ADDS items without touching prior items', () => {
    const state = buildEmptyReviewState();
    // First import.
    mergeImportIntoReviewState(state, /* file-A inputs */);
    const priorNarrativeCount = state.buckets['1.a'].narratives.length;
    // Second fresh import.
    mergeImportIntoReviewState(state, /* file-B inputs with same spec but different items */);
    expect(state.buckets['1.a'].narratives.length).toBe(priorNarrativeCount + N);
    // Prior items still present.
    expect(state.buckets['1.a'].narratives.find(n => n.sectionId === 'sec-1')).toBeDefined();
  });

  it('idempotent: same import twice (without reimport flag) does not duplicate', () => {
    const state = buildEmptyReviewState();
    const inputs = makeInputs({ importId: 'import-1', sourceContentHash: 'hash-A',
                                buckets: { '1.a': { narratives: [{sectionId: 'sec-1'}] }}});
    mergeImportIntoReviewState(state, inputs);
    mergeImportIntoReviewState(state, inputs);
    expect(state.buckets['1.a'].narratives.length).toBe(1);
  });

  it('audit log appends one entry per merge', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(state, /* inputs */);
    expect(state.mergeLog.length).toBe(1);
    expect(state.mergeLog[0].reimport).toBe(false);
    expect(state.mergeLog[0].counts.narratives.added).toBeGreaterThan(0);
  });
});
```

#### Group B: Reimport with strict-match dedupe (AC#4)

```ts
describe('mergeImportIntoReviewState — reimport strict-match', () => {
  it('AC#4: reimport REPLACES items with same (filename, contentHash)', () => {
    const state = buildEmptyReviewState();
    // First import: 1 narrative under 1.a from file-A.docx / hash-A.
    mergeImportIntoReviewState(state, makeInputs({
      sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A',
      buckets: { '1.a': { narratives: [{sectionId: 'old-sec', snippet: 'old version' }] }}
    }));
    expect(state.buckets['1.a'].narratives[0].snippet).toBe('old version');

    // Reimport with same filename + same hash, new sectionId, new snippet.
    const report = mergeImportIntoReviewState(state, makeInputs({
      reimport: true,
      sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A',
      buckets: { '1.a': { narratives: [{sectionId: 'new-sec', snippet: 'new version'}] }}
    }));
    expect(state.buckets['1.a'].narratives.length).toBe(1);
    expect(state.buckets['1.a'].narratives[0].snippet).toBe('new version');
    expect(state.buckets['1.a'].narratives[0].sectionId).toBe('new-sec');
    expect(report.counts.narratives.replaced).toBe(1);
    expect(report.counts.narratives.added).toBe(1);
  });

  it('AC#4: approved mark on a replaced item is dropped (re-confirm invariant)', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(state, /* file-A first import */);
    state.approvedIds.push('old-sec');

    mergeImportIntoReviewState(state, /* reimport with same source */);
    expect(state.approvedIds).not.toContain('old-sec');
    expect(state.approvedIds).not.toContain('new-sec'); // new item not auto-approved
  });

  it('AC#5: reimport with DIFFERENT filename adds, does not replace', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(state, makeInputs({
      sourceFilename: 'file-A.docx', sourceContentHash: 'hash-A',
      buckets: { '1.a': { narratives: [{sectionId: 'sec-A'}] }}
    }));
    mergeImportIntoReviewState(state, makeInputs({
      reimport: true,
      sourceFilename: 'file-A-v2.docx', sourceContentHash: 'hash-V2',
      buckets: { '1.a': { narratives: [{sectionId: 'sec-V2'}] }}
    }));
    expect(state.buckets['1.a'].narratives.length).toBe(2);
  });

  it('AC#5: reimport with SAME filename but DIFFERENT hash adds, does not replace', () => {
    // Strict-match requires BOTH filename AND hash.
  });

  it('AC#5: items from a DIFFERENT source survive reimport-replace', () => {
    const state = buildEmptyReviewState();
    // File-A imports 1 narrative.
    mergeImportIntoReviewState(state, /* file-A */);
    // File-B imports 1 narrative.
    mergeImportIntoReviewState(state, /* file-B */);
    // Reimport file-A.
    mergeImportIntoReviewState(state, /* file-A reimport with reimport: true */);
    // file-B's narrative untouched.
    expect(state.buckets['1.a'].narratives.find(n => n.sectionId === 'sec-B')).toBeDefined();
  });
});
```

#### Group C: Per-kind dedupe — tags / cvs / evidenceDocs / introductions / placeholders

For each kind:
- Fresh import adds; reimport replaces by same-source; different source survives.

```ts
describe('mergeImportIntoReviewState — per-kind dedupe', () => {
  it('cvs: reimport replaces same-source CVs', () => { /* ... */ });
  it('cvs: different-source CVs both survive reimport', () => { /* ... */ });
  it('evidenceDocs: reimport replaces same-source papers/syllabi', () => { /* ... */ });
  it('tags: reimport replaces same-source tags', () => { /* ... */ });
  it('introductions: reimport replaces same-source intro items per bucket key', () => { /* ... */ });
  it('placeholderSections: reimport replaces same-source placeholders', () => { /* ... */ });
});
```

#### Group D: Coverage report passthrough

```ts
describe('mergeImportIntoReviewState — coverage report', () => {
  it('writes coverageReport when provided', () => { /* ... */ });
  it('preserves prior coverageReport when new merge omits it', () => { /* ... */ });
});
```

### Test cases — `clearPreCR043State`

Uses `mongodb-memory-server` (already configured in `server/tests/setup.ts`).

```ts
describe('clearPreCR043State', () => {
  it('AC#13: clears aiBuckets/aiTags/aiCVs/aiEvidenceDocs/aiIntroductions/aiIntroductionHints/aiPlaceholderSections/aiMatrices on prior imports', async () => {
    const submission = await Submission.create({...});
    const oldImport = await SelfStudyImport.create({
      submissionId: submission._id,
      aiBuckets: { '1.a': {...} },
      aiTags: [{...}],
      aiCVs: [{...}],
      // ...
    });
    const cleared = await clearPreCR043State(SelfStudyImport, submission._id);
    expect(cleared).toBe(1);
    const reloaded = await SelfStudyImport.findById(oldImport._id);
    expect(reloaded.aiBuckets).toBeUndefined();
    expect(reloaded.aiTags).toBeUndefined();
    // ... every field
  });

  it('AC#14: excludeImportId leaves the named import untouched', async () => { /* ... */ });

  it('AC#14: scoped to submission — other submissions stay intact', async () => { /* ... */ });

  it('returns 0 when no prior state exists', async () => { /* ... */ });
});
```

**Estimated test count for Section 1:** 30 unit tests across `aiReviewMerge.test.ts`.

---

<a id="section-2"></a>

## 2. Server integration tests — `aiReviewController.ts`

**File:** `server/tests/integration/aiReviewController.test.ts` (new)
**Framework:** vitest + supertest (matches existing integration setup)

### Endpoints that require coverage

| Endpoint | Function | What it does |
|---|---|---|
| `GET /api/submissions/:id/review` | `getReviewState` | Returns `aiReviewState` + `aiMatrixState` |
| `POST /api/submissions/:id/review/approve` | `approveItem` | Per-item approve toggle |
| `POST /api/submissions/:id/review/discard` | `discardItem` | Per-item discard toggle |
| `POST /api/submissions/:id/review/clear-item` | `clearItem` | Hard remove an item from the rail |
| `POST /api/submissions/:id/review/apply` | `applyReviewState` | Push approved items to Submission |
| `GET /api/submissions/:id/matrix-state` | `getMatrixState` | Returns `aiMatrixState` |
| `POST /api/submissions/:id/matrix-state` | `setMatrixRowEdit` | Persist a row edit |

### Test cases — `getReviewState`

```ts
describe('GET /api/submissions/:id/review', () => {
  it('returns 401 without auth', async () => { /* ... */ });
  it('returns 404 for missing submission', async () => { /* ... */ });
  it('returns the persisted aiReviewState when populated', async () => { /* ... */ });
  it('returns null state for a fresh submission', async () => { /* ... */ });
  it('returns aiMatrixState alongside aiReviewState', async () => { /* ... */ });
});
```

### Test cases — `approveItem` + `discardItem` + `clearItem`

```ts
describe('POST /api/submissions/:id/review/approve', () => {
  it('AC#8: approving an item adds it to approvedIds', async () => { /* ... */ });
  it('AC#8: approving removes a prior discard', async () => { /* ... */ });
  it('approving an already-approved item is idempotent', async () => { /* ... */ });
  it('returns 400 without sectionId', async () => { /* ... */ });
  it('returns 409 when aiReviewState is empty', async () => { /* ... */ });
});

describe('POST /api/submissions/:id/review/discard', () => {
  it('discarding an item adds it to discardedIds', async () => { /* ... */ });
  it('discarding removes a prior approval', async () => { /* ... */ });
});

describe('POST /api/submissions/:id/review/clear-item', () => {
  it('hard-removes an item from all buckets', async () => { /* ... */ });
  it('removes item from approvedIds and discardedIds', async () => { /* ... */ });
  it('removes item from itemSources', async () => { /* ... */ });
});
```

### Test cases — `applyReviewState` (AC#6)

```ts
describe('POST /api/submissions/:id/review/apply', () => {
  it('AC#6: applies approved items to Submission.narratives', async () => {
    const submission = await seedSubmissionWithApprovedItem();
    const res = await request(app)
      .post(`/api/submissions/${submission._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.appliedCounts.narratives).toBe(1);
    const reloaded = await Submission.findById(submission._id);
    expect(reloaded.narratives.get('1').get('a').content).toContain('approved snippet');
  });

  it('AC#6: approved items are DROPPED from aiReviewState after apply', async () => {
    const submission = await seedSubmissionWithApprovedItem();
    await request(app).post(`/api/submissions/${submission._id}/review/apply`)
      .set('Authorization', `Bearer ${token}`);
    const reloaded = await Submission.findById(submission._id);
    expect(reloaded.aiReviewState.approvedIds).toEqual([]);
    expect(reloaded.aiReviewState.buckets['1.a'].narratives).toEqual([]);
  });

  it('AC#6: un-approved items REMAIN in aiReviewState', async () => { /* ... */ });

  it('returns 400 when nothing is approved', async () => { /* ... */ });

  it('AC#6: writes per-spec introduction blobs from approved intros', async () => { /* ... */ });

  it('AC#6: aggregates approved evidence files into supportingEvidenceFiles[]', async () => { /* ... */ });

  it('AC#6: approved CVs ride to payload.cvs', async () => { /* ... */ });

  it('AC#6: approved evidence docs ride to payload.evidenceDocs', async () => { /* ... */ });
});
```

### Test cases — `getMatrixState` + `setMatrixRowEdit`

```ts
describe('matrix-state routes', () => {
  it('AC#9: GET returns persisted aiMatrixState', async () => { /* ... */ });
  it('AC#9: POST with edit persists the row edit', async () => { /* ... */ });
  it('AC#9: POST with edit=null removes the row edit', async () => { /* ... */ });
  it('returns 400 without matrixSlug+rowAnchor', async () => { /* ... */ });
});
```

### Cross-PC isolation — AC#10

```ts
describe('cross-PC isolation', () => {
  it('AC#10: a different user gets the route but the submission lookup respects auth', async () => {
    // The current auth model lets any authenticated user hit the route; the
    // submission lookup itself does NOT yet enforce creator scoping. This
    // test will FAIL today and pin the gap. Fix: add createdBy/owner check
    // to _loadOwnedSubmission similar to the ImportBatch controllers'
    // creator check.
  });
});
```

> **Note**: AC#10 cross-PC isolation is currently a known gap — the
> implementation comment in `aiReviewController._loadOwnedSubmission`
> says "trust the authenticate middleware + role check" but no explicit
> ownership check exists. Writing this test will SURFACE that gap.
> The follow-on fix is ~5 lines (compare `submission.submitterId` to
> `req.user._id`).

**Estimated test count for Section 2:** 30 integration tests.

---

<a id="section-3"></a>

## 3. E2E tests — CR-043 acceptance criteria #3-#10, #12-#14

**File:** `e2e/tests/27_review_lifecycle.spec.ts` (new)
**Framework:** Playwright
**Seed extensions needed:** see Section 6.

### Test cases — multi-import lifecycle

```ts
test.describe('CR-043 — multi-import review lifecycle', () => {
  test('AC#3: second-file workflow preserves prior items + approvals', async ({ page }) => {
    // Use the new seed fixture `wizard_review_two_imports` which seeds
    // a Submission.aiReviewState with items from TWO imports + an
    // approval on one of file-A's items.
    const seed = await seedFixture('wizard_review_two_imports');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.getByRole('button', { name: /^Review/ }).click();
    // Both files' items render.
    await expect(page.getByText(/standards-1-5/)).toBeVisible();
    await expect(page.getByText(/standards-6-9/)).toBeVisible();
    // The approval mark from the seed is preserved.
    await expect(page.getByText(/1 approved/)).toBeVisible();
  });

  test('AC#6: approve + apply moves the item to the editor and out of Review', async ({ page }) => {
    // Pre-condition: seed gives us one un-approved item.
    // Action: click Approve on it, then click "Apply to editor".
    // Assertion: open Standards editor for the item's spec; the
    //            narrative text appears. Reopen Review; the item is
    //            gone.
  });

  test('AC#8: re-locking — Review disables once everything is approved + applied', async ({ page }) => {
    // Approve all + apply. Review button disables.
  });

  test('AC#9: Matrix button parity', async ({ page }) => {
    // Seed populates aiMatrixState; Matrix button enables; click opens
    // MatrixSurface; row edits persist after refresh.
  });

  test('AC#10: cross-PC isolation', async ({ browser }) => {
    // Two contexts, two SSO logins, one shared submission.
    // PC owns. The other user (different role) gets a 403/404 on
    // GET /api/submissions/:id/review.
    // CURRENTLY THIS TEST WILL FAIL — see the gap note in Section 2.
    // The fix is a small follow-on.
  });

  test('AC#12: no wipe on startUpload — drop file-B with wizard open does not lose file-A', async ({ page }) => {
    // Seed has file-A items in aiReviewState.
    // Open wizard, drop a second file via setInputFiles(),
    //   click Start — the wizard transitions to Parse.
    // (We can't drive a real parse from the test, but we CAN assert that
    //  the store's buckets/tags/cvs/etc are STILL populated before the
    //  parser callback even fires. The pre-CR-043 bug was the upload
    //  click immediately wiped them.)
  });
});
```

### Test cases — reimport semantics via API (AC#4, AC#5)

E2E for the full reimport behavior is complex without a real parser run. Instead, hit the merge endpoint directly + assert state.

```ts
test.describe('CR-043 — reimport via API', () => {
  test('AC#4: same-source reimport strips approvals + replaces items', async ({ page }) => {
    // Seed populates state from import-A. Approve one item.
    // POST /api/imports/upload with file-A again + aiIsReimport=true.
    // POST /api/imports/:newId/start-ai (FAKE — we don't have ai-service
    //   in the test path, so we seed the import record's
    //   aiBuckets/aiTags directly + then synthetically POST to
    //   /api/imports/:id/ai-callback with HMAC signature to fire the
    //   server-side merge).
    // GET /api/submissions/:id/review — assert:
    //   - The same spec still has the right number of items (replaced).
    //   - approvedIds no longer contains the old sectionId.
  });

  test('AC#5: different filename reimport keeps both versions', async ({ page }) => {
    // Same flow but the second import comes from file-A-v2.docx.
    // GET /api/submissions/:id/review — assert two items live.
  });
});
```

### Test cases — pre-CR-043 cutover clear (AC#13, AC#14)

```ts
test.describe('CR-043 cutover clear', () => {
  test('AC#13: first post-deploy import clears pre-CR-043 SelfStudyImport fields', async ({ page }) => {
    // Seed a submission with a "pre-CR-043" SelfStudyImport that has
    // aiBuckets/aiTags/aiCVs populated AND Submission.aiReviewState =
    // null. Fire the merge via the test-harness webhook trigger.
    // Assert: prior import's aiBuckets/etc are now undefined.
  });

  test('AC#14: clear is idempotent — second import on same submission does not re-clear', async ({ page }) => {
    // After AC#13's run, fire ANOTHER import. Assert: the OTHER prior
    // imports for this submission are NOT touched again. The clear
    // only fires when aiReviewState === null.
  });
});
```

**Estimated test count for Section 3:** 10 E2E tests.

---

<a id="section-4"></a>

## 4. E2E tests — Stevenson multi-file integration

**File:** `e2e/tests/28_stevenson_multifile_integration.spec.ts` (new)
**Framework:** Playwright with `page.setInputFiles()` driving the file input directly (no drag/drop)
**Fixture files:** `~/Desktop/CSHSE/2024 CSHSE Self-Study Stevenson University__*.docx`

> **Important:** these tests upload the REAL Stevenson splits and drive
> the actual ai-service parser. They are SLOW (5-10 minutes per file)
> and depend on the dev `cshse-ai` service being reachable. Tag them
> `@slow` and gate via `test.skip(process.env.E2E_RUN_SLOW !== '1', ...)` so
> they don't run in the default sweep.

### Fixture files available

From the splitter we ran earlier, these are in `~/Desktop/CSHSE/`:

```
2024 CSHSE Self-Study Stevenson University__00-preamble.docx
2024 CSHSE Self-Study Stevenson University__01-standards-01-05.docx
2024 CSHSE Self-Study Stevenson University__02-standards-06-09.docx
2024 CSHSE Self-Study Stevenson University__03-standards-10-13.docx
2024 CSHSE Self-Study Stevenson University__04-standards-14-21.docx
2024 CSHSE Self-Study Stevenson University__05-appendix.docx
2024 CSHSE Self-Study Stevenson University__cv-only__adventure-therapist.docx
2024 CSHSE Self-Study Stevenson University__cv-only__barry-w-thomas.docx
2024 CSHSE Self-Study Stevenson University__cv-only__carol-a-dietrich.docx
2024 CSHSE Self-Study Stevenson University__cv-only__roxanne-m-epps.docx
2024 CSHSE Self-Study Stevenson University__paper__sample-country-report.docx
2024 CSHSE Self-Study Stevenson University__paper__sample-response-paper.docx
2024 CSHSE Self-Study Stevenson University__syllabus__chs-105-human-services-social-policy.docx
2024 CSHSE Self-Study Stevenson University__syllabus__psy-101-introduction-to-psychology-3-s.docx
```

### Test cases

```ts
test.describe('@slow Stevenson real-file multi-import integration', () => {
  test.skip(process.env.E2E_RUN_SLOW !== '1', 'set E2E_RUN_SLOW=1 to enable');

  const FIXTURE_DIR = path.join(os.homedir(), 'Desktop', 'CSHSE');

  test('drop standards-01-05.docx → parse → Review shows narratives', async ({ page }) => {
    const seed = await seedFixture('wizard_review_minimal'); // gives us a submission
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    const wizardBtn = page.getByRole('button', { name: /Importer Wizard/ });
    await wizardBtn.click();
    // Find the file input + set the Stevenson split.
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(
      path.join(FIXTURE_DIR, '2024 CSHSE Self-Study Stevenson University__01-standards-01-05.docx')
    );
    // Click Next to kick off the upload + parse.
    await page.getByRole('button', { name: /Next/ }).click();
    // Wait for parse to complete (long).
    await page.waitForSelector('[data-testid="parse-complete"]', { timeout: 600_000 });
    // Click the new "Open Review" / "Next: Review" handoff.
    await page.getByRole('button', { name: /Next: Review/ }).click();
    // The persisted Review surface should be visible with Stevenson items.
    await expect(page.getByRole('heading', { name: /Review \(CR-043\)/ })).toBeVisible();
    // Some standards should have items.
    await expect(page.getByRole('tab', { name: /^1\.a/ })).toBeVisible();
  });

  test('drop standards-01-05.docx then standards-06-09.docx — merged Review shows both', async ({ page }) => {
    // Same flow but two consecutive imports.
    // After both parses complete + we open Review, assert:
    //   - bucket 1.a items from file-1 are present (source chip shows file-1)
    //   - bucket 7.b items from file-2 are present (source chip shows file-2)
    //   - applyTotals.narratives reflects the sum
  });

  test('drop CV-only file → wizard auto-routes to StandaloneCVReview', async ({ page }) => {
    // Use barry-w-thomas.docx — single CV.
    // Assert: after parse, the wizard renders StandaloneCVReview (single
    // CV card with faculty-name input + spec dropdown).
  });

  test('reimport: drop standards-01-05.docx, approve 2 items, then drop it again WITH reimport checked', async ({ page }) => {
    // Approve items 1 and 2.
    // Second parse with reimport=true.
    // Assert (per AC#4): items 1 and 2's snippets are now the NEW versions;
    // their approval marks are gone (need re-confirm).
  });

  test('drop 4 standard files in sequence → all merge into one Review', async ({ page }) => {
    // standards 01-05, 06-09, 10-13, 14-21.
    // Assert: applyTotals.narratives is the sum of all four; SpecRail
    // shows entries across Standards 1-21.
  });
});
```

**Estimated test count for Section 4:** 5 slow Stevenson integration tests.

---

<a id="section-4b"></a>

## 4B. Importer end-to-end coverage extension (@slow)

**File:** `e2e/tests/29_importer_full_coverage.spec.ts` (new)
**Framework:** Playwright `@slow`, gated behind `E2E_RUN_SLOW=1`
**Trigger:** added to plan scope 2026-05-25 after Section 4's Stevenson #1–#3 surfaced 10 production bugs (CR-037 empty-bucket guard wrongly failing CV-only uploads; CV detector architectural miss; splitter truncation; etc.). The same code paths that produced those bugs sit under every other importer surface — these specs probe each one to make sure no latent siblings remain.

**Sequencing:** run AFTER Stevenson #4 (reimport) and #5 (4-file sequence) complete green. The order matters because #4 + #5 validate the multi-file lifecycle that this extension's tests reuse implicitly.

**Goal:** every importer surface that depends on the same terminal-callback / detector / walker plumbing now has a real-docx assertion. If any of these surfaces breaks the way CV-only broke, the test catches it instead of a coordinator finding it in production.

### Test cases (one per surface)

1. **Paper-only upload (CR-040 evidenceDocs)**
   Upload `__paper__sample-response-paper.docx`. Assert: status='parsed', `payload.evidenceDocs.length > 0`, `Submission.aiReviewState.evidenceDocs.length > 0`. Confirms the CR-037 empty-bucket guard's `evidenceDocs` count works end-to-end.

2. **Syllabus-only upload (CR-040 evidenceDocs)**
   Upload `__syllabus__chs-105-human-services-social-policy.docx`. Same assertions as paper, plus that the detected `kind === 'syllabus'`.

3. **Introduction-only docx (CR-039 introductionHints)**
   Upload a fixture containing "Mission", "About the Program" headings with no Standards. Assert: `payload.introductionHints` non-empty, `introductions` populated in `aiReviewState`. The CR-037 fix also has to count intro items — verify it does.

4. **Coverage report populated (CR-040 Phase 3b)**
   Upload `__01-standards-01-05.docx`. Assert: `payload.coverageReport` is an object with `totalParagraphs > 0` and `coveragePercent` set; `aiReviewState.coverageReport` mirrors it.

5. **Curriculum matrix extraction**
   Upload the appropriate Stevenson split that contains `MatrixHSR` + `Matrix2` anchors (or the full Stevenson if needed). Assert: `aiMatrixState.matrices.length >= 1`, with non-empty `cells[]` and `columnHeaders[]`.

6. **Tag handling (CR-032)**
   Upload a Stevenson split that contains content the matcher won't confidently place (e.g. a generic prose section without a Standards heading). Assert: `payload.tags.length > 0`, each tag has `suggestedStd` + `suggestedSpec` + `confidence` + `acceptState='review_unknown'`.

7. **Placeholder sections (CR-037 "Unwritten" rail)**
   Upload a template-style docx with `Standard 7.b` heading but no body content. Assert: `payload.placeholderSections.length > 0`, `aiReviewState.placeholderSections` populated.

8. **Format detector — template path**
   Upload a known template-format docx (one with the template signals). Assert: `payload.format.format === 'template'`, `_run_template_pipeline` ran (not `_run_self_study_pipeline`), and the wizard reaches Review.

9. **Malformed inputs**
   Four sub-cases:
     a. 0-byte docx → assert HTTP 400 on upload (NOT a silent pipeline crash).
     b. Renamed PDF (`.pdf` content but `.docx` extension) → assert detector catches it; surfaces actionable error.
     c. Password-protected docx → assert mammoth raises; surfaced as `payload.errors[0].message` with a coordinator-friendly hint.
     d. Truncated docx (zip damaged) → assert recovery / explicit failure, never a silent zero-content `parsed`.

10. **Large appendix performance**
    Upload Stevenson's `__05-appendix.docx` (5,952 paragraphs). Assert: parse completes within 15 minutes; `aiReviewState.evidenceDocs.length > 0` (the appendix is mostly papers + syllabi); no `processing_state='failed'` from a per-section timeout. This is also a soft memory regression catch — Railway's container OOM-kills on memory pressure, which would surface as the parse hanging on a stage.

11. **Concurrent imports (same user, no batch)**
    Two browser contexts, same submission, same user, two different files uploaded simultaneously. Assert: both imports reach `parsed`, `Submission.aiReviewState.itemSources` contains entries from BOTH files (no clobbering). This is distinct from CR-041's batch flow (same-coordinator-multi-file inside ONE wizard run) — here we exercise the race where two separate wizard sessions hit the merge service concurrently.

**Estimated test count for Section 4B:** 11 @slow integration tests (one is split into 4 sub-cases, so ~14 assertion clusters).

**Fixtures needed:**
- Existing Stevenson splits cover items 1, 2, 4, 5, 10.
- Item 3 needs a new fixture: pick `__00-preamble.docx` (likely contains "Mission" / "About the Program") and verify, else hand-craft a minimal intro-only docx.
- Item 6 needs to identify a Stevenson section the matcher can't place — likely from `__04-standards-14-21.docx` (sparse content).
- Item 7 needs a hand-crafted template-format docx.
- Item 8 same as item 7.
- Item 9 fixtures: 0-byte file (write empty), rename a real PDF, find a password-protected docx, intentionally truncate a real docx.
- Item 11 reuses any two standards splits.

**Bug-fix policy:** per the standing rule, any failing test == real production bug. Fix the implementation, not the test. The expected outcome is 0 failures after iteration; the test plan stays open until every assertion is green.

---

<a id="section-5"></a>

## 5. Regression sweep — every existing AI-Importer spec

**Goal:** post-CR-043, the existing 19 Playwright specs all still pass.

### Existing specs to verify

```
00_health.spec.ts            — backend smoke
02_upload.spec.ts            — file upload basics
03_parse.spec.ts             — Parse step rendering
04_match.spec.ts             — matcher confidence display
05_matrix.spec.ts            — matrix step
13_review_edit_pencil.spec.ts — CR-032 inline edit
14_review_discard.spec.ts    — CR-033 Discard button
15_sso_smoke.spec.ts         — CR-042 SSO smoke
16_apply.spec.ts             — Apply step
17_recovery_hard_refresh.spec.ts — recovery
21_empty_buckets_guard.spec.ts — CR-037
22_handshake_retries.spec.ts — CR-036
23_introduction.spec.ts      — CR-039 (2 tests)
25_multifile_batch.spec.ts   — CR-041 US-10
26_review_persistence.spec.ts — CR-043 (NEW, 4 tests)
discard_button.spec.ts       — legacy
health.spec.ts               — legacy smoke
login.spec.ts                — login flow
```

Plus the new specs from this plan:
```
27_review_lifecycle.spec.ts            (Section 3, ~10 tests)
28_stevenson_multifile_integration.spec.ts (Section 4, ~5 tests, @slow)
```

### Regression assertions

For each existing spec, the post-CR-043 invariant is:
- Specs that navigate via the wizard's step rail (`13_review_edit_pencil`, `14_review_discard`, `16_apply`, `17_recovery_hard_refresh`) MUST still work via the wizard's internal Review/Apply tabs. The backwards-compat fallback in `ParseStep` (event dispatch + `setStep('review')`) preserves their navigation path.
- Specs that depend on `aiImportStore.buckets`/`tags`/etc being populated MUST still see those fields populated. The CR-043 change made them read-through caches but the values are the same shape.

### How to run

```bash
cd /Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/e2e
E2E_BASE_URL='https://cshse-develop.up.railway.app' \
  E2E_SEED_TOKEN='7d9e8a3b6f1c4d2a8e5b9f0c3d7a1e6b' \
  E2E_SSO_KEY="$(cat /tmp/sso-plain.txt)" \
  npx playwright test --reporter=list
```

Expected outcome after this plan completes:
- ~19 fast specs (current baseline) + 10 new = **29 fast specs, all green**
- +5 Stevenson @slow specs gated behind `E2E_RUN_SLOW=1`
- 25 skipped (the existing skip list — these are intentionally-skipped Tier 2/3 specs from the broader regression plan)

---

<a id="section-6"></a>

## 6. Test fixtures — seed router extensions

The new tests need seed fixtures that aren't covered by the existing ones.

### New fixture — `wizard_review_two_imports.json`

```json
{
  "_fixture_name": "wizard_review_two_imports",
  "_purpose": "CR-043 AC#3 multi-import lifecycle. Seeds a Submission.aiReviewState populated by TWO different imports — file-A and file-B — with one of file-A's items already approved. Verifies the second-file workflow preserves prior items + approvals.",
  "user": { /* same shape as wizard_review_minimal */ },
  "submission": { /* same */ },
  "import": { /* the anchor; CR-041 batch-style not required */ },
  "reviewState": {
    "itemSources": {
      "sec-A-1": {
        "importId": "synthetic-import-A",
        "sourceFilename": "standards-1-5-DepartmentChair.docx",
        "sourceContentHash": "hashA1",
        "importedAt": "2026-05-25T10:00:00Z"
      },
      "sec-B-1": {
        "importId": "synthetic-import-B",
        "sourceFilename": "standards-6-9-CurriculumLead.docx",
        "sourceContentHash": "hashB1",
        "importedAt": "2026-05-25T11:00:00Z"
      }
    },
    "buckets": {
      "1.a": {
        "standardCode": "1", "specCode": "a",
        "narratives": [
          { "sectionId": "sec-A-1", "snippet": "From file A", "sourceImportId": "synthetic-import-A", "sourceFilename": "standards-1-5-DepartmentChair.docx", "wordCount": 5, "confidence": 0.9, "heading": "Program ID from A" }
        ],
        "evidenceText": [], "evidenceFiles": [], "matrixCells": [],
        "coverageScore": null, "coverageCovered": null, "coverageGaps": [], "coverageStrengths": []
      },
      "7.b": {
        "standardCode": "7", "specCode": "b",
        "narratives": [
          { "sectionId": "sec-B-1", "snippet": "From file B", "sourceImportId": "synthetic-import-B", "sourceFilename": "standards-6-9-CurriculumLead.docx", "wordCount": 5, "confidence": 0.85, "heading": "Faculty from B" }
        ],
        "evidenceText": [], "evidenceFiles": [], "matrixCells": [],
        "coverageScore": null, "coverageCovered": null, "coverageGaps": [], "coverageStrengths": []
      }
    },
    "tags": [], "cvs": [], "evidenceDocs": [], "introductions": {},
    "placeholderSections": [],
    "approvedIds": ["sec-A-1"],
    "discardedIds": [],
    "mergeLog": []
  }
}
```

### Seed router changes

**File:** `server/src/routes/test.ts`

Add a new `reviewState` field handler analogous to `batch`:

```ts
const reviewStateSpec = (merged.reviewState ?? null) as Record<string, unknown> | null;

// ... after submission is created ...

if (reviewStateSpec) {
  (submissionDoc as any).aiReviewState = {
    ...reviewStateSpec,
    lastUpdatedAt: new Date()
  };
  (submissionDoc as any).markModified('aiReviewState');
  await submissionDoc.save();
}
```

### New fixture — `wizard_review_pre_cr043_state.json`

For AC#13 cutover-clear test. Seeds a submission with NO `aiReviewState` but with prior `SelfStudyImport` records that have `aiBuckets/aiTags/aiCVs` populated.

### Stevenson fixture index

For Section 4 tests, the Stevenson splits stay in `~/Desktop/CSHSE/`. No seed fixture is needed because those tests UPLOAD the files via `page.setInputFiles()` — the test environment doesn't pre-seed state; it drives the real wizard.

---

<a id="section-7"></a>

## 7. Run-and-report protocol

After implementing every test in this plan, the new session must:

1. **Run the full suite:**
   ```bash
   cd CSHSE/server && ./node_modules/.bin/vitest run
   cd CSHSE/e2e && E2E_BASE_URL='https://cshse-develop.up.railway.app' \
                    E2E_SEED_TOKEN='7d9e8a3b6f1c4d2a8e5b9f0c3d7a1e6b' \
                    E2E_SSO_KEY="$(cat /tmp/sso-plain.txt)" \
                    npx playwright test --reporter=list
   ```

2. **Expected totals:**
   - server vitest: ~30 new unit tests + ~30 new integration tests + the existing ~52 server tests = **~112 total**
   - e2e Playwright (fast): existing 19 + 10 new (Section 3) + 4 new (CR-043 26_review_persistence already shipped) = **~33 fast**
   - e2e Playwright (@slow, gated): 5 Stevenson integration tests, **opt-in only**

3. **Every test MUST pass.** If a test fails:
   - The test itself might be wrong → fix the test.
   - The implementation is wrong → fix the implementation, then verify the test.
   - Cross-PC isolation (Section 2) WILL surface a known gap. Fix it (5-line owner check on `_loadOwnedSubmission`).

4. **Report format:**
   ```
   Section 1 — aiReviewMerge.test.ts:        30/30 passing
   Section 2 — aiReviewController.test.ts:   30/30 passing (after isolation fix)
   Section 3 — 27_review_lifecycle.spec.ts:  10/10 passing
   Section 4 — Stevenson @slow (opt-in):     5/5 passing with E2E_RUN_SLOW=1
   Section 4B — Importer extension (opt-in): 11/11 passing with E2E_RUN_SLOW=1
   Section 5 — regression sweep:             23/23 prior specs still passing
   Total: 109 tests, 0 failures.
   ```

5. **Update the testing doc** in `Engineering/log.md` with the date + results.

---

## Out of scope for this plan

These items are NOT part of the testing work; they are separate follow-ons:

- **Wizard Stepper collapse** — removing the wizard's internal Review/Matrix/Apply tabs. The plan above keeps them as backwards-compat fallbacks. Once Sections 1-5 land green, the next session can port specs 13/14/16/17 to the new surface, then delete the wizard internals. ~1 day of focused work.
- **Coverage <90% calibration** — needs real Stevenson-class run stats; not a testing exercise.
- **Reader-scoring caller** — blocked on Reader workflow (CR-009) existing.

## Why this plan is exhaustive

Every claim in the "honestly NOT delivered" report has a test in this plan. Every untested CR-043 acceptance criterion (#3, #4, #5, #6, #8, #9, #10, #12, #13, #14) has a named test that asserts it. The Stevenson multi-file integration covers the real-world workflow that motivated CR-041 + CR-043 in the first place.

If every test in this plan passes, the AI Importer track moves from "implemented and hoping it works" to "regression-proof."

/**
 * CVs, Syllabi, and Papers are approvable just like narratives — and the
 * approve checkbox REFLECTS the persisted approved set on load. Previously
 * these three rail views (CVsView / EvidenceDocsView) had NO approve control
 * at all, so a coordinator who approved every CV/syllabus/paper could not see
 * which ones were approved. This locks in: seeded approvedIds render checked,
 * toggling persists to the DB, and a reload keeps the visual state.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, gotoReviewStep, type SeedResult } from '../helpers/seed';

const CV1 = 'sec-cv-1';
const CV2 = 'sec-cv-2';
const SYL1 = 'sec-syl-1';
const PAP1 = 'sec-pap-1';

function base(id: string) {
  return { sectionId: id, heading: id, snippet: 's', htmlSnippet: '<p>s</p>', wordCount: 1, confidence: 0.9, acceptState: 'pending', rationale: '' };
}

test.describe('CV / Syllabus / Paper approve checkbox (visible + persisted)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('seeded approvals render checked; toggling persists across reload', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'cv-approve@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {},
        tags: [],
        cvs: [
          { ...base(CV1), facultyName: 'Jane CV' },
          { ...base(CV2), facultyName: 'John CV' },
        ],
        evidenceDocs: [
          { ...base(SYL1), title: 'Intro Syllabus', docSubKind: 'syllabus' },
          { ...base(PAP1), title: 'Family Project', docSubKind: 'paper' },
        ],
        introductions: {},
        placeholderSections: [],
        // CV1 + SYL1 are PRE-APPROVED — their checkboxes must render checked.
        approvedIds: [CV1, SYL1],
        discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    // --- CVs view: CV1 checked, CV2 not. ---
    await page.getByTestId('rail-cvs').click();
    await expect(page.getByTestId(`approve-check-${CV1}`)).toBeChecked();
    await expect(page.getByTestId(`approve-check-${CV2}`)).not.toBeChecked();

    // Approve CV2 by clicking its checkbox.
    await page.getByTestId(`approve-check-${CV2}`).click();
    await expect(page.getByTestId(`approve-check-${CV2}`)).toBeChecked({ timeout: 10_000 });

    // --- Syllabi view: SYL1 checked. ---
    await page.getByTestId('rail-syllabi').click();
    await expect(page.getByTestId(`approve-check-${SYL1}`)).toBeChecked();

    // --- Papers view: PAP1 not yet approved → approve it. ---
    await page.getByTestId('rail-papers').click();
    await expect(page.getByTestId(`approve-check-${PAP1}`)).not.toBeChecked();
    await page.getByTestId(`approve-check-${PAP1}`).click();
    await expect(page.getByTestId(`approve-check-${PAP1}`)).toBeChecked({ timeout: 10_000 });

    // --- Persisted to the DB: CV1, SYL1 (seeded) + CV2, PAP1 (just clicked). ---
    await expect
      .poll(async () => {
        const r = await page.evaluate(async (id) => {
          const raw = localStorage.getItem('auth-storage');
          const token = raw ? JSON.parse(raw)?.state?.token : null;
          const res = await fetch(`/api/submissions/${id}/review`, { headers: { Authorization: `Bearer ${token}` } });
          return (await res.json())?.aiReviewState?.approvedIds ?? [];
        }, seed!.submissionId);
        return JSON.stringify((r as string[]).slice().sort());
      }, { timeout: 20_000, intervals: [1000] })
      .toContain(PAP1);

    // --- Reload: the seeded + newly-approved checks survive. ---
    await page.reload();
    await page.waitForLoadState('networkidle');
    await gotoReviewStep(page, seed);
    await page.getByTestId('rail-cvs').click();
    await expect(page.getByTestId(`approve-check-${CV1}`)).toBeChecked({ timeout: 15_000 });
    await expect(page.getByTestId(`approve-check-${CV2}`)).toBeChecked();
    await page.getByTestId('rail-papers').click();
    await expect(page.getByTestId(`approve-check-${PAP1}`)).toBeChecked({ timeout: 15_000 });
  });
});

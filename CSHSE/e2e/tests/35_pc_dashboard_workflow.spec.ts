/**
 * CR-047 — PC dashboard reorganized to follow the self-study workflow.
 *
 * The landing dashboard (/dashboard) for a Program Coordinator now mirrors
 * the editor toolbar's IMPORT → DRAFTS → SELF-STUDY → SUBMIT vocabulary:
 *
 *   1. IMPORT shows the PC's uploaded self-study file.
 *   2. DRAFTS shows count tiles (CVs / Syllabi / Projects / Introductions /
 *      Spec items) + a per-spec breakdown of items in Review.
 *   3. SELF-STUDY shows committed counts + a progress bar.
 *   4. SUBMIT shows the deadline + a (disabled-until-ready) submit CTA.
 *
 * Each DRAFTS tile / per-spec row deep-links into the editor's Review
 * surface, pre-selected to that kind.
 *
 * This spec seeds a submission with a known server-side aiReviewState
 * (via the /api/test/seed `reviewState` override block) and asserts the
 * dashboard rolls those counts up correctly, then that clicking a tile
 * lands on the Review surface.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

// Known draft counts: CVs 2, Syllabi 2, Projects 1, Introductions 1,
// Spec items 3 (1.a → 1, 2.c → 2).
const REVIEW_STATE_OVERRIDE = {
  reviewState: {
    buckets: {
      '1.a': {
        standardCode: '1',
        specCode: 'a',
        narratives: [{ sectionId: 'wf-n1', heading: 'h', snippet: 's', wordCount: 1 }],
        evidenceText: [],
        evidenceFiles: [],
        matrixCells: [],
      },
      '2.c': {
        standardCode: '2',
        specCode: 'c',
        narratives: [
          { sectionId: 'wf-n2', heading: 'h', snippet: 's', wordCount: 1 },
          { sectionId: 'wf-n3', heading: 'h', snippet: 's', wordCount: 1 },
        ],
        evidenceText: [],
        evidenceFiles: [],
        matrixCells: [],
      },
    },
    cvs: [
      { sectionId: 'wf-cv1', personName: 'Jane Doe' },
      { sectionId: 'wf-cv2', personName: 'John Roe' },
    ],
    evidenceDocs: [
      { sectionId: 'wf-syl1', docSubKind: 'syllabus' },
      { sectionId: 'wf-syl2', docSubKind: 'syllabus' },
      { sectionId: 'wf-pap1', docSubKind: 'paper' },
    ],
    introductions: { document: { items: [{ sectionId: 'wf-in1' }] } },
    tags: [],
    placeholderSections: [],
    approvedIds: [],
    discardedIds: [],
    itemSources: {},
    mergeLog: [],
  },
};

test.describe('CR-047 — PC dashboard workflow pipeline', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    // Unique institution per seed so the dashboard's
    // `GET /submissions?institutionId=X&limit=1` resolves to THIS test's
    // submission (the shared default institution would otherwise let one
    // test's PC navigate to another test's submission → 404).
    const uniqueInst = `CR047 E2E University ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    seed = await seedFixture('wizard_review_minimal', {
      ...REVIEW_STATE_OVERRIDE,
      user: { institutionName: uniqueInst },
      submission: { institutionName: uniqueInst },
    });
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('dashboard surfaces the import file + draft counts + per-spec rows', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);

    // Land on the workflow dashboard and wait for the rollup to load.
    const summaryResp = page.waitForResponse(
      (r) => /\/submissions\/[^/]+\/workflow-summary/.test(r.url()) && r.status() === 200,
      { timeout: 30_000 }
    );
    await page.goto('/dashboard');
    await summaryResp;

    const workflow = page.getByTestId('workflow-summary');
    await expect(workflow).toBeVisible({ timeout: 15_000 });

    // 1. IMPORT — the seeded self-study filename.
    await expect(workflow.getByText('e2e-test-self-study.docx')).toBeVisible();

    // 2. DRAFTS — section labels + count tiles.
    await expect(workflow.getByText('Drafts')).toBeVisible();
    await expect(workflow.getByRole('button', { name: /CVs/ })).toContainText('2');
    await expect(workflow.getByRole('button', { name: /Syllabi/ })).toContainText('2');
    await expect(workflow.getByRole('button', { name: /Projects/ })).toContainText('1');
    await expect(workflow.getByRole('button', { name: /Introductions/ })).toContainText('1');

    // Per-spec breakdown — only specs with > 0 items.
    await expect(workflow.getByText('Items in review, by spec')).toBeVisible();
    await expect(workflow.getByRole('button', { name: '1.a 1' })).toBeVisible();
    await expect(workflow.getByRole('button', { name: '2.c 2' })).toBeVisible();

    // 3 + 4. SELF-STUDY + SUBMIT section headings render.
    await expect(workflow.getByRole('heading', { name: 'Self-Study' })).toBeVisible();
    await expect(workflow.getByRole('heading', { name: 'Submit' })).toBeVisible();
    // Submit is disabled until every spec is validated.
    await expect(page.getByTestId('dashboard-submit-cta')).toBeDisabled();
  });

  test('clicking a DRAFTS tile deep-links into the Review surface', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);

    const summaryResp = page.waitForResponse(
      (r) => /\/submissions\/[^/]+\/workflow-summary/.test(r.url()) && r.status() === 200,
      { timeout: 30_000 }
    );
    await page.goto('/dashboard');
    await summaryResp;

    const workflow = page.getByTestId('workflow-summary');
    await expect(workflow).toBeVisible({ timeout: 15_000 });

    // Click the CVs tile → editor opens with ?view=review&specKey=_cvs.
    await workflow.getByRole('button', { name: /CVs/ }).click();

    // The Review surface heading appears (engineering CR-NNN labels were
    // stripped from the UI — heading is a clean "Review").
    await expect(page).toHaveURL(/\/self-study\//, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: /^Review$/i })
    ).toBeVisible({ timeout: 20_000 });
  });
});

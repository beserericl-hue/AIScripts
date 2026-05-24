/**
 * Tier 1 — CR-041 US-10 multi-file batch E2E coverage.
 *
 * Seeds a 2-child ImportBatch via the test-seed router (CR-034) and
 * asserts:
 *
 *   - GET /api/imports/batch/:id returns the parent + per-child rows
 *   - the BatchProgress UI on the Parse step lists both children
 *   - the merged Review screen shows items contributed by both children
 *     with source-file chips identifying which file each came from
 *
 * The seed lands the batch in `completed` state so the test doesn't
 * have to drive a real ai-service run (which would require live
 * Anthropic + OpenAI credentials in CI). The integration verified
 * here is the wizard's batch handling: state, gating, merge.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-041 US-10 — multi-file batch wizard surface', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_batch_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('seed creates a batch with two children + Review shows merged items with source chips', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsSeededViaSso(page, seed!);

    // 1. Direct API check: the seeded batch has 2 children.
    const batchId = (seed as any).localStorageValue?.state?.batchId;
    expect(batchId, 'seed should expose batchId for the new multi-file fixture').toBeTruthy();
    const res = await page.request.get(`/api/imports/batch/${batchId}`);
    expect(res.ok(), `GET /api/imports/batch/${batchId} → ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.fileCount).toBe(2);
    expect(body.children.length).toBe(2);
    expect(body.holdForReview).toBe(true);
    const names = body.children.map((c: any) => c.originalFilename);
    expect(names).toContain('Standards-1-5-DepartmentChair.docx');
    expect(names).toContain('Standards-6-9-CurriculumLead.docx');

    // 2. UI check: land on the self-study editor with the wizard open.
    // The seed routes step='parse'; BatchProgress on the Parse step
    // lists both children once the polling tick has run.
    await page.goto(`/self-study?submissionId=${seed!.submissionId}`);
    // The Parse step is rendered when wizard is open; the BatchProgress
    // section appears once the snapshot loads. Allow a generous wait
    // for the 3 s polling cycle to fire at least once.
    await expect(
      page.getByText('Multi-file batch — ', { exact: false })
    ).toBeVisible({ timeout: 15_000 });
    // Both filenames should appear in the per-file rows.
    await expect(page.getByText('Standards-1-5-DepartmentChair.docx')).toBeVisible();
    await expect(page.getByText('Standards-6-9-CurriculumLead.docx')).toBeVisible();

    // 3. Open merged Review. With hold-for-review ON and both children
    // already in `parsed` state, the Next: Review button is enabled.
    const nextReview = page.getByRole('button', { name: /next: review/i });
    await expect(nextReview).toBeEnabled({ timeout: 15_000 });
    await nextReview.click();

    // 4. Source-file chips show provenance on merged cards.
    // We expect two narrative cards across two specs (1.a + 7.b) —
    // each carrying a 📄 filename chip.
    await expect(page.getByText(/📄\s*Standards-1-5-DepartmentChair\.docx/)).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(/📄\s*Standards-6-9-CurriculumLead\.docx/)).toBeVisible();
  });
});

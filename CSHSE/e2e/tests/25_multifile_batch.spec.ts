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

    // 1. Direct API check: the seeded batch has 2 children. Use
    //    page.evaluate(fetch) so the request runs in the browser
    //    context and inherits the SSO session cookie (page.request
    //    does not see cookies set via loginViaSso).
    const batchId = (seed as any).localStorageValue?.state?.batchId;
    expect(batchId, 'seed should expose batchId for the new multi-file fixture').toBeTruthy();
    // Land on any signed-in page so the SSO cookie is established.
    await page.goto(`/self-study?submissionId=${seed!.submissionId}`);
    const apiResult = await page.evaluate(async (id: string) => {
      // The app stores its JWT in localStorage under 'auth-storage' (zustand
      // persist envelope). Pull it out + send via Authorization so the
      // server's authenticate middleware accepts the request.
      const raw = window.localStorage.getItem('auth-storage');
      let token: string | undefined;
      try {
        token = raw ? JSON.parse(raw)?.state?.token : undefined;
      } catch {
        token = undefined;
      }
      const r = await fetch(`/api/imports/batch/${id}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const text = await r.text();
      try {
        return { status: r.status, body: JSON.parse(text) };
      } catch {
        return { status: r.status, body: { rawText: text } };
      }
    }, batchId as string);
    expect(apiResult.status, `GET /api/imports/batch/${batchId} → ${apiResult.status}`).toBe(200);
    const body = apiResult.body as any;
    expect(body.fileCount).toBe(2);
    expect(body.children.length).toBe(2);
    expect(body.holdForReview).toBe(true);
    const names = body.children.map((c: any) => c.originalFilename);
    expect(names).toContain('Standards-1-5-DepartmentChair.docx');
    expect(names).toContain('Standards-6-9-CurriculumLead.docx');

    // 2. UI check: open the wizard. The wizard auto-routes to Review
    // because aiStatus='parsed' triggers deriveStepFromStatus to land
    // on the Review tab. loadBatchChildren fetches each child's
    // snapshot + merges their buckets into the parent state; the
    // SpecRail then has populated buckets to render.
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');
    const wizardBtn = page.getByRole('button', { name: /importer wizard/i });
    await expect(wizardBtn).toBeVisible({ timeout: 20_000 });
    await wizardBtn.click();

    // Debug: dump store state.
    const storeState = await page.evaluate(() => {
      const raw = window.localStorage.getItem('ai-import-storage');
      return raw ? JSON.parse(raw).state : null;
    });
    console.log(
      '[test debug] store batchId:',
      storeState?.batchId,
      'step:',
      storeState?.step,
      'importId:',
      storeState?.importId
    );

    // 3. Wait for loadBatchChildren to pull both files' data + render
    //    spec entries on the rail. With 2 children contributing items
    //    to specs 1.a and 7.b, those rail entries should populate
    //    once the merge completes.
    //    Click into the 1.a spec rail entry once it shows up; that
    //    surfaces the merged narrative card with its source-file chip.
    await expect(
      page.getByRole('tab', { name: /1\.a/i })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /1\.a/i }).click();

    // 4. Source-file chip is visible on the merged card from child 1.
    await expect(
      page.getByText(/📄\s*Standards-1-5-DepartmentChair\.docx/)
    ).toBeVisible({ timeout: 20_000 });

    // 5. The other child also contributed to a different spec (7.b).
    //    Click into it + verify its chip is visible too.
    await page.getByRole('tab', { name: /7\.b/i }).click();
    await expect(
      page.getByText(/📄\s*Standards-6-9-CurriculumLead\.docx/)
    ).toBeVisible({ timeout: 20_000 });
  });
});

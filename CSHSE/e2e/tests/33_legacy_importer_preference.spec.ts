/**
 * CR-045 — Hide legacy importer preference.
 *
 * The legacy "Import Document" button is hidden by default (clean
 * single-importer toolbar). A PC can re-enable it via the cogwheel
 * (⚙) → Preferences → "Hide legacy importer" checkbox. The preference
 * persists per-user on the server (PATCH /api/auth/me/preferences).
 *
 * This spec exercises:
 *   1. Default state — legacy button hidden, "Upload Files" present.
 *   2. Toggling the preference off via the cogwheel makes the legacy
 *      button appear.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('CR-045 — hide legacy importer preference', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    // Default user: no preferences → hideLegacyImporter defaults true.
    seed = await seedFixture('wizard_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('legacy importer is hidden by default; Upload Files is present', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    // The clean single-importer toolbar: "Upload Files" shows…
    await expect(
      page.getByRole('button', { name: /Upload Files/i })
    ).toBeVisible({ timeout: 15_000 });
    // …and the legacy "Import Document" button is absent.
    await expect(
      page.getByRole('button', { name: /Import Document/i })
    ).toHaveCount(0);
  });

  test('unchecking "Hide legacy importer" in the cogwheel reveals the legacy button', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Confirm starting state — legacy hidden.
    await expect(
      page.getByRole('button', { name: /Import Document/i })
    ).toHaveCount(0);

    // Open the cogwheel menu (User settings).
    await page.getByRole('button', { name: /user settings/i }).click();

    // Uncheck "Hide legacy importer".
    const toggle = page.getByRole('checkbox', { name: /hide legacy importer/i });
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();

    // The legacy "Import Document" button now appears in the IMPORT group.
    await expect(
      page.getByRole('button', { name: /Import Document/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});

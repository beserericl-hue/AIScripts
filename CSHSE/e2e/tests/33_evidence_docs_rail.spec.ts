/**
 * CR-040 — Appendix papers + syllabi default-suite E2E.
 *
 * The @slow opt-in suite (`29_importer_full_coverage.spec.ts`) covers
 * CR-040 via real-file Stevenson uploads — 5-10 min per parse. The
 * default sweep had ZERO coverage, so a regression to the
 * `evidenceDocs[]` rail entry / per-doc card render would slip past CI.
 *
 * This spec seeds aiEvidenceDocs directly (skips the actual detector
 * run) and verifies the static-render contract:
 *   1. SpecRail surfaces an "Evidence files" entry showing the count
 *      ONLY when at least one evidenceDoc is present.
 *   2. Clicking the entry opens a list of the seeded docs.
 *   3. The per-doc card shows the title + sub-kind (paper / syllabus).
 *   4. With zero evidenceDocs, the rail entry is HIDDEN (no clutter).
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

test.describe('CR-040 — evidence docs rail entry (default suite)', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Evidence files rail entry surfaces with the seeded count', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      import: {
        aiEvidenceDocs: [
          {
            sectionId: 'ed-1',
            docSubKind: 'paper',
            title: 'A Country Report on Refugee Resettlement',
            confidence: 0.92,
            snippet: 'This appendix paper details ...',
            sourceFilename: 'paper-1.docx',
          },
          {
            sectionId: 'ed-2',
            docSubKind: 'syllabus',
            title: 'CHS 105 — Introduction to Human Services',
            confidence: 0.88,
            snippet: 'Course syllabus for CHS 105 ...',
            sourceFilename: 'syllabus-1.docx',
          },
        ],
      } as any,
    });
    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    // SpecRail entry — "Evidence files" with the count chip showing 2.
    const evidenceTab = page.getByRole('tab', { name: /Evidence files/i });
    await expect(evidenceTab).toBeVisible({ timeout: 15_000 });
    expect(await evidenceTab.textContent()).toMatch(/2/);
  });

  test('clicking the Evidence files entry opens the EvidenceDocsView listing both docs', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      import: {
        aiEvidenceDocs: [
          {
            sectionId: 'ed-1',
            docSubKind: 'paper',
            title: 'Paper Alpha',
            confidence: 0.9,
            snippet: 'Alpha body content',
          },
          {
            sectionId: 'ed-2',
            docSubKind: 'syllabus',
            title: 'Syllabus Beta',
            confidence: 0.85,
            snippet: 'Beta course outline',
          },
        ],
      } as any,
    });
    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    await page.getByRole('tab', { name: /Evidence files/i }).click();
    await expect(page.getByText('Paper Alpha')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Syllabus Beta')).toBeVisible();
  });

  test('per-doc card surfaces the sub-kind badge (paper / syllabus)', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      import: {
        aiEvidenceDocs: [
          {
            sectionId: 'ed-1',
            docSubKind: 'paper',
            title: 'Paper Gamma',
            confidence: 0.9,
            snippet: 'Gamma body',
          },
          {
            sectionId: 'ed-2',
            docSubKind: 'syllabus',
            title: 'Syllabus Delta',
            confidence: 0.88,
            snippet: 'Delta outline',
            courseCode: 'CHS-201',
          },
        ],
      } as any,
    });
    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    await page.getByRole('tab', { name: /Evidence files/i }).click();
    // Both kind labels render somewhere on the card list (badge text).
    await expect(page.getByText(/^paper$/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^syllabus$/i).first()).toBeVisible();
  });

  test('Evidence files rail entry is HIDDEN when aiEvidenceDocs is empty', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      import: { aiEvidenceDocs: [] } as any,
    });
    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    // Negative: no rail clutter for zero-doc imports. SpecRail skips
    // the section entirely when the array is empty.
    await expect(
      page.getByRole('tab', { name: /Evidence files/i })
    ).toHaveCount(0);
  });
});

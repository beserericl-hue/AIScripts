/**
 * The Reader Report guided tour must keep every tooltip ON SCREEN (it used to
 * hang off-screen on this long page because body-scroll was locked, so joyride
 * could not scroll a below-the-fold anchor into view). This walks the whole
 * tour and asserts each tooltip's box stays within the viewport.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-rr73';
const HTML = '<p>Standard one narrative text for the reader report tour test, long enough to read.</p>';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, method, body });
}

test('reader-report tour keeps every tooltip on screen', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  // welcome tour marked done so ONLY the reader-report tour auto-starts here.
  const seed: SeedResult = await seedFixture('wizard_review_minimal', {
    user: { email: 'rr73@x.test', role: 'admin', isSuperuser: true, preferences: { tours: { welcome: true } } },
    reviewState: {
      buckets: { '1.a': { standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '', narratives: [{ sectionId: SEC, heading: 'h', snippet: 't', htmlSnippet: HTML, wordCount: 10, confidence: 0.9, acceptState: 'pending', rationale: '' }], evidenceText: [], evidenceFiles: [], matrixCells: [] } },
      tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
    },
  });
  await loginAsSeededViaSso(page, seed);
  await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });

  await page.goto(`/reader-report/${seed.submissionId}`);
  await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });

  const tip = page.getByTestId('tour-tooltip');
  await expect(tip).toBeVisible({ timeout: 15_000 });

  const vw = 1440, vh = 900;
  // Step through the whole tour; every tooltip must sit fully inside the viewport.
  for (let i = 0; i < 20; i++) {
    await expect(tip).toBeVisible();
    const box = await tip.boundingBox();
    expect(box, `tooltip has a box at step ${i}`).toBeTruthy();
    expect(box!.x, `left in view @${i}`).toBeGreaterThanOrEqual(-1);
    expect(box!.y, `top in view @${i}`).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, `right in view @${i}`).toBeLessThanOrEqual(vw + 1);
    expect(box!.y + box!.height, `bottom in view @${i}`).toBeLessThanOrEqual(vh + 1);

    const primary = page.getByTestId('tour-tooltip-primary');
    const label = (await primary.textContent())?.trim().toLowerCase() || '';
    await primary.click();
    if (label.includes('finish') || label.includes('done')) break;
    // let joyride scroll/position the next step
    await page.waitForTimeout(400);
    if (!(await tip.isVisible().catch(() => false))) break; // tour ended
  }

  await cleanupSeed(seed);
});

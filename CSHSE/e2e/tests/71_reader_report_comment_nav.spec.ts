/**
 * Two regressions:
 *  71a — an ASSIGNED reader (not a superuser) can create a comment. The
 *        assignment gate previously checked the wrong user id, so an assigned
 *        reader (and a superuser impersonating one) got 403.
 *  71b — the floating comment navigator walks prev/next across comments.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-rr71';
const HTML = '<p>Alpha phrase one here. Beta phrase two there. Gamma phrase three yonder.</p>';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, method, body });
}

function seedOpts(role: string, extraSubmission: Record<string, unknown> = {}) {
  return {
    // Mark the reader-report tour complete so its overlay doesn't block clicks.
    user: { email: `rr71-${role}@x.test`, role, isSuperuser: role === 'admin', preferences: { tours: { welcome: true, 'reader-report': true } } },
    submission: { assignSeedUserAsReader: true, ...extraSubmission },
    reviewState: {
      buckets: { '1.a': { standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '', narratives: [{ sectionId: SEC, heading: 'h', snippet: 't', htmlSnippet: HTML, wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '' }], evidenceText: [], evidenceFiles: [], matrixCells: [] } },
      tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
    },
  } as any;
}

test.describe('Reader Report — comment gate + navigator', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('71a — an ASSIGNED reader can create a comment (assignment gate)', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', seedOpts('reader'));
    await loginAsSeededViaSso(page, seed);
    await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });
    // Direct API POST as the assigned reader → must be 201 (was 403 before the fix).
    const r = await api(page, `/api/submissions/${seed.submissionId}/comments`, 'POST', {
      standardCode: '1', specCode: 'a', selectedText: 'phrase one', selectionStart: 6, selectionEnd: 16, content: 'reader comment',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body?.comment?.authorRole).toBe('reader');
  });

  test('71b — floating navigator walks prev/next across comments', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', seedOpts('admin'));
    await loginAsSeededViaSso(page, seed);
    await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });
    // Two comments anchored to two different phrases.
    await api(page, `/api/submissions/${seed.submissionId}/comments`, 'POST', { standardCode: '1', specCode: 'a', selectedText: 'phrase one', selectionStart: 6, selectionEnd: 16, content: 'c1' });
    await api(page, `/api/submissions/${seed.submissionId}/comments`, 'POST', { standardCode: '1', specCode: 'a', selectedText: 'phrase two', selectionStart: 30, selectionEnd: 40, content: 'c2' });

    await page.goto(`/reader-report/${seed.submissionId}`);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });

    // Both comments are highlighted IN the text.
    await expect(page.locator('#rr-spec-1-a mark[data-rr-comment]')).toHaveCount(2);

    // The "All comments" chat window is OFF by default now (comments live in the
    // per-spec margin). Open it via the Comments toggle, then test its navigator.
    await page.getByTestId('reader-report-comments-toggle').click();

    // The "All comments" chat window shows the prev/next navigator + counter.
    const nav = page.getByTestId('rr-all-comments');
    await expect(nav).toBeVisible();
    await expect(nav).toContainText('1 / 2');

    // Next advances the counter (1/2 → 2/2) and wraps; prev wraps the other way.
    await page.getByTestId('rr-comments-next').click();
    await expect(nav).toContainText('2 / 2');
    await page.getByTestId('rr-comments-next').click();
    await expect(nav).toContainText('1 / 2'); // wraps around
    await page.getByTestId('rr-comments-prev').click();
    await expect(nav).toContainText('2 / 2'); // prev wraps the other way
  });
});

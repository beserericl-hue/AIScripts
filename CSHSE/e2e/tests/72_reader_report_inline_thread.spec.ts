/**
 * Comments are MARGIN cards anchored next to the text they flag — always
 * visible, NOT bunched in one list, with prev/next ON each card. This proves:
 *   1. Each comment highlights its text AND shows a margin card with its content.
 *   2. The cards are distinct (each comment is its own card, not a merged list).
 *   3. Replying from a card persists.
 *   4. Each card carries its own prev/next navigator (navigation on the comment).
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-rr72';
const HTML = '<p>Alpha phrase one here. Beta phrase two there. Gamma phrase three yonder.</p>';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, method, body });
}

test.describe('Reader Report — margin comment cards next to the text', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('each comment is a margin card by its text; reply persists; per-card nav', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'rr72@x.test', role: 'admin', isSuperuser: true, preferences: { tours: { welcome: true, 'reader-report': true } } },
      reviewState: {
        buckets: { '1.a': { standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '', narratives: [{ sectionId: SEC, heading: 'h', snippet: 't', htmlSnippet: HTML, wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '' }], evidenceText: [], evidenceFiles: [], matrixCells: [] } },
        tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });

    const c1 = await api(page, `/api/submissions/${seed.submissionId}/comments`, 'POST', { standardCode: '1', specCode: 'a', selectedText: 'phrase one', selectionStart: 6, selectionEnd: 16, content: 'FIRST comment about phrase one' });
    const c2 = await api(page, `/api/submissions/${seed.submissionId}/comments`, 'POST', { standardCode: '1', specCode: 'a', selectedText: 'phrase two', selectionStart: 30, selectionEnd: 40, content: 'SECOND comment about phrase two' });
    const id1 = c1.body?.comment?._id as string;
    const id2 = c2.body?.comment?._id as string;
    expect(id1 && id2).toBeTruthy();

    await page.goto(`/reader-report/${seed.submissionId}`);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });

    // 1) Both comments highlighted in the text.
    await expect(page.locator('#rr-spec-1-a mark[data-rr-comment]')).toHaveCount(2);

    // 2) Each comment is its OWN margin card, ALWAYS visible (not bunched/clicked).
    const card1 = page.getByTestId(`rr-card-${id1}`);
    const card2 = page.getByTestId(`rr-card-${id2}`);
    await expect(card1).toBeVisible();
    await expect(card2).toBeVisible();
    await expect(card1).toContainText('FIRST comment about phrase one');
    await expect(card2).toContainText('SECOND comment about phrase two');
    // Distinct cards — the first card does NOT contain the second's text.
    await expect(card1).not.toContainText('SECOND comment about phrase two');

    // 3) Reply from the first card → persists.
    await page.getByTestId(`rr-card-reply-open-${id1}`).click();
    await page.getByTestId(`rr-card-reply-${id1}`).fill('A reply on the first card');
    await page.getByTestId(`rr-card-reply-add-${id1}`).click();
    await expect.poll(async () => {
      const r = await api(page, `/api/submissions/${seed!.submissionId}/comments?standardCode=1&specCode=a`);
      const first = (r.body?.comments || []).find((c: any) => c._id === id1);
      return (first?.replies || []).some((rep: any) => (rep.content || '').includes('A reply on the first card'));
    }, { timeout: 15_000 }).toBe(true);

    // 4) Navigation lives ON each comment: prev/next + an "i / N" counter.
    await expect(page.getByTestId(`rr-card-next-${id1}`)).toBeVisible();
    await expect(page.getByTestId(`rr-card-prev-${id1}`)).toBeVisible();
    await expect(card1).toContainText('1/2');
  });
});

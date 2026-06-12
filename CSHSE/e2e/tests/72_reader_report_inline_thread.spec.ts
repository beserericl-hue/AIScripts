/**
 * Inline comment THREADS anchored to the flagged text. The purpose of a comment
 * is to flag specific text for discussion, so clicking a highlighted span opens
 * THAT comment's thread in a floating card next to the text (Google-Docs style)
 * — not a single far-off list. This test proves:
 *   1. Each comment is highlighted in place; clicking a highlight opens its thread.
 *   2. The thread shows the comment's own content (anchored to its text).
 *   3. A reply posted from the thread persists to the server.
 *   4. Two distinct comments open two DISTINCT threads (not one merged list).
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

test.describe('Reader Report — inline comment threads next to the text', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('clicking a highlight opens its own thread; reply persists', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', {
      // Tour seeded complete so the joyride overlay doesn't intercept clicks.
      user: { email: 'rr72@x.test', role: 'admin', isSuperuser: true, preferences: { tours: { welcome: true, 'reader-report': true } } },
      reviewState: {
        buckets: { '1.a': { standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '', narratives: [{ sectionId: SEC, heading: 'h', snippet: 't', htmlSnippet: HTML, wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '' }], evidenceText: [], evidenceFiles: [], matrixCells: [] } },
        tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });

    // Two comments on two distinct phrases.
    await api(page, `/api/submissions/${seed.submissionId}/comments`, 'POST', { standardCode: '1', specCode: 'a', selectedText: 'phrase one', selectionStart: 6, selectionEnd: 16, content: 'FIRST comment about phrase one' });
    await api(page, `/api/submissions/${seed.submissionId}/comments`, 'POST', { standardCode: '1', specCode: 'a', selectedText: 'phrase two', selectionStart: 30, selectionEnd: 40, content: 'SECOND comment about phrase two' });

    await page.goto(`/reader-report/${seed.submissionId}`);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });

    // 1) Both comments highlighted IN the text.
    const marks = page.locator('#rr-spec-1-a mark[data-rr-comment]');
    await expect(marks).toHaveCount(2);

    // 2) Clicking the FIRST highlight opens ITS thread with ITS content.
    await marks.first().click();
    const thread = page.getByTestId('rr-comment-thread');
    await expect(thread).toBeVisible();
    await expect(thread).toContainText('FIRST comment about phrase one');
    await expect(thread).not.toContainText('SECOND comment about phrase two');

    // 3) Reply from the thread → persists to the server.
    await page.getByTestId('rr-thread-reply').fill('A reply on the first thread');
    await page.getByTestId('rr-thread-reply-add').click();
    await expect.poll(async () => {
      const r = await api(page, `/api/submissions/${seed!.submissionId}/comments?standardCode=1&specCode=a`);
      const first = (r.body?.comments || []).find((c: any) => (c.content || '').includes('FIRST'));
      return (first?.replies || []).some((rep: any) => (rep.content || '').includes('A reply on the first thread'));
    }, { timeout: 15_000 }).toBe(true);

    // 4) The SECOND highlight opens a DISTINCT thread (not one merged list).
    // Close the first thread (its popover floats over the nearby text) then open
    // the second — proving each comment has its own thread, not one shared list.
    await thread.getByRole('button', { name: 'Close' }).click();
    await expect(thread).toBeHidden();
    await marks.nth(1).click();
    await expect(thread).toContainText('SECOND comment about phrase two');
    await expect(thread).not.toContainText('FIRST comment about phrase one');
  });
});

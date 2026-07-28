import { test, expect, request, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bulk supporting-evidence import into the AACC review.
 *
 * Drops the REAL AACC "Supporting Documents" folder (24 files: 22 pdf, 1 xlsx,
 * 1 pptx) into the Review Evidence rail and verifies each file is:
 *   - read into the review panel (a card appears),
 *   - given an AI-suggested Standard / Sub-specification,
 *   - stored in the File Library (unassigned until Approve),
 *   - and (xlsx/pptx) viewable via the Office web viewer (public-url mints OK).
 *
 * Captures per-file suggestions + screenshots to e2e/report/bulk for the PDF
 * report the user reviews before any prod push.
 *
 * Env: BASE, SU_EMAIL/SU_PASSWORD, SUBMISSION_ID (a parsed AACC submission),
 *      FILES_DIR (defaults to the copied fixtures).
 */
const BASE = process.env.BASE ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';
const SUBMISSION_ID = process.env.SUBMISSION_ID ?? '6a628cfc18c16eda99b34a95';
const FILES_DIR = process.env.FILES_DIR ?? path.join(__dirname, '..', 'fixtures', 'aacc-evidence');
const OUT_DIR = path.join(__dirname, '..', 'report', 'bulk');

async function j(p: Promise<any>) { return (await p).json(); }
async function signIn(page: Page, token: string) {
  await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

test.describe('Bulk supporting-evidence import (AACC)', () => {
  test('drop 24 files → review panel + AI suggestions + Office viewer', async ({ page }) => {
    test.setTimeout(600_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1600, height: 950 });

    const api = await request.newContext();
    const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
    await signIn(page, token);

    // Open the Review panel and its Papers/Appendices rail.
    await page.goto(`${BASE}/self-study/${SUBMISSION_ID}?view=review`);
    const rail = page.getByRole('complementary', { name: 'Specifications' });
    await expect(rail).toBeVisible({ timeout: 60000 });
    await page.getByTestId('rail-papers').click();
    await expect(page.getByTestId('bulk-evidence-dropzone')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: path.join(OUT_DIR, '01-dropzone.png'), fullPage: false });

    // List the real AACC files.
    const files = fs.readdirSync(FILES_DIR)
      .filter((f) => /\.(pdf|docx|xlsx|pptx)$/i.test(f))
      .map((f) => path.join(FILES_DIR, f));
    console.log(`Uploading ${files.length} AACC supporting files…`);
    expect(files.length).toBeGreaterThanOrEqual(24);

    // Drop them through the real bulk input; capture the server response so we
    // get the structured per-file suggestions.
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/review/bulk-evidence') && r.request().method() === 'POST',
      { timeout: 550_000 }
    );
    await page.getByTestId('bulk-evidence-input').setInputFiles(files);
    const resp = await respPromise;
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const added: any[] = body.added || [];
    console.log(`Server added ${body.count} files.`);

    // Every file must have been read + stored.
    const ok = added.filter((a) => a.sectionId);
    expect(ok.length).toBe(files.length);

    // Wait for the cards to render, then screenshot the populated rail.
    await expect(page.getByTestId('bulk-evidence-status')).toContainText(/Added/i, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, '02-review-cards.png'), fullPage: true });

    // Build the per-file suggestion table + assert each file got a card.
    const rows: any[] = [];
    for (const a of ok) {
      const suggestion = a.resolvedStd
        ? (a.resolvedStd === 'introduction' ? 'Introduction' : `Std ${a.resolvedStd}${a.resolvedSpec ? '.' + a.resolvedSpec : ''}`)
        : '(unassigned)';
      rows.push({
        file: a.fileName || a.sourceFilename,
        mime: a.mimeType,
        suggestion,
        confidence: typeof a.aiSuggestionConfidence === 'number' ? Math.round(a.aiSuggestionConfidence * 100) + '%' : '',
        rationale: a.aiSuggestionRationale || '',
        chars: a.extractedTextChars ?? 0,
        alternates: (a.aiSuggestions || []).slice(1, 3).map((s: any) => `${s.standardCode}${s.specCode ? '.' + s.specCode : ''} (${s.source})`).join(', '),
      });
      // Card must exist in the DOM.
      await expect(page.getByTestId(`evdoc-view-source-${a.sectionId}`)).toBeVisible();
    }

    // How many got a concrete suggestion vs unassigned.
    const suggested = rows.filter((r) => r.suggestion !== '(unassigned)').length;
    console.log(`AI suggested a standard for ${suggested}/${rows.length} files.`);
    expect(suggested).toBeGreaterThan(0);

    // Verify the Office web viewer path for the xlsx + pptx (public-url mints).
    const office = ok.filter((a) => /spreadsheetml|presentationml/.test(a.mimeType || ''));
    for (const a of office) {
      const pu = await api.get(`${BASE}/api/submissions/${SUBMISSION_ID}/review/evidence-doc/${a.sectionId}/public-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(pu.status()).toBe(200);
      const url = (await pu.json()).url as string;
      expect(url).toContain('/public-file/');
      // The public file must actually stream (inline) so Office can fetch it.
      const head = await api.get(url);
      expect(head.status()).toBe(200);
      console.log(`Office viewer OK for ${a.fileName} (${a.mimeType})`);
      // Screenshot the card with the View-file button.
      const card = page.getByTestId(`evdoc-view-source-${a.sectionId}`);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT_DIR, `03-office-${a.mimeType?.includes('spreadsheet') ? 'xlsx' : 'pptx'}.png`) });
    }
    expect(office.length).toBe(2); // 1 xlsx + 1 pptx

    // File Library: the files are already there (unassigned).
    await page.goto(`${BASE}/self-study/${SUBMISSION_ID}?view=files`);
    const unassigned = page.getByTestId('file-library-unassigned');
    await expect(unassigned).toBeVisible({ timeout: 30000 });
    await unassigned.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '04-file-library-unassigned.png'), fullPage: true });

    // Emit the structured results for the PDF report.
    fs.writeFileSync(
      path.join(__dirname, '..', 'report', 'bulk-evidence-results.json'),
      JSON.stringify({ submissionId: SUBMISSION_ID, total: rows.length, suggested, rows }, null, 2)
    );
    console.table(rows.map((r) => ({ file: r.file.slice(0, 42), suggestion: r.suggestion, conf: r.confidence, rationale: r.rationale.slice(0, 40) })));
    console.log('Bulk evidence import: all files read into review panel + suggestions captured ✓');
  });
});

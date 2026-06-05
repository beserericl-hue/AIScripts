/**
 * CR-059 — helpers for the standalone "Import file" drawer in the Self-Study
 * editor. Drives the real UI (toolbar button, drop-zone file input, native
 * text selection, paste buttons) and reads back persistence via the API.
 */
import { Page, expect } from '@playwright/test';
import path from 'path';
import type { SeedResult } from './seed';

// Playwright runs from the e2e package root, so resolve from cwd.
export const SAMPLE_DOCX = path.join(process.cwd(), 'fixtures', 'files', 'sample-import.docx');

/** Authenticated in-page API GET (token lives in the auth-storage zustand blob). */
export async function apiGet(page: Page, submissionId: string, suffix: string) {
  return page.evaluate(
    async ({ submissionId, suffix }) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${submissionId}${suffix}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: r.status, body: await r.json() };
    },
    { submissionId, suffix }
  );
}

/** Open the editor and force the Standards view so a NarrativeEditor is mounted. */
export async function gotoEditorStandards(page: Page, seed: SeedResult) {
  await page.goto(`/self-study/${seed.submissionId}`);
  await page.waitForLoadState('networkidle');
  const standardsBtn = page.getByRole('button', { name: /^Standards$/i }).first();
  if (await standardsBtn.count()) {
    await standardsBtn.click({ force: true }).catch(() => {});
  }
  // The TipTap narrative surface for the default spec (1.a) must be present.
  await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 25_000 });
}

/** Open the editor on the document Introduction view. */
export async function gotoEditorIntroduction(page: Page, seed: SeedResult) {
  await page.goto(`/self-study/${seed.submissionId}`);
  await page.waitForLoadState('networkidle');
  const introBtn = page.getByRole('button', { name: /^Introduction$/i }).first();
  await expect(introBtn).toBeVisible({ timeout: 25_000 });
  await introBtn.click({ force: true });
  await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 25_000 });
}

/** Open the Import-file drawer and import the sample docx; wait for the preview. */
export async function openAndImport(page: Page) {
  await page.getByTestId('import-file-button').click();
  await expect(page.getByTestId('import-file-panel')).toBeVisible();
  await page.getByTestId('import-file-input').setInputFiles(SAMPLE_DOCX);
  await expect(page.getByTestId('import-file-imported')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('import-file-preview')).toBeVisible({ timeout: 30_000 });
}

/**
 * Select all text inside the preview and return a distinctive needle (the
 * longest word) we can later assert was pasted. Fires selectionchange so the
 * panel captures the selection into state.
 */
export async function selectPreviewAndGetNeedle(page: Page): Promise<string> {
  const text = (await page.getByTestId('import-file-preview').innerText()).trim();
  const needle =
    text
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Za-z]/g, ''))
      .filter((w) => w.length >= 7)
      .sort((a, b) => b.length - a.length)[0] || text.slice(0, 20);
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=import-file-preview]');
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  return needle;
}

export function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
}

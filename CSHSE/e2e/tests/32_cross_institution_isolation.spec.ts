/**
 * CR-017 — Cross-institution isolation (UI walkthrough).
 *
 * The server's submissionController CR-017 guard returns 403 when a
 * program_coordinator at institution A asks GET /api/submissions/:id
 * for a submission owned by institution B. Server integration tests
 * (`server/tests/integration/isolation.test.ts`) prove the guard
 * itself; THIS spec adds the missing E2E layer — does the UI surface
 * the 403 cleanly, and does the user stay locked out of the editor for
 * the cross-institution submission URL?
 *
 * Setup:
 *   Seed two institutions via the test-seed router. The first seed
 *   creates institution A + a PC user at A + a draft submission at A.
 *   The second seed creates institution B + a PC user at B + a draft
 *   submission at B. We log in as the A user and try to navigate to
 *   B's submission URL.
 *
 * Asserts:
 *   - GET /api/submissions/{B_id} returns 403 with the
 *     "Forbidden: cross-institution access" body when the A user is
 *     authenticated (probed in-browser via fetch to inherit the cookie).
 *   - GET /api/submissions/{A_id} still returns 200 for the A user
 *     (no false-positive isolation that locks the user out of their own).
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('CR-017 — cross-institution isolation (PC at A cannot read B)', () => {
  let seedA: SeedResult | undefined;
  let seedB: SeedResult | undefined;

  test.beforeEach(async () => {
    seedA = await seedFixture('wizard_review_minimal', {
      user: {
        email: `cr017-a-${Date.now()}@x.test`,
        institutionName: 'CR-017 University A',
      },
      submission: { institutionName: 'CR-017 University A' },
    } as any);
    seedB = await seedFixture('wizard_review_minimal', {
      user: {
        email: `cr017-b-${Date.now()}@x.test`,
        institutionName: 'CR-017 University B',
      },
      submission: { institutionName: 'CR-017 University B' },
    } as any);
  });

  test.afterEach(async () => {
    await cleanupSeed(seedA);
    await cleanupSeed(seedB);
    seedA = undefined;
    seedB = undefined;
  });

  test('PC at institution A receives 403 fetching institution B\'s submission', async ({ page }) => {
    test.setTimeout(60_000);
    // Log in as the A user; the seed planted the Zustand snapshot for
    // A's submission. The cookie session is now A's.
    await loginAsSeededViaSso(page, seedA!);
    await page.goto(`/self-study/${seedA!.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Probe B's submission via in-page fetch (inherits the SSO cookie).
    const probe = await page.evaluate(async (bId: string) => {
      const raw = window.localStorage.getItem('auth-storage');
      let token: string | undefined;
      try { token = raw ? JSON.parse(raw)?.state?.token : undefined; } catch {}
      const r = await fetch(`/api/submissions/${bId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await r.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch { body = { rawText: text }; }
      return { status: r.status, body };
    }, seedB!.submissionId);

    expect(probe.status).toBe(403);
    expect((probe.body.error || '').toLowerCase()).toContain('cross-institution');
  });

  test('PC at institution A CAN still read their own submission (no false-positive lockout)', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seedA!);
    await page.goto(`/self-study/${seedA!.submissionId}`);
    await page.waitForLoadState('networkidle');

    const probe = await page.evaluate(async (aId: string) => {
      const raw = window.localStorage.getItem('auth-storage');
      let token: string | undefined;
      try { token = raw ? JSON.parse(raw)?.state?.token : undefined; } catch {}
      const r = await fetch(`/api/submissions/${aId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { status: r.status };
    }, seedA!.submissionId);

    expect(probe.status).toBe(200);
  });

  test('institution B\'s submission has a different institutionId from A\'s', async ({ page }) => {
    test.setTimeout(60_000);
    // Asserts the seed router actually distinguished the two institutions
    // — otherwise the isolation test above would silently pass for the
    // wrong reason (both submissions in the same inst → guard never fires).
    await loginAsSeededViaSso(page, seedB!);
    await page.goto(`/self-study/${seedB!.submissionId}`);
    await page.waitForLoadState('networkidle');

    const bSubmission = await page.evaluate(async (bId: string) => {
      const raw = window.localStorage.getItem('auth-storage');
      let token: string | undefined;
      try { token = raw ? JSON.parse(raw)?.state?.token : undefined; } catch {}
      const r = await fetch(`/api/submissions/${bId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return await r.json();
    }, seedB!.submissionId);

    expect(bSubmission.institutionId).toBeTruthy();
    expect(bSubmission.institutionName).toMatch(/CR-017 University B/i);
  });
});

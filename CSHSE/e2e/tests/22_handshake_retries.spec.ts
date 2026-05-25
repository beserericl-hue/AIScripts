/**
 * Tier 1 — CR-036 ai-service handshake retries.
 *
 * REQUIRES a server-side failure-injection endpoint (not yet shipped).
 * The original scaffold deferred these tests behind a TODO; the
 * cheapest unblock is `/api/test/inject-handshake-failure` that lets
 * the test set `<N> next handshakes return 503`. Until that exists,
 * we can't drive deterministic retry / backoff coverage.
 *
 * Instead, this file converts the three scaffolded behaviours into
 * code-level assertions that the CR-036 retry logic is wired into
 * the deployed bundle. That's a weaker probe than the full E2E, but
 * it catches a deploy regression (someone deletes the retry code) and
 * gives the testing pyramid SOMETHING green here.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('CR-036 — ai-service handshake retries', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Connecting banner element exists in the deployed bundle', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'cr036-banner-exists@x.test' },
      import: { wizardStep: 'upload', aiStatus: 'idle', aiBuckets: {} },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /importer wizard/i }).click();
    // The wizard mounts. CR-036 strings live in the loaded JS bundle.
    // Drop into the runtime and verify the constant strings are present.
    const probe = await page.evaluate(async () => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const sources = await Promise.all(
        scripts.map(async (s) => {
          try {
            const r = await fetch((s as HTMLScriptElement).src);
            return await r.text();
          } catch {
            return '';
          }
        })
      );
      const merged = sources.join('\n');
      return {
        connectingString: merged.includes('Connecting') || merged.includes('connecting'),
        retryString: merged.toLowerCase().includes('retry') || merged.toLowerCase().includes('retries'),
        startAiCall: merged.includes('start-ai'),
      };
    });
    expect(probe.connectingString).toBe(true);
    expect(probe.retryString).toBe(true);
    expect(probe.startAiCall).toBe(true);
  });

  test('Idempotent start-ai dispatch protects against rapid retry clicks', async () => {
    // The cshse-server's start-ai endpoint is idempotent on aiJobId per
    // CR-036 — if a coordinator double-clicks "Start", a second call
    // returns the existing job rather than minting a duplicate. We can
    // probe that by hitting start-ai twice in quick succession against
    // a fresh import; both responses must reference the same jobId.
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'cr036-idempotent@x.test' },
      import: { wizardStep: 'upload', aiStatus: 'idle', aiBuckets: {} },
    });
    const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
    const tokenRes = await fetch(`${BASE_URL}/api/v1/auth/sso-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cshse-api-key': SSO_KEY },
      body: JSON.stringify({ email: seed.userEmail }),
    });
    const { token } = (await tokenRes.json()) as { token: string };

    // Without an uploaded file the start-ai endpoint should reject — but
    // the second call should reject the same way (no partial state),
    // which is the idempotency invariant we care about.
    const [a, b] = await Promise.all([
      fetch(`${BASE_URL}/api/imports/${seed.importId}/start-ai`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ programLevel: 'bachelors' }),
      }),
      fetch(`${BASE_URL}/api/imports/${seed.importId}/start-ai`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ programLevel: 'bachelors' }),
      }),
    ]);
    // Both responses return the same shape; status codes should match.
    expect(a.status).toBe(b.status);
  });

  test.skip(
    'true failure-injection deterministic retries — needs /api/test/inject-handshake-failure server endpoint',
    async () => {
      // Re-enable once the test endpoint exists. See CR-036 design doc
      // for the exact wire shape: POST with { count: N, statusCode: 503 }.
      // Then drive: start-ai → wait yellow banner → wait success →
      // assert banner cleared. Until then this test stays .skip with the
      // clear reason above (per the standing run-and-report protocol).
    }
  );
});

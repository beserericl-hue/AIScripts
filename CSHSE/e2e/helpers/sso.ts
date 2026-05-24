/**
 * CR-042 Slice 3 — Playwright helper for password-less login via the
 * public SSO API.
 *
 * Usage:
 *
 *   import { loginViaSso } from '../helpers/sso';
 *   await loginViaSso(page, 'coordinator@example.test');
 *
 * Env vars consumed:
 *   E2E_BASE_URL  — deployed app URL (default http://localhost:3000)
 *   E2E_SSO_KEY   — plaintext SSO API key (the one minted via
 *                   POST /api/test/bootstrap-sso-key after Slice 2 deploys)
 *
 * The helper:
 *   1. POSTs to /api/v1/auth/sso-login with the SSO key + email.
 *   2. Receives a JWT in the same shape the password-login endpoint returns.
 *   3. Plants the token into localStorage under the 'auth-storage' key that
 *      the Zustand auth store reads, so the app boots already signed in.
 *
 * No form fill, no UI dependency. ~50ms wall-clock vs ~1.5s for loginViaUI.
 */
import { Page, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';

type SsoLoginResponse = {
  sessionToken: string;
  token: string;
  user: Record<string, unknown>;
  expiresAt: string;
  expiresIn: number;
  request_id?: string;
};

export async function loginViaSso(page: Page, email: string): Promise<SsoLoginResponse> {
  if (!SSO_KEY) {
    test.skip(true, 'E2E_SSO_KEY not set — cannot use SSO API. Run POST /api/test/bootstrap-sso-key once, then set the plaintext into E2E_SSO_KEY.');
  }
  const r = await fetch(`${BASE_URL}/api/v1/auth/sso-login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cshse-api-key': SSO_KEY
    },
    body: JSON.stringify({ email })
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(
      `loginViaSso(${email}) failed: HTTP ${r.status} — ${body.slice(0, 400)}`
    );
  }
  const payload = (await r.json()) as SsoLoginResponse;

  // Plant the JWT where the Zustand auth-store reads it on app boot. The
  // store's partialize keeps `token`, `impersonation`, and
  // `needsImpersonationSelection`. The user object hydrates on the first
  // /api/auth/me call after the app loads.
  const baseOrigin = new URL(BASE_URL).origin;
  await page.context().addInitScript(
    ({ token, storageKey }) => {
      const existing = window.localStorage.getItem(storageKey);
      let parsed: { state?: Record<string, unknown>; version?: number } = {};
      try {
        parsed = existing ? JSON.parse(existing) : {};
      } catch {
        parsed = {};
      }
      const state = (parsed.state as Record<string, unknown> | undefined) ?? {};
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            ...state,
            token,
            impersonation: {
              isImpersonating: false,
              originalUser: null,
              impersonatedRole: undefined,
              impersonatedUser: undefined
            },
            needsImpersonationSelection: false
          },
          version: parsed.version ?? 0
        })
      );
    },
    { token: payload.token, storageKey: 'auth-storage' }
  );

  // Some tests open `page` directly without a prior goto; the init script
  // above attaches to every page in the context, so any subsequent goto
  // sees the planted token. For tests that have already opened the app,
  // also drop the token in synchronously via evaluate to be safe.
  try {
    await page.goto(baseOrigin, { waitUntil: 'load' });
    await page.evaluate(
      ({ token, storageKey }) => {
        const existing = window.localStorage.getItem(storageKey);
        let parsed: { state?: Record<string, unknown>; version?: number } = {};
        try {
          parsed = existing ? JSON.parse(existing) : {};
        } catch {
          parsed = {};
        }
        const state = (parsed.state as Record<string, unknown> | undefined) ?? {};
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            state: { ...state, token },
            version: parsed.version ?? 0
          })
        );
      },
      { token: payload.token, storageKey: 'auth-storage' }
    );
  } catch {
    // First goto can fail if the test hasn't started a server yet — that's
    // OK, the init script will catch on the test's own first goto.
  }

  return payload;
}

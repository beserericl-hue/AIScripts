import { test, expect, request, APIRequestContext } from '@playwright/test';

/**
 * CR-074 — MemberClick OAuth `state` is now PERSISTED in MongoDB (TTL index),
 * not an in-memory Map, so it survives a server restart or a multi-instance
 * scale-out (the AACC/Julia "Sign-in link expired" symptom). The callback also
 * now LOGS the previously-silent invalid-state branch.
 *
 * `E2E_MC_STATE` is a state value inserted DIRECTLY into Mongo (via
 * scratchpad/prep_mcstate.cjs) — so it was NEVER in the running server's memory.
 * If the callback finds it, it can only have read the persistent store, which
 * proves the fix.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse.courseworx.media';
const MC_STATE = process.env.E2E_MC_STATE ?? '';
const EXPIRED = 'Sign-in link expired';

test.describe('MemberClick OAuth — persistent state', () => {
  test.skip(!MC_STATE, 'set E2E_MC_STATE (run scratchpad/prep_mcstate.cjs in-container first)');
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await request.newContext({ baseURL: BASE }); });
  test.afterAll(async () => { await api?.dispose(); });

  test('1) a Mongo-only state is found by the callback (restart/replica resilient)', async () => {
    const r = await api.get(`/sso/v1/memberclick/callback?state=${MC_STATE}&code=fake-code-e2e`, { maxRedirects: 0 });
    expect(r.status()).toBe(400);
    const body = await r.text();
    // Got PAST the state check (state came only from Mongo) → it fails later at
    // the token exchange, NOT at "Sign-in link expired".
    expect(body, 'persistent state was found, not treated as expired').not.toContain(EXPIRED);
  });

  test('2) the same state is single-use → second callback is rejected as expired', async () => {
    const r = await api.get(`/sso/v1/memberclick/callback?state=${MC_STATE}&code=fake-code-e2e`, { maxRedirects: 0 });
    expect(r.status()).toBe(400);
    expect(await r.text(), 'state consumed on first use').toContain(EXPIRED);
  });

  test('3) an unknown state is rejected as expired', async () => {
    const r = await api.get('/sso/v1/memberclick/callback?state=deadbeefdeadbeefdeadbeef&code=x', { maxRedirects: 0 });
    expect(r.status()).toBe(400);
    expect(await r.text()).toContain(EXPIRED);
  });

  // Prod-only: MemberClick is configured, so /login mints a real state + 302s to
  // the authorize endpoint. (Dev has no client id → "Not set up yet"; skipped.)
  test('4) /login issues a fresh persisted state (configured env only)', async () => {
    const r = await api.get('/sso/v1/memberclick/login?returnTo=/dashboard', { maxRedirects: 0 });
    test.skip(r.status() !== 302, 'MemberClick OAuth not configured in this environment');
    const loc = r.headers()['location'] || '';
    const state = new URL(loc).searchParams.get('state');
    expect(state, 'authorize redirect carries a state').toBeTruthy();
    // That state must be immediately usable (found), then single-use.
    const cb = await api.get(`/sso/v1/memberclick/callback?state=${state}&code=fake`, { maxRedirects: 0 });
    expect(await cb.text(), 'freshly minted state is found').not.toContain(EXPIRED);
  });
});

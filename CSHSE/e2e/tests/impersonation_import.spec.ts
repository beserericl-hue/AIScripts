import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * IMPERSONATION-IMPORT ATTRIBUTION. The intended workflow: a superuser
 * impersonates a PC to help them import; the resulting self-study MUST belong
 * to the PC's institution and be visible when impersonating that PC again — not
 * parked at whatever institution the client happened to have selected.
 *
 * Proves: SU-impersonating-PC-X creating a submission (even with a WRONG
 * institutionId in the body) is attributed to PC-X's institution, owned by
 * PC-X, visible when impersonating PC-X, and denied to a different PC.
 *
 * Requires E2E_SSO_KEY + E2E_SEED_TOKEN. Uses the superuser SSO login.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const SU_EMAIL = process.env.CSHSE_SU_EMAIL ?? 'eric@agileadtesting.com';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string): Promise<string> {
  const r = await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } });
  expect(r.ok(), `sso-login ${email}: ${r.status()}`).toBeTruthy();
  return (await r.json()).token as string;
}

test('superuser impersonating a PC: import is owned by the PC, visible to the PC', async () => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(120_000);
  const api = await request.newContext({ baseURL: BASE });

  let seedX: SeedResult | undefined, seedB: SeedResult | undefined;
  try {
    // PC-X at institution X, PC-B at a different institution B (the "wrong" one).
    seedX = await seedFixture('wizard_review_minimal', { user: { institutionName: `Imp Inst X ${RUN}`, email: 'imp-pc-x@test.local' }, submission: { institutionName: `Imp Inst X ${RUN}` } });
    seedB = await seedFixture('wizard_review_minimal', { user: { institutionName: `Imp Inst B ${RUN}`, email: 'imp-pc-b@test.local' }, submission: { institutionName: `Imp Inst B ${RUN}` } });

    const suToken = await tok(api, SU_EMAIL);
    const tokX = await tok(api, seedX!.userEmail);
    const tokB = await tok(api, seedB!.userEmail);

    // Identify PC-X + PC-B ids/institutions.
    const meX = await (await api.get('/api/auth/me', { headers: { Authorization: `Bearer ${tokX}` } })).json();
    const pcXId = (meX.user ?? meX).id ?? (meX.user ?? meX)._id;
    const instX = (meX.user ?? meX).institutionId as string;
    const meB = await (await api.get('/api/auth/me', { headers: { Authorization: `Bearer ${tokB}` } })).json();
    const instB = (meB.user ?? meB).institutionId as string;
    expect(instX && instB && instX !== instB, 'X and B are distinct institutions').toBeTruthy();

    // SU impersonates PC-X (full identity) and creates a submission with the
    // WRONG institution (B) selected in the body.
    const impersonateX = {
      Authorization: `Bearer ${suToken}`,
      'X-Impersonated-User-Id': String(pcXId),
      'X-Impersonated-Role': 'program_coordinator',
      'X-Impersonated-User-Name': 'PC X',
    };
    const created = await api.post('/api/submissions', {
      headers: impersonateX,
      data: { institutionId: instB, institutionName: 'Imp Inst X (typo)', programName: 'Human Services', programLevel: 'associate', type: 'initial' },
    });
    expect(created.ok(), `impersonated create failed: ${created.status()} ${await created.text()}`).toBeTruthy();
    const sub = (await created.json()).submission ?? (await created.json());
    const subId = sub._id;

    // (1) It must be attributed to PC-X's institution, NOT the wrong one (B).
    expect(String(sub.institutionId), 'submission attributed to PC-X institution, not the selected wrong one')
      .toBe(String(instX));
    // (2) Owned by the impersonated PC (submitterId = PC-X).
    expect(String(sub.submitterId), 'submitterId is the impersonated PC').toBe(String(pcXId));

    // (3) Visible when impersonating PC-X again.
    const asX = await api.get(`/api/submissions/${subId}`, { headers: impersonateX });
    expect(asX.ok(), 'PC-X (impersonated) can see the submission they imported').toBeTruthy();

    // (4) Visible to the real PC-X token too.
    const asRealX = await api.get(`/api/submissions/${subId}`, { headers: { Authorization: `Bearer ${tokX}` } });
    expect(asRealX.ok(), 'real PC-X can see it').toBeTruthy();

    // (5) DENIED to PC-B (different institution).
    const asB = await api.get(`/api/submissions/${subId}`, { headers: { Authorization: `Bearer ${tokB}` } });
    expect([401, 403, 404].includes(asB.status()), `PC-B must NOT see PC-X's submission (got ${asB.status()})`).toBeTruthy();

    console.log(`OK: impersonated import attributed to instX=${instX}, owned by PC-X, denied to PC-B`);
  } finally {
    await cleanupSeed(seedX); await cleanupSeed(seedB);
  }
});

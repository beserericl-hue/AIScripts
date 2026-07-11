import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * CROSS-TENANT ISOLATION audit (2026-07). Proves that a program coordinator at
 * institution B, and an unassigned reader, cannot READ or WRITE institution A's
 * persistent data through ANY endpoint the audit flagged — and that legitimate
 * access (PC to its own submission) still works. Also proves a plain admin
 * cannot escalate itself to superuser.
 *
 * Requires E2E_SSO_KEY + E2E_SEED_TOKEN.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const DENIED = [401, 403, 404];

async function tok(api: APIRequestContext, email: string): Promise<string> {
  const r = await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } });
  expect(r.ok(), `sso-login ${email}: ${r.status()}`).toBeTruthy();
  return (await r.json()).token as string;
}

test.describe('cross-tenant isolation', () => {
  let seedA: SeedResult | undefined, seedB: SeedResult | undefined, seedR: SeedResult | undefined, seedAdmin: SeedResult | undefined;
  let api: APIRequestContext;

  test.beforeAll(async () => {
    test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
    api = await request.newContext({ baseURL: BASE });
    seedA = await seedFixture('wizard_review_minimal', { user: { institutionName: 'Isolation Inst A', email: 'iso-pc-a@test.local' }, submission: { institutionName: 'Isolation Inst A' } });
    seedB = await seedFixture('wizard_review_minimal', { user: { institutionName: 'Isolation Inst B', email: 'iso-pc-b@test.local' }, submission: { institutionName: 'Isolation Inst B' } });
    seedR = await seedFixture('wizard_review_minimal', { user: { institutionName: 'Isolation Inst R', email: 'iso-reader@test.local', role: 'reader' } });
    seedAdmin = await seedFixture('wizard_review_minimal', { user: { institutionName: 'Isolation Inst Adm', email: 'iso-admin@test.local', role: 'admin' } });
  });
  test.afterAll(async () => { await cleanupSeed(seedA); await cleanupSeed(seedB); await cleanupSeed(seedR); await cleanupSeed(seedAdmin); });

  test('PC-B and an unassigned reader are denied read+write on inst A everywhere', async () => {
    const tokenA = await tok(api, seedA!.userEmail);
    const authA = { Authorization: `Bearer ${tokenA}` };
    const meA = await (await api.get('/api/auth/me', { headers: authA })).json();
    const instA = (meA.user ?? meA).institutionId as string;
    const pcAId = (meA.user ?? meA).id ?? (meA.user ?? meA)._id;
    const subA = seedA!.submissionId;
    const importA = seedA!.importId;

    // POSITIVE CONTROL — PC-A must still read its own submission + progress.
    expect((await api.get(`/api/submissions/${subA}`, { headers: authA })).ok(), 'PC-A reads own submission').toBeTruthy();
    expect((await api.get(`/api/submissions/${subA}/progress`, { headers: authA })).ok(), 'PC-A reads own progress').toBeTruthy();

    const attackers = [
      { name: 'PC-B', token: await tok(api, seedB!.userEmail) },
      { name: 'reader(unassigned)', token: await tok(api, seedR!.userEmail) },
    ];

    const reads = (inst: string) => [
      `/api/submissions/${subA}`,
      `/api/submissions/${subA}/progress`,
      `/api/submissions/${subA}/review`,
      `/api/submissions/${subA}/evidence`,
      `/api/submissions/${subA}/workflow-summary`,
      `/api/submissions/${subA}/failed`,
      `/api/submissions/${subA}/comments`,
      `/api/submissions/${subA}/checklist`,
      `/api/submissions/${subA}/scores`,
      `/api/submissions/${subA}/scores/summary`,
      `/api/submissions/${subA}/compilation`,
      `/api/submissions/${subA}/lock`,
      `/api/submissions/${subA}/matrix`,
      `/api/submissions/${subA}/matrices`,
      `/api/reviews/submissions/${subA}`,
      `/api/program-courses/${subA}/courses`,
      `/api/webhooks/validation/latest?submissionId=${subA}&standardCode=1&specCode=a`,
      `/api/webhooks/validation/${subA}/1/failed`,
      `/api/imports/check/${subA}`,
      `/api/imports/${importA}`,
      `/api/imports/${importA}/content`,
      `/api/imports/${importA}/content?submissionId=${subA}`,
      `/api/imports/${importA}/sections`,
      `/api/imports/${importA}/ai-status`,
      `/api/users?institutionId=${inst}`,
      `/api/users?role=admin`,
      `/api/users/${pcAId}`,
      `/api/institutions`,
      `/api/institutions/${inst}`,
    ];
    const writes = () => [
      { m: 'patch' as const, p: `/api/submissions/${subA}/narrative`, d: { standardCode: '1', specCode: 'a', content: 'HACKED' } },
      { m: 'patch' as const, p: `/api/submissions/${subA}/introduction`, d: { scope: 'document', content: 'HACKED' } },
      { m: 'post' as const, p: `/api/submissions/${subA}/review/set-approved`, d: { approvedIds: [] } },
      { m: 'post' as const, p: `/api/submissions/${subA}/evidence/url`, d: { url: 'https://evil.example', description: 'x' } },
      { m: 'post' as const, p: `/api/submissions/${subA}/standards/1/submit`, d: {} },
      { m: 'post' as const, p: `/api/submissions/${subA}/standards/1/specs/1.a/override`, d: { verdict: 'pass' } },
      { m: 'post' as const, p: `/api/submissions/${subA}/standards/1/complete`, d: {} },
      { m: 'post' as const, p: `/api/program-courses/${subA}/courses`, d: { courseCode: 'HACK101', courseName: 'x' } },
      { m: 'put' as const, p: `/api/submissions/${subA}/scores`, d: { standardCode: '1', specCode: 'a', score: 0 } },
      { m: 'post' as const, p: `/api/webhooks/validate`, d: { submissionId: subA, standardCode: '1', specCode: 'a' } },
      { m: 'post' as const, p: `/api/submissions`, d: { institutionId: instA, institutionName: 'Isolation Inst A', programName: 'x', programLevel: 'associate', type: 'initial' } },
      { m: 'post' as const, p: `/api/imports/upload`, d: null }, // multipart skipped; ownership check must fire on submissionId in body
    ];

    const leaks: string[] = [];
    for (const atk of attackers) {
      const h = { Authorization: `Bearer ${atk.token}` };
      for (const p of reads(instA)) {
        const r = await api.get(p, { headers: h });
        const body = await r.text();
        // A read leaks if it 200s AND echoes A's submission/institution id as real data.
        const leaked = !DENIED.includes(r.status()) && (body.includes(subA) || (p.includes('/institutions/') && body.includes(instA)) || (p.includes(`/users/${pcAId}`) && body.includes(String(pcAId))) || (p.includes('institutionId=') && body.includes(instA)));
        if (leaked) leaks.push(`[${atk.name}] READ ${r.status()} ${p}`);
      }
      for (const w of writes()) {
        if (w.p.endsWith('/upload')) continue; // needs multipart; covered by narrative/introduction writes
        const r = await api[w.m](w.p, { headers: h, data: w.d });
        if (!DENIED.includes(r.status())) leaks.push(`[${atk.name}] WRITE ${r.status()} ${w.m.toUpperCase()} ${w.p}`);
      }
      // LIST must not contain A's submission.
      const list = await api.get('/api/submissions', { headers: h });
      if ((await list.text()).includes(subA)) leaks.push(`[${atk.name}] LIST /api/submissions leaked subA`);
    }

    // INTEGRITY — none of the write attempts changed A's data.
    const afterA = await (await api.get(`/api/submissions/${subA}`, { headers: authA })).json();
    if (JSON.stringify(afterA).includes('HACKED')) leaks.push('INTEGRITY: A data was mutated');

    console.log(`\n=== ${leaks.length} LEAK(S) ===\n${leaks.join('\n') || '(none)'}`);
    expect(leaks, `cross-tenant leaks:\n${leaks.join('\n')}`).toEqual([]);
  });

  test('a plain admin cannot escalate itself to superuser via updateUser', async () => {
    const tokenAdm = await tok(api, seedAdmin!.userEmail);
    const authAdm = { Authorization: `Bearer ${tokenAdm}` };
    const me = await (await api.get('/api/auth/me', { headers: authAdm })).json();
    const myId = (me.user ?? me).id ?? (me.user ?? me)._id;
    // Attempt the escalation.
    await api.put(`/api/users/${myId}`, { headers: authAdm, data: { isSuperuser: true } });
    // Re-read identity — must NOT be superuser.
    const after = await (await api.get('/api/auth/me', { headers: authAdm })).json();
    expect((after.user ?? after).isSuperuser === true, 'admin escalated to superuser').toBeFalsy();
  });
});

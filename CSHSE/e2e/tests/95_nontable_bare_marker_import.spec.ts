import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * CR-074 — Kennesaw State ("2026 NEW ACCREDITATION DRAFT WITHOUT TABLE FORMAT").
 * When a program removes the official template's tables and writes the self-study
 * as prose, a substandard marker can land ALONE on its own paragraph ("7c.") or
 * be glued straight onto its prompt with no space ("5b.Provide documentation…").
 * The template walker's heading patterns required trailing whitespace+text, so
 * these markers fell through as body text — the substandard's content merged into
 * the PREVIOUS spec and its own bucket came up empty ("the matcher didn't route
 * anything to 7.c"). Monica flagged exactly Standards 5.b and 7.c.
 *
 * This exercises the REAL deployed import path against dev and asserts:
 *   1. bucket 7.c is populated (bare "7c." marker recognised),
 *   2. bucket 5.b is populated (glued "5b.Provide…" marker recognised),
 *   3. 7.b no longer swallows 7.c's evaluation content.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const FIXTURE = path.resolve(__dirname, '../fixtures/files/nontable_bare_markers_baccalaureate.docx');

async function tok(api: APIRequestContext, email: string) {
  const r = await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } });
  return (await r.json()).token as string;
}
const strip = (h: string) => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('non-table self-study: bare/glued substandard markers route to their own bucket', async () => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(300_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: `nontable-pc-${Date.now().toString(36)}@test.local` },
      submission: { programLevel: 'bachelors', institutionName: 'Non-Table Marker E2E' },
    });
    const auth = { Authorization: `Bearer ${await tok(api, seed!.userEmail)}` };
    const me = await (await api.get('/api/auth/me', { headers: auth })).json();
    const institutionId = (me.user ?? me).institutionId as string;

    const created = await api.post('/api/submissions', {
      headers: auth,
      data: { institutionId, institutionName: 'Non-Table Marker E2E', programName: 'Human Services', programLevel: 'bachelors', type: 'initial' },
    });
    const sub = ((await created.json()).submission ?? (await created.json()))._id as string;

    const up = await api.post('/api/imports/upload', {
      headers: auth,
      multipart: { submissionId: sub, file: { name: 'nontable.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: fs.readFileSync(FIXTURE) } },
    });
    expect(up.ok(), `upload failed: ${up.status()} ${await up.text()}`).toBeTruthy();
    const importId = (await up.json()).importId as string;
    const start = await api.post(`/api/imports/${importId}/start-ai`, { headers: auth, data: { programLevel: 'bachelors', forceFormat: null } });
    expect(start.ok(), `start-ai failed: ${await start.text()}`).toBeTruthy();

    let last = '';
    await expect.poll(async () => {
      const s = await (await api.get(`/api/imports/${importId}/ai-status`, { headers: auth })).json();
      last = s.status;
      return s.status;
    }, { timeout: 240_000, intervals: [4000] }).toMatch(/^(parsed|completed|failed)$/);
    expect(last, 'parse must not fail').not.toBe('failed');

    let buckets: any = {};
    const bucketText = (k: string) => {
      const b = buckets[k] || {};
      const parts = [...(b.narratives || []), ...(b.evidenceText || [])];
      return parts.map((it: any) => strip(it?.htmlSnippet || it?.snippet || '')).join(' ');
    };
    await expect.poll(async () => {
      const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      const rs = ((body.submission ?? body) as any).aiReviewState ?? {};
      buckets = rs.buckets ?? {};
      return bucketText('7.a');
    }, { timeout: 30_000, intervals: [2000] }).toMatch(/FACWORD-delta/);

    // 1) bare "7c." marker → its own bucket, with the evaluation response.
    expect(bucketText('7.c'), 'Std 7.c recovered from bare "7c." marker').toMatch(/EVALWORD-foxtrot/);
    // 2) glued "5b.Provide…" marker → its own bucket.
    expect(bucketText('5.b'), 'Std 5.b recovered from glued "5b.Provide" marker').toMatch(/REFERWORD-bravo/);
    // 3) 7.b must NOT swallow 7.c's content any more.
    expect(bucketText('7.b'), '7.b keeps its own content').toMatch(/ROLEWORD-echo/);
    expect(bucketText('7.b'), '7.b no longer absorbs 7.c').not.toMatch(/EVALWORD-foxtrot/);

    console.log('Non-table markers: 5.b ✓ 7.c ✓ (no 7.b over-absorption) ✓');
  } finally {
    await cleanupSeed(seed);
  }
});

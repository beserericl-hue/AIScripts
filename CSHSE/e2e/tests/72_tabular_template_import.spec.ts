import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Tabular official CSHSE template import (Anne Arundel-style). Several
 * institutions submit the official template with its TABLES intact — one table
 * per Standard, the "Standard N:" heading + lettered specs + each "Response:"
 * all inside table CELLS (Kennesaw removed the tables). The detector + walker
 * used to read only paragraphs, so a tabular template misclassified as free-form
 * self_study and content mis-routed (an Introduction prompt landed under
 * Standard 4.a). This exercises the REAL deployed import path and asserts:
 *   1. it's detected/parsed as the template format (specs route by structure),
 *   2. a HEADERLESS continuation table opens the next sequential Standard (5),
 *   3. a 3-column table (a.|a.|content) is read (Standard 6),
 *   4. the Introduction prompt ("major program changes") routes to the
 *      Introduction — NOT to Standard 4.a, which holds its own SLO response.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const FIXTURE = path.resolve(__dirname, '../fixtures/files/tabular_template_associate.docx');

async function tok(api: APIRequestContext, email: string) {
  const r = await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } });
  return (await r.json()).token as string;
}
const strip = (h: string) => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('tabular template imports every standard/spec; intro routes to intro', async () => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(300_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    // A Program Coordinator (superusers cannot import).
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: `tabular-pc-${Date.now().toString(36)}@test.local` },
      submission: { programLevel: 'associate', institutionName: 'Tabular Template E2E' },
    });
    const auth = { Authorization: `Bearer ${await tok(api, seed!.userEmail)}` };
    const me = await (await api.get('/api/auth/me', { headers: auth })).json();
    const institutionId = (me.user ?? me).institutionId as string;

    const created = await api.post('/api/submissions', {
      headers: auth,
      data: { institutionId, institutionName: 'Tabular Template E2E', programName: 'Human Services', programLevel: 'associate', type: 'initial' },
    });
    const sub = ((await created.json()).submission ?? (await created.json()))._id as string;

    // Upload the tabular template + run the true production import path (auto-detect).
    const up = await api.post('/api/imports/upload', {
      headers: auth,
      multipart: { submissionId: sub, file: { name: 'tabular.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: fs.readFileSync(FIXTURE) } },
    });
    expect(up.ok(), `upload failed: ${up.status()} ${await up.text()}`).toBeTruthy();
    const importId = (await up.json()).importId as string;
    const start = await api.post(`/api/imports/${importId}/start-ai`, { headers: auth, data: { programLevel: 'associate', forceFormat: null } });
    expect(start.ok(), `start-ai failed: ${await start.text()}`).toBeTruthy();

    let last = '';
    await expect.poll(async () => {
      const s = await (await api.get(`/api/imports/${importId}/ai-status`, { headers: auth })).json();
      last = s.status;
      return s.status;
    }, { timeout: 240_000, intervals: [4000] }).toMatch(/^(parsed|completed|failed)$/);
    expect(last, 'parse must not fail').not.toBe('failed');

    const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
    const rs = ((body.submission ?? body) as any).aiReviewState ?? {};
    const buckets = rs.buckets ?? {};
    const intro = rs.introductions ?? {};
    const bucketText = (k: string) => {
      const b = buckets[k] || {};
      const it = (b.narratives || [])[0] || (b.evidenceText || [])[0];
      return strip(it?.htmlSnippet || it?.snippet || '');
    };

    // 1) Standard 4 — all three answer shapes captured under the RIGHT spec.
    expect(bucketText('4.a'), 'Std 4.a = SLO response').toMatch(/measurable student learning outcomes/i);
    expect(bucketText('4.b'), 'Std 4.b = bare-Response answer').toMatch(/five-year formal evaluation/i);
    expect(bucketText('4.c'), 'Std 4.c = no-marker answer').toMatch(/publishes student achievement data/i);
    // 4.a must NOT be the intro "major program changes" prompt (the reported bug).
    expect(bucketText('4.a')).not.toMatch(/major program changes/i);

    // 2) Standard 5 recovered from the HEADERLESS continuation table.
    expect(bucketText('5.a'), 'Std 5.a from headerless table').toMatch(/open-access/i);
    expect(bucketText('5.b')).toMatch(/student referral system/i);

    // 3) Standard 6 read from the 3-column (a.|a.|content) table.
    expect(bucketText('6.a'), 'Std 6.a from 3-column table').toMatch(/master's degree/i);

    // 4) The Introduction prompt routes to the Introduction, not a Standard.
    const introText = strip(JSON.stringify(intro));
    expect(introText, 'intro holds the major-program-changes prompt').toMatch(/major program changes/i);
    expect(introText).toMatch(/Associate of Applied Sciences/i);

    console.log('Tabular template: Std 4/5/6 routed, intro→intro, headerless + 3-col handled ✓');
  } finally {
    await cleanupSeed(seed);
  }
});

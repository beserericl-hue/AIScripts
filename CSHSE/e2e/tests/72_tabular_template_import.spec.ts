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

    // The importer writes aiStatus='parsed' a beat before aiReviewState is
    // committed — re-fetch until the buckets are populated (avoids the race).
    let buckets: any = {};
    let intro: any = {};
    const bucketText = (k: string) => {
      const b = buckets[k] || {};
      const it = (b.narratives || [])[0] || (b.evidenceText || [])[0];
      return strip(it?.htmlSnippet || it?.snippet || '');
    };
    await expect.poll(async () => {
      const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      const rs = ((body.submission ?? body) as any).aiReviewState ?? {};
      buckets = rs.buckets ?? {};
      intro = rs.introductions ?? {};
      return bucketText('4.a');
    }, { timeout: 30_000, intervals: [2000] }).toMatch(/measurable student learning outcomes/i);

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

    // 5) COMPARE anchors — the source HTML must carry a data-section-id anchor
    //    for EVERY review item (narrative, supporting-evidence, intro). Without
    //    it the Compare pane can't locate the item ("section not located —
    //    showing top"). This is the regression that was missing.
    const srcHtml = await (await api.get(`/api/imports/${importId}/content?submissionId=${sub}`, {
      headers: { ...auth, Accept: 'text/html' },
    })).text();
    const anchors = new Set([...srcHtml.matchAll(/data-section-id="([^"]+)"/g)].map((m) => m[1]));
    expect(anchors.size, 'source HTML has section anchors').toBeGreaterThan(3);
    const itemIds: string[] = [];
    for (const bk of Object.values(buckets) as any[]) {
      for (const kind of ['narratives', 'evidenceText', 'evidenceFiles']) {
        for (const it of bk?.[kind] || []) if (it?.sectionId) itemIds.push(it.sectionId);
      }
    }
    for (const ib of Object.values(intro) as any[]) {
      for (const it of ib?.items || []) if (it?.sectionId) itemIds.push(it.sectionId);
    }
    const missing = itemIds.filter((id) => !anchors.has(id));
    expect(itemIds.length, 'review has items to anchor').toBeGreaterThan(5);
    expect(missing, `EVERY review item must be anchored in the source (missing ${missing.length}/${itemIds.length})`).toEqual([]);
    // A narrative AND a short evidence item both resolve to an anchor.
    const narrId = buckets['4.a']?.narratives?.[0]?.sectionId;
    const evId = (Object.values(buckets) as any[]).flatMap((b) => b?.evidenceText || []).find((e: any) => e?.sectionId)?.sectionId;
    expect(narrId && anchors.has(narrId), 'narrative 4.a anchored').toBeTruthy();
    if (evId) expect(anchors.has(evId), 'a supporting-evidence item is anchored').toBeTruthy();

    console.log(`Tabular template: routing ✓ | Compare anchors: ${itemIds.length}/${itemIds.length} items anchored ✓`);
  } finally {
    await cleanupSeed(seed);
  }
});

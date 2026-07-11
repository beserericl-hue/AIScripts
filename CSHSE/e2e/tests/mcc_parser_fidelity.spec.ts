import { test, expect, request } from '@playwright/test';
import * as fs from 'fs';

/**
 * MCC parser fidelity E2E — exercises the REAL deployed AI-import path on
 * develop (upload → start-ai → cshse-ai parse → S3 appendix upload → merge
 * into aiReviewState) and then verifies the parsed review data is high
 * QUALITY, not merely non-empty:
 *   1. Letter-based spec mapping — Standard 1 yields buckets 1.a..1.f whose
 *      narrative bodies are the institution's own sub-point text.
 *   2. Clickable links — supporting-link text is anchored as <a href> in the
 *      narrative htmlSnippet (e.g. "MCC Accreditation Page").
 *   3. Appendix routing — evidenceDocs carry resolvedStd + resolvedSpec so the
 *      file cards pre-fill Standard / Sub-standard.
 *
 * Password-less via the SSO key. Requires E2E_SSO_KEY and MCC_PDF.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const EMAIL = process.env.MCC_EMAIL ?? process.env.CSHSE_SU_EMAIL ?? 'eric@agileadtesting.com';
const PDF = process.env.MCC_PDF ?? '';

test('MCC import fidelity: letters map, links clickable, appendices routed', async () => {
  test.skip(!SSO_KEY || !PDF, 'set E2E_SSO_KEY and MCC_PDF');
  test.setTimeout(600_000);

  const api = await request.newContext({ baseURL: BASE });
  const login = await api.post('/api/v1/auth/sso-login', {
    headers: { 'x-cshse-api-key': SSO_KEY },
    data: { email: EMAIL },
  });
  expect(login.ok(), `sso-login failed: ${login.status()}`).toBeTruthy();
  const token = (await login.json()).token as string;
  expect(token).toBeTruthy();
  const auth = { Authorization: `Bearer ${token}` };

  const me = await (await api.get('/api/auth/me', { headers: auth })).json();
  const institutionId = (process.env.MCC_INST || (me.user ?? me).institutionId) as string;
  expect(institutionId, 'no institutionId (set MCC_INST)').toBeTruthy();

  // Fresh submission.
  const created = await api.post('/api/submissions', {
    headers: auth,
    data: { institutionId, institutionName: 'MCC Fidelity E2E', programName: 'Human Services', programLevel: 'associate', type: 'initial' },
  });
  const sub = ((await created.json()).submission ?? (await created.json()) as any)._id as string;
  expect(sub).toBeTruthy();

  // 1) Upload the original file (stored in S3 as aiS3Key).
  const buffer = fs.readFileSync(PDF);
  const up = await api.post('/api/imports/upload', {
    headers: auth,
    multipart: {
      submissionId: sub,
      file: { name: 'mcc-self-study.pdf', mimeType: 'application/pdf', buffer },
    },
  });
  expect(up.ok(), `upload failed: ${up.status()} ${await up.text()}`).toBeTruthy();
  const importId = (await up.json()).importId as string;
  expect(importId).toBeTruthy();

  // 2) Kick off the AI import via the true production path: auto-detect
  //    (forceFormat null) — the PDF detector classifies this as mcc_narrative.
  const start = await api.post(`/api/imports/${importId}/start-ai`, {
    headers: auth,
    data: { programLevel: 'associate', forceFormat: null },
  });
  expect(start.ok(), `start-ai failed: ${start.status()} ${await start.text()}`).toBeTruthy();

  // 3) Poll ai-status until the parse completes (935-page + 73 S3 uploads).
  let last = '';
  await expect
    .poll(async () => {
      const s = await (await api.get(`/api/imports/${importId}/ai-status`, { headers: auth })).json();
      last = `${s.status}${s.stages?.length ? ` (${s.stages[s.stages.length - 1]?.stage ?? ''})` : ''}`;
      return s.status;
    }, { timeout: 540_000, intervals: [5000] })
    .toMatch(/^(parsed|completed|failed)$/);
  console.log('final ai-status:', last);
  expect(last, 'parse must not fail').not.toMatch(/^failed/);

  // 4) Pull the server's review state and assert QUALITY.
  const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
  const rs = ((body.submission ?? body) as any).aiReviewState ?? {};
  const buckets = rs.buckets ?? {};
  const evidenceDocs: any[] = rs.evidenceDocs ?? [];
  console.log(`buckets: ${Object.keys(buckets).length}, evidenceDocs: ${evidenceDocs.length}`);

  // (a) Letter-based mapping: 1.a..1.f present with non-trivial bodies.
  const std1 = Object.keys(buckets).filter((k) => /^1\.[a-f]$/.test(k)).sort();
  console.log('Standard-1 spec buckets:', std1.join(', '));
  expect(std1.length, 'expected 1.a..1.f letter buckets').toBeGreaterThanOrEqual(4);
  for (const k of std1) {
    const n = (buckets[k].narratives ?? [])[0];
    expect(n, `bucket ${k} has a narrative`).toBeTruthy();
    expect((n.htmlSnippet || n.snippet || '').length, `${k} body non-trivial`).toBeGreaterThan(40);
  }

  // (b) Clickable links: at least one Standard-1 narrative anchors a real link.
  const std1Html = std1.map((k) => buckets[k].narratives?.[0]?.htmlSnippet || '').join('\n');
  const anchors = [...std1Html.matchAll(/<a\s+href="(https?:[^"]+)"[^>]*>([^<]+)<\/a>/g)];
  console.log('Standard-1 anchors:', anchors.map((m) => `${m[2]} -> ${m[1]}`).join(' | ') || '(none)');
  expect(anchors.length, 'expected >=1 clickable <a href> in Standard-1 narratives').toBeGreaterThan(0);

  // (c) Appendix routing: a healthy share carry resolvedStd+resolvedSpec.
  const routed = evidenceDocs.filter((e) => e.resolvedStd && e.resolvedSpec);
  console.log(`routed: ${routed.length}/${evidenceDocs.length} — sample:`,
    routed.slice(0, 8).map((e) => `${e.mccCode || e.sectionId}->${e.resolvedStd}.${e.resolvedSpec}`).join(', '));
  expect(evidenceDocs.length, 'expected appendix evidenceDocs').toBeGreaterThan(10);
  expect(routed.length, 'expected most appendices routed to std.spec').toBeGreaterThan(evidenceDocs.length * 0.5);

  // (d) Compare / Show-in-source: the source HTML served for this import must
  //     be the CLEAN rebuild — formatted, with working links and per-spec
  //     anchors — not the legacy flattened run-on parse.
  const source = await (await api.get(`/api/imports/${importId}/content?submissionId=${sub}`, {
    headers: { ...auth, Accept: 'text/html' },
  })).text();
  const srcAnchors = (source.match(/<a\s+href="https?:/g) || []).length;
  const srcSections = (source.match(/data-section-id=/g) || []).length;
  console.log(`source HTML: ${source.length} bytes, ${srcAnchors} links, ${srcSections} section anchors`);
  expect(srcAnchors, 'source must contain clickable links').toBeGreaterThan(10);
  expect(srcSections, 'source must have data-section-id anchors').toBeGreaterThan(20);
  // The compare pane locates a spec by its narrative sectionId — it must exist
  // in the source so the highlight lands precisely.
  const oneSectionId = buckets['1.a']?.narratives?.[0]?.sectionId;
  if (oneSectionId) {
    expect(source.includes(`data-section-id="${oneSectionId}"`),
      `source must anchor spec 1.a (${oneSectionId})`).toBeTruthy();
  }
});

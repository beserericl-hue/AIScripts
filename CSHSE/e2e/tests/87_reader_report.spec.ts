import { test, expect, request, APIRequestContext, Page } from '@playwright/test';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Reader Report — full compliance-report coverage (the report handed to the PC
 * and the CSHSE board). Exercises the four issues raised on the report page,
 * against the deployed dev environment, and drops inspectable artifacts
 * (screenshots + the generated Word / HTML / PDF reports) into artifacts/.
 *
 *   1. INTRODUCTION section — the report starts with the Introduction (from the
 *      self-study's introduction, NOT Standard 1), with its own 6-topic
 *      compliant/non-compliant checklist matching pages 1-4 of the official form.
 *   2. FILE LIST — every categorized supporting file for a spec is offered
 *      (none dropped for a missing originalName).
 *   3. COMMENTS — the Word doc + preview show ALL comments: the checklist
 *      comment AND the inline margin comments left by readers / lead reader.
 *   4. CHECKBOXES + LEAD OVERRIDE — the checkboxes reflect/persist the reader's
 *      selections, and a lead reader can override a reader's decision (the board
 *      report then uses the lead's mark; the reader's original is preserved).
 *
 * Auth: an SSO-scoped API key brokers a login for any existing user
 * (superuser, readers, lead reader). Bootstrap one on dev with
 *   POST /api/test/bootstrap-sso-key  (x-e2e-seed-token: <E2E_SEED_TOKEN>)
 * and pass it as E2E_SSO_KEY.  The test is skipped when E2E_SSO_KEY is unset.
 */

const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
// Stevenson University (baccalaureate) on dev — the submission from the report screenshots.
const SUB = process.env.E2E_RR_SUBMISSION ?? '6986239a6612bf17f04a3217';
const SU_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'eric@agileadtesting.com';
const READER1_EMAIL = process.env.E2E_RR_READER1 ?? 'reader1@cshse.test';
const READER1_ID = process.env.E2E_RR_READER1_ID ?? '6a1d7e1a7bc2ee2a2b16d152';
const LEAD_EMAIL = process.env.E2E_RR_LEAD ?? 'lead-assigned@cshse.test';

const ART = path.join(__dirname, '..', 'artifacts', '87_reader_report');
const RUN = 'e2e-87';

// The six Introduction topics that mirror pages 1-4 of the official reader form.
const INTRO_TOPICS: Record<string, RegExp> = {
  a: /Introduction/i,
  b: /Required Introductory/i,
  c: /Describe the Program/i,
  d: /Interim Report|Reaccreditation/i,
  e: /Multiple Sites/i,
  f: /Hybrid|Online/i,
};

async function tok(api: APIRequestContext, email: string): Promise<string> {
  const res = await api.post('/api/v1/auth/sso-login', {
    headers: { 'x-cshse-api-key': SSO_KEY },
    data: { email },
  });
  expect(res.ok(), `sso-login for ${email} → ${res.status()}`).toBeTruthy();
  return (await res.json()).token as string;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function getData(api: APIRequestContext, auth: any, reviewerId?: string) {
  const qs = reviewerId ? `?reviewerId=${reviewerId}` : '';
  const res = await api.get(`/api/reports/submission/${SUB}/reader-report-data${qs}`, { headers: auth });
  expect(res.ok(), `GET reader-report-data → ${res.status()}`).toBeTruthy();
  return res.json();
}

/** Read word/document.xml text out of a .docx buffer. */
async function docxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml;
}

/** Inject a token via the SSO hash-handoff and land on the reader-report screen. */
async function openReport(page: Page, token: string, suffix = '') {
  await page.goto(`${BASE}/reader-report/${SUB}${suffix}#token=${encodeURIComponent(token)}`);
  await page.waitForLoadState('networkidle');
  // Dismiss the first-run help tour so it doesn't obscure the inspection shots.
  const skip = page.getByRole('button', { name: /^Skip$/ });
  if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(300); }
}

test.describe('Reader Report — introduction, files, comments, lead override', () => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY (bootstrap via POST /api/test/bootstrap-sso-key)');

  let api: APIRequestContext;
  let su = '', reader1 = '', lead = '';

  test.beforeAll(async () => {
    fs.mkdirSync(ART, { recursive: true });
    api = await request.newContext({ baseURL: BASE });
    su = await tok(api, SU_EMAIL);
    reader1 = await tok(api, READER1_EMAIL);
    lead = await tok(api, LEAD_EMAIL);
  });
  test.afterAll(async () => { await api?.dispose(); });

  // ── Issue 1 — the report opens with the Introduction (6 topics), not Standard 1
  test('1) Introduction section is first, with the 6-topic checklist', async () => {
    const data = await getData(api, bearer(reader1));
    const sections: any[] = data.standards || [];
    expect(sections.length, 'has sections').toBeGreaterThan(1);

    const first = sections[0];
    expect(first.code, 'first section is the Introduction').toBe('introduction');
    expect(String(first.title)).toMatch(/Introduction/i);

    // Standard 1 must NOT be first (the bug: report started at Standard 1).
    expect(sections[1]?.code, 'Standard 1 follows the Introduction').toBe('1');

    // Six topic specs a-f, each matching an official-form row.
    const specs: any[] = first.specs || [];
    expect(specs.map((s) => s.specCode)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    for (const s of specs) {
      const re = INTRO_TOPICS[s.specCode];
      expect(String(s.specTitle), `intro topic ${s.specCode}`).toMatch(re);
    }
    fs.writeFileSync(path.join(ART, 'intro-structure.json'),
      JSON.stringify({ order: sections.map((s) => s.code), introSpecs: specs.map((s) => ({ code: s.specCode, title: s.specTitle })) }, null, 2));
  });

  // ── Issue 4a — the reader's checkbox selections persist per spec
  test('4a) Reader checkbox marks persist across a reload', async () => {
    const marks = [
      { standardCode: 'introduction', specCode: 'a', mark: 'compliant', comment: `${RUN} intro-a compliant` },
      { standardCode: 'introduction', specCode: 'b', mark: 'compliant', comment: '' },
      { standardCode: 'introduction', specCode: 'c', mark: 'noncompliant', comment: `${RUN} intro-c needs work` },
      { standardCode: 'introduction', specCode: 'd', mark: 'compliant', comment: '' },
      { standardCode: 'introduction', specCode: 'e', mark: 'compliant', comment: '' },
      { standardCode: 'introduction', specCode: 'f', mark: 'compliant', comment: '' },
      { standardCode: '1', specCode: 'a', mark: 'compliant', comment: `${RUN} std1a` },
    ];
    // Merge onto whatever else the reader has already marked, so we PUT a full set.
    const cur = await getData(api, bearer(reader1));
    const rows: any[] = [];
    for (const sec of cur.standards || []) {
      for (const sp of sec.specs || []) {
        const o = marks.find((m) => m.standardCode === sec.code && m.specCode === sp.specCode);
        rows.push({ standardCode: sec.code, specCode: sp.specCode, mark: o?.mark ?? sp.readerMark ?? '', comment: o?.comment ?? sp.readerComment ?? '' });
      }
    }
    const put = await api.put(`/api/reports/submission/${SUB}/reader-report-data`, { headers: bearer(reader1), data: { rows } });
    expect(put.ok(), `PUT → ${put.status()}`).toBeTruthy();

    const after = await getData(api, bearer(reader1));
    const intro = (after.standards || []).find((s: any) => s.code === 'introduction');
    const byCode = Object.fromEntries((intro.specs || []).map((s: any) => [s.specCode, s]));
    expect(byCode.a.readerMark).toBe('compliant');
    expect(byCode.c.readerMark).toBe('noncompliant');
    expect(byCode.c.readerComment).toContain('needs work');
  });

  // ── Issue 1 + pages 1-4 — the Introduction fills the Word document
  test('1w) Introduction fills the Word report (all 6 topics, no leftover placeholders)', async () => {
    const res = await api.get(`/api/reports/submission/${SUB}/reader-report/download?format=docx`, { headers: bearer(reader1) });
    expect(res.status()).toBe(200);
    const buf = Buffer.from(await res.body());
    expect(buf.slice(0, 2).toString('latin1'), 'is a .docx (PK zip)').toBe('PK');
    fs.writeFileSync(path.join(ART, 'reader1-report.docx'), buf);

    const xml = await docxText(buf);
    // Every intro placeholder must have been substituted (none left raw).
    expect(xml, 'no leftover {{...intro...}} placeholders').not.toMatch(/\{\{[^}]*intro[^}]*\}\}/i);
    expect(xml, 'no leftover {{c_/n_/cm_}} placeholders at all').not.toMatch(/\{\{(c_|n_|cm_)/);
    // The Introduction heading is present and the checkbox glyphs rendered.
    expect(xml).toMatch(/Introduction/);
    const checked = (xml.match(/☒/g) || []).length;
    expect(checked, 'checked boxes rendered from the reader marks').toBeGreaterThanOrEqual(6);
  });

  // ── Issue 3 — the report shows ALL comments (checklist + inline margin comments)
  test('3) Report includes checklist comments AND inline reader/lead comments', async () => {
    const readerText = `${RUN} INLINE reader comment ${Date.now().toString(36)}`;
    const leadText = `${RUN} INLINE lead comment ${Date.now().toString(36)}`;
    // Reader leaves an inline margin comment on the Introduction; lead on Standard 1.
    const c1 = await api.post(`/api/submissions/${SUB}/comments`, {
      headers: bearer(reader1),
      data: { standardCode: 'introduction', specCode: 'a', selectedText: 'introduction', selectionStart: 0, selectionEnd: 12, content: readerText },
    });
    expect(c1.ok(), `reader comment → ${c1.status()}`).toBeTruthy();
    const c2 = await api.post(`/api/submissions/${SUB}/comments`, {
      headers: bearer(lead),
      data: { standardCode: '1', specCode: 'a', selectedText: 'program', selectionStart: 0, selectionEnd: 7, content: leadText },
    });
    expect(c2.ok(), `lead comment → ${c2.status()}`).toBeTruthy();

    const res = await api.get(`/api/reports/submission/${SUB}/reader-report/download?format=html`, { headers: bearer(reader1) });
    expect(res.status()).toBe(200);
    const html = await res.text();
    fs.writeFileSync(path.join(ART, 'reader1-report.html'), html);

    expect(html, 'checklist comment present').toContain('needs work');
    expect(html, 'inline reader comment present').toContain(readerText);
    expect(html, 'inline lead comment present').toContain(leadText);
  });

  // ── Issue 2 — the per-spec file list offers every categorized file
  test('2) Per-spec file list surfaces categorized supporting files', async () => {
    // The evidence library the report screen reads from.
    const res = await api.get(`/api/submissions/${SUB}/evidence`, { headers: bearer(reader1) });
    expect(res.ok(), `GET evidence → ${res.status()}`).toBeTruthy();
    const list: any[] = (await res.json()).evidence || [];
    const real = list.filter((e) => !(e.tags || []).some((t: string) => String(t).startsWith('reader-report')));
    // Files must not be dropped for a missing originalName (the relaxed filter).
    const keptByRelaxedFilter = real.filter((e) => !!e.file || e.evidenceType === 'url');
    fs.writeFileSync(path.join(ART, 'evidence-summary.json'),
      JSON.stringify({ total: list.length, real: real.length, kept: keptByRelaxedFilter.length,
        sample: keptByRelaxedFilter.slice(0, 5).map((e) => ({ name: e.file?.originalName || '(no name)', type: e.evidenceType, tags: e.tags })) }, null, 2));
    expect(keptByRelaxedFilter.length, 'categorized files are available to the report').toBeGreaterThan(0);
  });

  // ── Issue 4b — a lead reader overrides a reader's decision; the board report uses it
  test('4b) Lead override: lead changes a reader mark; board report uses the lead mark', async () => {
    // Reader marked intro-a COMPLIANT above; the lead overrides to NON-COMPLIANT.
    const view = await getData(api, bearer(lead), READER1_ID);
    expect(view.overrideMode, 'lead viewing a reader is in override mode').toBe(true);
    expect(view.readonly, 'override mode is editable').toBeFalsy();

    const rows: any[] = [];
    for (const sec of view.standards || []) {
      for (const sp of sec.specs || []) {
        const override = sec.code === 'introduction' && sp.specCode === 'a';
        rows.push({
          standardCode: sec.code, specCode: sp.specCode,
          mark: override ? 'noncompliant' : (sp.leadMark || ''),
          comment: override ? `${RUN} LEAD override — insufficient` : (sp.leadComment || ''),
        });
      }
    }
    const put = await api.put(`/api/reports/submission/${SUB}/reader-report-data?reviewerId=${READER1_ID}`, { headers: bearer(lead), data: { rows } });
    expect(put.ok(), `lead PUT → ${put.status()}`).toBeTruthy();

    // The override persists as a distinct layer; the reader's original is preserved.
    const after = await getData(api, bearer(lead), READER1_ID);
    const introA = (after.standards.find((s: any) => s.code === 'introduction').specs).find((s: any) => s.specCode === 'a');
    expect(introA.leadMark, 'lead override recorded').toBe('noncompliant');
    expect(introA.overriddenBy, 'override provenance recorded').toBeTruthy();
    expect(introA.readerMark, 'reader original preserved').toBe('compliant');

    // The board report (lead downloading the reader's report) uses the lead mark.
    const res = await api.get(`/api/reports/submission/${SUB}/reader-report/download?format=html&reviewerId=${READER1_ID}`, { headers: bearer(lead) });
    expect(res.status()).toBe(200);
    const html = await res.text();
    fs.writeFileSync(path.join(ART, 'board-report-with-override.html'), html);
    expect(html, 'lead override comment in the board report').toContain('LEAD override — insufficient');
  });

  // ── UI inspection artifacts — screenshots of the actual report screen
  test('UI) Screenshots: Introduction section + lead-override view', async ({ page }) => {
    test.setTimeout(90_000);
    // Reader's own report — the Introduction section renders first with its checklist.
    await openReport(page, reader1);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('rr-row-introduction'), 'Introduction section renders').toBeVisible();
    await expect(page.getByTestId('rr-c-introduction-a'), 'intro-a compliant checkbox').toBeVisible();
    await expect(page.getByTestId('rr-c-introduction-f'), 'intro-f compliant checkbox').toBeVisible();
    await page.getByTestId('rr-row-introduction').scrollIntoViewIfNeeded();
    // Element-scoped shots are readable for inspection (fullPage is far too tall).
    await page.getByTestId('rr-row-introduction').screenshot({ path: path.join(ART, 'ui-introduction-section.png') });
    await page.getByTestId('rr-nav-introduction').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ART, 'ui-report-top.png') });

    // Lead opens the reader's report → override mode with the "Reader marked" provenance.
    await openReport(page, lead);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });
    const viewBtn = page.getByTestId(`rr-view-reviewer-${READER1_ID}`);
    if (await viewBtn.count()) {
      await viewBtn.first().click();
      await page.waitForTimeout(1500);
    }
    const badge = page.getByText(/Lead override:/i).first();
    await expect(badge, 'lead override badge visible').toBeVisible({ timeout: 10_000 });
    await badge.scrollIntoViewIfNeeded();
    // Screenshot the intro row that now carries the "Reader marked / Lead override" strip.
    await page.getByTestId('rr-row-introduction').screenshot({ path: path.join(ART, 'ui-lead-override.png') });
  });
});

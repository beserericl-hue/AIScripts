import { test, expect, request, APIRequestContext } from '@playwright/test';

/**
 * CR-074 — submit lifecycle: unassigned-file gate, auto-assign readers on
 * submit, and the reader "Reader Self Study" dashboard.
 *
 * Token-based (works dev + prod identically): the scenario is built in-container
 * by scratchpad/prep_cr074.cjs, which prints a JSON blob passed in via
 * E2E_CR074_JSON = {sub, pcToken, leadToken, introSpecs, ...}.
 *
 * Coverage:
 *  1. A submit-ready study with ONE unassigned file is HARD-blocked: preflight
 *     reports UNASSIGNED_FILES + submitDisabled, and POST submit → 400.
 *  2. After the PC assigns the file (to the Introduction), preflight clears and
 *     submit succeeds.
 *  3. On submit the institution's lead reader gets an active assignment, so the
 *     study appears on their reader-dashboard with per-intro/per-spec progress
 *     (the Lauri/AACC bug).
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const RAW = process.env.E2E_CR074_JSON ?? '';
let cfg: any = {};
try { cfg = JSON.parse(RAW); } catch { /* skipped below */ }
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

test.describe('CR-074 submit lifecycle + reader dashboard', () => {
  // The three steps mutate one shared submission in order (block → assign+submit
  // → reader sees it), so they MUST run serially, not in parallel workers.
  test.describe.configure({ mode: 'serial' });
  test.skip(!cfg.sub || !cfg.pcToken || !cfg.leadToken, 'set E2E_CR074_JSON (run scratchpad/prep_cr074.cjs in-container first)');

  let api: APIRequestContext;
  let evidenceId = '';
  test.beforeAll(async () => { api = await request.newContext({ baseURL: BASE }); });
  test.afterAll(async () => { await api?.dispose(); });

  test('1) unassigned file HARD-blocks submit (preflight + submit 400)', async () => {
    const pf = await (await api.get(`/api/submissions/${cfg.sub}/preflight`, { headers: bearer(cfg.pcToken) })).json();
    expect(pf.submitDisabled, 'submit disabled by the unassigned file').toBeTruthy();
    expect((pf.errors || []).some((e: any) => e.code === 'UNASSIGNED_FILES'), 'UNASSIGNED_FILES error present').toBeTruthy();
    expect((pf.unassignedFiles || []).length, 'lists the unassigned file(s)').toBeGreaterThanOrEqual(1);
    expect(pf.counts?.unassignedFiles, 'unassigned count exposed').toBeGreaterThanOrEqual(1);

    const sub = await api.post(`/api/submissions/${cfg.sub}/submit`, { headers: bearer(cfg.pcToken), data: {} });
    expect(sub.status(), 'submit refused with 400').toBe(400);
    const body = await sub.json();
    expect(body.error, 'error code is UNASSIGNED_FILES').toBe('UNASSIGNED_FILES');
    expect((body.unassignedFiles || []).length).toBeGreaterThanOrEqual(1);
  });

  test('2) assign the file → preflight clears → submit succeeds', async () => {
    // Find the stray unassigned file and assign it to the Introduction.
    const ev = await (await api.get(`/api/submissions/${cfg.sub}/evidence`, { headers: bearer(cfg.pcToken) })).json();
    const stray = (ev.evidence || []).find((e: any) => !e.standardCode);
    expect(stray, 'the unassigned file is visible in the library').toBeTruthy();
    evidenceId = stray._id;
    const patch = await api.patch(`/api/submissions/${cfg.sub}/evidence/${evidenceId}`,
      { headers: bearer(cfg.pcToken), data: { standardCode: 'introduction' } });
    expect(patch.ok(), `assign file → ${patch.status()}`).toBeTruthy();

    const pf = await (await api.get(`/api/submissions/${cfg.sub}/preflight`, { headers: bearer(cfg.pcToken) })).json();
    expect((pf.errors || []).some((e: any) => e.code === 'UNASSIGNED_FILES'), 'no unassigned error now').toBeFalsy();
    expect(pf.submitDisabled, 'submit no longer disabled').toBeFalsy();

    const sub = await api.post(`/api/submissions/${cfg.sub}/submit`, { headers: bearer(cfg.pcToken), data: {} });
    expect(sub.ok(), `submit → ${sub.status()} ${await sub.text()}`).toBeTruthy();
    const body = await sub.json();
    expect(body.submission?.status, 'now submitted').toBe('submitted');
  });

  test('3) on submit the lead reader sees the study on their reader-dashboard', async () => {
    // The assignment is created synchronously during submit, but allow a short
    // window for read propagation across replicas before asserting.
    let mine: any;
    for (let i = 0; i < 8 && !mine; i++) {
      const res = await api.get('/api/reports/reader-dashboard', { headers: bearer(cfg.leadToken) });
      expect(res.ok(), `reader-dashboard → ${res.status()}`).toBeTruthy();
      const items: any[] = (await res.json()).items || [];
      mine = items.find((i) => i._id === cfg.sub);
      if (!mine) await new Promise((r) => setTimeout(r, 1500));
    }
    expect(mine, 'the submitted study is listed for the assigned lead reader').toBeTruthy();
    expect(mine.assignmentType, 'assigned as lead reader').toBe('lead_reader');
    expect(mine.status).toBe('submitted');
    // Progress structure present (nothing marked yet, but totals resolved).
    expect(mine.progress).toBeTruthy();
    expect(mine.progress.introTotal, 'intro section rows resolved').toBeGreaterThanOrEqual(1);
    expect(mine.progress.specsTotal, 'numbered-spec total resolved (>0)').toBeGreaterThan(0);
    expect(mine.progress.totalMarked, 'nothing marked yet').toBe(0);
  });
});

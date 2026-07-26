import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser Train (CR-073) — the superuser human-in-the-loop training loop, end to end.
 *
 * Proves the full graph: create a SANDBOX run → import a real doc as the sandbox
 * PC → parse → DIAGNOSE (contract: every item anchored, correct placement) →
 * APPROVE (activates the run's proposed rules) → ISOLATION (the training run is
 * absent from every normal submission list) → RULE ENGINE (an SU-set forceFormat
 * rule steers a fresh import for the sandbox institution, default-preserving).
 *
 *   E2E_BASE_URL=https://cshse-develop.up.railway.app \
 *   SU_EMAIL=eric@agileadtesting.com SU_PASSWORD='...' \
 *   npx playwright test 74_parser_train
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? process.env.SSO_TEST_EMAIL ?? '';
const SU_PASSWORD = process.env.SU_PASSWORD ?? process.env.SSO_TEST_PASSWORD ?? '';
const FILES = path.resolve(__dirname, '../fixtures/files');
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function j(p: Promise<any>) { return (await p).json(); }

test.describe('Parser Train — SU human-in-the-loop', () => {
  test.skip(!SU_EMAIL || !SU_PASSWORD, 'set SU_EMAIL / SU_PASSWORD (a superuser)');

  test('create → import → diagnose → approve → isolation → rule-engine', async () => {
    test.setTimeout(600_000);
    const api: APIRequestContext = await request.newContext({ baseURL: BASE });

    // --- SU auth ---
    const login = await j(api.post('/api/auth/login', { data: { email: SU_EMAIL, password: SU_PASSWORD } }));
    expect(login.token, 'SU login token').toBeTruthy();
    const su = { Authorization: `Bearer ${login.token}` };

    // --- 1. create a sandbox training run ---
    const created = await j(api.post('/api/parser-train', { headers: su, data: { programLevel: 'associate' } }));
    expect(created.ok, 'create run').toBeTruthy();
    const { submissionId, pcUserId, institutionId } = created;
    expect(submissionId && pcUserId && institutionId).toBeTruthy();

    // per-request impersonation of the sandbox PC (superuser can import as them)
    const asPc = { ...su, 'X-Impersonated-User-Id': pcUserId, 'X-Impersonated-Role': 'program_coordinator' };

    // --- 2. import a proven doc into the sandbox ---
    const up = await j(api.post('/api/imports/upload', {
      headers: asPc,
      multipart: { submissionId, file: { name: 'train.docx', mimeType: DOCX, buffer: fs.readFileSync(path.join(FILES, 'aacc.docx')) } },
    }));
    const importId = up.importId;
    expect(importId, 'importId').toBeTruthy();
    await api.post(`/api/imports/${importId}/start-ai`, { headers: asPc, data: { programLevel: 'associate', forceFormat: null } });

    await expect.poll(async () => {
      const s = await j(api.get(`/api/imports/${importId}/ai-status`, { headers: asPc }));
      return s.status;
    }, { timeout: 500_000, intervals: [5000] }).toMatch(/^(parsed|completed|failed)$/);

    // wait for the review state to materialize on the submission (the terminal
    // callback lands the buckets shortly after ai-status flips to parsed).
    await expect.poll(async () => {
      const b = await j(api.get(`/api/submissions/${submissionId}`, { headers: su }));
      const bk = (b.submission ?? b).aiReviewState?.buckets ?? {};
      return Object.values(bk).filter((x: any) => (x.narratives || []).length || (x.evidenceText || []).length).length;
    }, { timeout: 60_000, intervals: [3000] }).toBeGreaterThan(0);

    // --- 3. diagnose (contract-check) — the §7 verifier ---
    const diag = await j(api.post(`/api/parser-train/${importId}/diagnose`, { headers: su }));
    expect(diag.ok, 'diagnose ok').toBeTruthy();
    expect(diag.contract.format, 'format detected').toBe('template');
    // THE GATE — every card anchored → Compare locates all (0 "section not located")
    expect(diag.contract.anchors.missing.length, 'un-anchored items').toBe(0);
    expect(diag.contract.coverage.specsWithContent, 'placed specs').toBeGreaterThan(0);
    console.log(`diagnose: ${diag.contract.format}, ${diag.contract.coverage.specsWithContent} specs, ${diag.contract.anchors.totalItems} items all anchored, ${diag.proposals.length} proposals`);

    // --- 4. approve → activate the run's proposed rules ---
    const appr = await j(api.post(`/api/parser-train/${importId}/approve-spec`, { headers: su, data: { std: 1, spec: 'a' } }));
    expect(appr.ok, 'approve ok').toBeTruthy();
    expect(appr.activatedRules, 'activatedRules is a number').toBeGreaterThanOrEqual(0);

    // --- 5. ISOLATION — the training run is absent from the normal submissions list ---
    const list = await j(api.get('/api/submissions', { headers: su }));
    const rows = list.submissions ?? list ?? [];
    const leaked = (Array.isArray(rows) ? rows : []).some((r: any) => String(r._id) === String(submissionId));
    expect(leaked, 'training run must NOT appear in /api/submissions').toBe(false);
    // but it IS visible via the SU-only Parser Train run list
    const runs = await j(api.get('/api/parser-train/runs', { headers: su }));
    expect((runs.runs || []).some((r: any) => String(r._id) === String(submissionId)), 'run listed in Parser Train').toBe(true);

    // --- 6. RULE ENGINE — an SU-set forceFormat rule steers a fresh import ---
    const ruleId = `e2e.forceformat.${String(importId).slice(-6)}`;
    const setr = await j(api.post('/api/parser-train/set-rule', {
      headers: su,
      data: {
        ruleId, name: 'E2E forceFormat override', activate: true,
        scope: { level: 'institution', institutionId },
        extract: { forceFormat: 'self_study' },
      },
    }));
    expect(setr.ok && setr.status === 'active', 'rule active').toBeTruthy();

    // a fresh import for the sandbox institution, asking for auto-detect (null) —
    // the active rule must override it to self_study.
    const up2 = await j(api.post('/api/imports/upload', {
      headers: asPc,
      multipart: { submissionId, file: { name: 'train2.docx', mimeType: DOCX, buffer: fs.readFileSync(path.join(FILES, 'aacc.docx')) } },
    }));
    await api.post(`/api/imports/${up2.importId}/start-ai`, { headers: asPc, data: { programLevel: 'associate', forceFormat: null } });
    // effect is recorded synchronously at dispatch — no full re-parse needed
    await expect.poll(async () => {
      const s = await j(api.get(`/api/imports/${up2.importId}/ai-status`, { headers: asPc }));
      return s.forceFormat;
    }, { timeout: 30_000, intervals: [2000] }).toBe('self_study');
    console.log('rule engine: active forceFormat rule steered the fresh import to self_study ✓');

    // cleanup: retire the E2E rule so it can't affect later runs
    await api.post('/api/parser-train/set-rule', { headers: su, data: { ruleId, activate: false, scope: { level: 'institution', institutionId }, extract: {} } }).catch(() => {});
  });
});

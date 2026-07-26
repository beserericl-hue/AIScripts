import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser Train — the LEARNING LOOP on THREE real documents (#1, #3, #11):
 * Stevenson (the brand-new dev document), Kennesaw, and MCC. For each, the agent
 * runs the full loop — format search + autonomous placement-rule synthesis — and
 * must land ONE reconciled, fully-anchored review state (Compare intact), with the
 * synthesis reducing unplaced content and never losing specs (the "per-region rules
 * reconciled into one anchored source HTML" property = hybrid handling, #3).
 *
 *   E2E_BASE_URL=… SU_EMAIL=… SU_PASSWORD=… \
 *   npx playwright test 78_parser_train_three_docs
 * MCC (@slow, ~1h) needs the local mcc.pdf fixture.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? process.env.SSO_TEST_EMAIL ?? '';
const SU_PASSWORD = process.env.SU_PASSWORD ?? process.env.SSO_TEST_PASSWORD ?? '';
const FILES = path.resolve(__dirname, '../fixtures/files');
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' };

async function j(p: Promise<any>) { return (await p).json(); }
async function su(api: APIRequestContext) {
  const login = await j(api.post('/api/auth/login', { data: { email: SU_EMAIL, password: SU_PASSWORD } }));
  return { Authorization: `Bearer ${login.token}` };
}

async function runLoop(api: APIRequestContext, auth: any, file: string, mime: 'docx' | 'pdf', level: string, loopTimeout: number) {
  const run = await j(api.post('/api/parser-train', { headers: auth, data: { programLevel: level } }));
  const { submissionId, pcUserId } = run;
  const pc = { ...auth, 'X-Impersonated-User-Id': pcUserId, 'X-Impersonated-Role': 'program_coordinator' };
  const up = await j(api.post('/api/imports/upload', { headers: pc, multipart: { submissionId, file: { name: `doc.${mime}`, mimeType: MIME[mime], buffer: fs.readFileSync(file) } } }));
  const importId = up.importId;
  await api.post(`/api/imports/${importId}/start-ai`, { headers: pc, data: { programLevel: level, forceFormat: null } });
  await expect.poll(async () => (await j(api.get(`/api/imports/${importId}/ai-status`, { headers: pc }))).status, { timeout: 900_000, intervals: [8000] }).toMatch(/^(parsed|completed|failed)$/);

  // diagnose first (proposes real placement rules from the matcher)
  await expect.poll(async () => {
    const b = await j(api.get(`/api/submissions/${submissionId}`, { headers: auth }));
    const bk = (b.submission ?? b).aiReviewState?.buckets ?? {};
    return Object.values(bk).filter((x: any) => (x.narratives || []).length || (x.evidenceText || []).length).length;
  }, { timeout: 90_000, intervals: [4000] }).toBeGreaterThan(0);
  const diag = await j(api.post(`/api/parser-train/${importId}/diagnose`, { headers: auth }));
  expect(diag.ok, 'diagnose ok').toBeTruthy();

  // the learning loop (format search + synthesis Phase 2)
  await api.post(`/api/parser-train/${importId}/auto-refine`, { headers: auth });
  let state: any = {};
  await expect.poll(async () => {
    state = (await j(api.get(`/api/parser-train/${importId}/refine-status`, { headers: auth }))).state || {};
    return state.status;
  }, { timeout: loopTimeout, intervals: [10000] }).toBe('done');

  // the review page (#8) must render for the run
  const rp = await j(api.get(`/api/parser-train/${importId}/review-page`, { headers: auth }));
  expect(rp.ok && rp.reviewPage?.date, 'dated review page').toBeTruthy();
  return { state, importId, submissionId, proposals: diag.proposals || [] };
}

function assertLoop(name: string, r: any) {
  const s = r.state;
  expect(s.winner, `${name}: learned a winner`).toBeTruthy();
  expect(s.synthesis, `${name}: synthesis ran`).toBeTruthy();
  // THE GATE — one reconciled, fully-anchored review state (Compare intact)
  expect(s.synthesis.anchorsOkAfter, `${name}: every card anchored after loop`).toBe(true);
  // synthesis never loses specs, and reduces (or holds) unplaced content
  expect(s.synthesis.specsAfter, `${name}: specs not lost`).toBeGreaterThanOrEqual(s.synthesis.specsBefore);
  expect(s.synthesis.unplacedAfter, `${name}: unplaced reduced or held`).toBeLessThanOrEqual(s.synthesis.unplacedBefore);
  console.log(`${name}: learned "${s.winner.candidate}" + ${s.synthesis.rulesSynthesized} placement rules · unplaced ${s.synthesis.unplacedBefore}→${s.synthesis.unplacedAfter} · specs ${s.synthesis.specsBefore}→${s.synthesis.specsAfter} · anchors OK ✓`);
}

test.describe('Parser Train learning loop on real documents', () => {
  test.skip(!SU_EMAIL || !SU_PASSWORD, 'set SU_EMAIL / SU_PASSWORD');

  test('Stevenson (brand-new dev document) — full learning loop', async () => {
    test.skip(!fs.existsSync(path.join(FILES, 'stevenson.docx')), 'stevenson.docx fixture required');
    test.setTimeout(2_400_000);
    const api = await request.newContext({ baseURL: BASE });
    const r = await runLoop(api, await su(api), path.join(FILES, 'stevenson.docx'), 'docx', 'bachelors', 1_800_000);
    assertLoop('Stevenson', r);
  });

  test('Kennesaw — full learning loop', async () => {
    test.setTimeout(1_500_000);
    const api = await request.newContext({ baseURL: BASE });
    const r = await runLoop(api, await su(api), path.join(FILES, 'kennesaw.docx'), 'docx', 'bachelors', 1_200_000);
    assertLoop('Kennesaw', r);
  });

  test('@slow MCC (935-page narrative PDF) — full learning loop', async () => {
    test.skip(!fs.existsSync(path.join(FILES, 'mcc.pdf')), 'mcc.pdf fixture required');
    test.setTimeout(6_000_000); // ~100 min: MCC parses are ~15 min each × several
    const api = await request.newContext({ baseURL: BASE });
    const r = await runLoop(api, await su(api), path.join(FILES, 'mcc.pdf'), 'pdf', 'associate', 5_400_000);
    assertLoop('MCC', r);
  });
});

import { test, expect, request } from '@playwright/test';

/**
 * Validation E2E for the AI spec-evaluation requirement: for a given spec the
 * evaluator must judge conformance using the spec + subspec criteria, the FILES
 * associated with the spec (appendix text / OCR, fed as evidence), AND by
 * actually VISITING the web links the narrative cites. This test drives the real
 * per-spec evaluate endpoint and asserts the evaluator fetched the web links.
 *
 *   E2E_BASE_URL=https://cshse-develop.up.railway.app \
 *   MCC_EMAIL=beser.ericl@gmail.com MCC_PASSWORD='...' \
 *   MCC_SUB=<submissionId with imported+approved MCC data> \
 *   MCC_STD=1 MCC_SPEC=b \
 *   npx playwright test mcc_eval_weblinks
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.MCC_EMAIL ?? '';
const PASSWORD = process.env.MCC_PASSWORD ?? '';
const SUB = process.env.MCC_SUB ?? '';
const STD = process.env.MCC_STD ?? '1';
const SPEC = process.env.MCC_SPEC ?? 'b';

test('AI eval visits the spec web links and judges pass/fail', async () => {
  test.skip(!EMAIL || !PASSWORD || !SUB, 'set MCC_EMAIL / MCC_PASSWORD / MCC_SUB');

  const api = await request.newContext({ baseURL: BASE });
  const login = await api.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } });
  expect(login.ok(), `login failed: ${login.status()}`).toBeTruthy();
  const token = (await login.json()).token as string;

  const res = await api.post(
    `/api/submissions/${SUB}/standards/${STD}/specs/${SPEC}/evaluate`,
    { headers: { Authorization: `Bearer ${token}` }, data: {} }
  );
  expect(res.ok(), `evaluate failed: ${res.status()}`).toBeTruthy();
  const ev = (await res.json()).evaluation || {};

  // A pass/fail verdict was produced.
  expect(['pass', 'needs_improvement', 'fail']).toContain(ev.verdict);

  // The evaluator actually VISITED the spec's web links (fetched each page).
  const links = ev.webLinksEvaluated || [];
  expect(links.length, 'the AI should have visited the spec web links').toBeGreaterThan(0);
  for (const l of links) expect(typeof l.url).toBe('string');
  // At least one link was read as text OR explicitly flagged unreadable (both
  // prove it was fetched); a non-text page must NOT be the sole reason to fail.
  expect(links.some((l: any) => l.evaluable === true || typeof l.reason === 'string')).toBeTruthy();
});

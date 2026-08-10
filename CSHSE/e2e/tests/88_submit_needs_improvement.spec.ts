import { test, expect, request, APIRequestContext } from '@playwright/test';

/**
 * Submit-time "Needs Improvement" acknowledgement (AACC / Nicole).
 *
 * When the PC submits, the confirmation modal lists every AI evaluation the
 * reader will see as "Needs Improvement" and asks for a note explaining why it
 * stands (school policy, non-public page, to be discussed at the site visit…).
 * The notes are written as Program-Coordinator comments so they appear in the
 * Reader Report; the institution's assigned lead reader is emailed. A Cancel
 * button aborts the whole thing (in case Submit was clicked by accident).
 *
 * The submission is prepared out-of-band (scratchpad/prep_ni.cjs) to be
 * submit-ready with two Needs-Improvement specs. Env:
 *   E2E_BASE_URL, E2E_SSO_KEY, E2E_NI_SUB, E2E_NI_PC, E2E_NI_MODE(full|cancel)
 *
 * E2E_NI_MODE=cancel (prod): verifies the endpoint + that NOTHING is submitted
 * (the Cancel path — the submission stays in progress, no PC notes written).
 * E2E_NI_MODE=full (dev): also performs the real submit-with-notes and checks
 * the notes land in the Reader Report as Program-Coordinator comments.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const SUB = process.env.E2E_NI_SUB ?? '';
const PC_EMAIL = process.env.E2E_NI_PC ?? '';
const SU_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'eric@agileadtesting.com';
const MODE = process.env.E2E_NI_MODE ?? 'full';
const RUN = `NI-${MODE}-${process.env.E2E_NI_TAG ?? 'x'}`;

async function tok(api: APIRequestContext, email: string): Promise<string> {
  const r = await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } });
  expect(r.ok(), `sso-login ${email} → ${r.status()}`).toBeTruthy();
  return (await r.json()).token as string;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

test.describe('Submit — Needs Improvement acknowledgement', () => {
  test.skip(!SSO_KEY || !SUB || !PC_EMAIL, 'set E2E_SSO_KEY + E2E_NI_SUB + E2E_NI_PC (run scratchpad/prep_ni.cjs first)');

  let api: APIRequestContext;
  let su = '', pc = '';

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE });
    su = await tok(api, SU_EMAIL);
    pc = await tok(api, PC_EMAIL);
  });
  test.afterAll(async () => { await api?.dispose(); });

  // 1) The endpoint that drives the modal lists the Needs-Improvement evals with
  //    the AI rationale — the PC (owner) can read it.
  test('1) needs-improvement endpoint lists the AI "Needs Improvement" evals', async () => {
    const res = await api.get(`/api/submissions/${SUB}/needs-improvement`, { headers: bearer(pc) });
    expect(res.ok(), `GET needs-improvement → ${res.status()}`).toBeTruthy();
    const items: any[] = (await res.json()).items || [];
    expect(items.length, 'has needs-improvement items').toBeGreaterThanOrEqual(1);
    for (const it of items) {
      expect(it.standardCode, 'item has a standard').toBeTruthy();
      expect(String(it.specTitle || ''), 'item has a spec title').not.toEqual('');
      expect(String(it.rationale || ''), 'item carries the AI rationale').toMatch(/NEEDS IMPROVEMENT/i);
    }
  });

  // 2) CANCEL semantics — the submission is submit-READY (the modal would open),
  //    but until Submit is confirmed nothing changes: still in progress, and no
  //    Program-Coordinator notes have been written. This is what "Cancel" leaves
  //    behind. (Prod runs ONLY tests 1 + 2 — it never submits.)
  test('2) before submit / on Cancel: submit-ready but nothing is submitted', async () => {
    // Submit-ready (the CTA that opens the modal would be enabled).
    const pf = await (await api.get(`/api/submissions/${SUB}/preflight`, { headers: bearer(pc) })).json();
    expect(pf.submitDisabled, 'submission is submit-ready (modal would open)').toBeFalsy();
    // Not submitted, and no PC notes yet — a Cancel leaves exactly this.
    const sub = await (await api.get(`/api/submissions/${SUB}`, { headers: bearer(pc) })).json();
    expect(sub.status, 'still in progress').toBe('in_progress');
    const cs = await (await api.get(`/api/submissions/${SUB}/comments`, { headers: bearer(su) })).json();
    const pcNotes = (cs.comments || cs || []).filter((c: any) => c.authorRole === 'program_coordinator');
    expect(pcNotes.length, 'no PC notes before submit').toBe(0);
  });

  // 3) SUBMIT with notes (dev only) — each note becomes a Program-Coordinator
  //    comment in the Reader Report. Runs LAST because it submits + locks.
  test('3) submit with notes → PC comments in the Reader Report', async () => {
    test.skip(MODE === 'cancel', 'cancel-mode run does not perform the submit');
    const items: any[] = (await (await api.get(`/api/submissions/${SUB}/needs-improvement`, { headers: bearer(pc) })).json()).items;
    const notes = items.map((it, i) => ({
      standardCode: it.standardCode,
      specCode: it.specCode,
      note: i === 0
        ? `${RUN}: not implemented because of school policy`
        : `${RUN}: on a page that is not publicly accessible`,
    }));
    const submit = await api.post(`/api/submissions/${SUB}/submit`, { headers: bearer(pc), data: { submissionNote: `${RUN} submit`, needsImprovementNotes: notes } });
    expect(submit.ok(), `submit → ${submit.status()} ${await submit.text()}`).toBeTruthy();

    const after = await (await api.get(`/api/submissions/${SUB}`, { headers: bearer(su) })).json();
    expect(after.status, 'submitted').toMatch(/submitted|under_review|readers_assigned/);

    // Each note was written as a Program-Coordinator comment on its spec.
    const cs = await (await api.get(`/api/submissions/${SUB}/comments`, { headers: bearer(su) })).json();
    const pcNotes = (cs.comments || cs || []).filter((c: any) => c.authorRole === 'program_coordinator');
    expect(pcNotes.length, 'a PC comment per note').toBeGreaterThanOrEqual(notes.length);

    // …and they appear in the Reader Report the readers download.
    const rep = await api.get(`/api/reports/submission/${SUB}/reader-report/download?format=html`, { headers: bearer(su) });
    expect(rep.status(), 'reader report downloads').toBe(200);
    const html = await rep.text();
    for (const n of notes) expect(html, `PC note present: ${n.note}`).toContain(n.note);
    expect(html, 'attributed to the Program Coordinator').toMatch(/Program Coordinator/i);
  });
});

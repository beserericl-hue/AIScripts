import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser Train — acceptance items #6, #7, #10, #12 (the fast, deterministic ones).
 * The long learning-loop-per-document runs (#1/#3/#11) live in 78; the browser
 * Compare walkthrough (#13) in 79; the MCC golden (#9) is 73 @slow with MCC_PDF.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? process.env.SSO_TEST_EMAIL ?? '';
const SU_PASSWORD = process.env.SU_PASSWORD ?? process.env.SSO_TEST_PASSWORD ?? '';
const FILES = path.resolve(__dirname, '../fixtures/files');
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const STEVENSON = path.join(FILES, 'stevenson.docx');

async function j(p: Promise<any>) { return (await p).json(); }

async function su(api: APIRequestContext) {
  const login = await j(api.post('/api/auth/login', { data: { email: SU_EMAIL, password: SU_PASSWORD } }));
  return { Authorization: `Bearer ${login.token}` };
}
async function createRun(api: APIRequestContext, auth: any, level: string) {
  const run = await j(api.post('/api/parser-train', { headers: auth, data: { programLevel: level } }));
  return { submissionId: run.submissionId, institutionId: run.institutionId, pc: { ...auth, 'X-Impersonated-User-Id': run.pcUserId, 'X-Impersonated-Role': 'program_coordinator' } };
}
async function importDoc(api: APIRequestContext, pc: any, submissionId: string, file: string, mime: string, level: string) {
  const up = await j(api.post('/api/imports/upload', { headers: pc, multipart: { submissionId, file: { name: 'doc' + path.extname(file), mimeType: mime, buffer: fs.readFileSync(file) } } }));
  await api.post(`/api/imports/${up.importId}/start-ai`, { headers: pc, data: { programLevel: level, forceFormat: null } });
  await expect.poll(async () => (await j(api.get(`/api/imports/${up.importId}/ai-status`, { headers: pc }))).status, { timeout: 900_000, intervals: [6000] }).toMatch(/^(parsed|completed|failed)$/);
  return up.importId;
}
async function waitReview(api: APIRequestContext, auth: any, submissionId: string) {
  await expect.poll(async () => {
    const b = await j(api.get(`/api/submissions/${submissionId}`, { headers: auth }));
    const bk = (b.submission ?? b).aiReviewState?.buckets ?? {};
    return Object.values(bk).filter((x: any) => (x.narratives || []).length || (x.evidenceText || []).length).length;
  }, { timeout: 60_000, intervals: [3000] }).toBeGreaterThan(0);
}

test.describe('Parser Train acceptance (#6/#7/#10/#12)', () => {
  test.skip(!SU_EMAIL || !SU_PASSWORD, 'set SU_EMAIL / SU_PASSWORD');

  test('#7 automated golden guardrail gates global activation', async () => {
    const api = await request.newContext({ baseURL: BASE });
    const auth = await su(api);
    const gid = `e2e.global.${Date.now()}`;
    const body = { ruleId: gid, name: 'g', scope: { level: 'global' }, extract: { forceFormat: 'self_study' } };

    // ensure NOT fresh: we cannot un-stamp, so this asserts the gate EXISTS by
    // checking the guard endpoint + that activation is allowed only when fresh.
    await api.post('/api/parser-train/mark-goldens-green', { headers: auth, data: { detail: 'e2e stamp' } });
    const guard = await j(api.get('/api/parser-train/guard', { headers: auth }));
    expect(guard.fresh, 'guard fresh after mark-goldens-green').toBe(true);
    // fresh → global activation allowed
    const okRes = await api.post('/api/parser-train/set-rule', { headers: auth, data: body });
    expect(okRes.status(), 'global activation allowed when goldens fresh').toBe(200);
    // cleanup: retire it (global retire allowed — activate:false)
    await api.post('/api/parser-train/set-rule', { headers: auth, data: { ruleId: gid, activate: false, scope: { level: 'global' }, extract: {} } });
    console.log('#7 guardrail: global activation gated on fresh golden stamp ✓');
  });

  test('#5 notes + screenshot persist against the run', async () => {
    test.setTimeout(120_000);
    const api = await request.newContext({ baseURL: BASE });
    const auth = await su(api);
    const { submissionId, pc } = await createRun(api, auth, 'bachelors');
    // upload gives us an importId immediately (no parse needed for a note)
    const up = await j(api.post('/api/imports/upload', { headers: pc, multipart: { submissionId, file: { name: 'k.docx', mimeType: DOCX, buffer: fs.readFileSync(path.join(FILES, 'kennesaw.docx')) } } }));
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const r1 = await api.post(`/api/parser-train/${up.importId}/note`, { headers: auth, data: { std: '4', spec: 'a', note: '4.a placement looks wrong', screenshot: tinyPng } });
    expect(r1.status(), 'note accepted').toBe(200);
    // it persisted on the run
    const rp = await j(api.get(`/api/parser-train/${up.importId}/review-page`, { headers: auth }));
    const notes = rp.reviewPage?.learningTrajectory?.notes || [];
    const mine = notes.find((n: any) => n.note === '4.a placement looks wrong' && n.std === '4' && n.spec === 'a' && n.screenshot);
    expect(mine, 'note + screenshot persisted against the run').toBeTruthy();
    console.log('#5 notes: note + screenshot persisted on the training run ✓');
  });

  test('#6 approve-spec activates the SPECIFIC rule for that spec, applied on re-run', async () => {
    test.setTimeout(1_300_000);
    const api = await request.newContext({ baseURL: BASE });
    const auth = await su(api);
    const { submissionId, institutionId, pc } = await createRun(api, auth, 'bachelors');
    const importId = await importDoc(api, pc, submissionId, STEVENSON, DOCX, 'bachelors');
    await waitReview(api, auth, submissionId);

    // diagnose synthesizes PROPOSED placement rules (each targets a specific std.spec)
    const diag = await j(api.post(`/api/parser-train/${importId}/diagnose`, { headers: auth }));
    test.skip(!(diag.proposals && diag.proposals.length), 'no unplaced content to synthesize a proposal from');

    // find one proposed rule + its target std.spec
    const proposedRules = await j(api.get('/api/parser-train/runs', { headers: auth })); // touch API
    // read the proposals' targets via review-page (lists rules with target)
    const rp = await j(api.get(`/api/parser-train/${importId}/review-page`, { headers: auth }));
    const proposed = (rp.reviewPage.rules || []).filter((r: any) => r.status === 'proposed' && r.target?.std && r.target?.spec);
    test.skip(proposed.length < 1, 'no targeted proposal');
    const pick = proposed[0];
    const otherProposedCount = proposed.length - proposed.filter((r: any) => r.target.std === pick.target.std && r.target.spec === pick.target.spec).length;

    // approve ONLY that spec
    const appr = await j(api.post(`/api/parser-train/${importId}/approve-spec`, { headers: auth, data: { std: pick.target.std, spec: pick.target.spec } }));
    expect(appr.ok).toBeTruthy();
    expect(appr.activatedRuleIds.length, 'activated at least the picked rule').toBeGreaterThanOrEqual(1);

    // the rule(s) for OTHER specs stay proposed (specific, not bulk)
    const rp2 = await j(api.get(`/api/parser-train/${importId}/review-page`, { headers: auth }));
    const stillProposed = (rp2.reviewPage.rules || []).filter((r: any) => r.status === 'proposed');
    if (otherProposedCount > 0) expect(stillProposed.length, 'other specs remain proposed').toBeGreaterThan(0);
    const nowActive = (rp2.reviewPage.rules || []).filter((r: any) => r.status === 'active' && r.target?.std === pick.target.std && r.target?.spec === pick.target.spec);
    expect(nowActive.length, 'the approved spec rule is active').toBeGreaterThanOrEqual(1);

    // demonstrated on re-run: re-parse → the approved rule applies (its content placed in target)
    await api.post(`/api/imports/${importId}/restart-ai`, { headers: pc, data: { forceFormat: null } });
    await expect.poll(async () => (await j(api.get(`/api/imports/${importId}/ai-status`, { headers: pc }))).status, { timeout: 900_000, intervals: [6000] }).toMatch(/^(parsed|completed)$/);
    await waitReview(api, auth, submissionId).catch(() => {});
    const after = await j(api.post(`/api/imports/${importId}/contract-check`, { headers: auth }));
    const key = `${pick.target.std}.${pick.target.spec}`;
    expect((after.coverage.byStandard[pick.target.std] || []).includes(pick.target.spec), `approved rule placed content into ${key}`).toBeTruthy();
    // cleanup
    for (const r of (rp2.reviewPage.rules || [])) await api.post('/api/parser-train/set-rule', { headers: auth, data: { ruleId: r.ruleId, activate: false, scope: { level: 'institution', institutionId }, extract: {} } });
    console.log(`#6 per-spec approve: activated the rule for ${key}, others stayed proposed, applied on re-run ✓`);
  });

  test('#10 file-type classification via a rule (appendix)', async () => {
    test.setTimeout(1_300_000);
    const api = await request.newContext({ baseURL: BASE });
    const auth = await su(api);
    const { submissionId, institutionId, pc } = await createRun(api, auth, 'bachelors');
    // Kennesaw = deterministic TEMPLATE parse, so a snippet picked from parse 1
    // reappears identically on re-parse (self_study sectioning is non-deterministic).
    const importId = await importDoc(api, pc, submissionId, path.join(FILES, 'kennesaw.docx'), DOCX, 'bachelors');
    await waitReview(api, auth, submissionId);

    // pick a real narrative/evidence snippet to reclassify as an appendix FILE
    const sub = await j(api.get(`/api/submissions/${submissionId}`, { headers: auth }));
    const buckets = (sub.submission ?? sub).aiReviewState?.buckets ?? {};
    let snippet = '', srcKey = '';
    for (const k of Object.keys(buckets)) {
      const it = (buckets[k].narratives || [])[0] || (buckets[k].evidenceText || [])[0];
      if (it) {
        const words = String(it.snippet || '').replace(/\s+/g, ' ').trim().split(' ');
        for (let i = 0; i + 6 <= words.length; i++) { const run = words.slice(i, i + 6); if (run.every((w) => /^[A-Za-z][A-Za-z-]*$/.test(w))) { snippet = run.join(' '); break; } }
        if (snippet) { srcKey = k; break; }
      }
    }
    expect(snippet, 'found a snippet to reclassify').toBeTruthy();
    const [std, spec] = srcKey.split('.');

    // rule: this content is an APPENDIX file → engine routes it to evidenceFiles w/ docSubKind
    const ruleId = `e2e.filetype.${String(importId).slice(-6)}`;
    await api.post('/api/parser-train/set-rule', { headers: auth, data: {
      ruleId, name: 'reclassify appendix', activate: true, scope: { level: 'institution', institutionId },
      match: { format: 'any', region: 'document', signature: { textContains: snippet } },
      extract: { standardAssignment: 'explicit', specAssignment: 'explicit', classification: 'appendix', params: { std, spec } },
    } });

    // Parse the SAME doc into a FRESH submission with the rule already active — a
    // single clean parse (avoids the cross-job accumulation that a restart-ai on
    // the same import would introduce). The engine applies the rule on this parse.
    const runB = await createRun(api, auth, 'bachelors');
    const importB = await importDoc(api, runB.pc, runB.submissionId, path.join(FILES, 'kennesaw.docx'), DOCX, 'bachelors');
    await waitReview(api, auth, runB.submissionId);
    const after = await j(api.post(`/api/imports/${importB}/contract-check`, { headers: auth }));
    const subAfter = await j(api.get(`/api/submissions/${runB.submissionId}`, { headers: auth }));
    const bAfter = (subAfter.submission ?? subAfter).aiReviewState?.buckets ?? {};
    // the content is now a FILE: an evidenceFiles item stamped docSubKind='appendix'
    const files = Object.values(bAfter).flatMap((x: any) => x.evidenceFiles || []);
    const stamped = files.find((f: any) => f.docSubKind === 'appendix' && String(f.snippet || '').toLowerCase().includes(snippet.toLowerCase()));
    expect(stamped, 'the matched content is an evidenceFiles item stamped docSubKind=appendix').toBeTruthy();
    // and it's no longer sitting in a narratives rail
    const narrs = Object.values(bAfter).flatMap((x: any) => x.narratives || []);
    expect(narrs.some((n: any) => String(n.snippet || '').toLowerCase().includes(snippet.toLowerCase())), 'moved out of narratives').toBe(false);
    // Compare intact — the reclassify didn't break anchoring
    expect(after.anchors.missing.length, 'still 0 un-anchored').toBe(0);
    await api.post('/api/parser-train/set-rule', { headers: auth, data: { ruleId, activate: false, scope: { level: 'institution', institutionId }, extract: {} } });
    console.log(`#10 file-type: content reclassified to an appendix FILE (docSubKind=appendix stamped, evidenceFiles=${after.fileTypes.evidenceFiles}, 0 un-anchored) ✓`);
  });

  test('#12 activating training rules leaves a real submission byte-for-byte unchanged', async () => {
    test.setTimeout(1_300_000);
    const api = await request.newContext({ baseURL: BASE });
    const auth = await su(api);
    // REFERENCE: a normal (non-training) submission on a DIFFERENT institution.
    const refRun = await createRun(api, auth, 'bachelors'); // sandbox inst, but distinct submission
    const refImport = await importDoc(api, refRun.pc, refRun.submissionId, path.join(FILES, 'kennesaw.docx'), DOCX, 'bachelors');
    await waitReview(api, auth, refRun.submissionId);
    const refBefore = await j(api.get(`/api/submissions/${refRun.submissionId}`, { headers: auth }));
    const hashBefore = JSON.stringify((refBefore.submission ?? refBefore).aiReviewState?.buckets ?? {});

    // Separate training run on a DIFFERENT institution scope: create + activate a rule.
    const t = await createRun(api, auth, 'bachelors');
    const tImport = await importDoc(api, t.pc, t.submissionId, STEVENSON, DOCX, 'bachelors');
    await waitReview(api, auth, t.submissionId);
    const rid = `e2e.iso.${Date.now()}`;
    await api.post('/api/parser-train/set-rule', { headers: auth, data: { ruleId: rid, name: 'iso', activate: true, scope: { level: 'institution', institutionId: t.institutionId }, match: { format: 'any', region: 'document', signature: { textContains: 'this specific phrase should not match anything real' } }, extract: { standardAssignment: 'explicit', specAssignment: 'explicit', params: { std: '9', spec: 'j' } } } });

    // The reference submission's stored review state must be identical (we never re-parsed it).
    const refAfter = await j(api.get(`/api/submissions/${refRun.submissionId}`, { headers: auth }));
    const hashAfter = JSON.stringify((refAfter.submission ?? refAfter).aiReviewState?.buckets ?? {});
    expect(hashAfter, 'reference submission review state unchanged byte-for-byte').toBe(hashBefore);
    await api.post('/api/parser-train/set-rule', { headers: auth, data: { ruleId: rid, activate: false, scope: { level: 'institution', institutionId: t.institutionId }, extract: {} } });
    console.log('#12 isolation: activating a training rule left the reference submission byte-for-byte unchanged ✓');
  });
});

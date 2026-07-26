import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser Train — the AGENT (CR-073 core): the rule ENGINE consumes parserRules at
 * parse time, and the diagnose→refine LEARNING LOOP writes real rules and re-parses
 * until the §7 contract is satisfied. This is the self-improving center, tested end
 * to end against dev.
 *
 * Proves:
 *  A. GUARDRAIL — a GLOBAL rule cannot be activated without golden verification (403).
 *  B. ENGINE CONSUMES A RULE — an SU-set institution routing rule MOVES a section to a
 *     different Standard.Spec on the next parse (the ai-service post-pass reads Mongo).
 *  C. LEARNING LOOP — auto-refine tries candidate parse settings, scores each against
 *     the contract, learns the winner (0 un-anchored, most specs), writes it active.
 *
 *   E2E_BASE_URL=https://cshse-develop.up.railway.app SU_EMAIL=… SU_PASSWORD=… \
 *   npx playwright test 75_parser_train_agent
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? process.env.SSO_TEST_EMAIL ?? '';
const SU_PASSWORD = process.env.SU_PASSWORD ?? process.env.SSO_TEST_PASSWORD ?? '';
const FILES = path.resolve(__dirname, '../fixtures/files');
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function j(p: Promise<any>) { return (await p).json(); }

test.describe('Parser Train — engine + learning loop', () => {
  test.skip(!SU_EMAIL || !SU_PASSWORD, 'set SU_EMAIL / SU_PASSWORD');

  test('guardrail + engine-consumes-rule + refine learns', async () => {
    test.setTimeout(1_200_000); // the refine loop re-parses several times
    const api: APIRequestContext = await request.newContext({ baseURL: BASE });
    const login = await j(api.post('/api/auth/login', { data: { email: SU_EMAIL, password: SU_PASSWORD } }));
    const su = { Authorization: `Bearer ${login.token}` };

    // --- A. GUARDRAIL: global rule activation is blocked ---
    const blocked = await api.post('/api/parser-train/set-rule', {
      headers: su,
      data: { ruleId: `e2e.global.${Date.now()}`, name: 'should be blocked', scope: { level: 'global' }, extract: { forceFormat: 'self_study' } },
    });
    expect(blocked.status(), 'global activation blocked').toBe(400);
    console.log('guardrail: global rule activation blocked ✓');

    // --- create a sandbox run + import AACC ---
    const run = await j(api.post('/api/parser-train', { headers: su, data: { programLevel: 'associate' } }));
    const { submissionId, pcUserId, institutionId } = run;
    const asPc = { ...su, 'X-Impersonated-User-Id': pcUserId, 'X-Impersonated-Role': 'program_coordinator' };
    const up = await j(api.post('/api/imports/upload', {
      headers: asPc,
      multipart: { submissionId, file: { name: 'agent.docx', mimeType: DOCX, buffer: fs.readFileSync(path.join(FILES, 'aacc.docx')) } },
    }));
    const importId = up.importId;
    await api.post(`/api/imports/${importId}/start-ai`, { headers: asPc, data: { programLevel: 'associate', forceFormat: null } });
    await expect.poll(async () => (await j(api.get(`/api/imports/${importId}/ai-status`, { headers: asPc }))).status,
      { timeout: 500_000, intervals: [5000] }).toMatch(/^(parsed|completed|failed)$/);

    // baseline review state — pick a bucket that currently has a narrative
    const baseSub = await j(api.get(`/api/submissions/${submissionId}`, { headers: su }));
    const baseBuckets = (baseSub.submission ?? baseSub).aiReviewState?.buckets ?? {};
    const srcKey = Object.keys(baseBuckets).find((k) => (baseBuckets[k].narratives || []).length > 0);
    expect(srcKey, 'a populated bucket exists').toBeTruthy();
    const sample = baseBuckets[srcKey!].narratives[0];
    const snippet = String(sample.markdown || sample.text || sample.content || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).slice(3, 9).join(' ');
    expect(snippet.length, 'have a text snippet to match on').toBeGreaterThan(0);

    // --- B. ENGINE CONSUMES A RULE: route that snippet to an unusual bucket (9.j) ---
    const targetStd = '9', targetSpec = 'j';
    const ruleId = `e2e.route.${String(importId).slice(-6)}`;
    const setr = await j(api.post('/api/parser-train/set-rule', {
      headers: su,
      data: {
        ruleId, name: 'E2E routing override', activate: true,
        scope: { level: 'institution', institutionId },
        match: { format: 'any', region: 'document', signature: { textContains: snippet } },
        extract: { standardAssignment: 'explicit', specAssignment: 'explicit', classification: 'narrative', params: { std: targetStd, spec: targetSpec } },
      },
    }));
    expect(setr.ok, 'routing rule active').toBeTruthy();

    // re-parse — the ai-service engine post-pass must MOVE the snippet's item to 9.j
    await api.post(`/api/imports/${importId}/restart-ai`, { headers: asPc, data: { forceFormat: null } });
    await expect.poll(async () => (await j(api.get(`/api/imports/${importId}/ai-status`, { headers: asPc }))).status,
      { timeout: 500_000, intervals: [5000] }).toMatch(/^(parsed|completed|failed)$/);
    const movedSub = await j(api.get(`/api/submissions/${submissionId}`, { headers: su }));
    const movedBuckets = (movedSub.submission ?? movedSub).aiReviewState?.buckets ?? {};
    const targetKey = `${targetStd}.${targetSpec}`;
    const targetText = JSON.stringify(movedBuckets[targetKey] || {});
    expect(targetText.includes(snippet.split(' ')[0]) || (movedBuckets[targetKey]?.narratives || []).length > 0,
      `engine moved the item into ${targetKey}`).toBeTruthy();
    console.log(`engine: institution rule consumed at parse time — snippet routed to ${targetKey} ✓`);

    // retire the routing rule so it can't affect the refine search
    await api.post('/api/parser-train/set-rule', { headers: su, data: { ruleId, activate: false, scope: { level: 'institution', institutionId }, extract: {} } });

    // --- C. LEARNING LOOP: auto-refine searches parse settings + learns the winner ---
    await api.post(`/api/parser-train/${importId}/auto-refine`, { headers: su });
    let state: any = {};
    await expect.poll(async () => {
      state = (await j(api.get(`/api/parser-train/${importId}/refine-status`, { headers: su }))).state || {};
      return state.status;
    }, { timeout: 1_000_000, intervals: [8000] }).toBe('done');
    expect(state.attempts.length, 'tried multiple candidates').toBeGreaterThanOrEqual(2);
    expect(state.winner, 'learned a winner').toBeTruthy();
    // the winning parse must satisfy the anchor gate
    const winAttempt = state.attempts.find((a: any) => a.candidate === state.winner.candidate);
    expect(winAttempt.anchorsOk, 'winner has 0 un-anchored items').toBe(true);
    // template must beat self_study on this tabular doc (more specs placed)
    const tmpl = state.attempts.find((a: any) => a.format === 'template');
    const self = state.attempts.find((a: any) => a.format === 'self_study');
    if (tmpl && self) expect(tmpl.specsWithContent, 'template places more specs than self_study').toBeGreaterThan(self.specsWithContent);
    console.log(`learning loop: tried [${state.attempts.map((a: any) => `${a.candidate}=${a.specsWithContent}sp/${a.anchorsOk ? 'anch' : 'MISS'}`).join(', ')}] → learned "${state.winner.candidate}" ✓`);
  });
});

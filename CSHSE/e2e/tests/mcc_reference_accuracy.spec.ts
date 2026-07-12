import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * REFERENCE ACCURACY (third pass). Independently re-parses the "(Supporting
 * Document … appendix CODE)" notes in every spec's narrative text (in JS) and
 * asserts the parser linked EXACTLY those appendix files to each spec — no
 * extra files, none missing. Then screenshots the File Library for a spec.
 * Requires E2E_SSO_KEY, E2E_SEED_TOKEN, MCC_PDF.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const PDF = process.env.MCC_PDF ?? '';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}
// Independent JS re-implementation of the parser's reference extraction.
function refsInText(text: string): Set<string> {
  const out = new Set<string>();
  const plain = (text || '').replace(/<[^>]+>/g, ' ');
  const docRe = /\(\s*Supporting\s+Documents?\b([\s\S]*?)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = docRe.exec(plain))) {
    const codeRe = /appendix\s*([A-Za-z]\d{1,2})\b/gi;
    let cm: RegExpExecArray | null;
    while ((cm = codeRe.exec(m[1]))) out.add(cm[1].toUpperCase());
  }
  return out;
}

test('third pass links exactly the appendices each spec cites', async ({ page }) => {
  test.skip(!SSO_KEY || !PDF, 'set E2E_SSO_KEY + MCC_PDF');
  test.setTimeout(900_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', { user: { institutionName: `Ref Inst ${RUN}`, email: 'ref-pc@test.local' }, submission: { institutionName: `Ref Inst ${RUN}` } });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const institutionId = ((await (await api.get('/api/auth/me', { headers: auth })).json()).user ?? {}).institutionId;
    const sub = ((await (await api.post('/api/submissions', { headers: auth, data: { institutionId, institutionName: 'Ref', programName: 'HS', programLevel: 'associate', type: 'initial' } })).json()).submission)._id;
    const up = await api.post('/api/imports/upload', { headers: auth, multipart: { submissionId: sub, file: { name: 'mcc.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) } } });
    const importId = (await up.json()).importId;
    await api.post(`/api/imports/${importId}/start-ai`, { headers: auth, data: { programLevel: 'associate', forceFormat: null } });
    let rs: any = {};
    await expect.poll(async () => {
      const b = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      rs = ((b.submission ?? b) as any).aiReviewState ?? {};
      return Object.keys(rs.buckets ?? {}).length;
    }, { timeout: 700_000, intervals: [5000] }).toBeGreaterThan(0);

    const evidenceDocs: any[] = rs.evidenceDocs ?? [];
    const validCodes = new Set(evidenceDocs.map((e) => String(e.mccCode)));

    // GROUND TRUTH: for each spec, the appendix codes its narrative text cites
    // (intersected with codes that actually have a stored file).
    const groundTruth: Record<string, Set<string>> = {};
    for (const [key, b] of Object.entries(rs.buckets ?? {}) as any[]) {
      const text = (b.narratives || []).map((n: any) => `${n.snippet || ''} ${n.htmlSnippet || ''}`).join('\n');
      const codes = [...refsInText(text)].filter((c) => validCodes.has(c));
      if (codes.length) groundTruth[key] = new Set(codes);
    }

    // PARSER CLAIM: for each spec, the appendix codes linked to it.
    const parserLinks: Record<string, Set<string>> = {};
    for (const e of evidenceDocs) {
      for (const r of (e.referencedBySpecs || [])) {
        const key = `${r.std}.${r.spec}`;
        (parserLinks[key] ??= new Set()).add(String(e.mccCode));
      }
    }

    // Compare per spec — the parser's links must EQUAL the text's references.
    const problems: string[] = [];
    const allKeys = new Set([...Object.keys(groundTruth), ...Object.keys(parserLinks)]);
    for (const key of allKeys) {
      const truth = groundTruth[key] ?? new Set();
      const claim = parserLinks[key] ?? new Set();
      const extra = [...claim].filter((c) => !truth.has(c));   // parser linked a file the text doesn't cite
      const missing = [...truth].filter((c) => !claim.has(c)); // text cites a file the parser didn't link
      if (extra.length) problems.push(`${key}: EXTRA (not in text) ${extra.join(',')}`);
      if (missing.length) problems.push(`${key}: MISSING (in text, not linked) ${missing.join(',')}`);
    }
    console.log(`specs checked: ${allKeys.size} | 1.b linked: ${[...(parserLinks['1.b'] ?? [])].sort().join(',')}`);
    console.log(`problems: ${problems.length}\n${problems.slice(0, 20).join('\n')}`);
    expect(problems, `reference-linking mismatches:\n${problems.join('\n')}`).toEqual([]);

    // Approve all + screenshot the File Library (spec 4.a should now show C-series it cites).
    const ids: string[] = [];
    for (const b of Object.values(rs.buckets) as any[]) for (const it of b.narratives ?? []) ids.push(it.sectionId);
    for (const ib of Object.values(rs.introductions ?? {}) as any[]) for (const it of ib.items ?? []) ids.push(it.sectionId);
    for (const e of evidenceDocs) ids.push(e.sectionId);
    await api.post(`/api/submissions/${sub}/review/set-approved`, { headers: auth, data: { approvedIds: ids } });
    await page.goto(`${BASE}/self-study/${sub}#token=${encodeURIComponent(token)}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Supporting File Library/i }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText('Expand All', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/ref-accuracy-library.png', fullPage: true });
  } finally {
    await cleanupSeed(seed);
  }
});

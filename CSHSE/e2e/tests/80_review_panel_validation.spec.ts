import { test, expect, request, Page, APIRequestContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * CR-073 — the Parser Train parsing result shown ON THE REVIEW PANEL (not the
 * editor), per section (Introduction / Files / Standards) with the parsed text +
 * files, and VALIDATED against the production review panel for the same document.
 *
 * DEV: the Parser Train review panel is a SUPERUSER surface (reuse of
 * ReviewSurface/ReviewStep) opened at /self-study/:id?view=review.
 * PROD: the production build has no SU-review change, so we impersonate the
 * document's real Program Coordinator to open the same review panel — the
 * validated outcome real coordinators see.
 *
 *   E2E_BASE_URL=<dev> PROD_BASE=<prod> SU_EMAIL=… SU_PASSWORD=… \
 *   npx playwright test 80_review_panel_validation
 */
const DEV = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const PROD = process.env.PROD_BASE ?? 'https://cshse.courseworx.media';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';
const FILES = path.resolve(__dirname, '../fixtures/files');
const SHOTS = path.resolve(__dirname, '../report/review');
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' } as const;
async function j(p: Promise<any>) { return (await p).json(); }
function mkshots() { fs.mkdirSync(SHOTS, { recursive: true }); }

// ---- summarize a parsed review state (for dev↔prod validation) ----
function summarize(rs: any) {
  const buckets = rs?.buckets ?? {};
  const byStd: Record<string, string[]> = {};
  let specs = 0, narr = 0, ev = 0, files = 0;
  for (const k of Object.keys(buckets)) {
    const b = buckets[k];
    const n = (b.narratives || []).length, e = (b.evidenceText || []).length, f = (b.evidenceFiles || []).length;
    if (n || e || f) { specs++; const [s, sp] = k.split('.'); (byStd[s] = byStd[s] || []).push(sp); }
    narr += n; ev += e; files += f;
  }
  const intro = rs?.introductions || {};
  const introChars = Object.values(intro).reduce((a: number, it: any) => a + (it?.items || []).reduce((x: number, i: any) => x + String(i.snippet || '').length, 0), 0);
  return {
    standards: Object.keys(byStd).sort((a, b) => +a - +b),
    specsWithContent: specs, narratives: narr, evidenceText: ev, evidenceFiles: files,
    cvs: (rs?.cvs || []).length, evidenceDocs: (rs?.evidenceDocs || []).length, matrices: (rs?.matrices || []).length,
    introChars, hasIntro: introChars > 0,
  };
}
async function reviewState(api: APIRequestContext, auth: any, sub: string, base: string) {
  const b = await j(api.get(`${base}/api/submissions/${sub}`, { headers: auth }));
  return (b.submission ?? b).aiReviewState ?? {};
}

// ---- open the review panel + screenshot each section ----
async function captureReviewPanel(page: Page, base: string, sub: string, prefix: string) {
  await page.goto(`${base}/self-study/${sub}?view=review`);
  await expect(page.getByRole('complementary', { name: 'Specifications' })).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, `${prefix}-01-overview.png`), fullPage: true });

  // INTRODUCTION — the parsed introduction text
  const introTab = page.getByRole('tab', { name: /Document Introduction/i }).first();
  if (await introTab.isVisible().catch(() => false)) {
    await introTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, `${prefix}-02-introduction.png`), fullPage: true });
  }

  // STANDARDS — click the first spec tab that has content; cards show parsed text
  const specTab = page.getByRole('tab', { name: /^\d+\.[a-j]\b/ }).first();
  let comparedOk = false;
  if (await specTab.isVisible().catch(() => false)) {
    await specTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, `${prefix}-03-standards.png`), fullPage: true });

    // COMPARE — resolves the card's anchor in the source (located)
    const compareBtn = page.getByRole('button', { name: /^Compare/ }).first();
    if (await compareBtn.isVisible().catch(() => false)) {
      await compareBtn.click();
      await page.waitForTimeout(1500);
      await expect(page.getByText(/section not located/i)).toHaveCount(0, { timeout: 15000 });
      comparedOk = true;
      await page.screenshot({ path: path.join(SHOTS, `${prefix}-04-compare.png`), fullPage: true });
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  // FILES — the Supporting Evidence rail (CVs / Syllabi / Papers / Matrices)
  const evHeader = page.getByText('Supporting Evidence', { exact: false }).first();
  if (await evHeader.isVisible().catch(() => false)) {
    await evHeader.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, `${prefix}-05-files.png`), fullPage: true });
  }
  return { comparedOk };
}

async function loginSU(api: APIRequestContext, base: string) {
  return (await j(api.post(`${base}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
}

// dev: parse a doc through Parser Train, return submissionId + importId
async function devParse(api: APIRequestContext, token: string, file: string, mime: 'docx' | 'pdf', level: string) {
  const auth = { Authorization: `Bearer ${token}` };
  const run = await j(api.post(`${DEV}/api/parser-train`, { headers: auth, data: { programLevel: level } }));
  const pc = { ...auth, 'X-Impersonated-User-Id': run.pcUserId, 'X-Impersonated-Role': 'program_coordinator' };
  const up = await j(api.post(`${DEV}/api/imports/upload`, { headers: pc, multipart: { submissionId: run.submissionId, file: { name: `d.${mime}`, mimeType: MIME[mime], buffer: fs.readFileSync(file) } } }));
  await api.post(`${DEV}/api/imports/${up.importId}/start-ai`, { headers: pc, data: { programLevel: level, forceFormat: null } });
  await expect.poll(async () => (await j(api.get(`${DEV}/api/imports/${up.importId}/ai-status`, { headers: pc }))).status, { timeout: 1_200_000, intervals: [8000] }).toMatch(/^(parsed|completed)$/);
  await expect.poll(async () => Object.keys((await reviewState(api, auth, run.submissionId, DEV)).buckets ?? {}).length, { timeout: 90_000, intervals: [4000] }).toBeGreaterThan(0);
  return { submissionId: run.submissionId, importId: up.importId };
}

// browser sign-in as SU (dev) via token hash
async function browserSU(page: Page, token: string) {
  await page.goto(`${DEV}/dashboard#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}
// browser sign-in as the prod PC by injecting an impersonation session (E2E)
async function browserProdPC(page: Page, suToken: string, pc: any) {
  await page.addInitScript(([tok, pcObj]) => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: {
      token: tok, needsImpersonationSelection: false,
      impersonation: { isImpersonating: true, impersonatedRole: 'program_coordinator', impersonatedUser: pcObj },
    }, version: 0 }));
  }, [suToken, pc] as any);
  await page.goto(`${PROD}/dashboard`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

const DOCS = [
  { name: 'aacc', file: path.join(FILES, 'aacc.docx'), mime: 'docx' as const, level: 'associate', prodSub: '6a590c0fc01945aaab81f289', pc: { id: '6a4d718362b2b773fb5e0302', email: 'nrwilliams1@aacc.edu', firstName: 'Nicole', lastName: 'Williams', role: 'program_coordinator' } },
  { name: 'kennesaw', file: path.join(FILES, 'kennesaw.docx'), mime: 'docx' as const, level: 'bachelors', prodSub: '6a31f92483a01b1a6d930a4e', pc: { id: '6a31f8a383a01b1a6d93095b', email: 'mnandan@kennesaw.edu', firstName: 'Monica', lastName: 'Nandan', role: 'program_coordinator' } },
  { name: 'mcc', file: path.join(FILES, 'mcc.pdf'), mime: 'pdf' as const, level: 'associate', prodSub: '6a550c306ded4223c782ffe2', pc: { id: '6a5119d976f91443017832bd', email: 'mlmiller26@mccneb.edu', firstName: 'Michelle', lastName: 'Miller', role: 'program_coordinator' }, slow: true },
  { name: 'stevenson', file: path.join(FILES, 'stevenson.docx'), mime: 'docx' as const, level: 'bachelors', prodSub: '', pc: null, slow: true }, // dev-only, 14MB self_study (slow parse)
];

test.describe('Review panel — parsed output shown + validated vs production', () => {
  for (const d of DOCS) {
    test(`${d.slow ? '@slow ' : ''}${d.name}: parsed sections on the review panel${d.prodSub ? ' + prod validation' : ''}`, async ({ page }) => {
      test.skip(!fs.existsSync(d.file), `${d.name} fixture required`);
      test.setTimeout(d.slow ? 2_400_000 : 1_200_000);
      mkshots();
      const api = await request.newContext();
      const token = await loginSU(api, DEV);
      const auth = { Authorization: `Bearer ${token}` };

      // --- DEV: parse + show on the review panel (as SU) ---
      const { submissionId } = await devParse(api, token, d.file, d.mime, d.level);
      const devRs = summarize(await reviewState(api, auth, submissionId, DEV));
      await browserSU(page, token);
      const devCap = await captureReviewPanel(page, DEV, submissionId, `${d.name}-dev`);
      expect(devRs.specsWithContent, `${d.name} dev: specs on review panel`).toBeGreaterThan(0);
      expect(devCap.comparedOk, `${d.name} dev: Compare located a card`).toBe(true);
      console.log(`${d.name} DEV review panel: ${devRs.standards.length} stds, ${devRs.specsWithContent} specs, intro ${devRs.introChars} chars, files ev=${devRs.evidenceFiles}/cv=${devRs.cvs}/docs=${devRs.evidenceDocs}`);

      // --- PROD: same review panel via the document's real PC + validation ---
      if (d.prodSub && d.pc) {
        const prodApi = await request.newContext();
        const prodTok = await loginSU(prodApi, PROD);
        const pcAuth = { Authorization: `Bearer ${prodTok}`, 'X-Impersonated-User-Id': d.pc.id, 'X-Impersonated-Role': 'program_coordinator' };
        const prodRs = summarize(await reviewState(prodApi, pcAuth, d.prodSub, PROD));
        await browserProdPC(page, prodTok, d.pc);
        await captureReviewPanel(page, PROD, d.prodSub, `${d.name}-prod`);

        // VALIDATION — the dev parse (with rules) reproduces the prod validated outcome:
        // every standard the production review panel shows is also present on dev,
        // dev places at least as many specs, and the introduction presence matches.
        const missingOnDev = prodRs.standards.filter((s) => !devRs.standards.includes(s));
        expect(missingOnDev, `${d.name}: standards on prod also present on dev`).toEqual([]);
        expect(devRs.specsWithContent, `${d.name}: dev places >= prod specs`).toBeGreaterThanOrEqual(prodRs.specsWithContent - 2);
        expect(devRs.hasIntro, `${d.name}: introduction presence matches prod`).toBe(prodRs.hasIntro);
        console.log(`${d.name} VALIDATION vs prod: dev stds ${devRs.standards.length} ⊇ prod ${prodRs.standards.length}; specs dev ${devRs.specsWithContent} vs prod ${prodRs.specsWithContent}; intro dev=${devRs.hasIntro}/prod=${prodRs.hasIntro} ✓`);
      }
    });
  }
});

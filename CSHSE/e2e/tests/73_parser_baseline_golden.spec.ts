import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser BASELINE golden regression (CR-073 §"Baseline capture + golden tests").
 * The proven documents — AACC (tabular template), Kennesaw (paragraph template),
 * MCC (narrative PDF) — are the immovable baseline. Their verified raw-parse
 * output is frozen in e2e/fixtures/golden/*.json. This re-imports each and
 * asserts the parser still reproduces its golden: same format, same
 * Standard/sub-spec PLACEMENT (exact for the deterministic template paths;
 * structural for MCC's LLM sub-spec matching), same file-type classification,
 * and — the enforced gate for ALL — every item anchored → Compare *located*
 * (0 "section not located"). Any future parser/rule change must keep these green.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const SEED_TOKEN = process.env.E2E_SEED_TOKEN ?? '';
const MCC_PDF = process.env.MCC_PDF ?? '';
const GOLDEN = path.resolve(__dirname, '../fixtures/golden');
const FILES = path.resolve(__dirname, '../fixtures/files');
const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

async function j(p: Promise<any>) {
  const r = await p;
  return r.json();
}

/** Import a proven doc on the target, return its parse snapshot + contract result. */
async function importAndSnapshot(api: APIRequestContext, file: string, mime: 'docx' | 'pdf', level: string) {
  const seed = await j(api.post('/api/test/seed', {
    headers: { 'x-e2e-seed-token': SEED_TOKEN },
    data: { fixture: 'wizard_review_minimal', overrides: { user: { email: `golden-${Date.now()}@x.test` }, submission: { programLevel: level } } },
  }));
  const tok = (await j(api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email: seed.userEmail } }))).token;
  const auth = { Authorization: `Bearer ${tok}` };
  const me = await j(api.get('/api/auth/me', { headers: auth }));
  const institutionId = (me.user ?? me).institutionId;
  const created = await j(api.post('/api/submissions', { headers: auth, data: { institutionId, institutionName: 'Golden', programName: 'HS', programLevel: level, type: 'initial' } }));
  const sub = (created.submission ?? created)._id;
  const up = await j(api.post('/api/imports/upload', {
    headers: auth,
    multipart: { submissionId: sub, file: { name: `doc.${mime}`, mimeType: MIME[mime], buffer: fs.readFileSync(file) } },
  }));
  const importId = up.importId;
  await api.post(`/api/imports/${importId}/start-ai`, { headers: auth, data: { programLevel: level, forceFormat: null } });

  let fmt = '';
  await expect.poll(async () => {
    const s = await j(api.get(`/api/imports/${importId}/ai-status`, { headers: auth }));
    fmt = (s.detectedFormat || s.format || {}).format || '';
    return s.status;
  }, { timeout: 600_000, intervals: [5000] }).toMatch(/^(parsed|completed|failed)$/);

  let rs: any = {};
  await expect.poll(async () => {
    const b = await j(api.get(`/api/submissions/${sub}`, { headers: auth }));
    rs = (b.submission ?? b).aiReviewState ?? {};
    return Object.keys(rs.buckets ?? {}).length;
  }, { timeout: 30_000, intervals: [2000] }).toBeGreaterThan(0);

  const cc = await j(api.post(`/api/imports/${importId}/contract-check`, { headers: auth }));

  const byStandard: Record<string, string[]> = {};
  let specsWithContent = 0;
  for (const k of Object.keys(rs.buckets || {})) {
    const b = rs.buckets[k];
    if ((b.narratives || []).length || (b.evidenceText || []).length) {
      specsWithContent++;
      const [std, sp] = k.split('.');
      (byStandard[std] = byStandard[std] || []).push(sp);
    }
  }
  for (const s of Object.keys(byStandard)) byStandard[s].sort();
  return {
    format: fmt,
    standards: Object.keys(byStandard).sort((a, b) => +a - +b),
    byStandard, specsWithContent,
    anchors: cc.anchors, fileTypes: cc.fileTypes,
    cleanup: seed.cleanupToken, api,
  };
}

async function cleanup(api: APIRequestContext, token?: string) {
  if (token) await api.delete('/api/test/seed', { headers: { 'x-e2e-seed-token': SEED_TOKEN }, data: { cleanupToken: token } }).catch(() => {});
}

test.describe('Parser baseline golden regression', () => {
  test.skip(!SSO_KEY || !SEED_TOKEN, 'set E2E_SSO_KEY + E2E_SEED_TOKEN');

  // --- Template documents: DETERMINISTIC placement → exact golden match ---
  for (const doc of [
    { name: 'aacc', file: path.join(FILES, 'aacc.docx'), mime: 'docx' as const, level: 'associate' },
    { name: 'kennesaw', file: path.join(FILES, 'kennesaw.docx'), mime: 'docx' as const, level: 'bachelors' },
  ]) {
    test(`${doc.name}: reproduces golden (exact placement + every item anchored)`, async () => {
      test.setTimeout(300_000);
      const golden = JSON.parse(fs.readFileSync(path.join(GOLDEN, `${doc.name}.json`), 'utf-8'));
      const api = await request.newContext({ baseURL: BASE });
      let snap: any;
      try {
        snap = await importAndSnapshot(api, doc.file, doc.mime, doc.level);
        // format + exact Standard/sub-spec placement (template hint routing is deterministic)
        expect(snap.format, 'format').toBe(golden.format);
        expect(snap.standards, 'standards present').toEqual(golden.coverage.standards);
        expect(snap.byStandard, 'exact std→spec placement').toEqual(golden.coverage.byStandard);
        expect(snap.specsWithContent, 'spec count with content').toBe(golden.coverage.specsWithContent);
        // THE GATE — every item anchored, Compare locates all (0 "section not located")
        expect(snap.anchors.missing.length, `un-anchored items (${snap.anchors.missing.length})`).toBe(0);
        // totalItems includes LLM-generated evidenceText (non-deterministic count) → assert a floor, not exact
        expect(snap.anchors.totalItems, 'item count floor').toBeGreaterThanOrEqual(golden.coverage.specsWithContent);
        // file-type classification (deterministic files/CVs/docs/matrices; evidenceText is LLM → not asserted exact)
        expect(snap.fileTypes.evidenceFiles).toBe(golden.fileTypes.evidenceFiles);
        expect(snap.fileTypes.cvs).toBe(golden.fileTypes.cvs);
        expect(snap.fileTypes.evidenceDocs).toBe(golden.fileTypes.evidenceDocs);
        expect(snap.fileTypes.matrices).toBe(golden.fileTypes.matrices);
        console.log(`${doc.name}: golden reproduced — ${snap.standards.length} stds, ${snap.specsWithContent} specs, ${snap.anchors.totalItems} items all anchored ✓`);
      } finally {
        await cleanup(api, snap?.cleanup);
      }
    });
  }

  // --- MCC: LLM sub-spec matching → STRUCTURAL match (tolerate content variance) ---
  test('@slow mcc: reproduces golden structurally (all standards + every item anchored)', async () => {
    test.skip(!MCC_PDF, 'set MCC_PDF to the 935-page PDF to run the MCC baseline');
    test.setTimeout(900_000);
    const golden = JSON.parse(fs.readFileSync(path.join(GOLDEN, 'mcc.json'), 'utf-8'));
    const api = await request.newContext({ baseURL: BASE });
    let snap: any;
    try {
      snap = await importAndSnapshot(api, MCC_PDF, 'pdf', 'associate');
      expect(snap.format, 'format').toBe(golden.format); // mcc_narrative
      // every golden standard still has content (placement of the LLM matcher may vary within a std)
      for (const std of golden.coverage.standards) {
        expect(snap.standards, `Standard ${std} present`).toContain(std);
      }
      // spec + appendix counts within tolerance (LLM variance)
      expect(Math.abs(snap.specsWithContent - golden.coverage.specsWithContent)).toBeLessThanOrEqual(10);
      expect(Math.abs(snap.fileTypes.evidenceDocs - golden.fileTypes.evidenceDocs)).toBeLessThanOrEqual(3);
      // THE GATE — every item anchored regardless
      expect(snap.anchors.missing.length, 'un-anchored items').toBe(0);
      console.log(`mcc: golden reproduced structurally — ${snap.standards.length} stds, ${snap.specsWithContent} specs, ${snap.fileTypes.evidenceDocs} appendix files, ${snap.anchors.totalItems} items all anchored ✓`);
    } finally {
      await cleanup(api, snap?.cleanup);
    }
  });
});

/**
 * EXTENSIVE review→editor completeness test.
 *
 * Seeds a review state with an item in EVERY category — narrative,
 * supporting-evidence text, evidence file, faculty CV, syllabus, paper, a
 * Document Introduction, and a Standard Introduction — approves ALL of them,
 * then proves each one is materialized into its correct editor target:
 *
 *   narrative          → Submission.narratives[std][spec].content
 *   evidence text      → Submission.narratives[std][spec].supportingEvidenceText
 *   evidence file      → SupportingEvidence (tag rev:<id>)
 *   CV                 → SupportingEvidence (tag rev:<id>)
 *   syllabus / paper   → SupportingEvidence (tag rev:<id>)
 *   document intro     → Submission.documentIntroduction
 *   standard intro     → Submission.standardIntroductions[std]
 *
 * Finally it asserts COMPLETENESS: every approved id has a materialized target
 * — i.e. nothing approved is left un-moved. This guards the whole pipeline.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

// distinct, greppable markers per category
const M = {
  narr: 'NARRMARKER60', evtext: 'EVTEXTMARKER60', file: 'FILEMARKER60',
  cv: 'CVMARKER60', syl: 'SYLMARKER60', paper: 'PAPERMARKER60',
  docIntro: 'DOCINTROMARKER60', stdIntro: 'STDINTROMARKER60',
};
const ID = {
  narr: 'sec60-narr', evtext: 'sec60-evtext', file: 'sec60-file',
  cv: 'sec60-cv', syl: 'sec60-syl', paper: 'sec60-paper',
  docIntro: 'sec60-docintro', stdIntro: 'sec60-stdintro',
};
const ALL_IDS = Object.values(ID);

function item(sectionId: string, marker: string, extra: Record<string, unknown> = {}) {
  return { sectionId, heading: marker, snippet: `${marker} body text.`, htmlSnippet: `<p>${marker} body text.</p>`, wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '', ...extra };
}

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { path, method, body });
}

test.describe('Review → editor: every approved item is moved (nothing left)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('all categories approve → all materialize into the editor', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'review-complete@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [item(ID.narr, M.narr)],
            evidenceText: [item(ID.evtext, M.evtext)],
            evidenceFiles: [item(ID.file, M.file)],
            matrixCells: [],
          },
        },
        tags: [],
        cvs: [item(ID.cv, M.cv, { facultyName: 'Dr. Test Faculty' })],
        evidenceDocs: [
          item(ID.syl, M.syl, { title: 'Test Syllabus', docSubKind: 'syllabus' }),
          item(ID.paper, M.paper, { title: 'Test Paper', docSubKind: 'paper' }),
        ],
        introductions: {
          document: { items: [item(ID.docIntro, M.docIntro)] },
          'standard-1': { items: [item(ID.stdIntro, M.stdIntro)] },
        },
        placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);

    // Approve EVERYTHING.
    const setRes = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: ALL_IDS });
    expect(setRes.status).toBe(200);
    expect(setRes.body.approvedIds?.length).toBe(ALL_IDS.length);

    // Pull the editor state + evidence and assert each category landed.
    await expect.poll(async () => {
      const sub = (await api(page, `/api/submissions/${seed!.submissionId}`)).body;
      const nc = (sub.narrativeContent || []).find((n: any) => n.standardCode === '1' && n.specCode === 'a');
      return (nc?.content || '').includes(M.narr) ? 'ok' : 'pending';
    }, { timeout: 20_000, intervals: [1000] }).toBe('ok');

    const sub = (await api(page, `/api/submissions/${seed.submissionId}`)).body;
    const ev = (await api(page, `/api/submissions/${seed.submissionId}/evidence`)).body;
    const nc = (sub.narrativeContent || []).find((n: any) => n.standardCode === '1' && n.specCode === 'a') || {};
    const evItems = Array.isArray(ev) ? ev : (ev.evidence || ev.items || []);
    const revTags = new Set<string>();
    for (const e of evItems) for (const t of (e.tags || [])) if (String(t).startsWith('rev:')) revTags.add(String(t).slice(4));
    const stdIntro = sub.standardIntroductions || {};
    const stdIntro1 = typeof stdIntro === 'object' ? (stdIntro['1'] || stdIntro.get?.('1') || '') : '';

    // --- assert EVERY category materialized ---
    expect(nc.content || '', 'narrative → content').toContain(M.narr);
    expect(nc.supportingEvidenceText || '', 'evidence text → supportingEvidenceText').toContain(M.evtext);
    expect(revTags.has(ID.file), 'evidence file → SupportingEvidence').toBe(true);
    expect(revTags.has(ID.cv), 'CV → SupportingEvidence').toBe(true);
    expect(revTags.has(ID.syl), 'syllabus → SupportingEvidence').toBe(true);
    expect(revTags.has(ID.paper), 'paper → SupportingEvidence').toBe(true);
    expect(sub.documentIntroduction || '', 'document intro → documentIntroduction').toContain(M.docIntro);
    expect(String(stdIntro1), 'standard intro → standardIntroductions[1]').toContain(M.stdIntro);

    // --- COMPLETENESS: every approved id has a materialized home (nothing left) ---
    const materializedText = [nc.content, nc.supportingEvidenceText, sub.documentIntroduction, String(stdIntro1)].join(' ');
    const unmoved = ALL_IDS.filter((id) => {
      if ([ID.file, ID.cv, ID.syl, ID.paper].includes(id)) return !revTags.has(id);
      const marker = { [ID.narr]: M.narr, [ID.evtext]: M.evtext, [ID.docIntro]: M.docIntro, [ID.stdIntro]: M.stdIntro }[id]!;
      return !materializedText.includes(marker);
    });
    expect(unmoved, `approved-but-not-moved: ${unmoved.join(',')}`).toHaveLength(0);
  });
});

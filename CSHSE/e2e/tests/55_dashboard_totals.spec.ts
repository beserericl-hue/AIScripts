/**
 * Dashboard DRAFTS counts mirror the Review rail (TOTALS, not un-triaged) —
 * even when some items are already approved. Plus a `reviewed` progress count.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

function item(id: string) {
  return { sectionId: id, heading: id, snippet: 's', htmlSnippet: '<p>s</p>', wordCount: 1, confidence: 0.9, acceptState: 'pending', rationale: '' };
}

test.describe('Dashboard DRAFTS = totals (mirror Review rail)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('workflow-summary drafts show totals + reviewed, regardless of approvals', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'dash-totals@x.test' },
      reviewState: {
        buckets: {
          '1.a': { standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [item('n1'), item('n2'), item('n3')], evidenceText: [item('e1')], evidenceFiles: [], matrixCells: [] },
          '2.a': { standardCode: '2', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [item('n4')], evidenceText: [], evidenceFiles: [], matrixCells: [] },
        },
        tags: [],
        cvs: [item('cv1'), item('cv2'), item('cv3')],
        evidenceDocs: [
          { ...item('s1'), docSubKind: 'syllabus' }, { ...item('s2'), docSubKind: 'syllabus' },
          { ...item('p1'), docSubKind: 'paper' }, { ...item('p2'), docSubKind: 'project' },
        ],
        introductions: { doc: { items: [item('i1')] } },
        placeholderSections: [],
        // Approve a bunch — the dashboard totals must NOT shrink.
        approvedIds: ['cv1', 'cv2', 'cv3', 's1', 'p1', 'n1', 'n2'],
        discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);

    const ws = await page.evaluate(async (id: string) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${id}/workflow-summary`, { headers: { Authorization: `Bearer ${token}` } });
      return (await r.json())?.drafts;
    }, seed.submissionId);

    // TOTALS — match the seeded review content exactly.
    expect(ws.cvs).toBe(3);            // 3 cvs total (all 3 approved, still shows 3)
    expect(ws.syllabi).toBe(2);        // 2 syllabi total
    expect(ws.papers).toBe(2);         // paper + project = 2
    expect(ws.introductions).toBe(1);  // 1 intro item
    expect(ws.specItems).toBe(5);      // 3 narr + 1 evText + 1 narr = 5 bucket items
    // reviewed = approved across all kinds (cv1,cv2,cv3,s1,p1,n1,n2 = 7).
    expect(ws.reviewed).toBe(7);
  });
});

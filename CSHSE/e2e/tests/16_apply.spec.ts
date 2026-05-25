/**
 * Tier 1 — Apply step regression.
 *
 * Drives the Apply path through the CR-043 POST /:id/review/apply
 * endpoint. The endpoint pushes approved items into
 * Submission.narratives + standardIntroductions and drops them from
 * aiReviewState. Each test seeds a known approved/discarded mix and
 * asserts the post-apply state.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';

async function ssoToken(email: string): Promise<string> {
  const r = await fetch(`${BASE_URL}/api/v1/auth/sso-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cshse-api-key': SSO_KEY },
    body: JSON.stringify({ email }),
  });
  return ((await r.json()) as { token: string }).token;
}

function seedState(approved: string[], discarded: string[] = []) {
  return {
    itemSources: {
      'narr-1': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'h-A', importedAt: new Date().toISOString() },
      'narr-2': { importId: 'imp-A', sourceFilename: 'file-A.docx', sourceContentHash: 'h-A', importedAt: new Date().toISOString() },
    },
    buckets: {
      '1.a': {
        standardCode: '1',
        specCode: 'a',
        narratives: [
          { sectionId: 'narr-1', heading: 'A', snippet: 'approved-content body text here', wordCount: 6, confidence: 0.9, sourceImportId: 'imp-A', sourceFilename: 'file-A.docx' },
          { sectionId: 'narr-2', heading: 'B', snippet: 'discarded-content body text here', wordCount: 6, confidence: 0.8, sourceImportId: 'imp-A', sourceFilename: 'file-A.docx' },
        ],
        evidenceText: [], evidenceFiles: [], matrixCells: [],
      },
    },
    tags: [],
    cvs: [],
    evidenceDocs: [],
    introductions: {},
    placeholderSections: [],
    approvedIds: approved,
    discardedIds: discarded,
    mergeLog: [],
  };
}

test.describe('Apply step', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Apply with no approved items returns 400', async () => {
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'apply-empty@x.test' },
      reviewState: seedState([], []),
    });
    const token = await ssoToken(seed.userEmail);
    const res = await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review/apply`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(res.status).toBe(400);
  });

  test('Apply with approved items pushes them to Submission.narratives + drops them from aiReviewState', async () => {
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'apply-narr@x.test' },
      reviewState: seedState(['narr-1'], []),
    });
    const token = await ssoToken(seed.userEmail);
    const apply = await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review/apply`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(apply.status).toBe(200);
    const applyBody = (await apply.json()) as any;
    expect(applyBody.ok).toBe(true);
    expect(applyBody.appliedCounts.narratives).toBeGreaterThanOrEqual(1);

    // The approved item is gone; the un-approved item remains.
    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    const remaining = rev.aiReviewState?.buckets?.['1.a']?.narratives || [];
    expect(remaining.length).toBe(1);
    expect(remaining[0].sectionId).toBe('narr-2');
    expect(rev.aiReviewState.approvedIds).not.toContain('narr-1');
  });

  test('Discarded items stay out of the editor after Apply', async () => {
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'apply-discard@x.test' },
      reviewState: seedState(['narr-1'], ['narr-2']),
    });
    const token = await ssoToken(seed.userEmail);
    const apply = await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review/apply`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(apply.status).toBe(200);
    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    // narr-1 (approved) is removed by apply.
    // narr-2 (discarded) is still in buckets but in discardedIds — Apply
    // does NOT remove discarded items. They drop out only on
    // clear-item or a subsequent reimport. Verify both invariants.
    const remaining = rev.aiReviewState?.buckets?.['1.a']?.narratives || [];
    expect(remaining.find((n: any) => n.sectionId === 'narr-1')).toBeUndefined();
    expect(remaining.find((n: any) => n.sectionId === 'narr-2')).toBeDefined();
    expect(rev.aiReviewState.discardedIds).toContain('narr-2');
  });

  test('Approve-via-API → Apply commits narrative content (Self-Study Editor surface)', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'apply-commits@x.test' },
      reviewState: seedState([], []),
    });
    await loginAsSeededViaSso(page, seed);
    const token = await ssoToken(seed.userEmail);

    // Approve narr-1 via the CR-043 approve endpoint.
    const approve = await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review/approve`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ sectionId: 'narr-1', approved: true }),
      }
    );
    expect(approve.status).toBe(200);

    // Apply.
    const apply = await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review/apply`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(apply.status).toBe(200);

    // The narrative content lives on the Submission's narratives Map.
    // Fetch via the standard self-study endpoint and verify.
    const sub = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    const std1 = (sub.narrativeContent || []).find((n: any) => n.standardCode === '1' || n.standard_code === '1') ||
                 sub.narratives?.['1'];
    // The post-apply narrative content must include the seeded snippet.
    const raw = JSON.stringify(sub);
    expect(raw).toContain('approved-content body text here');
  });
});

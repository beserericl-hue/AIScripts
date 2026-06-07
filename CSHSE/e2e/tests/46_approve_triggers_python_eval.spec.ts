/**
 * Approve auto-runs the AI evaluation via the Python cshse-ai API — E2E.
 *
 * Per request: clicking Approve / Approve all should also run the evaluate
 * "workflow" so the final-editing step has verdicts without a manual step.
 * The chain is: set-approved → materialize → autoEvaluateAffectedSpecs →
 * validationService.validateSection → cshseAiClient.evaluateSection → the
 * Python FastAPI (cshse-ai). This proves it end-to-end against the live stack:
 *
 *   - Approve a narrative.
 *   - Poll GET /standards/:std/specs/:spec/evaluation until a verdict appears
 *     — which only exists if the Python evaluator actually ran and returned.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

const SEC = 'sec-pyeval-1';

test.describe('Approve triggers the Python AI evaluation', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('approving a spec produces an AI evaluation (verdict) from cshse-ai', async ({ page }) => {
    test.setTimeout(150_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'python-eval@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [
              {
                sectionId: SEC,
                heading: 'Regional accreditation',
                snippet:
                  'The program is part of Stevenson University, a regionally accredited institution ' +
                  'accredited by the Middle States Commission on Higher Education. The Counseling & ' +
                  'Human Services program operates within this accredited degree-granting university.',
                htmlSnippet: '<p>The program is part of a regionally accredited university (Middle States).</p>',
                wordCount: 40, confidence: 0.95, acceptState: 'pending', rationale: '',
              },
            ],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [],
        itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    // Approve → triggers the background Python evaluation for spec 1.a.
    await page.getByTestId(`approve-toggle-${SEC}`).click();
    await expect(page.getByTestId(`approve-toggle-${SEC}`)).toHaveAttribute('data-approved', 'true');

    // Poll the evaluation endpoint until the Python evaluator's verdict lands.
    // (No manual "Validate" click — the approve did it.)
    await expect
      .poll(
        async () => {
          const res = await page.evaluate(async (submissionId: string) => {
            const raw = localStorage.getItem('auth-storage');
            const token = raw ? JSON.parse(raw)?.state?.token : null;
            const r = await fetch(
              `/api/submissions/${submissionId}/standards/1/specs/a/evaluation`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const body = await r.json();
            return body?.evaluation ? JSON.stringify(body.evaluation) : '';
          }, seed!.submissionId);
          return res;
        },
        { timeout: 120_000, intervals: [3000] }
      )
      .toMatch(/verdict|pass|needs_improvement|fail|score|criteria|missing/i);
  });
});

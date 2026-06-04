/**
 * Review-surface guided tour — coverage E2E.
 *
 * Regression guard for "the Drafts → Review screen tour only showed a stub".
 * The Review surface hydrates its rail / cards / panes asynchronously, and the
 * tour used to filter its steps in a one-shot snapshot — so every late-mounting
 * Review anchor was dropped and the tour collapsed to intro + phase chips +
 * outro. A unit test with a mocked Joyride can't catch that; only driving the
 * REAL surface + REAL Joyride can.
 *
 * This spec:
 *   1. Seeds a populated Review surface (buckets + CVs + syllabi + papers).
 *   2. Opens the Review surface and launches the screen tour from the Help menu.
 *   3. Walks every Joyride step, collecting the copy.
 *   4. Asserts the tour teaches each arrowed object — not a 7-step stub.
 *
 * It would FAIL on the pre-fix build (no Review steps survive the snapshot) and
 * PASSES once the runner settles the DOM + pre-selects a card before starting.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

// Each arrowed object on the Review screen → a distinctive phrase from its
// tour step's copy (i18n tour.review.*). If a stop is dropped, its phrase is
// absent and the test fails — naming exactly which guide went missing.
const REQUIRED_STOPS: Array<[string, RegExp]> = [
  ['summary counts', /counts everything the helper pulled/i],
  ['left rail', /left-hand list is your menu/i],
  ['CVs', /Faculty CVs the helper found/i],
  ['Syllabi', /Course syllabi the helper pulled out/i],
  ['Papers / Projects', /Papers and student projects/i],
  ['standards list', /Every numbered standard/i],
  ['draft cards', /middle shows the drafts/i],
  ['bulk-approve toolbar', /Handle lots of cards at once/i],
  ['AI evaluation panel', /the helper explains itself here/i],
  ['Place-as / Reassign', /Tell the helper what a draft really is/i],
  ['Apply to editor', /sends everything you approved/i],
  ['Next (Matrix)', /Move on to the next step/i],
  ['Re-run detectors', /read your paper again/i],
  ['Finish review', /sets aside any drafts you didn/i],
  ['Back to editor', /Go back to writing your story/i],
];

type WalkResult = { seen: string[]; offscreen: string[] };

/**
 * Walk the live Joyride tour. Returns the copy shown at every step AND a list
 * of any steps whose Next/Back buttons fell outside the viewport — the bug a
 * real user hits when the tooltip renders below the fold and can't be scrolled
 * to. (Playwright auto-scrolls before a .click(), which masks the overflow, so
 * we must check the bounding box BEFORE clicking.)
 */
async function walkTour(page: Page): Promise<WalkResult> {
  const tooltip = page.getByTestId('tour-tooltip');
  await expect(tooltip).toBeVisible({ timeout: 8000 });
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };

  const seen: string[] = [];
  const offscreen: string[] = [];
  for (let i = 0; i < 40; i++) {
    const content = await page.getByTestId('tour-tooltip-content').textContent();
    const stepText = (content ?? '').trim();
    if (stepText) seen.push(stepText);
    const primary = page.getByTestId('tour-tooltip-primary');

    // The primary (Next/Finish) button must be inside the viewport — if it
    // isn't, a real user can't advance or dismiss the tour.
    const box = await primary.boundingBox();
    if (
      !box ||
      box.y < 0 ||
      box.x < 0 ||
      box.y + box.height > vp.height ||
      box.x + box.width > vp.width
    ) {
      offscreen.push(
        `step ${i + 1} (button at ${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'no-box'}, viewport ${vp.width}x${vp.height}): ${stepText.slice(0, 60)}`
      );
    }

    const label = (await primary.textContent()) ?? '';
    await primary.click();
    if (/finish|done/i.test(label)) break;
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(120);
  }
  return { seen, offscreen };
}

test.describe('Review surface — guided tour covers every object', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('the screen tour walks all Review stops (not a 7-step stub)', async ({ page }) => {
    test.setTimeout(120_000);
    // Use a real, large desktop viewport (the size the coordinator runs at) so
    // a tooltip anchored to a bottom-of-screen control would overflow below the
    // fold instead of being masked by Playwright's auto-scroll-before-click.
    await page.setViewportSize({ width: 1920, height: 1080 });

    seed = await seedFixture('wizard_review_minimal', {
      // Suppress first-visit auto-start so we launch deterministically from
      // the Help menu while ON the Review surface (the real replay path).
      user: {
        email: 'review-tour-coverage@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      // Populate the Supporting Evidence rail so the CV/Syllabi/Papers stops
      // have real content behind them (the tiles render regardless, but this
      // mirrors the live Stevenson data the user was looking at).
      // NOTE: the "Matrices" rail tile is data-conditional (renders only when
      // submission.aiMatrixState.matrices is non-empty). Seeding it here trips
      // a latent seed-endpoint bug (the matrixState branch calls
      // submissionDoc.save(), which clobbers the imports array $push'd just
      // before it → buckets vanish). So this spec asserts the 16 stops the
      // minimal fixture reliably produces; the Matrices step itself is pinned
      // by tourRegistry.test.tsx (authored + anchored) and renders live when
      // matrix data is present (as in the user's Stevenson submission).
      import: {
        aiCVs: [
          {
            sectionId: 'cv-1',
            facultyName: 'Dr. Jane Faculty',
            snippet: 'PhD, 15 years teaching human services.',
            confidence: 0.93,
            routing: { source: 'matcher' },
          },
        ],
        aiEvidenceDocs: [
          {
            sectionId: 'ed-1',
            docSubKind: 'paper',
            title: 'Capstone Project — Community Needs Assessment',
            confidence: 0.9,
            snippet: 'Student capstone body ...',
          },
          {
            sectionId: 'ed-2',
            docSubKind: 'syllabus',
            title: 'CHS 105 — Introduction to Human Services',
            confidence: 0.88,
            snippet: 'Course syllabus body ...',
            courseCode: 'CHS 105',
          },
        ],
      } as any,
    });

    await loginAsSeededViaSso(page, seed);
    // Opens the Review surface and waits for real cards to render (proves the
    // async content has hydrated before we launch the tour).
    await gotoReviewStep(page, seed);

    // Launch the screen tour the way a coordinator does: Help → "show me
    // around this screen". resolveTourForRoute('/self-study/...') → self-study.
    await page.getByTestId('help-menu-trigger').click();
    await page.getByTestId('help-menu-tour').click();

    const { seen: stops, offscreen } = await walkTour(page);
    const joined = stops.join('\n---\n');

    // Surface the live tour copy in the test log so coverage is auditable.
    // eslint-disable-next-line no-console
    console.log(
      `\n[review-tour] live tour walked ${stops.length} steps:\n` +
        stops.map((s, i) => `  ${i + 1}. ${s}`).join('\n') +
        '\n'
    );

    // 0) Every step's Next/Back buttons must be reachable — inside the
    //    viewport. A tooltip anchored to a bottom-of-screen control must not
    //    push its controls below the fold (the user can't scroll during a tour).
    expect(
      offscreen,
      `tour steps with off-screen controls (user can't advance):\n${offscreen.join('\n')}`
    ).toEqual([]);

    // 1) Not the stub: the old build showed intro + 5 phase chips + outro = 7.
    //    The Review deep-dive must add well beyond that.
    expect(
      stops.length,
      `tour only showed ${stops.length} steps:\n${joined}`
    ).toBeGreaterThanOrEqual(18);

    // 2) Every arrowed object has its guide — report the exact ones missing.
    const missing = REQUIRED_STOPS.filter(([, rx]) => !rx.test(joined)).map(
      ([name]) => name
    );
    expect(
      missing,
      `missing tour guides for: ${missing.join(', ')}\n\nFULL TOUR COPY:\n${joined}`
    ).toEqual([]);
  });
});

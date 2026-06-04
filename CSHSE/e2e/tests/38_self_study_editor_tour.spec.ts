/**
 * Self-Study editor (the writing screen) guided tour — coverage E2E.
 *
 * Same regression guard as the Review-surface tour (spec 37), for the
 * Standards-editor view. Drives the REAL editor on cshse-develop, launches the
 * screen tour from the Help menu, walks every Joyride step, and asserts:
 *   1. Each arrowed object on the editor has its guide (fails by name if not).
 *   2. Every step's Next/Back buttons are inside the viewport — a tooltip
 *      anchored to a bottom-of-screen control (e.g. Supporting Evidence Text,
 *      Save/Validate) must not push its controls below the fold.
 *
 * Would FAIL on the pre-fix build (the editor tour was the 7-step stub).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

// Each arrowed object → a distinctive phrase from its tour step (tour.ss.*).
const REQUIRED_STOPS: Array<[string, RegExp]> = [
  ['Introduction tab', /opening of your whole self-study/i],
  ['Standards tab', /answer each part, one at a time/i],
  ['Curriculum Matrix tab', /big table that maps your courses/i],
  ['Supporting File Library tab', /holds every file you uploaded/i],
  ['standards rail', /every standard and its parts/i],
  ['editor', /writing space for the part you picked/i],
  ['toolbar', /style your writing/i],
  ['Supporting Evidence Text', /Supporting Evidence Text — extra proof/i],
  ['Clear', /wipes everything in this part/i],
  ['Save', /keeps your work without checking/i],
  ['Validate', /checks this part against the rules/i],
  ['Submit Self-Study', /sends your whole self-study in for review/i],
];

type WalkResult = { seen: string[]; offscreen: string[] };

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

test.describe('Self-Study editor — guided tour covers every object', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('the screen tour walks all editor stops (not a 7-step stub)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1920, height: 1080 });

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'ss-editor-tour@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
    });

    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Land on the Standards (writing) view. The editor defaults to Standard 1,
    // Spec a, so the NarrativeEditor (toolbar + Save/Validate/Clear + Supporting
    // Evidence) mounts. Click the tab to be deterministic regardless of which
    // workflow phase the submission opened on.
    await page.locator('[data-tour="ss-tab-standards"]').click();
    await expect(page.locator('[data-tour="ss-toolbar"]')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('[data-tour="ss-save"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-tour="ss-evidence-text"]')).toBeVisible({ timeout: 10_000 });

    // Launch the screen tour the way a coordinator does.
    await page.getByTestId('help-menu-trigger').click();
    await page.getByTestId('help-menu-tour').click();

    const { seen: stops, offscreen } = await walkTour(page);
    const joined = stops.join('\n---\n');

    // eslint-disable-next-line no-console
    console.log(
      `\n[ss-editor-tour] live tour walked ${stops.length} steps:\n` +
        stops.map((s, i) => `  ${i + 1}. ${s}`).join('\n') +
        '\n'
    );

    // 0) Every step's controls must be reachable (inside the viewport).
    expect(
      offscreen,
      `tour steps with off-screen controls (user can't advance):\n${offscreen.join('\n')}`
    ).toEqual([]);

    // 1) Not the stub (intro + 5 phase chips + outro = 7). 12 editor stops add
    //    well beyond that.
    expect(
      stops.length,
      `tour only showed ${stops.length} steps:\n${joined}`
    ).toBeGreaterThanOrEqual(18);

    // 2) Every arrowed object has its guide — report exactly what's missing.
    const missing = REQUIRED_STOPS.filter(([, rx]) => !rx.test(joined)).map(
      ([name]) => name
    );
    expect(
      missing,
      `missing tour guides for: ${missing.join(', ')}\n\nFULL TOUR COPY:\n${joined}`
    ).toEqual([]);
  });
});

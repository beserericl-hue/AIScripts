/**
 * CR-044 — Review screen typography parity.
 *
 * The Self-Study NarrativeEditor renders body content at `prose prose-sm`
 * (~14px). The Review surface's card-body containers must match so the
 * PC's eye doesn't re-calibrate every time they flip between Review
 * and the editor during a multi-author workflow.
 *
 * Four files were lifted to `prose prose-sm` in the CR-044 commit:
 *   - ItemCardList.tsx           — narrative card body (rendered snippet)
 *   - ItemPreview.tsx            — preview pane body + rationale block
 *   - StandaloneCVReview.tsx     — CV preview body
 *   - MissingFragmentsView.tsx   — missing-fragment body
 *
 * This test asserts the DOM emitted by each component carries both
 * `prose` and `prose-sm` classes on its primary body container so a
 * future refactor can't silently strip them.
 *
 * We render with minimal mocked store state and read the DOM directly —
 * no userEvent interactions needed; computed-style isn't probed because
 * jsdom doesn't ship a Tailwind preflight (a class-presence assertion
 * is the right granularity for a parity invariant).
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useAIImportStore } from '../../../../../store/aiImportStore';

vi.mock('../../../../../services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

import { ItemCardList } from './ItemCardList';
import { StandaloneCVReview } from './StandaloneCVReview';
import { MissingFragmentsView } from './MissingFragmentsView';

/**
 * Find the prose body container that holds `expectedText`.
 * Prefers the deepest .prose ancestor that contains the text, so generic
 * outer wrappers (flex containers, page chrome) don't shadow the actual
 * card-body styling.
 */
function findProseBody(container: HTMLElement, expectedText: string): HTMLElement | null {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>('.prose'));
  for (const el of candidates) {
    if ((el.textContent ?? '').includes(expectedText)) return el;
  }
  return null;
}

function expectProseSm(el: Element | null | undefined): void {
  expect(el, 'expected a .prose body container that contains the text').toBeTruthy();
  const cls = el!.className;
  expect(cls, `prose missing on: ${cls}`).toContain('prose');
  expect(cls, `prose-sm missing on: ${cls}`).toContain('prose-sm');
}

describe('CR-044 — typography parity (prose prose-sm)', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
  });

  it('ItemCardList narrative card body uses prose prose-sm', () => {
    const bucket: any = {
      standardCode: '1',
      specCode: 'a',
      standardTitle: 'Mission',
      specPrompt: 'p',
      narratives: [
        {
          sectionId: 's1',
          heading: 'Narrative A',
          snippet: 'This is the narrative body text the PC reads to decide.',
          wordCount: 12,
          confidence: 0.9,
          rationale: '',
        },
      ],
      evidenceText: [],
      evidenceFiles: [],
      matrixCells: [],
      coverageScore: null,
      coverageCovered: null,
      coverageGaps: [],
      coverageStrengths: [],
    };
    const { container } = render(
      <ItemCardList
        selectedKey="1.a"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={() => {}}
      />
    );
    // The narrative body container renders the snippet text inside a
    // `prose prose-sm` div per CR-044.
    const body = findProseBody(container, 'This is the narrative body text');
    expectProseSm(body);
  });

  it('StandaloneCVReview CV preview body uses prose prose-sm', () => {
    useAIImportStore.setState({
      cvs: [
        {
          sectionId: 'cv-1',
          facultyName: 'Dr. Alice',
          snippet:
            'CV body content lifted to prose prose-sm so it matches the editor baseline.',
          confidence: 0.95,
          routing: { source: 'matcher' },
        } as any,
      ],
    });
    const { container } = render(<StandaloneCVReview />);
    const body = findProseBody(container, 'CV body content lifted to prose prose-sm');
    expectProseSm(body);
  });

  it('MissingFragmentsView fragment body uses prose prose-sm', () => {
    const fragments = [
      {
        sectionId: 'frag-1',
        snippet:
          'Missing fragment body — the parser flagged this as unaccounted for.',
        heading: 'Some heading',
        kind: 'narrative',
      },
    ];
    const { container } = render(
      <MissingFragmentsView
        fragments={fragments as any}
        resolvedIds={new Set<string>()}
      />
    );
    const body = findProseBody(container, 'Missing fragment body');
    expectProseSm(body);
  });
});

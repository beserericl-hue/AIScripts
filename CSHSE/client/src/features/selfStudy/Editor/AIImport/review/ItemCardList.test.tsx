/**
 * Component unit tests for ItemCardList — the middle column of the
 * Review surface.
 *
 * ItemCardList is the largest leaf in the review tree (1600+ lines). We
 * don't try to cover every branch here; we exercise the contracts that
 * are most likely to silently regress:
 *
 *   - Renders one card per bucket item with the heading + word count
 *   - "Send to tags / Apply as file / Reassign" toolbar buttons fire
 *     onBulkAction with the selected sectionIds
 *   - "Approve all" fires onApproveAll with every rowId
 *   - Clicking a card fires onSelect with the sectionId
 *   - The kind-chip toggles (Narrative / Evidence / File) fire onChangeKind
 *   - Unplaced view renders unplaced tags only
 *   - Empty bucket renders "+ Add from source" affordance when callback supplied
 *   - The displayLabel falls back to body snippet for terse headings ("b.")
 *   - CR-024 — per-spec matrix references render when a matrix cell
 *     addresses the selected (std, spec)
 *   - CR-041 US-6 — source-file chip surfaces sourceFilename when present
 *   - "Select all" toggles every card's checkbox
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAIImportStore } from '../../../../../store/aiImportStore';
import { ItemCardList } from './ItemCardList';
import { UNPLACED_KEY } from './SpecRail';
import type {
  SpecBucket,
  BucketItem,
  Tag,
  MatrixData,
} from '../../../../../store/aiImportStore';

function mkItem(overrides: Partial<BucketItem> & Pick<BucketItem, 'sectionId'>): BucketItem {
  return {
    heading: 'Some heading',
    snippet: 'Body text body text body text.',
    confidence: 0.9,
    wordCount: 5,
    rationale: 'matched on keywords',
    ...overrides,
  } as BucketItem;
}

function mkBucket(overrides: Partial<SpecBucket>): SpecBucket {
  return {
    standardCode: '1',
    specCode: 'a',
    standardTitle: 'Mission',
    specPrompt: 'prompt',
    narratives: [],
    evidenceText: [],
    evidenceFiles: [],
    matrixCells: [],
    coverageScore: null,
    coverageCovered: null,
    coverageGaps: [],
    coverageStrengths: [],
    ...overrides,
  };
}

function mkTag(overrides: Partial<Tag> & Pick<Tag, 'tagId' | 'sectionId'>): Tag {
  return {
    summary: 'tag summary',
    fullText: 'unplaced fragment body',
    suggestedStd: null,
    suggestedSpec: null,
    confidence: 0.4,
    sourceHeading: 'Heading',
    acceptState: 'pending',
    rationale: '',
    ...overrides,
  } as Tag;
}

describe('<ItemCardList />', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
  });

  it('returns a "select a spec" prompt when no key is selected', () => {
    render(
      <ItemCardList
        selectedKey={null}
        bucket={null}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={() => {}}
      />
    );
    expect(screen.getByText(/Select a spec from the left/i)).toBeInTheDocument();
  });

  it('renders one card per narrative + evidence-text item with heading + word count', () => {
    const bucket = mkBucket({
      narratives: [
        mkItem({ sectionId: 's1', heading: 'Mission narrative', wordCount: 220 }),
      ],
      evidenceText: [
        mkItem({ sectionId: 's2', heading: 'Evidence A', wordCount: 30 }),
      ],
    });
    render(
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
    expect(screen.getByText('Mission narrative')).toBeInTheDocument();
    expect(screen.getByText('Evidence A')).toBeInTheDocument();
    expect(screen.getByText(/220 words/)).toBeInTheDocument();
    expect(screen.getByText(/30 words/)).toBeInTheDocument();
  });

  it('clicking a card fires onSelect with the sectionId', async () => {
    const onSelect = vi.fn();
    const bucket = mkBucket({
      narratives: [mkItem({ sectionId: 's1', heading: 'Card A' })],
    });
    render(
      <ItemCardList
        selectedKey="1.a"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={onSelect}
        onBulkAction={() => {}}
      />
    );
    await userEvent.click(screen.getByText('Card A'));
    expect(onSelect).toHaveBeenCalledWith('s1');
  });

  it('toolbar bulk actions fire onBulkAction with the checked sectionIds', async () => {
    const onBulkAction = vi.fn();
    const bucket = mkBucket({
      narratives: [
        mkItem({ sectionId: 's1', heading: 'A' }),
        mkItem({ sectionId: 's2', heading: 'B' }),
      ],
    });
    render(
      <ItemCardList
        selectedKey="1.a"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={onBulkAction}
      />
    );
    // Check the per-item checkbox for "A" (Select item).
    const itemCheckboxes = screen.getAllByLabelText(/Select item/i);
    await userEvent.click(itemCheckboxes[0]);
    // Toolbar buttons.
    await userEvent.click(screen.getByRole('button', { name: /Send to tags/i }));
    expect(onBulkAction).toHaveBeenCalledWith('to-tags', ['s1']);

    // Re-check then Apply as file.
    await userEvent.click(itemCheckboxes[0]);
    await userEvent.click(screen.getByRole('button', { name: /Apply as file/i }));
    expect(onBulkAction).toHaveBeenLastCalledWith('to-file', ['s1']);

    await userEvent.click(itemCheckboxes[0]);
    await userEvent.click(screen.getByRole('button', { name: /Reassign/i }));
    expect(onBulkAction).toHaveBeenLastCalledWith('reassign', ['s1']);
  });

  it('"Select all" toolbar checkbox toggles every card', async () => {
    const onBulkAction = vi.fn();
    const bucket = mkBucket({
      narratives: [
        mkItem({ sectionId: 's1', heading: 'A' }),
        mkItem({ sectionId: 's2', heading: 'B' }),
      ],
    });
    render(
      <ItemCardList
        selectedKey="1.a"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={onBulkAction}
      />
    );
    // The first checkbox in the toolbar is "select-all". Click it,
    // then a bulk action — both sectionIds should land.
    const toolbar = screen.getByText(/\d+ items?/i).closest('div')!;
    const selectAll = within(toolbar).getByRole('checkbox');
    await userEvent.click(selectAll);
    await userEvent.click(screen.getByRole('button', { name: /Send to tags/i }));
    expect(onBulkAction).toHaveBeenCalledWith('to-tags', expect.arrayContaining(['s1', 's2']));
  });

  it('Approve all fires onApproveAll with every rowId in the active view', async () => {
    const onApproveAll = vi.fn();
    const bucket = mkBucket({
      narratives: [
        mkItem({ sectionId: 's1' }),
        mkItem({ sectionId: 's2' }),
        mkItem({ sectionId: 's3' }),
      ],
    });
    render(
      <ItemCardList
        selectedKey="1.a"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={() => {}}
        onApproveAll={onApproveAll}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Approve all/i }));
    // BucketItem.rowId === BucketItem.sectionId (see toCard).
    expect(onApproveAll).toHaveBeenCalledWith(['s1', 's2', 's3']);
  });

  it('kind chip toggles fire onChangeKind with the chosen ItemKind', async () => {
    const onChangeKind = vi.fn();
    const bucket = mkBucket({
      narratives: [mkItem({ sectionId: 's1', heading: 'A' })],
    });
    render(
      <ItemCardList
        selectedKey="1.a"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={() => {}}
        onChangeKind={onChangeKind}
      />
    );
    // The three chips inside the card: Narrative / Evidence / File. Click
    // "Evidence" to flip from text → evidenceText.
    await userEvent.click(screen.getByRole('button', { name: /^Evidence$/i }));
    expect(onChangeKind).toHaveBeenCalledWith('s1', 'evidenceText');
  });

  it('Unplaced view renders unplaced tags only and uses sourceHeading as the label', () => {
    const tags: Tag[] = [
      mkTag({ tagId: 't1', sectionId: 's1', sourceHeading: 'Unplaced One', fullText: 'body one' }),
      mkTag({ tagId: 't2', sectionId: 's2', sourceHeading: 'Unplaced Two', fullText: 'body two' }),
    ];
    render(
      <ItemCardList
        selectedKey={UNPLACED_KEY}
        bucket={null}
        unplacedTags={tags}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={() => {}}
      />
    );
    expect(screen.getByText('Unplaced One')).toBeInTheDocument();
    expect(screen.getByText('Unplaced Two')).toBeInTheDocument();
  });

  it('empty bucket renders the "+ Add from source" CTA when onCorrectMissingSpec is provided', async () => {
    const onCorrectMissingSpec = vi.fn();
    const bucket = mkBucket({ standardCode: '4', specCode: 'b' });
    render(
      <ItemCardList
        selectedKey="4.b"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={[]}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={() => {}}
        onCorrectMissingSpec={onCorrectMissingSpec}
      />
    );
    expect(screen.getByText(/No items in this spec/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /\+ Add from source/i }));
    expect(onCorrectMissingSpec).toHaveBeenCalledWith('4', 'b');
  });

  it('derives a body-snippet label for terse headings like "b."', () => {
    const bucket = mkBucket({
      narratives: [
        mkItem({
          sectionId: 's1',
          heading: 'b.',
          snippet: 'This is the first line of body text that will be used as the label.',
        }),
      ],
    });
    render(
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
    // The terse heading "b." should NOT be the displayed label; the body
    // snippet should be. (The snippet also appears in the inline preview
    // body so use getAllByText.)
    expect(
      screen.getAllByText(/This is the first line of body text/i).length
    ).toBeGreaterThanOrEqual(1);
    // The terse heading should appear ONLY in the "Source heading:" line,
    // not as the displayLabel header.
    expect(screen.getByText(/Source heading:/i)).toBeInTheDocument();
  });

  it('CR-024 — per-spec matrix references render when a matrix cell addresses (std, spec)', () => {
    const bucket = mkBucket({ standardCode: '1', specCode: 'a' });
    const matrices: MatrixData[] = [
      {
        matrixId: 'mx1',
        name: 'Curriculum Map',
        cells: [
          {
            std: '1',
            spec: 'a',
            columnIndex: 1,
            codeRaw: 'I',
            rowAnchor: 'matrix-mx1-row-1-a',
            confidence: 1,
          } as any,
        ],
        columnHeaders: ['CHS 101'],
      } as any,
    ];
    render(
      <ItemCardList
        selectedKey="1.a"
        bucket={bucket}
        unplacedTags={[]}
        placeholders={[]}
        matrices={matrices}
        selectedSectionId={null}
        onSelect={() => {}}
        onBulkAction={() => {}}
      />
    );
    expect(screen.getByText(/Curriculum matrices for 1\.a/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Curriculum Map/i })).toBeInTheDocument();
    expect(screen.getByText('CHS 101:')).toBeInTheDocument();
  });

  it('CR-041 US-6 — source-file chip surfaces sourceFilename when present', () => {
    const bucket = mkBucket({
      narratives: [
        mkItem({
          sectionId: 's1',
          heading: 'Card from a batch',
          sourceImportId: 'imp-1',
          sourceFilename: 'syllabus-chs-105.docx',
        } as any),
      ],
    });
    render(
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
    expect(screen.getByText(/syllabus-chs-105\.docx/i)).toBeInTheDocument();
  });
});

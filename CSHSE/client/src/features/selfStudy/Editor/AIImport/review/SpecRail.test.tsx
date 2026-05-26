/**
 * Component unit tests for SpecRail — the left column of the Review surface.
 *
 * SpecRail is props-driven (no store hooks), which makes it the easiest
 * surface in the wizard to unit-test. We assert:
 *   - Buckets group by standard and render under "Standard N" headers
 *   - Coverage glyph (🟢 / 🟡 / 🔴) reflects the coverage fields
 *   - Synthetic Unplaced / Unwritten / Matrices buckets appear when
 *     their inputs are non-empty
 *   - CR-033 CVs + CR-040 evidence-docs entries render only when present
 *   - CR-039 Document + per-Standard Introductions render alongside specs
 *   - CR-040 Phase 3b "Missing from import" entry surfaces when
 *     missingFragmentCount > 0
 *   - Filter input narrows the visible specs
 *   - onSelect callback fires with the correct synthetic / spec key
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SpecRail,
  UNPLACED_KEY,
  UNWRITTEN_KEY,
  MATRICES_KEY,
  CVS_KEY,
  EVIDENCE_DOCS_KEY,
  MISSING_FRAGMENTS_KEY,
  INTRO_DOC_KEY,
} from './SpecRail';
import type {
  SpecBucket,
  PlaceholderSection,
  Tag,
  MatrixData,
  IntroductionBucket,
  CVItem,
  EvidenceDocItem,
} from '../../../../../store/aiImportStore';

function mkBucket(overrides: Partial<SpecBucket> & Pick<SpecBucket, 'standardCode' | 'specCode'>): SpecBucket {
  return {
    standardTitle: 'Standard',
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

function mkBuckets(...specs: Array<Partial<SpecBucket> & Pick<SpecBucket, 'standardCode' | 'specCode'>>): Record<string, SpecBucket> {
  const out: Record<string, SpecBucket> = {};
  for (const s of specs) {
    out[`${s.standardCode}.${s.specCode}`] = mkBucket(s);
  }
  return out;
}

const NO_TAGS: Tag[] = [];
const NO_PLACEHOLDERS: PlaceholderSection[] = [];
const NO_MATRICES: MatrixData[] = [];

describe('<SpecRail />', () => {
  it('groups buckets by standard and renders "Standard N" headers', () => {
    const buckets = mkBuckets(
      { standardCode: '1', specCode: 'a', standardTitle: 'Mission' },
      { standardCode: '1', specCode: 'b', standardTitle: 'Mission' },
      { standardCode: '2', specCode: 'a', standardTitle: 'Governance' },
    );
    render(
      <SpecRail
        buckets={buckets}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/Standard 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Standard 2/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /1\.a/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /1\.b/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /2\.a/ })).toBeInTheDocument();
  });

  it('renders coverage glyph reflecting bucket state', () => {
    const buckets = mkBuckets(
      { standardCode: '1', specCode: 'a', coverageCovered: true },
      { standardCode: '1', specCode: 'b', coverageScore: 0.6, coverageCovered: false },
      {
        standardCode: '1',
        specCode: 'c',
        narratives: [{ sectionId: 's', heading: 'h', snippet: 's', confidence: 1, wordCount: 5, rationale: '' } as any],
      },
    );
    render(
      <SpecRail
        buckets={buckets}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByRole('tab', { name: /1\.a/ }).textContent).toContain('🟢');
    expect(screen.getByRole('tab', { name: /1\.b/ }).textContent).toContain('🟡');
    expect(screen.getByRole('tab', { name: /1\.c/ }).textContent).toContain('🔴');
  });

  it('renders the synthetic Unplaced bucket with the unplaced tag count', () => {
    const tags: Tag[] = [
      { tagId: 't1', sectionId: 's1', suggestedStd: null, suggestedSpec: null } as any,
      { tagId: 't2', sectionId: 's2', suggestedStd: null, suggestedSpec: null } as any,
      { tagId: 't3', sectionId: 's3', suggestedStd: '1', suggestedSpec: 'a' } as any, // placed
    ];
    render(
      <SpecRail
        buckets={{}}
        tags={tags}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    const unplaced = screen.getByRole('tab', { name: /Unplaced/i });
    expect(unplaced).toBeInTheDocument();
    expect(unplaced.textContent).toContain('2');
  });

  it('renders Unwritten button only when placeholders are present', () => {
    const { rerender } = render(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    expect(screen.queryByRole('tab', { name: /Unwritten/i })).toBeNull();

    rerender(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={[{ paragraphIndex: 0, heading: 'h' } as any]}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByRole('tab', { name: /Unwritten/i })).toBeInTheDocument();
  });

  it('renders the Matrices entry only when at least one matrix is present', () => {
    const { rerender } = render(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    expect(screen.queryByRole('tab', { name: /^Matrices$/i })).toBeNull();

    const matrices: MatrixData[] = [
      { matrixId: 'mx1', name: 'Curriculum Map', cells: [], columnHeaders: [] } as any,
    ];
    rerender(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={matrices}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByRole('tab', { name: /Matrices/i })).toBeInTheDocument();
  });

  it('renders CVs entry only when cvs are present, and never on empty arrays', () => {
    const { rerender } = render(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        cvs={[]}
      />
    );
    expect(screen.queryByRole('tab', { name: /^CVs$/ })).toBeNull();

    const cvs: CVItem[] = [
      { sectionId: 's', facultyName: 'Dr. A', snippet: '', confidence: 0.9 } as any,
    ];
    rerender(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        cvs={cvs}
      />
    );
    expect(screen.getByRole('tab', { name: /CVs/i })).toBeInTheDocument();
  });

  it('renders Evidence files entry only when evidenceDocs are present', () => {
    const docs: EvidenceDocItem[] = [
      { sectionId: 's', kind: 'paper', title: 't', snippet: '', confidence: 0.9 } as any,
    ];
    render(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        evidenceDocs={docs}
      />
    );
    expect(screen.getByRole('tab', { name: /Evidence files/i })).toBeInTheDocument();
  });

  it('renders Document Introduction at the top when present', () => {
    const introductions: Record<string, IntroductionBucket> = {
      document: { scope: 'document', standardCode: null, items: [] },
    };
    render(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        introductions={introductions}
      />
    );
    expect(screen.getByRole('tab', { name: /Document Introduction/i })).toBeInTheDocument();
  });

  it('renders per-Standard Introduction sibling when intro bucket exists', () => {
    const buckets = mkBuckets({ standardCode: '3', specCode: 'a' });
    const introductions: Record<string, IntroductionBucket> = {
      'standard-3': { scope: 'standard', standardCode: '3', items: [] },
    };
    render(
      <SpecRail
        buckets={buckets}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        introductions={introductions}
      />
    );
    // The Standard-3 grouping should include an Introduction sibling.
    const introTab = screen.getAllByRole('tab').find(
      (el) => /Introduction/i.test(el.textContent || '')
    );
    expect(introTab).toBeTruthy();
  });

  it('renders "Missing from import" when missingFragmentCount > 0', () => {
    const { rerender } = render(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        missingFragmentCount={0}
      />
    );
    expect(screen.queryByRole('tab', { name: /Missing from import/i })).toBeNull();

    rerender(
      <SpecRail
        buckets={{}}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        missingFragmentCount={7}
      />
    );
    const missing = screen.getByRole('tab', { name: /Missing from import/i });
    expect(missing).toBeInTheDocument();
    expect(missing.textContent).toContain('7');
  });

  it('filter input narrows visible specs', async () => {
    const buckets = mkBuckets(
      { standardCode: '1', specCode: 'a', standardTitle: 'Mission Statement' },
      { standardCode: '1', specCode: 'b', standardTitle: 'Mission Statement' },
      { standardCode: '5', specCode: 'a', standardTitle: 'Governance' },
    );
    render(
      <SpecRail
        buckets={buckets}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
      />
    );
    const filter = screen.getByLabelText(/filter specifications/i);
    await userEvent.type(filter, 'Governance');
    expect(screen.queryByRole('tab', { name: /1\.a/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /1\.b/ })).toBeNull();
    expect(screen.getByRole('tab', { name: /5\.a/ })).toBeInTheDocument();
  });

  it('clicking a spec fires onSelect with the {std}.{spec} key', async () => {
    const buckets = mkBuckets({ standardCode: '4', specCode: 'b' });
    const onSelect = vi.fn();
    render(
      <SpecRail
        buckets={buckets}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={onSelect}
      />
    );
    await userEvent.click(screen.getByRole('tab', { name: /4\.b/ }));
    expect(onSelect).toHaveBeenCalledWith('4.b');
  });

  it('clicking synthetic buttons fires onSelect with the synthetic keys', async () => {
    const onSelect = vi.fn();
    render(
      <SpecRail
        buckets={{}}
        tags={[{ tagId: 't', sectionId: 's', suggestedStd: null, suggestedSpec: null } as any]}
        placeholders={[{ paragraphIndex: 0, heading: 'h' } as any]}
        matrices={[{ matrixId: 'mx', name: 'M', cells: [], columnHeaders: [] } as any]}
        selectedKey={null}
        onSelect={onSelect}
        missingFragmentCount={1}
        introductions={{ document: { scope: 'document', standardCode: null, items: [] } }}
      />
    );
    await userEvent.click(screen.getByRole('tab', { name: /Document Introduction/i }));
    expect(onSelect).toHaveBeenCalledWith(INTRO_DOC_KEY);

    await userEvent.click(screen.getByRole('tab', { name: /Matrices/i }));
    expect(onSelect).toHaveBeenCalledWith(MATRICES_KEY);

    await userEvent.click(screen.getByRole('tab', { name: /Unplaced/i }));
    expect(onSelect).toHaveBeenCalledWith(UNPLACED_KEY);

    await userEvent.click(screen.getByRole('tab', { name: /Unwritten/i }));
    expect(onSelect).toHaveBeenCalledWith(UNWRITTEN_KEY);

    await userEvent.click(screen.getByRole('tab', { name: /Missing from import/i }));
    expect(onSelect).toHaveBeenCalledWith(MISSING_FRAGMENTS_KEY);
  });

  it('marks the active tab with aria-selected="true"', () => {
    const buckets = mkBuckets({ standardCode: '1', specCode: 'a' });
    render(
      <SpecRail
        buckets={buckets}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey="1.a"
        onSelect={() => {}}
      />
    );
    expect(screen.getByRole('tab', { name: /1\.a/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('"+ Add" buttons fire onAddFromSourceForIntro with the correct intro bucket key', async () => {
    const buckets = mkBuckets({ standardCode: '3', specCode: 'a' });
    const introductions: Record<string, IntroductionBucket> = {
      document: { scope: 'document', standardCode: null, items: [] },
      'standard-3': { scope: 'standard', standardCode: '3', items: [] },
    };
    const onAddFromSourceForIntro = vi.fn();
    render(
      <SpecRail
        buckets={buckets}
        tags={NO_TAGS}
        placeholders={NO_PLACEHOLDERS}
        matrices={NO_MATRICES}
        selectedKey={null}
        onSelect={() => {}}
        introductions={introductions}
        onAddFromSourceForIntro={onAddFromSourceForIntro}
      />
    );
    const addButtons = screen.getAllByRole('button', { name: /^\+ Add$/i });
    expect(addButtons.length).toBe(2); // one for document, one for standard-3
    await userEvent.click(addButtons[0]);
    expect(onAddFromSourceForIntro).toHaveBeenCalledWith('document');
    await userEvent.click(addButtons[1]);
    expect(onAddFromSourceForIntro).toHaveBeenCalledWith('standard-3');
  });
});

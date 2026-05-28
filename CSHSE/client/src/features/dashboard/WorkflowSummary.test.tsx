/**
 * CR-047 — unit tests for the PC dashboard workflow pipeline component.
 *
 * Covers acceptance: renders the four workflow sections; count tiles reflect
 * the summary payload; per-spec rows list only specs with > 0; empty-import
 * state; deep-link onClick fires the navigation callbacks with the correct
 * rail key.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WorkflowSummary, type WorkflowSummaryData } from './WorkflowSummary';

const baseSummary: WorkflowSummaryData = {
  import: {
    filename: '2024 CSHSE Self-Study Stevenson University.docx',
    importedAt: '2026-05-26T12:00:00.000Z',
    aiStatus: 'finished',
    fileCount: 1,
  },
  drafts: {
    cvs: 15,
    syllabi: 30,
    papers: 11,
    introductions: 4,
    specItems: 64,
    bySpec: [
      { std: '1', spec: 'a', count: 2 },
      { std: '2', spec: 'c', count: 5 },
    ],
  },
  selfStudy: {
    specsValidated: 1,
    specsTotal: 83,
    narrativesWritten: 12,
    matrixRows: 412,
    evidenceFiles: 9,
  },
  submit: {
    deadline: '2026-04-29T00:00:00.000Z',
    validated: 1,
    total: 83,
    ready: false,
  },
};

function renderWith(
  overrides: Partial<WorkflowSummaryData> = {},
  cbs: Partial<Record<string, any>> = {}
) {
  const onOpenImporter = cbs.onOpenImporter ?? vi.fn();
  const onOpenReview = cbs.onOpenReview ?? vi.fn();
  const onOpenSelfStudy = cbs.onOpenSelfStudy ?? vi.fn();
  const onSubmit = cbs.onSubmit ?? vi.fn();
  render(
    <WorkflowSummary
      summary={{ ...baseSummary, ...overrides }}
      isLoading={false}
      onOpenImporter={onOpenImporter}
      onOpenReview={onOpenReview}
      onOpenSelfStudy={onOpenSelfStudy}
      onSubmit={onSubmit}
    />
  );
  return { onOpenImporter, onOpenReview, onOpenSelfStudy, onSubmit };
}

describe('WorkflowSummary', () => {
  it('renders the four workflow sections', () => {
    renderWith();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Self-Study')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('shows the imported file name + status', () => {
    renderWith();
    expect(
      screen.getByText('2024 CSHSE Self-Study Stevenson University.docx')
    ).toBeInTheDocument();
    expect(screen.getByText(/finished/)).toBeInTheDocument();
  });

  it('renders draft count tiles reflecting the payload', () => {
    renderWith();
    // tile counts
    expect(screen.getByText('15')).toBeInTheDocument(); // CVs
    expect(screen.getByText('30')).toBeInTheDocument(); // Syllabi
    expect(screen.getByText('11')).toBeInTheDocument(); // Projects
    expect(screen.getByText('64')).toBeInTheDocument(); // Spec items
  });

  it('lists per-spec rows for specs with > 0 review items', () => {
    renderWith();
    expect(screen.getByText('Items in review, by spec')).toBeInTheDocument();
    expect(screen.getByText('1.a')).toBeInTheDocument();
    expect(screen.getByText('2.c')).toBeInTheDocument();
  });

  it('omits the per-spec section when no specs have items', () => {
    renderWith({
      drafts: { ...baseSummary.drafts, bySpec: [], specItems: 0 },
    });
    expect(screen.queryByText('Items in review, by spec')).not.toBeInTheDocument();
  });

  it('shows the empty-import state with an Open Importer CTA', () => {
    renderWith({ import: null });
    expect(screen.getByText('No document imported yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open Importer'));
  });

  it('deep-links each draft tile into Review with the matching rail key', () => {
    const { onOpenReview } = renderWith();
    fireEvent.click(screen.getByRole('button', { name: /CVs/i }));
    expect(onOpenReview).toHaveBeenCalledWith('_cvs');

    fireEvent.click(screen.getByRole('button', { name: /Syllabi/i }));
    expect(onOpenReview).toHaveBeenCalledWith('_evidence-docs:syllabus');

    fireEvent.click(screen.getByRole('button', { name: /Projects/i }));
    expect(onOpenReview).toHaveBeenCalledWith('_evidence-docs:paper');

    fireEvent.click(screen.getByRole('button', { name: /Introductions/i }));
    expect(onOpenReview).toHaveBeenCalledWith('_intro:document');
  });

  it('deep-links a per-spec row into Review with the real spec key', () => {
    const { onOpenReview } = renderWith();
    fireEvent.click(screen.getByText('1.a'));
    expect(onOpenReview).toHaveBeenCalledWith('1.a');
  });

  it('fires onOpenSelfStudy from the Self-Study CTA', () => {
    const { onOpenSelfStudy } = renderWith();
    fireEvent.click(screen.getByText('Open Self-Study'));
    expect(onOpenSelfStudy).toHaveBeenCalled();
  });

  it('disables the submit CTA until all specs are validated', () => {
    renderWith();
    const cta = screen.getByTestId('dashboard-submit-cta') as HTMLButtonElement;
    expect(cta).toBeDisabled();
  });

  it('enables the submit CTA when ready and fires onSubmit', () => {
    const { onSubmit } = renderWith({
      submit: { ...baseSummary.submit, ready: true, validated: 83 },
    });
    const cta = screen.getByTestId('dashboard-submit-cta') as HTMLButtonElement;
    expect(cta).not.toBeDisabled();
    fireEvent.click(cta);
    expect(onSubmit).toHaveBeenCalled();
  });

  it('renders a loading state', () => {
    render(
      <WorkflowSummary
        summary={null}
        isLoading
        onOpenImporter={vi.fn()}
        onOpenReview={vi.fn()}
        onOpenSelfStudy={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByTestId('workflow-summary-loading')).toBeInTheDocument();
  });
});

/**
 * CR-009 / Sprint 5.1 — CompilationTabView unit tests (pure view).
 *
 * Pins the highlight rules, each reader's Compliant / Non-compliant mark,
 * and the one-click Final-mark picker (Lauri CR Nov 2026: no 0-3 score).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CompilationTabView, SendToBoardPanel } from './CompilationTab';
import type { CompilationPayload } from './CompilationTab';

function wrap(children: React.ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const baseHandlers = {
  onSetFinal: vi.fn(),
  onClearFinal: vi.fn(),
  // CR-011 export toolbar
  exportMode: 'internal' as const,
  onChangeExportMode: vi.fn(),
  onExportSuggestions: vi.fn(),
};

const sample: CompilationPayload = {
  submissionId: 'sub-1',
  institutionName: 'Sample U',
  programName: 'Human Services',
  programLevel: 'bachelors',
  status: 'review_complete',
  readers: [
    { id: 'r1', name: 'Reader Alpha' },
    { id: 'r2', name: 'Reader Bravo' },
    { id: 'r3', name: 'Reader Charlie' },
  ],
  rows: [
    {
      standardCode: '1',
      specCode: 'a',
      marks: [
        { reviewerId: 'r1', reviewerName: 'Reader Alpha', mark: 'compliant' },
        { reviewerId: 'r2', reviewerName: 'Reader Bravo', mark: 'compliant' },
        { reviewerId: 'r3', reviewerName: 'Reader Charlie', mark: 'noncompliant' },
      ],
      hasNonCompliant: true,
      hasDisagreement: true,
      allAgree: false,
      finalMark: null,
      excluded: false,
    },
    {
      standardCode: '1',
      specCode: 'b',
      marks: [
        { reviewerId: 'r1', reviewerName: 'Reader Alpha', mark: 'compliant' },
        { reviewerId: 'r2', reviewerName: 'Reader Bravo', mark: 'compliant' },
      ],
      hasNonCompliant: false,
      hasDisagreement: false,
      allAgree: true,
      finalMark: 'compliant',
      finalSetByName: 'Lead Linda',
      excluded: false,
    },
    {
      standardCode: '2',
      specCode: 'a',
      marks: [],
      hasNonCompliant: false,
      hasDisagreement: false,
      allAgree: false,
      finalMark: null,
      excluded: true,
      excludedReason: 'Not applicable to bachelors',
    },
  ],
};

describe('CompilationTabView', () => {
  it('renders the loading state', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={null}
          isLoading
        />
      )
    );
    expect(screen.getByTestId('compilation-loading')).toBeInTheDocument();
  });

  it('renders the error state', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={null}
          isLoading={false}
          error="boom"
        />
      )
    );
    expect(screen.getByTestId('compilation-error')).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('renders the no-rows state when data has empty rows', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={{ ...sample, rows: [] }}
          isLoading={false}
        />
      )
    );
    expect(screen.getByTestId('compilation-no-rows')).toBeInTheDocument();
  });

  it('links the header to the per-reader Reader Reports (with and without rows)', () => {
    const { rerender } = render(
      wrap(<CompilationTabView {...baseHandlers} data={sample} isLoading={false} />)
    );
    expect(screen.getByTestId('compilation-reader-reports-link')).toHaveAttribute(
      'href',
      '/reader-report/sub-1'
    );
    // The entry point is present even before any reader scores exist.
    rerender(wrap(<CompilationTabView {...baseHandlers} data={{ ...sample, rows: [] }} isLoading={false} />));
    expect(screen.getByTestId('compilation-reader-reports-link')).toHaveAttribute(
      'href',
      '/reader-report/sub-1'
    );
  });

  it('header links to the site-visit checklist and itinerary (with and without rows)', () => {
    const { rerender } = render(wrap(<CompilationTabView {...baseHandlers} data={sample} isLoading={false} />));
    expect(screen.getByTestId('site-visit-checklist-link-sub-1')).toHaveAttribute('href', '/site-visit/sub-1/checklist');
    expect(screen.getByTestId('site-visit-itinerary-link-sub-1')).toHaveAttribute('href', '/site-visit/sub-1/itinerary');
    rerender(wrap(<CompilationTabView {...baseHandlers} data={{ ...sample, rows: [] }} isLoading={false} />));
    expect(screen.getByTestId('site-visit-checklist-link-sub-1')).toBeInTheDocument();
  });

  it('renders a column header per reader', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    expect(screen.getByTestId('compilation-reader-col-r1')).toBeInTheDocument();
    expect(screen.getByTestId('compilation-reader-col-r2')).toBeInTheDocument();
    expect(screen.getByTestId('compilation-reader-col-r3')).toBeInTheDocument();
  });

  it('marks the non-compliant/disagreement row with data attributes used for styling', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    const row = screen.getByTestId('compilation-row-1_a');
    expect(row).toHaveAttribute('data-noncompliant', 'true');
    expect(row).toHaveAttribute('data-disagreement', 'true');
  });

  it('marks the all-agree row without non-compliance or disagreement', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    const row = screen.getByTestId('compilation-row-1_b');
    expect(row).toHaveAttribute('data-noncompliant', 'false');
    expect(row).toHaveAttribute('data-disagreement', 'false');
  });

  it('marks excluded rows and hides the Final picker + Clear', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    const row = screen.getByTestId('compilation-row-2_a');
    expect(row).toHaveAttribute('data-excluded', 'true');
    expect(screen.queryByTestId('compilation-final-compliant-2_a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compilation-final-noncompliant-2_a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compilation-final-clear-2_a')).not.toBeInTheDocument();
  });

  it("shows each reader's Compliant / Non-compliant mark in their column, with no 0-3 score", () => {
    render(wrap(<CompilationTabView {...baseHandlers} data={sample} isLoading={false} />));
    expect(screen.getByTestId('compilation-cell-1_a-r1')).toHaveTextContent('Compliant');
    expect(screen.getByTestId('compilation-cell-1_a-r1')).not.toHaveTextContent('Non-compliant');
    expect(screen.getByTestId('compilation-cell-1_a-r3')).toHaveTextContent('Non-compliant');
    // A reader who did not mark the spec shows a dash.
    expect(screen.getByTestId('compilation-cell-1_b-r3')).toHaveTextContent('—');
    const table = screen.getByTestId('compilation');
    expect(table.textContent).not.toMatch(/0-3|0–3|Score|Partial|Largely/);
    expect(screen.queryByTestId('score-4-selector')).not.toBeInTheDocument();
  });

  it('clicking Non-compliant sets the Final mark for that spec', () => {
    const onSetFinal = vi.fn();
    render(wrap(<CompilationTabView {...baseHandlers} onSetFinal={onSetFinal} data={sample} isLoading={false} />));
    fireEvent.click(screen.getByTestId('compilation-final-noncompliant-1_a'));
    expect(onSetFinal).toHaveBeenCalledWith('1', 'a', 'noncompliant');
  });

  it('the current Final mark is pressed; clicking it again is a no-op, the other one switches', () => {
    const onSetFinal = vi.fn();
    render(wrap(<CompilationTabView {...baseHandlers} onSetFinal={onSetFinal} data={sample} isLoading={false} />));
    const c = screen.getByTestId('compilation-final-compliant-1_b');
    const nc = screen.getByTestId('compilation-final-noncompliant-1_b');
    expect(c).toHaveAttribute('aria-pressed', 'true');
    expect(nc).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(c);
    expect(onSetFinal).not.toHaveBeenCalled();
    fireEvent.click(nc);
    expect(onSetFinal).toHaveBeenCalledWith('1', 'b', 'noncompliant');
    expect(screen.getByText(/Set by Lead Linda/)).toBeInTheDocument();
  });

  it('no Clear button when no Final mark is set; picker disabled while saving', () => {
    render(wrap(<CompilationTabView {...baseHandlers} data={sample} isLoading={false} savingKey="1_a" />));
    expect(screen.queryByTestId('compilation-final-clear-1_a')).not.toBeInTheDocument();
    expect(screen.getByTestId('compilation-final-compliant-1_a')).toBeDisabled();
    expect(screen.getByTestId('compilation-final-noncompliant-1_a')).toBeDisabled();
  });

  it('clear button fires onClearFinal with the row key', () => {
    const onClearFinal = vi.fn();
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          onClearFinal={onClearFinal}
          data={sample}
          isLoading={false}
        />
      )
    );
    fireEvent.click(screen.getByTestId('compilation-final-clear-1_b'));
    expect(onClearFinal).toHaveBeenCalledWith('1', 'b');
  });

  it('CR-011 — export toolbar shows both mode radios + Generate button', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    expect(screen.getByTestId('compilation-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('suggestions-mode-internal')).toBeChecked();
    expect(screen.getByTestId('suggestions-mode-pc')).not.toBeChecked();
    expect(screen.getByTestId('suggestions-export-btn')).toBeInTheDocument();
  });

  it('CR-011 — toggling PC-facing fires onChangeExportMode("pc_facing")', () => {
    const onChangeExportMode = vi.fn();
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          onChangeExportMode={onChangeExportMode}
          data={sample}
          isLoading={false}
        />
      )
    );
    fireEvent.click(screen.getByTestId('suggestions-mode-pc'));
    expect(onChangeExportMode).toHaveBeenCalledWith('pc_facing');
  });

  it('CR-011 — Generate button fires onExportSuggestions and disables while exporting', () => {
    const onExportSuggestions = vi.fn();
    const { rerender } = render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          onExportSuggestions={onExportSuggestions}
          data={sample}
          isLoading={false}
        />
      )
    );
    fireEvent.click(screen.getByTestId('suggestions-export-btn'));
    expect(onExportSuggestions).toHaveBeenCalled();
    rerender(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          onExportSuggestions={onExportSuggestions}
          data={sample}
          isLoading={false}
          exporting
        />
      )
    );
    expect(screen.getByTestId('suggestions-export-btn')).toBeDisabled();
    expect(screen.getByText(/Generating/)).toBeInTheDocument();
  });

  it('legend renders all four highlight buckets', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    const legend = screen.getByTestId('compilation-legend');
    expect(legend).toHaveTextContent(/Any reader marked Non-compliant/);
    expect(legend).toHaveTextContent(/Disagreement/);
    expect(legend).toHaveTextContent(/All agree/);
    expect(legend).toHaveTextContent(/Excluded/);
  });

  // CR-022 / S13c — "Request change from admin" affordance.
  it('CR-022 — does not show the assignment-change box when not locked', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    expect(screen.queryByTestId('assignment-change-box')).not.toBeInTheDocument();
  });

  it('CR-022 — shows the locked box and reveals the reason form on open', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
          lockedPhase
          requestState="idle"
        />
      )
    );
    expect(screen.getByTestId('assignment-change-box')).toBeInTheDocument();
    // CR-052 / S12.3 — the box carries the DOM id the first-time hint balloon
    // anchors to; lock it so a refactor can't silently un-anchor the hint.
    expect(document.getElementById('assignment-change-box')).not.toBeNull();
    // form not visible until opened
    expect(screen.queryByTestId('assignment-change-reason')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('assignment-change-open'));
    expect(screen.getByTestId('assignment-change-reason')).toBeInTheDocument();
    // Send is disabled until a reason is typed
    expect(screen.getByTestId('assignment-change-send')).toBeDisabled();
  });

  it('CR-022 — Send fires onRequestAssignmentChange with the trimmed reason', () => {
    const onRequestAssignmentChange = vi.fn();
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
          lockedPhase
          requestState="idle"
          onRequestAssignmentChange={onRequestAssignmentChange}
        />
      )
    );
    fireEvent.click(screen.getByTestId('assignment-change-open'));
    fireEvent.change(screen.getByTestId('assignment-change-reason'), {
      target: { value: '  swap reader Smith  ' },
    });
    fireEvent.click(screen.getByTestId('assignment-change-send'));
    expect(onRequestAssignmentChange).toHaveBeenCalledWith('swap reader Smith');
  });

  it('CR-022 — confirms once the request is done', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
          lockedPhase
          requestState="done"
        />
      )
    );
    expect(screen.getByTestId('assignment-change-done')).toBeInTheDocument();
  });

  // CR-056 — the "send to board" panel renders inside the view.
  it('CR-056 — shows the done banner when the submission is review_complete', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
        />
      )
    );
    // sample.status === 'review_complete'
    expect(screen.getByTestId('send-to-board-done')).toBeInTheDocument();
    expect(screen.queryByTestId('send-to-board-box')).not.toBeInTheDocument();
  });

  it('CR-056 — shows the send box on an advanceable submission', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={{ ...sample, status: 'readers_assigned' }}
          isLoading={false}
        />
      )
    );
    expect(screen.getByTestId('send-to-board-box')).toBeInTheDocument();
    expect(screen.queryByTestId('send-to-board-done')).not.toBeInTheDocument();
  });
});

// CR-056 — "Complete review & send to board" panel (pure).
describe('SendToBoardPanel', () => {
  it('renders the done banner for review_complete', () => {
    render(<SendToBoardPanel status="review_complete" />);
    expect(screen.getByTestId('send-to-board-done')).toBeInTheDocument();
  });

  it('renders the decided banner for compliant / non_compliant', () => {
    const { rerender } = render(<SendToBoardPanel status="compliant" />);
    expect(screen.getByTestId('send-to-board-decided')).toBeInTheDocument();
    rerender(<SendToBoardPanel status="non_compliant" />);
    expect(screen.getByTestId('send-to-board-decided')).toBeInTheDocument();
  });

  it('renders nothing for a non-advanceable status (draft)', () => {
    const { container } = render(<SendToBoardPanel status="draft" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('two-step confirm: open reveals confirm/cancel, confirm fires onFinalizeToBoard', () => {
    const onFinalizeToBoard = vi.fn();
    render(<SendToBoardPanel status="under_review" onFinalizeToBoard={onFinalizeToBoard} />);
    // Step 1 — only the open button is visible.
    expect(screen.getByTestId('send-to-board-open')).toBeInTheDocument();
    expect(screen.queryByTestId('send-to-board-confirm')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('send-to-board-open'));
    // Step 2 — confirm + cancel appear.
    expect(screen.getByTestId('send-to-board-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('send-to-board-cancel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('send-to-board-confirm'));
    expect(onFinalizeToBoard).toHaveBeenCalled();
  });

  it('cancel returns to the single-button state without firing', () => {
    const onFinalizeToBoard = vi.fn();
    render(<SendToBoardPanel status="submitted" onFinalizeToBoard={onFinalizeToBoard} />);
    fireEvent.click(screen.getByTestId('send-to-board-open'));
    fireEvent.click(screen.getByTestId('send-to-board-cancel'));
    expect(screen.getByTestId('send-to-board-open')).toBeInTheDocument();
    expect(screen.queryByTestId('send-to-board-confirm')).not.toBeInTheDocument();
    expect(onFinalizeToBoard).not.toHaveBeenCalled();
  });

  it('disables the confirm button and surfaces the error while finalizing', () => {
    render(
      <SendToBoardPanel status="submitted" finalizing finalizeError="Boom from server" />
    );
    fireEvent.click(screen.getByTestId('send-to-board-open'));
    expect(screen.getByTestId('send-to-board-confirm')).toBeDisabled();
    expect(screen.getByTestId('send-to-board-error')).toHaveTextContent('Boom from server');
  });
});

/**
 * CR-009 / Sprint 5.1 — CompilationTabView unit tests (pure view).
 *
 * Pins the highlight rules and the inline Final-score editor.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CompilationTabView } from './CompilationTab';
import type { CompilationPayload } from './CompilationTab';

function wrap(children: React.ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const baseHandlers = {
  onBeginEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onChangePendingFinal: vi.fn(),
  onSaveFinal: vi.fn(),
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
      scores: [
        { reviewerId: 'r1', reviewerName: 'Reader Alpha', score: 3 },
        { reviewerId: 'r2', reviewerName: 'Reader Bravo', score: 2 },
        { reviewerId: 'r3', reviewerName: 'Reader Charlie', score: 0 },
      ],
      hasZero: true,
      hasDisagreement: true,
      allAgree: false,
      finalScore: null,
      excluded: false,
    },
    {
      standardCode: '1',
      specCode: 'b',
      scores: [
        { reviewerId: 'r1', reviewerName: 'Reader Alpha', score: 2 },
        { reviewerId: 'r2', reviewerName: 'Reader Bravo', score: 2 },
      ],
      hasZero: false,
      hasDisagreement: false,
      allAgree: true,
      finalScore: 2,
      finalSetByName: 'Lead Linda',
      excluded: false,
    },
    {
      standardCode: '2',
      specCode: 'a',
      scores: [],
      hasZero: false,
      hasDisagreement: false,
      allAgree: false,
      finalScore: null,
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

  it('marks the zero/disagreement row with data attributes used for styling', () => {
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
    expect(row).toHaveAttribute('data-haszero', 'true');
    expect(row).toHaveAttribute('data-disagreement', 'true');
  });

  it('marks the all-agree row without zero or disagreement', () => {
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
    expect(row).toHaveAttribute('data-haszero', 'false');
    expect(row).toHaveAttribute('data-disagreement', 'false');
  });

  it('marks excluded rows and hides Set/Change/Clear actions', () => {
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
    expect(screen.queryByTestId('compilation-final-edit-2_a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compilation-final-clear-2_a')).not.toBeInTheDocument();
  });

  it('beginEdit fires with the row key and current final score', () => {
    const onBeginEdit = vi.fn();
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          onBeginEdit={onBeginEdit}
          data={sample}
          isLoading={false}
        />
      )
    );
    fireEvent.click(screen.getByTestId('compilation-final-edit-1_b'));
    expect(onBeginEdit).toHaveBeenCalledWith('1', 'b', 2);
  });

  it('inline editor renders the 4-level selector and fires save', () => {
    const onSaveFinal = vi.fn();
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          onSaveFinal={onSaveFinal}
          data={sample}
          isLoading={false}
          editingKey="1_a"
          pendingFinalScore={2}
        />
      )
    );
    expect(screen.getByTestId('compilation-final-editor-1_a')).toBeInTheDocument();
    expect(screen.getByTestId('score-4-selector')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('compilation-final-save-1_a'));
    expect(onSaveFinal).toHaveBeenCalledWith('1', 'a');
  });

  it('save button is disabled when no pendingFinalScore is set', () => {
    render(
      wrap(
        <CompilationTabView
          {...baseHandlers}
          data={sample}
          isLoading={false}
          editingKey="1_a"
          pendingFinalScore={null}
        />
      )
    );
    expect(screen.getByTestId('compilation-final-save-1_a')).toBeDisabled();
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
    expect(legend).toHaveTextContent(/Any reader scored 0/);
    expect(legend).toHaveTextContent(/Disagreement/);
    expect(legend).toHaveTextContent(/All agree/);
    expect(legend).toHaveTextContent(/Excluded/);
  });
});

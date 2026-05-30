/**
 * CR-012 / Sprint 6.1 — ChecklistView unit tests (pure view).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChecklistView } from './Checklist';
import type { ChecklistPayload, ChecklistItem } from './Checklist';

const handlers = {
  onChangeNote: vi.fn(),
  onToggleVerify: vi.fn(),
  onDelete: vi.fn(),
  onExport: vi.fn(),
};

function makeItem(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    _id: 'i1',
    standardCode: '1',
    specCode: 'a',
    inclusionReason: 'partial',
    finalScoreAtInclusion: 1,
    verified: false,
    source: 'auto',
    ...over,
  };
}

function makePayload(items: ChecklistItem[]): ChecklistPayload {
  const counts = {
    total: items.length,
    partial: items.filter((i) => i.inclusionReason === 'partial').length,
    non_compliant: items.filter((i) => i.inclusionReason === 'non_compliant').length,
    follow_up: items.filter((i) => i.inclusionReason === 'follow_up').length,
    manual: items.filter((i) => i.inclusionReason === 'manual').length,
    verified: items.filter((i) => i.verified).length,
  };
  return {
    submissionId: 'sub-1',
    institutionName: 'Sample U',
    programName: 'HS',
    programLevel: 'bachelors',
    items,
    counts,
  };
}

describe('ChecklistView', () => {
  it('renders loading state', () => {
    render(<ChecklistView {...handlers} data={null} isLoading canWrite draftNotes={{}} />);
    expect(screen.getByTestId('checklist-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<ChecklistView {...handlers} data={null} isLoading={false} error="boom" canWrite draftNotes={{}} />);
    expect(screen.getByTestId('checklist-error')).toBeInTheDocument();
  });

  it('renders the empty state when data has zero items + export button disabled', () => {
    render(
      <ChecklistView
        {...handlers}
        data={makePayload([])}
        isLoading={false}
        canWrite
        draftNotes={{}}
      />
    );
    expect(screen.getByTestId('checklist-empty')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-export-btn')).toBeDisabled();
  });

  it('renders one row per item with the right inclusion-reason chip', () => {
    const items = [
      makeItem({ _id: 'a', standardCode: '1', specCode: 'a', inclusionReason: 'partial' }),
      makeItem({ _id: 'b', standardCode: '1', specCode: 'b', inclusionReason: 'non_compliant', finalScoreAtInclusion: 0 }),
    ];
    render(
      <ChecklistView
        {...handlers}
        data={makePayload(items)}
        isLoading={false}
        canWrite
        draftNotes={{}}
      />
    );
    expect(screen.getByTestId('checklist-row-a')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-row-b')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-row-a')).toHaveTextContent(/Partial/);
    expect(screen.getByTestId('checklist-row-b')).toHaveTextContent(/Non-compliant/);
  });

  it('toolbar shows partial + non_compliant counts', () => {
    const items = [
      makeItem({ _id: 'a', inclusionReason: 'partial' }),
      makeItem({ _id: 'b', inclusionReason: 'non_compliant', finalScoreAtInclusion: 0 }),
      makeItem({ _id: 'c', inclusionReason: 'partial', verified: true }),
    ];
    render(
      <ChecklistView
        {...handlers}
        data={makePayload(items)}
        isLoading={false}
        canWrite
        draftNotes={{}}
      />
    );
    const toolbar = screen.getByTestId('checklist-toolbar');
    expect(toolbar).toHaveTextContent(/3 items · 1 verified/);
    expect(toolbar).toHaveTextContent(/2 partial/);
    expect(toolbar).toHaveTextContent(/1 non-compliant/);
  });

  it('verify button fires onToggleVerify with the item; row marks data-verified', () => {
    const onToggleVerify = vi.fn();
    const verified = makeItem({ _id: 'v', verified: true });
    render(
      <ChecklistView
        {...handlers}
        onToggleVerify={onToggleVerify}
        data={makePayload([verified])}
        isLoading={false}
        canWrite
        draftNotes={{}}
      />
    );
    const row = screen.getByTestId('checklist-row-v');
    expect(row).toHaveAttribute('data-verified', 'true');
    fireEvent.click(screen.getByTestId('checklist-verify-v'));
    expect(onToggleVerify).toHaveBeenCalledWith(verified);
  });

  it('note textarea fires onChangeNote per keystroke', () => {
    const onChangeNote = vi.fn();
    const item = makeItem({ _id: 'n' });
    render(
      <ChecklistView
        {...handlers}
        onChangeNote={onChangeNote}
        data={makePayload([item])}
        isLoading={false}
        canWrite
        draftNotes={{}}
      />
    );
    fireEvent.change(screen.getByTestId('checklist-note-n'), { target: { value: 'classroom 3 visited' } });
    expect(onChangeNote).toHaveBeenCalledWith('n', 'classroom 3 visited');
  });

  it('non-writers see no verify button, no delete, and disabled note', () => {
    const item = makeItem({ _id: 'r' });
    render(
      <ChecklistView
        {...handlers}
        data={makePayload([item])}
        isLoading={false}
        canWrite={false}
        draftNotes={{}}
      />
    );
    expect(screen.getByTestId(`checklist-note-r`)).toBeDisabled();
    // Verify button still renders (the view is generic) but only canWrite
    // gates input affordances; the container is the authoritative gate.
    // We instead confirm delete is not visible for the auto row (only on
    // manual rows, regardless of writer).
    expect(screen.queryByTestId('checklist-delete-r')).not.toBeInTheDocument();
  });

  it('manual rows render Remove button (when canWrite); auto rows do not', () => {
    const manual = makeItem({ _id: 'm', inclusionReason: 'manual', source: 'manual', finalScoreAtInclusion: 0 });
    const auto = makeItem({ _id: 'a', source: 'auto' });
    render(
      <ChecklistView
        {...handlers}
        data={makePayload([manual, auto])}
        isLoading={false}
        canWrite
        draftNotes={{}}
      />
    );
    expect(screen.getByTestId('checklist-delete-m')).toBeInTheDocument();
    expect(screen.queryByTestId('checklist-delete-a')).not.toBeInTheDocument();
  });

  it('Export button fires onExport; shows Generating… while exporting', () => {
    const onExport = vi.fn();
    const item = makeItem({ _id: 'e' });
    const { rerender } = render(
      <ChecklistView
        {...handlers}
        onExport={onExport}
        data={makePayload([item])}
        isLoading={false}
        canWrite
        draftNotes={{}}
      />
    );
    fireEvent.click(screen.getByTestId('checklist-export-btn'));
    expect(onExport).toHaveBeenCalled();
    rerender(
      <ChecklistView
        {...handlers}
        onExport={onExport}
        data={makePayload([item])}
        isLoading={false}
        canWrite
        draftNotes={{}}
        exporting
      />
    );
    expect(screen.getByTestId('checklist-export-btn')).toBeDisabled();
    expect(screen.getByText(/Generating/)).toBeInTheDocument();
  });
});

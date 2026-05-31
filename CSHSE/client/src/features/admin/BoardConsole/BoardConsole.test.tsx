/**
 * CR-053 / Sprint 7.1 — BoardConsoleView unit tests (pure view).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardConsoleView } from './BoardConsole';
import type { QueueRow, UpcomingPayload } from './BoardConsole';

const handlers = { setDraft: vi.fn(), onRecord: vi.fn() };

const queue: QueueRow[] = [
  { _id: 'q1', submissionId: '2026-001', institutionName: 'Sample U', programName: 'HS', programLevel: 'bachelors', status: 'review_complete' },
];

const upcoming: UpcomingPayload = {
  withinDays: 365,
  horizon: '2027-05-30T00:00:00.000Z',
  expiring: [
    { _id: 'e1', submissionId: '2024-018', institutionName: 'Expires Soon', programName: 'HS', programLevel: 'bachelors', status: 'compliant', expiresAt: '2026-07-30T00:00:00.000Z' },
  ],
  tabled: [
    { _id: 't1', submissionId: '2025-007', institutionName: 'Tabled', programName: 'HS', programLevel: 'masters', status: 'review_complete', reconsiderAt: '2026-08-15T00:00:00.000Z' },
  ],
};

describe('BoardConsoleView', () => {
  it('renders loading', () => {
    render(<BoardConsoleView {...handlers} queue={[]} upcoming={null} isLoading drafts={{}} />);
    expect(screen.getByTestId('board-loading')).toBeInTheDocument();
  });

  it('renders error', () => {
    render(<BoardConsoleView {...handlers} queue={[]} upcoming={null} isLoading={false} error="boom" drafts={{}} />);
    expect(screen.getByTestId('board-error')).toBeInTheDocument();
  });

  it('renders queue + upcoming sections + row count in headers', () => {
    render(<BoardConsoleView {...handlers} queue={queue} upcoming={upcoming} isLoading={false} drafts={{}} />);
    expect(screen.getByTestId('board-console')).toBeInTheDocument();
    expect(screen.getByTestId('board-row-q1')).toBeInTheDocument();
    expect(screen.getByTestId('board-upcoming-exp-e1')).toBeInTheDocument();
    expect(screen.getByTestId('board-upcoming-tab-t1')).toBeInTheDocument();
    expect(screen.getByText(/Awaiting decision \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Upcoming cycles \(2\)/)).toBeInTheDocument();
  });

  it('shows the empty state for queue + upcoming when both empty', () => {
    render(
      <BoardConsoleView
        {...handlers}
        queue={[]}
        upcoming={{ withinDays: 90, horizon: 'x', expiring: [], tabled: [] }}
        isLoading={false}
        drafts={{}}
      />
    );
    expect(screen.getByTestId('board-queue-empty')).toBeInTheDocument();
    expect(screen.getByTestId('board-upcoming-empty')).toBeInTheDocument();
  });

  it('default draft outcome is "accept"; selecting "table" surfaces the reconsider date input', () => {
    const setDraft = vi.fn();
    const { rerender } = render(
      <BoardConsoleView
        {...handlers}
        setDraft={setDraft}
        queue={queue}
        upcoming={upcoming}
        isLoading={false}
        drafts={{}}
      />
    );
    expect(screen.getByTestId('board-outcome-q1')).toHaveValue('accept');
    // No reconsider field by default.
    expect(screen.queryByTestId('board-reconsider-q1')).not.toBeInTheDocument();
    // Effective + Expires fields show by default (outcome=accept).
    expect(screen.getByTestId('board-effective-q1')).toBeInTheDocument();
    expect(screen.getByTestId('board-expires-q1')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('board-outcome-q1'), { target: { value: 'table' } });
    expect(setDraft).toHaveBeenCalledWith('q1', { outcome: 'table' });

    rerender(
      <BoardConsoleView
        {...handlers}
        setDraft={setDraft}
        queue={queue}
        upcoming={upcoming}
        isLoading={false}
        drafts={{ q1: { outcome: 'table', comments: 'pending clarification' } }}
      />
    );
    expect(screen.getByTestId('board-reconsider-q1')).toBeInTheDocument();
    expect(screen.queryByTestId('board-effective-q1')).not.toBeInTheDocument();
  });

  it('Record button disabled until comments non-empty; fires onRecord with row id', () => {
    const onRecord = vi.fn();
    const { rerender } = render(
      <BoardConsoleView
        {...handlers}
        onRecord={onRecord}
        queue={queue}
        upcoming={upcoming}
        isLoading={false}
        drafts={{ q1: { outcome: 'accept', comments: '' } }}
      />
    );
    expect(screen.getByTestId('board-record-q1')).toBeDisabled();
    rerender(
      <BoardConsoleView
        {...handlers}
        onRecord={onRecord}
        queue={queue}
        upcoming={upcoming}
        isLoading={false}
        drafts={{ q1: { outcome: 'accept', comments: 'looks good' } }}
      />
    );
    fireEvent.click(screen.getByTestId('board-record-q1'));
    expect(onRecord).toHaveBeenCalledWith('q1');
  });

  it('Comment input fires setDraft', () => {
    const setDraft = vi.fn();
    render(
      <BoardConsoleView
        {...handlers}
        setDraft={setDraft}
        queue={queue}
        upcoming={upcoming}
        isLoading={false}
        drafts={{}}
      />
    );
    fireEvent.change(screen.getByTestId('board-comments-q1'), { target: { value: 'All criteria met.' } });
    expect(setDraft).toHaveBeenCalledWith('q1', { comments: 'All criteria met.' });
  });
});

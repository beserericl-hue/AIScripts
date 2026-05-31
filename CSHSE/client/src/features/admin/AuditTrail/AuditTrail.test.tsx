/**
 * CR-020 / Sprint 7.3 — AuditTrailView unit tests (pure view).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditTrailView } from './AuditTrail';
import type { AuditEntry } from './AuditTrail';

const handlers = {
  onChangeFilter: vi.fn(),
  onRefresh: vi.fn(),
  onExport: vi.fn(),
};

const sample: AuditEntry[] = [
  {
    _id: 'a1',
    action: 'board.decision_recorded',
    actorName: 'Alex Admin',
    actorRole: 'admin',
    targetType: 'submission',
    targetId: 'sub-abc',
    submissionId: 'sub-abc',
    payload: { outcome: 'accept', priorOutcome: null },
    timestamp: '2026-05-30T12:00:00.000Z',
    reason: 'All criteria met.'
  },
  {
    _id: 'a2',
    action: 'compilation.final_set',
    actorName: 'Lead Linda',
    actorRole: 'lead_reader',
    targetType: 'submission',
    targetId: 'sub-abc',
    submissionId: 'sub-abc',
    payload: { score: 3, priorScore: 2, standardCode: '1', specCode: 'a' },
    timestamp: '2026-05-30T11:00:00.000Z'
  },
];

describe('AuditTrailView', () => {
  it('renders the filter bar + table headers', () => {
    render(
      <AuditTrailView
        {...handlers}
        entries={[]}
        total={0}
        isLoading={false}
        filter={{}}
      />
    );
    expect(screen.getByTestId('audit-trail')).toBeInTheDocument();
    expect(screen.getByTestId('audit-filters')).toBeInTheDocument();
    // "Action" matches both the header and the filter label — assert specifically.
    expect(screen.getByText('When')).toBeInTheDocument();
    expect(screen.getAllByText(/Action/).length).toBeGreaterThan(0);
    expect(screen.getByText('Actor')).toBeInTheDocument();
  });

  it('renders the empty state when no entries', () => {
    render(
      <AuditTrailView
        {...handlers}
        entries={[]}
        total={0}
        isLoading={false}
        filter={{}}
      />
    );
    expect(screen.getByTestId('audit-empty')).toBeInTheDocument();
  });

  it('renders one row per entry; shows actor + payload', () => {
    render(
      <AuditTrailView
        {...handlers}
        entries={sample}
        total={2}
        isLoading={false}
        filter={{}}
      />
    );
    expect(screen.getByTestId('audit-row-a1')).toHaveTextContent(/board\.decision_recorded/);
    expect(screen.getByTestId('audit-row-a1')).toHaveTextContent(/Alex Admin/);
    expect(screen.getByTestId('audit-row-a1')).toHaveTextContent(/All criteria met/);
    expect(screen.getByTestId('audit-row-a2')).toHaveTextContent(/Lead Linda/);
    expect(screen.getByTestId('audit-count')).toHaveTextContent('Showing 2 of 2');
  });

  it('typing into the action filter fires onChangeFilter', () => {
    const onChangeFilter = vi.fn();
    render(
      <AuditTrailView
        {...handlers}
        onChangeFilter={onChangeFilter}
        entries={[]}
        total={0}
        isLoading={false}
        filter={{}}
      />
    );
    fireEvent.change(screen.getByTestId('audit-filter-action'), { target: { value: 'comment.relayed' } });
    expect(onChangeFilter).toHaveBeenCalledWith({ action: 'comment.relayed' });
  });

  it('Refresh + CSV buttons fire their handlers', () => {
    const onRefresh = vi.fn();
    const onExport = vi.fn();
    render(
      <AuditTrailView
        {...handlers}
        onRefresh={onRefresh}
        onExport={onExport}
        entries={[]}
        total={0}
        isLoading={false}
        filter={{}}
      />
    );
    fireEvent.click(screen.getByTestId('audit-refresh'));
    expect(onRefresh).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('audit-export-csv'));
    expect(onExport).toHaveBeenCalled();
  });

  it('error banner renders when error is set', () => {
    render(
      <AuditTrailView
        {...handlers}
        entries={[]}
        total={0}
        isLoading={false}
        filter={{}}
        error="boom"
      />
    );
    expect(screen.getByTestId('audit-error')).toHaveTextContent('boom');
  });
});

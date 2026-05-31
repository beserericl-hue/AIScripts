/**
 * CR-019 / Sprint 8.2 — JointVentureManagementView unit tests (pure view).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JointVentureManagementView } from './JointVentureManagement';
import type { JointVenture, InstitutionLite } from './JointVentureManagement';

const handlers = {
  onToggleArchived: vi.fn(),
  setDraft: vi.fn(),
  onCreate: vi.fn(),
  onArchive: vi.fn(),
};

const institutions: InstitutionLite[] = [
  { _id: 'i1', name: 'Alpha U', jointVentureId: null },
  { _id: 'i2', name: 'Beta C', jointVentureId: null },
  { _id: 'i3', name: 'Gamma I', jointVentureId: 'jv-other' },
];

const sampleJv: JointVenture = {
  _id: 'jv1',
  name: 'Coastal Consortium',
  description: 'Three coastal schools',
  institutionIds: ['i1', 'i2'],
  archived: false,
  createdByName: 'Alex Admin',
  createdAt: '2026-05-30T12:00:00Z',
};

describe('JointVentureManagementView', () => {
  it('renders loading state', () => {
    render(<JointVentureManagementView {...handlers} jvs={[]} institutions={[]} isLoading showArchived={false} draft={{ name: '', description: '', institutionIds: [] }} />);
    expect(screen.getByTestId('jv-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<JointVentureManagementView {...handlers} jvs={[]} institutions={[]} isLoading={false} error="boom" showArchived={false} draft={{ name: '', description: '', institutionIds: [] }} />);
    expect(screen.getByTestId('jv-error')).toBeInTheDocument();
  });

  it('filters the picker to eligible institutions (no jointVentureId)', () => {
    render(
      <JointVentureManagementView
        {...handlers}
        jvs={[sampleJv]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: '', description: '', institutionIds: [] }}
      />
    );
    expect(screen.getByTestId('jv-pick-i1')).toBeInTheDocument();
    expect(screen.getByTestId('jv-pick-i2')).toBeInTheDocument();
    // i3 is already in another JV — must not appear.
    expect(screen.queryByTestId('jv-pick-i3')).not.toBeInTheDocument();
  });

  it('Create button disabled until name set + ≥2 institutions picked', () => {
    const { rerender } = render(
      <JointVentureManagementView
        {...handlers}
        jvs={[]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: '', description: '', institutionIds: [] }}
      />
    );
    expect(screen.getByTestId('jv-create-submit')).toBeDisabled();

    rerender(
      <JointVentureManagementView
        {...handlers}
        jvs={[]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: 'JV', description: '', institutionIds: ['i1'] }}
      />
    );
    expect(screen.getByTestId('jv-create-submit')).toBeDisabled();

    rerender(
      <JointVentureManagementView
        {...handlers}
        jvs={[]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: 'JV', description: '', institutionIds: ['i1', 'i2'] }}
      />
    );
    expect(screen.getByTestId('jv-create-submit')).not.toBeDisabled();
  });

  it('toggling an institution checkbox fires setDraft with the new institutionIds set', () => {
    const setDraft = vi.fn();
    render(
      <JointVentureManagementView
        {...handlers}
        setDraft={setDraft}
        jvs={[]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: '', description: '', institutionIds: ['i1'] }}
      />
    );
    fireEvent.click(screen.getByTestId('jv-pick-i2'));
    expect(setDraft).toHaveBeenCalledWith({ institutionIds: ['i1', 'i2'] });
  });

  it('Create button fires onCreate when enabled', () => {
    const onCreate = vi.fn();
    render(
      <JointVentureManagementView
        {...handlers}
        onCreate={onCreate}
        jvs={[]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: 'JV', description: '', institutionIds: ['i1', 'i2'] }}
      />
    );
    fireEvent.click(screen.getByTestId('jv-create-submit'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('renders a row per JV with member-count + Archive button on active rows', () => {
    render(
      <JointVentureManagementView
        {...handlers}
        jvs={[sampleJv]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: '', description: '', institutionIds: [] }}
      />
    );
    const row = screen.getByTestId('jv-row-jv1');
    expect(row).toHaveTextContent('Coastal Consortium');
    expect(row).toHaveTextContent('2 members');
    expect(row).toHaveTextContent(/Alpha U/);
    expect(row).toHaveTextContent(/Beta C/);
    expect(screen.getByTestId('jv-archive-jv1')).toBeInTheDocument();
  });

  it('archived rows hide the Archive button', () => {
    const archived: JointVenture = { ...sampleJv, archived: true };
    render(
      <JointVentureManagementView
        {...handlers}
        jvs={[archived]}
        institutions={institutions}
        isLoading={false}
        showArchived
        draft={{ name: '', description: '', institutionIds: [] }}
      />
    );
    expect(screen.queryByTestId('jv-archive-jv1')).not.toBeInTheDocument();
  });

  it('Archive button fires onArchive with the JV id', () => {
    const onArchive = vi.fn();
    render(
      <JointVentureManagementView
        {...handlers}
        onArchive={onArchive}
        jvs={[sampleJv]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: '', description: '', institutionIds: [] }}
      />
    );
    fireEvent.click(screen.getByTestId('jv-archive-jv1'));
    expect(onArchive).toHaveBeenCalledWith('jv1');
  });

  it('shows the "no eligible" notice when every institution is already in a JV', () => {
    const allTaken = institutions.map((i) => ({ ...i, jointVentureId: 'jv-other' }));
    render(
      <JointVentureManagementView
        {...handlers}
        jvs={[]}
        institutions={allTaken}
        isLoading={false}
        showArchived={false}
        draft={{ name: '', description: '', institutionIds: [] }}
      />
    );
    expect(screen.getByTestId('jv-no-eligible')).toBeInTheDocument();
  });

  it('toggle-archived button fires onToggleArchived', () => {
    const onToggleArchived = vi.fn();
    render(
      <JointVentureManagementView
        {...handlers}
        onToggleArchived={onToggleArchived}
        jvs={[]}
        institutions={institutions}
        isLoading={false}
        showArchived={false}
        draft={{ name: '', description: '', institutionIds: [] }}
      />
    );
    fireEvent.click(screen.getByTestId('jv-toggle-archived'));
    expect(onToggleArchived).toHaveBeenCalled();
  });
});

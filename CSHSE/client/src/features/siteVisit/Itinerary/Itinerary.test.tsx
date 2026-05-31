/**
 * CR-013 / Sprint 6.2 — ItineraryView unit tests (pure view).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItineraryView } from './Itinerary';
import type { ItineraryPayload, AgendaSlot } from './Itinerary';

const handlers = {
  setDraft: vi.fn(),
  onSave: vi.fn(),
  onExport: vi.fn(),
};

function makePayload(over: Partial<ItineraryPayload> = {}): ItineraryPayload {
  return {
    submissionId: 'sub-1',
    siteVisit: {
      _id: 'sv-1',
      scheduledDate: '2026-06-15T00:00:00.000Z',
      leadReaderName: 'Lead Linda',
      institutionName: 'Sample U',
      status: 'scheduled',
      agenda: [{ time: '09:00', activity: 'Welcome' }],
    },
    canCoEdit: true,
    ...over,
  };
}

describe('ItineraryView', () => {
  it('renders loading state', () => {
    render(<ItineraryView {...handlers} data={null} isLoading draft={[]} />);
    expect(screen.getByTestId('itin-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<ItineraryView {...handlers} data={null} isLoading={false} error="boom" draft={[]} />);
    expect(screen.getByTestId('itin-error')).toBeInTheDocument();
  });

  it('renders no-visit notice when siteVisit is null', () => {
    render(
      <ItineraryView
        {...handlers}
        data={makePayload({ siteVisit: null })}
        isLoading={false}
        draft={[]}
      />
    );
    expect(screen.getByTestId('itin-no-visit')).toBeInTheDocument();
  });

  it('renders one slot per draft entry; Save button visible when canCoEdit', () => {
    const draft: AgendaSlot[] = [
      { time: '09:00', activity: 'Welcome' },
      { time: '10:00', activity: 'Tour', location: 'Building A' },
    ];
    render(
      <ItineraryView {...handlers} data={makePayload()} isLoading={false} draft={draft} />
    );
    expect(screen.getByTestId('itin-slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('itin-slot-1')).toBeInTheDocument();
    expect(screen.getByTestId('itin-save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('itin-add-slot')).toBeInTheDocument();
  });

  it('typing into a slot field fires setDraft with the patched slot', () => {
    const setDraft = vi.fn();
    const draft: AgendaSlot[] = [{ time: '09:00', activity: 'Welcome' }];
    render(
      <ItineraryView
        {...handlers}
        setDraft={setDraft}
        data={makePayload()}
        isLoading={false}
        draft={draft}
      />
    );
    fireEvent.change(screen.getByTestId('itin-slot-0-location'), { target: { value: 'Lobby' } });
    expect(setDraft).toHaveBeenCalledWith([{ time: '09:00', activity: 'Welcome', location: 'Lobby' }]);
  });

  it('CSV-style fields round-trip attendees + specCodes', () => {
    const setDraft = vi.fn();
    const draft: AgendaSlot[] = [{ time: '09:00', activity: 'X', attendees: ['Pat', 'Lin'], specCodes: ['1.a'] }];
    render(
      <ItineraryView
        {...handlers}
        setDraft={setDraft}
        data={makePayload()}
        isLoading={false}
        draft={draft}
      />
    );
    expect((screen.getByTestId('itin-slot-0-attendees') as HTMLInputElement).value).toBe('Pat, Lin');
    expect((screen.getByTestId('itin-slot-0-specs') as HTMLInputElement).value).toBe('1.a');

    fireEvent.change(screen.getByTestId('itin-slot-0-specs'), { target: { value: '1.a, 2.b, 3.c' } });
    expect(setDraft).toHaveBeenCalledWith([
      { time: '09:00', activity: 'X', attendees: ['Pat', 'Lin'], specCodes: ['1.a', '2.b', '3.c'] },
    ]);
  });

  it('Add agenda slot appends an empty draft slot', () => {
    const setDraft = vi.fn();
    const draft: AgendaSlot[] = [{ time: '09:00', activity: 'Welcome' }];
    render(
      <ItineraryView
        {...handlers}
        setDraft={setDraft}
        data={makePayload()}
        isLoading={false}
        draft={draft}
      />
    );
    fireEvent.click(screen.getByTestId('itin-add-slot'));
    expect(setDraft).toHaveBeenCalledWith([
      { time: '09:00', activity: 'Welcome' },
      { time: '', activity: '' },
    ]);
  });

  it('Remove slot removes that index', () => {
    const setDraft = vi.fn();
    const draft: AgendaSlot[] = [
      { time: '09:00', activity: 'A' },
      { time: '10:00', activity: 'B' },
    ];
    render(
      <ItineraryView
        {...handlers}
        setDraft={setDraft}
        data={makePayload()}
        isLoading={false}
        draft={draft}
      />
    );
    fireEvent.click(screen.getByTestId('itin-slot-0-remove'));
    expect(setDraft).toHaveBeenCalledWith([{ time: '10:00', activity: 'B' }]);
  });

  it('read-only mode disables every input + hides Save/Add/Remove', () => {
    const draft: AgendaSlot[] = [{ time: '09:00', activity: 'A' }];
    render(
      <ItineraryView
        {...handlers}
        data={makePayload({ canCoEdit: false })}
        isLoading={false}
        draft={draft}
      />
    );
    expect(screen.getByTestId('itin-slot-0-time')).toBeDisabled();
    expect(screen.getByTestId('itin-slot-0-activity')).toBeDisabled();
    expect(screen.queryByTestId('itin-save-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('itin-add-slot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('itin-slot-0-remove')).not.toBeInTheDocument();
  });

  it('Save + Export buttons fire their handlers', () => {
    const onSave = vi.fn();
    const onExport = vi.fn();
    render(
      <ItineraryView
        {...handlers}
        onSave={onSave}
        onExport={onExport}
        data={makePayload()}
        isLoading={false}
        draft={[{ time: '09:00', activity: 'A' }]}
      />
    );
    fireEvent.click(screen.getByTestId('itin-save-btn'));
    expect(onSave).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('itin-export-btn'));
    expect(onExport).toHaveBeenCalled();
  });
});

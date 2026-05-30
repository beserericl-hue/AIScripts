/**
 * CR-023 — RelayConsoleView unit tests (pure view).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RelayConsoleView } from './RelayConsole';

const sample = [
  {
    _id: 'c1',
    submissionId: 'sub-1',
    standardCode: '1',
    specCode: 'a',
    authorName: 'Reader Jane',
    authorRole: 'reader' as const,
    selectedText: 'governance',
    content: 'Original raw comment.',
    relayed: false,
  },
  {
    _id: 'c2',
    submissionId: 'sub-1',
    standardCode: '2',
    specCode: 'b',
    authorName: 'Reader Bob',
    authorRole: 'reader' as const,
    selectedText: 'syllabus',
    content: 'Already sanitized text.',
    relayed: true,
    pcLabel: 'Reader A',
    relayedText: 'Cleaned-up text.',
  },
  {
    _id: 'c3',
    submissionId: 'sub-1',
    standardCode: '3',
    specCode: 'c',
    authorName: 'Reader Carla',
    authorRole: 'reader' as const,
    selectedText: 'evidence',
    content: 'Disputed comment.',
    relayed: false,
    boardEscalated: true,
  },
];

const baseHandlers = {
  setDraft: vi.fn(),
  onRelay: vi.fn(),
  onUnrelay: vi.fn(),
  onEscalate: vi.fn(),
};

describe('RelayConsoleView', () => {
  it('renders loading state', () => {
    render(
      <RelayConsoleView
        {...baseHandlers}
        comments={[]}
        isLoading
        draftsByComment={{}}
      />
    );
    expect(screen.getByTestId('relay-console-loading')).toBeInTheDocument();
  });

  it('renders the empty state when no queue items', () => {
    render(
      <RelayConsoleView
        {...baseHandlers}
        comments={[]}
        isLoading={false}
        draftsByComment={{}}
      />
    );
    expect(screen.getByTestId('relay-console-empty')).toBeInTheDocument();
  });

  it('renders a card per comment with state chips (Relayed / Escalated)', () => {
    render(
      <RelayConsoleView
        {...baseHandlers}
        comments={sample as any}
        isLoading={false}
        draftsByComment={{}}
      />
    );
    expect(screen.getByTestId('relay-card-c1')).toBeInTheDocument();
    expect(screen.getByTestId('relay-card-c2')).toBeInTheDocument();
    expect(screen.getByTestId('relay-card-c3')).toBeInTheDocument();
    expect(screen.getByText('Relayed')).toBeInTheDocument();
    expect(screen.getByText('Escalated')).toBeInTheDocument();
  });

  it('fires onRelay with the comment id when "Relay to PC" is clicked', () => {
    const onRelay = vi.fn();
    render(
      <RelayConsoleView
        {...baseHandlers}
        onRelay={onRelay}
        comments={[sample[0]] as any}
        isLoading={false}
        draftsByComment={{}}
      />
    );
    fireEvent.click(screen.getByTestId('relay-send-c1'));
    expect(onRelay).toHaveBeenCalledWith('c1');
  });

  it('relayed comments show "Un-relay" instead of "Escalate"', () => {
    render(
      <RelayConsoleView
        {...baseHandlers}
        comments={[sample[1]] as any}
        isLoading={false}
        draftsByComment={{}}
      />
    );
    expect(screen.getByTestId('relay-unrelay-c2')).toBeInTheDocument();
    expect(screen.queryByTestId('relay-escalate-c2')).not.toBeInTheDocument();
  });

  it('non-relayed comments show "Escalate"', () => {
    render(
      <RelayConsoleView
        {...baseHandlers}
        comments={[sample[0]] as any}
        isLoading={false}
        draftsByComment={{}}
      />
    );
    expect(screen.getByTestId('relay-escalate-c1')).toBeInTheDocument();
  });

  it('typing into the sanitized text + pcLabel + reason calls setDraft per change', () => {
    const setDraft = vi.fn();
    render(
      <RelayConsoleView
        {...baseHandlers}
        setDraft={setDraft}
        comments={[sample[0]] as any}
        isLoading={false}
        draftsByComment={{}}
      />
    );
    fireEvent.change(screen.getByTestId('relay-text-c1'), { target: { value: 'sanitized v1' } });
    fireEvent.change(screen.getByTestId('relay-pcLabel-c1'), { target: { value: 'Reader A' } });
    fireEvent.change(screen.getByTestId('relay-reason-c1'), { target: { value: 'OK to share' } });
    expect(setDraft).toHaveBeenCalledWith('c1', { relayedText: 'sanitized v1' });
    expect(setDraft).toHaveBeenCalledWith('c1', { pcLabel: 'Reader A' });
    expect(setDraft).toHaveBeenCalledWith('c1', { reason: 'OK to share' });
  });
});

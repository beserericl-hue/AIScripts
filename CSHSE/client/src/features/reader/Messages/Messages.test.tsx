/**
 * CR-010 / Sprint 5.4 — MessagesView unit tests (pure view).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessagesView } from './Messages';
import type { DmThread, DmMessage } from './Messages';

const handlers = {
  onSelectThread: vi.fn(),
  onChangeDraft: vi.fn(),
  onPost: vi.fn(),
};

const sampleThreads: DmThread[] = [
  {
    _id: 't1',
    subject: 'Question about 1.b',
    participantIds: ['u-lead', 'u-r2'],
    createdByName: 'Lead Linda',
    lastMessageAt: '2026-05-30T15:00:00Z',
    contextStandardCode: '1',
    contextSpecCode: 'b',
  },
  {
    _id: 't2',
    subject: 'Board prep',
    participantIds: ['u-lead', 'u-admin'],
    createdByName: 'Lead Linda',
    lastMessageAt: '2026-05-30T16:00:00Z',
  },
];

const sampleMessages: DmMessage[] = [
  {
    _id: 'm1',
    threadId: 't1',
    senderId: 'u-lead',
    senderName: 'Lead Linda',
    senderRole: 'lead_reader',
    content: 'Bob, could you clarify your 1.b score?',
    createdAt: '2026-05-30T15:00:00Z',
  },
];

describe('MessagesView', () => {
  it('renders loading state', () => {
    render(<MessagesView {...handlers} threads={[]} isLoading selectedThreadId={null} messages={[]} threadLoading={false} draft="" />);
    expect(screen.getByTestId('messages-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<MessagesView {...handlers} threads={[]} isLoading={false} error="boom" selectedThreadId={null} messages={[]} threadLoading={false} draft="" />);
    expect(screen.getByTestId('messages-error')).toBeInTheDocument();
  });

  it('renders the empty inbox state when no threads exist', () => {
    render(<MessagesView {...handlers} threads={[]} isLoading={false} selectedThreadId={null} messages={[]} threadLoading={false} draft="" />);
    expect(screen.getByTestId('messages-empty')).toBeInTheDocument();
  });

  // CR-052 / Sprint 12.3 — the Conversations header carries the DOM id the
  // first-time hint balloon anchors to. Lock the anchor so a refactor that
  // drops the id breaks loudly instead of silently un-anchoring the hint.
  it('Conversations header exposes the hint anchor id', () => {
    render(<MessagesView {...handlers} threads={sampleThreads} isLoading={false} selectedThreadId={null} messages={[]} threadLoading={false} draft="" />);
    expect(document.getElementById('messages-conversations-header')).not.toBeNull();
  });

  it('renders a row per thread; clicking calls onSelectThread', () => {
    const onSelectThread = vi.fn();
    render(
      <MessagesView
        {...handlers}
        onSelectThread={onSelectThread}
        threads={sampleThreads}
        isLoading={false}
        selectedThreadId={null}
        messages={[]}
        threadLoading={false}
        draft=""
      />
    );
    expect(screen.getByTestId('thread-t1')).toBeInTheDocument();
    expect(screen.getByTestId('thread-t2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('thread-t1'));
    expect(onSelectThread).toHaveBeenCalledWith('t1');
  });

  it('thread pane shows "select a conversation" when nothing is open', () => {
    render(
      <MessagesView
        {...handlers}
        threads={sampleThreads}
        isLoading={false}
        selectedThreadId={null}
        messages={[]}
        threadLoading={false}
        draft=""
      />
    );
    expect(screen.getByTestId('thread-pane-empty')).toBeInTheDocument();
  });

  it('thread pane renders messages and composer when a thread is open', () => {
    render(
      <MessagesView
        {...handlers}
        threads={sampleThreads}
        isLoading={false}
        selectedThreadId="t1"
        messages={sampleMessages}
        threadLoading={false}
        draft=""
      />
    );
    expect(screen.getByTestId('message-m1')).toBeInTheDocument();
    expect(screen.getByTestId('thread-composer')).toBeInTheDocument();
  });

  it('Send button is disabled when draft is empty; fires onPost when typed', () => {
    const onPost = vi.fn();
    const onChangeDraft = vi.fn();
    const { rerender } = render(
      <MessagesView
        {...handlers}
        onPost={onPost}
        onChangeDraft={onChangeDraft}
        threads={sampleThreads}
        isLoading={false}
        selectedThreadId="t1"
        messages={sampleMessages}
        threadLoading={false}
        draft=""
      />
    );
    expect(screen.getByTestId('thread-send')).toBeDisabled();
    fireEvent.change(screen.getByTestId('thread-composer'), { target: { value: 'reply' } });
    expect(onChangeDraft).toHaveBeenCalledWith('reply');
    rerender(
      <MessagesView
        {...handlers}
        onPost={onPost}
        onChangeDraft={onChangeDraft}
        threads={sampleThreads}
        isLoading={false}
        selectedThreadId="t1"
        messages={sampleMessages}
        threadLoading={false}
        draft="reply"
      />
    );
    fireEvent.click(screen.getByTestId('thread-send'));
    expect(onPost).toHaveBeenCalled();
  });
});

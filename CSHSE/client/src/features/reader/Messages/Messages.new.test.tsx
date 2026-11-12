/**
 * Messages — "New message": pick recipients from the review team, subject,
 * message, Send; and the container posts to the create-thread endpoint.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw-server';
import { Messages, MessagesView, type NewMessageDraft } from './Messages';
import { MemoryRouter } from 'react-router-dom';
import { TourProvider } from '../../tour/TourProvider';
import { HintProvider } from '../../tour/HintProvider';

const base = {
  threads: [], isLoading: false, selectedThreadId: null, onSelectThread: vi.fn(), messages: [],
  threadLoading: false, draft: '', onChangeDraft: vi.fn(), onPost: vi.fn(),
};
const team = [
  { _id: 'u-lead', name: 'Lauri Weiner', role: 'lead_reader' as const },
  { _id: 'u-r2', name: 'Cheryl McGill', role: 'reader' as const },
];

describe('Messages — New message (view)', () => {
  it('shows a New message button that opens the form', () => {
    const onOpenNew = vi.fn();
    render(<MessagesView {...base} onOpenNew={onOpenNew} />);
    fireEvent.click(screen.getByTestId('messages-new'));
    expect(onOpenNew).toHaveBeenCalled();
  });

  it('lists the review team as recipients and keeps Send disabled until To, subject and message are filled', () => {
    const draft: NewMessageDraft = { recipientIds: [], subject: '', message: '' };
    const onChangeNew = vi.fn();
    const { rerender } = render(<MessagesView {...base} onOpenNew={vi.fn()} recipients={team} newDraft={draft} onChangeNew={onChangeNew} onSendNew={vi.fn()} />);
    expect(screen.getByText('Lauri Weiner')).toBeInTheDocument();
    expect(screen.getByText('Lead reader')).toBeInTheDocument();
    expect(screen.getByTestId('messages-new-send')).toBeDisabled();
    fireEvent.click(screen.getByTestId('messages-new-to-u-r2'));
    expect(onChangeNew).toHaveBeenCalledWith({ ...draft, recipientIds: ['u-r2'] });
    rerender(<MessagesView {...base} onOpenNew={vi.fn()} recipients={team} newDraft={{ recipientIds: ['u-r2'], subject: 'Hi', message: 'Body' }} onChangeNew={onChangeNew} onSendNew={vi.fn()} />);
    expect(screen.getByTestId('messages-new-send')).toBeEnabled();
  });

  it('NEGATIVE: with nobody else on the team it says so and cannot send', () => {
    render(<MessagesView {...base} onOpenNew={vi.fn()} recipients={[]} newDraft={{ recipientIds: [], subject: 's', message: 'm' }} onChangeNew={vi.fn()} onSendNew={vi.fn()} />);
    expect(screen.getByTestId('messages-new-no-recipients')).toBeInTheDocument();
    expect(screen.getByTestId('messages-new-send')).toBeDisabled();
  });
});

describe('Messages — New message (container)', () => {
  it('posts the new thread and opens it', async () => {
    let posted: any = null;
    server.use(
      http.get(/\/api\/submissions\/s1\/messages\/recipients$/, () => HttpResponse.json({ recipients: team })),
      http.get(/\/api\/submissions\/s1\/messages$/, () => HttpResponse.json({ threads: posted ? [{ _id: 't9', subject: posted.subject, participantIds: [], createdByName: 'Me', lastMessageAt: '2026-11-12T00:00:00Z' }] : [] })),
      http.post(/\/api\/submissions\/s1\/messages$/, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ thread: { _id: 't9' }, message: { _id: 'm9' } }, { status: 201 });
      }),
      http.get(/\/api\/messages\/t9$/, () => HttpResponse.json({ thread: { _id: 't9' }, messages: [{ _id: 'm9', threadId: 't9', senderId: 'me', senderName: 'Me', senderRole: 'reader', content: 'Can we talk about 4.a?', createdAt: '2026-11-12T00:00:00Z' }] }))
    );
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><TourProvider><HintProvider><Messages submissionId="s1" /></HintProvider></TourProvider></MemoryRouter></QueryClientProvider>);
    fireEvent.click(await screen.findByTestId('messages-new'));
    fireEvent.click(await screen.findByTestId('messages-new-to-u-lead'));
    fireEvent.change(screen.getByTestId('messages-new-subject'), { target: { value: '4.a' } });
    fireEvent.change(screen.getByTestId('messages-new-body'), { target: { value: 'Can we talk about 4.a?' } });
    fireEvent.click(screen.getByTestId('messages-new-send'));
    await waitFor(() => expect(posted).toEqual({ subject: '4.a', participantIds: ['u-lead'], message: 'Can we talk about 4.a?' }));
    expect(await screen.findByTestId('message-m9')).toHaveTextContent('Can we talk about 4.a?');
    expect(screen.queryByTestId('messages-new-form')).not.toBeInTheDocument();
  });
});

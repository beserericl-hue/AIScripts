import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-server';
import { HelpChat } from './HelpChat';
import { useHelpChatStore } from '../store/helpChatStore';

describe('<HelpChat />', () => {
  // CR-052 — HelpChat's open state lives in a singleton zustand store.
  // Without an explicit reset between tests, the second test inherits an
  // open chat panel from the first.
  beforeEach(() => {
    useHelpChatStore.getState().close();
  });

  it('renders nothing when the help-chat webhook is not configured', async () => {
    server.use(
      http.get(/\/webhooks\/help\/status$/, () =>
        HttpResponse.json({ available: false })
      )
    );

    const { container } = render(<HelpChat />);
    // Wait one microtask so the status-check effect runs.
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the chat bubble when help-chat is available', async () => {
    server.use(
      http.get(/\/webhooks\/help\/status$/, () =>
        HttpResponse.json({ available: true })
      )
    );

    render(<HelpChat />);
    const toggle = await screen.findByRole('button', { name: /open help chat/i });
    expect(toggle).toBeInTheDocument();
  });

  it('opens the chat panel and exchanges a message round-trip', async () => {
    server.use(
      http.get(/\/webhooks\/help\/status$/, () =>
        HttpResponse.json({ available: true })
      ),
      http.post(/\/webhooks\/help\/chat$/, () =>
        HttpResponse.json({ answer: 'You can submit from the dashboard.', sources: [] })
      )
    );

    const user = userEvent.setup();
    render(<HelpChat />);
    const toggle = await screen.findByRole('button', { name: /open help chat/i });
    await user.click(toggle);

    // Welcome message appears once panel opens.
    await waitFor(() =>
      expect(screen.getByText(/how to use the Self-Study Portal/i)).toBeInTheDocument()
    );

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, 'How do I submit?');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('How do I submit?')).toBeInTheDocument();
    expect(
      await screen.findByText('You can submit from the dashboard.')
    ).toBeInTheDocument();
  });

  it('shows an error message when the chat backend errors', async () => {
    server.use(
      http.get(/\/webhooks\/help\/status$/, () =>
        HttpResponse.json({ available: true })
      ),
      http.post(/\/webhooks\/help\/chat$/, () =>
        HttpResponse.json({ error: 'oops' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    render(<HelpChat />);
    await user.click(await screen.findByRole('button', { name: /open help chat/i }));
    await user.type(screen.getByRole('textbox'), 'anything');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(
      await screen.findByText(/encountered an error/i)
    ).toBeInTheDocument();
  });
});

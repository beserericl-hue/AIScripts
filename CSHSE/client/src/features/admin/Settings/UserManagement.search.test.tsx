import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw-server';
import { UserManagement } from './UserManagement';
import { useAuthStore } from '../../../store/authStore';

const mk = (i: number, first: string, last: string) => ({
  _id: `u${i}`, firstName: first, lastName: last, name: `${first} ${last}`, email: `u${i}@example.org`,
  role: 'reader', status: 'active', isActive: true, roleAssignments: [],
});
const ALL = [...Array.from({ length: 60 }, (_, i) => mk(i, 'Aaron', `Person${String(i).padStart(2, '0')}`)), mk(99, 'Reader', 'Two')];
let searches: string[] = [];

beforeEach(() => {
  searches = [];
  useAuthStore.setState({
    user: { id: 'su', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'admin', isSuperuser: false } as any,
    token: 't', isAuthenticated: true, isLoading: false,
    impersonation: { isImpersonating: false, originalUser: null } as any,
  } as any);
  server.use(
    http.get(/\/api\/users$/, ({ request }) => {
      const u = new URL(request.url);
      const q = (u.searchParams.get('search') || '').toLowerCase();
      const limit = Number(u.searchParams.get('limit') || 50);
      if (q) searches.push(q);
      const words = q.split(/\s+/).filter(Boolean);
      const hits = ALL.filter((x) => words.every((w) => `${x.firstName} ${x.lastName} ${x.email}`.toLowerCase().includes(w)));
      return HttpResponse.json({ users: hits.slice(0, limit), pagination: { page: 1, limit, total: hits.length, totalPages: 1 } });
    }),
    http.get(/\/api\/(invitations|institutions|users\/.*|.*readers.*|.*superusers.*)/, () => HttpResponse.json({ users: [], invitations: [], institutions: [] }))
  );
});

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><UserManagement /></MemoryRouter>
    </QueryClientProvider>
  );

describe('Settings → Users search', () => {
  it('POSITIVE: finds a user who is not among the 50 loaded, by asking the server', async () => {
    renderIt();
    await screen.findByText('Aaron Person00');
    expect(screen.queryByText('Reader Two')).not.toBeInTheDocument(); // not on the first page
    expect(screen.getByTestId('users-count')).toHaveTextContent('Showing 50 of 61 users');
    fireEvent.change(screen.getByTestId('user-search'), { target: { value: 'Reader Two' } });
    expect(await screen.findByText('Reader Two', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(searches).toContain('reader two');
    await waitFor(() => expect(screen.queryByTestId('user-search-busy')).not.toBeInTheDocument());
  });

  it('Load more widens the list', async () => {
    renderIt();
    await screen.findByText('Aaron Person00');
    fireEvent.click(screen.getByTestId('users-load-more'));
    expect(await screen.findByText('Reader Two', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('users-count')).toHaveTextContent('Showing 61 of 61 users');
    expect(screen.queryByTestId('users-load-more')).not.toBeInTheDocument();
  });

  it('NEGATIVE: no match shows a clear empty state, and no spinner is left running', async () => {
    renderIt();
    await screen.findByText('Aaron Person00');
    fireEvent.change(screen.getByTestId('user-search'), { target: { value: 'nobody-like-this' } });
    expect(await screen.findByTestId('users-empty', {}, { timeout: 3000 })).toHaveTextContent('No users match “nobody-like-this”');
    await waitFor(() => expect(screen.queryByTestId('user-search-busy')).not.toBeInTheDocument());
  });
});

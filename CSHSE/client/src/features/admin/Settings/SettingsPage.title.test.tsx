import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';
import { useAuthStore } from '../../../store/authStore';

function setUser(isSuperuser: boolean) {
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'admin', isSuperuser } as any,
    token: 't', isAuthenticated: true, isLoading: false,
    impersonation: { isImpersonating: false, originalUser: null } as any,
  } as any);
}
const renderAt = (path = '/admin/settings') =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><SettingsPage /></MemoryRouter></QueryClientProvider>);

describe('Settings header follows the section', () => {
  beforeEach(() => setUser(true));
  it('superuser on Users: "Settings · Users", no superuser badge', () => {
    renderAt('/admin/settings?section=users');
    expect(screen.getByTestId('settings-title')).toHaveTextContent('Settings · Users');
    expect(screen.queryByTestId('settings-superuser-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-subtitle')).toHaveTextContent('Manage users, roles, and invitations');
    expect(screen.queryByText('Superuser Settings')).not.toBeInTheDocument();
  });
  it('superuser on API Keys: badge says Superuser only', () => {
    renderAt('/admin/settings?section=api-keys');
    expect(screen.getByTestId('settings-title')).toHaveTextContent('Settings · API Keys');
    expect(screen.getByTestId('settings-superuser-badge')).toHaveTextContent('Superuser only');
  });
  it('NEGATIVE: an admin cannot open a superuser section by URL — lands on an admin section', () => {
    setUser(false);
    renderAt('/admin/settings?section=api-keys');
    expect(screen.getByTestId('settings-title')).not.toHaveTextContent('API Keys');
    expect(screen.queryByTestId('settings-superuser-badge')).not.toBeInTheDocument();
  });
});

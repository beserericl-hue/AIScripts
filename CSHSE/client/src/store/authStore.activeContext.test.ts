/**
 * Multi-role active context (header role switcher) — store + request headers.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-server';
import { api } from '../services/api';
import { useAuthStore } from './authStore';

const GUTTMAN = 'inst-guttman', AACC = 'inst-aacc';
const nicole = {
  id: 'nk', email: 'nk@example.com', firstName: 'Nicole', lastName: 'Kras',
  role: 'program_coordinator' as const, institutionId: GUTTMAN, institutionName: 'Guttman',
  roleAssignments: [
    { role: 'reader', institutionId: AACC, institutionName: 'Anne Arundel' },
    { role: 'program_coordinator', institutionId: GUTTMAN, institutionName: 'Guttman' },
  ],
};
const su = { id: 'su', email: 'su@example.com', firstName: 'S', lastName: 'U', role: 'admin' as const, isSuperuser: true };
const noImp = { isImpersonating: false, originalUser: null, impersonatedRole: undefined, impersonatedUser: undefined };

function reset(user: any, extra: any = {}) {
  localStorage.clear();
  useAuthStore.setState({ user, token: 't', isAuthenticated: true, isLoading: false, needsImpersonationSelection: false, impersonation: noImp, activeContext: null, ...extra });
}

describe('authStore — active context', () => {
  beforeEach(() => reset(nicole));

  it('defaults to the primary role (no context)', () => {
    const s = useAuthStore.getState();
    expect(s.getEffectiveRole()).toBe('program_coordinator');
    expect(s.getEffectiveUser()?.institutionId).toBe(GUTTMAN);
    expect(s.getRoleAssignments()).toHaveLength(2);
  });

  it('switching to Reader at AACC changes the effective role and institution', () => {
    useAuthStore.getState().setActiveContext({ role: 'reader', institutionId: AACC, institutionName: 'Anne Arundel' });
    const s = useAuthStore.getState();
    expect(s.getEffectiveRole()).toBe('reader');
    expect(s.getEffectiveUser()?.institutionId).toBe(AACC);
    expect(s.getEffectiveUser()?.institutionName).toBe('Anne Arundel');
  });

  it('ignores a context the user does not hold (never elevates)', () => {
    useAuthStore.setState({ activeContext: { role: 'lead_reader', institutionId: AACC } });
    expect(useAuthStore.getState().getEffectiveRole()).toBe('program_coordinator');
    useAuthStore.setState({ activeContext: { role: 'admin', institutionId: GUTTMAN } });
    expect(useAuthStore.getState().getEffectiveRole()).toBe('program_coordinator');
  });

  it('logout clears the context', () => {
    useAuthStore.getState().setActiveContext({ role: 'reader', institutionId: AACC });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().activeContext).toBeNull();
  });

  it('a superuser (not impersonating) gets no switcher and no context', () => {
    reset(su, { activeContext: { role: 'reader', institutionId: AACC } });
    expect(useAuthStore.getState().getRoleAssignments()).toHaveLength(0);
    expect(useAuthStore.getState().getActiveContext()).toBeNull();
  });

  it('a superuser viewing as Nicole can switch her context', () => {
    reset(su, { impersonation: { isImpersonating: true, originalUser: su, impersonatedRole: 'program_coordinator', impersonatedUser: nicole } });
    expect(useAuthStore.getState().getRoleAssignments()).toHaveLength(2);
    useAuthStore.getState().setActiveContext({ role: 'reader', institutionId: AACC });
    expect(useAuthStore.getState().getEffectiveRole()).toBe('reader');
  });

  it('role-only impersonation offers no switcher', () => {
    reset(su, { impersonation: { isImpersonating: true, originalUser: su, impersonatedRole: 'reader', impersonatedUser: null } });
    expect(useAuthStore.getState().getRoleAssignments()).toHaveLength(0);
  });

  it('the API client forwards X-Active-Role / X-Active-Institution-Id only when a context is set', async () => {
    let seen: Record<string, string | null> = {};
    server.use(http.get('/api/echo-ctx', ({ request }) => {
      seen = { role: request.headers.get('x-active-role'), inst: request.headers.get('x-active-institution-id') };
      return HttpResponse.json({ ok: true });
    }));
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 't' } }));
    await api.get('/api/echo-ctx');
    expect(seen).toEqual({ role: null, inst: null });
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 't', activeContext: { role: 'reader', institutionId: AACC } } }));
    await api.get('/api/echo-ctx');
    expect(seen).toEqual({ role: 'reader', inst: AACC });
  });
});

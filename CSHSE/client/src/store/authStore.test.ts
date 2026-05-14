import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

const su = {
  id: 'su-1',
  email: 'su@example.com',
  firstName: 'Super',
  lastName: 'User',
  role: 'admin' as const,
  isSuperuser: true,
};

const admin = { ...su, id: 'a-1', email: 'a@example.com', role: 'admin' as const, isSuperuser: false };
const reader = { ...admin, id: 'r-1', email: 'r@example.com', role: 'reader' as const };
const coord = { ...admin, id: 'c-1', email: 'c@example.com', role: 'program_coordinator' as const };

function reset(user: typeof su | typeof admin | typeof reader | typeof coord | null = null) {
  useAuthStore.setState({
    user,
    token: user ? 'test-token' : null,
    isAuthenticated: !!user,
    isLoading: false,
    needsImpersonationSelection: false,
    impersonation: {
      isImpersonating: false,
      originalUser: null,
      impersonatedRole: undefined,
      impersonatedUser: undefined,
    },
  });
}

describe('authStore — role gating', () => {
  beforeEach(() => reset(null));

  describe('canAccessAdminSettings', () => {
    it('is false when not authenticated', () => {
      expect(useAuthStore.getState().canAccessAdminSettings()).toBe(false);
    });

    it('is true for an admin', () => {
      reset(admin);
      expect(useAuthStore.getState().canAccessAdminSettings()).toBe(true);
    });

    it('is true for a superuser who is not currently impersonating', () => {
      reset(su);
      expect(useAuthStore.getState().canAccessAdminSettings()).toBe(true);
    });

    it('is false for a plain reader', () => {
      reset(reader);
      expect(useAuthStore.getState().canAccessAdminSettings()).toBe(false);
    });

    it('falls to the impersonated role when a superuser is impersonating', () => {
      reset(su);
      useAuthStore.getState().startImpersonation('reader');
      expect(useAuthStore.getState().canAccessAdminSettings()).toBe(false);

      useAuthStore.getState().startImpersonation('admin');
      expect(useAuthStore.getState().canAccessAdminSettings()).toBe(true);
    });
  });

  describe('isSuperuser()', () => {
    it('returns true for a superuser who is NOT impersonating', () => {
      reset(su);
      expect(useAuthStore.getState().isSuperuser()).toBe(true);
    });

    it('returns false for a superuser who IS currently impersonating', () => {
      reset(su);
      useAuthStore.getState().startImpersonation('admin');
      expect(useAuthStore.getState().isSuperuser()).toBe(false);
    });

    it('returns false for a regular admin', () => {
      reset(admin);
      expect(useAuthStore.getState().isSuperuser()).toBe(false);
    });
  });

  describe('getEffectiveRole / getEffectiveUser', () => {
    it("returns the user's own role by default", () => {
      reset(coord);
      expect(useAuthStore.getState().getEffectiveRole()).toBe('program_coordinator');
      expect(useAuthStore.getState().getEffectiveUser()?.id).toBe('c-1');
    });

    it('returns the impersonated role + user when impersonating', () => {
      reset(su);
      useAuthStore.getState().startImpersonation('reader', reader);
      expect(useAuthStore.getState().getEffectiveRole()).toBe('reader');
      expect(useAuthStore.getState().getEffectiveUser()?.id).toBe('r-1');
    });

    it("ignores startImpersonation when the caller is not a superuser", () => {
      reset(reader);
      useAuthStore.getState().startImpersonation('admin');
      expect(useAuthStore.getState().getEffectiveRole()).toBe('reader');
      expect(useAuthStore.getState().canAccessAdminSettings()).toBe(false);
    });
  });

  describe('stopImpersonation', () => {
    it('clears impersonation state and reopens the selector', () => {
      reset(su);
      useAuthStore.getState().startImpersonation('reader', reader);
      useAuthStore.getState().stopImpersonation();
      const s = useAuthStore.getState();
      expect(s.impersonation.isImpersonating).toBe(false);
      expect(s.needsImpersonationSelection).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears user, token, impersonation', () => {
      reset(su);
      useAuthStore.getState().startImpersonation('admin');
      useAuthStore.getState().logout();
      const s = useAuthStore.getState();
      expect(s.user).toBeNull();
      expect(s.token).toBeNull();
      expect(s.isAuthenticated).toBe(false);
      expect(s.impersonation.isImpersonating).toBe(false);
    });
  });
});

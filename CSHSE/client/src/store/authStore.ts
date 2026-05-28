import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

// CR-045 — per-user UI preferences mirrored from GET /api/auth/me.
export interface UserPreferences {
  hideLegacyImporter?: boolean;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'program_coordinator' | 'lead_reader' | 'reader';
  institutionId?: string;
  institutionName?: string;
  isSuperuser?: boolean;
  // CR-045 — server defaults hideLegacyImporter to true when absent.
  preferences?: UserPreferences;
}

interface ImpersonationState {
  isImpersonating: boolean;
  originalUser: User | null;
  impersonatedRole?: 'admin' | 'program_coordinator' | 'lead_reader' | 'reader';
  impersonatedUser?: User | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  impersonation: ImpersonationState;
  needsImpersonationSelection: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  startImpersonation: (role: string, user?: User | null) => void;
  stopImpersonation: () => void;
  skipImpersonation: () => void;
  openImpersonationSelector: () => void;
  getEffectiveRole: () => string;
  getEffectiveUser: () => User | null;
  isSuperuser: () => boolean;
  canAccessAdminSettings: () => boolean;
  // CR-045 — patch the current user's UI preferences. Optimistically
  // updates local state, then PATCHes the server; on failure the server
  // value (re-fetched on next checkAuth) wins.
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      impersonation: {
        isImpersonating: false,
        originalUser: null,
        impersonatedRole: undefined,
        impersonatedUser: undefined,
      },
      needsImpersonationSelection: false,

      login: async (email: string, password: string) => {
        const response = await api.post('/api/auth/login', { email, password });
        const { user, token } = response.data;

        // Check if user is superuser - if so, they need to select impersonation
        const needsSelection = user.isSuperuser === true;

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          needsImpersonationSelection: needsSelection,
          impersonation: {
            isImpersonating: false,
            originalUser: null,
            impersonatedRole: undefined,
            impersonatedUser: undefined,
          }
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          needsImpersonationSelection: false,
          impersonation: {
            isImpersonating: false,
            originalUser: null,
            impersonatedRole: undefined,
            impersonatedUser: undefined,
          }
        });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isLoading: false });
          return;
        }

        try {
          const response = await api.get('/api/auth/me');
          const user = response.data.user;
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            // Don't reset impersonation state on checkAuth - keep existing session
          });
        } catch {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            needsImpersonationSelection: false,
            impersonation: {
              isImpersonating: false,
              originalUser: null,
              impersonatedRole: undefined,
              impersonatedUser: undefined,
            }
          });
        }
      },

      startImpersonation: (role: string, impersonatedUser?: User | null) => {
        const { user } = get();
        if (!user?.isSuperuser) return;

        set({
          impersonation: {
            isImpersonating: true,
            originalUser: user,
            impersonatedRole: role as 'admin' | 'program_coordinator' | 'lead_reader' | 'reader',
            impersonatedUser: impersonatedUser || null,
          },
          needsImpersonationSelection: false,
        });
      },

      stopImpersonation: () => {
        const { impersonation } = get();
        if (!impersonation.isImpersonating) return;

        set({
          impersonation: {
            isImpersonating: false,
            originalUser: null,
            impersonatedRole: undefined,
            impersonatedUser: undefined,
          },
          needsImpersonationSelection: true, // Return to selection screen
        });
      },

      skipImpersonation: () => {
        // SU chooses to continue as themselves
        set({ needsImpersonationSelection: false });
      },

      openImpersonationSelector: () => {
        // Allow superuser to open impersonation selector at any time
        const { user } = get();
        if (!user?.isSuperuser) return;
        set({ needsImpersonationSelection: true });
      },

      getEffectiveRole: () => {
        const { user, impersonation } = get();
        if (impersonation.isImpersonating && impersonation.impersonatedRole) {
          return impersonation.impersonatedRole;
        }
        return user?.role || '';
      },

      getEffectiveUser: () => {
        const { user, impersonation } = get();
        if (impersonation.isImpersonating && impersonation.impersonatedUser) {
          return impersonation.impersonatedUser;
        }
        return user;
      },

      isSuperuser: () => {
        const { user, impersonation } = get();
        // Return true only if user is SU AND not currently impersonating
        return user?.isSuperuser === true && !impersonation.isImpersonating;
      },

      canAccessAdminSettings: () => {
        const { user, impersonation } = get();
        // SU (not impersonating) or Admin role can access settings
        if (user?.isSuperuser && !impersonation.isImpersonating) {
          return true;
        }
        const effectiveRole = impersonation.isImpersonating
          ? impersonation.impersonatedRole
          : user?.role;
        return effectiveRole === 'admin';
      },

      updatePreferences: async (prefs: Partial<UserPreferences>) => {
        const { user } = get();
        if (!user) return;
        // Optimistic local update so the checkbox flips instantly.
        const merged: UserPreferences = { ...(user.preferences ?? {}), ...prefs };
        set({ user: { ...user, preferences: merged } });
        try {
          const res = await api.patch('/api/auth/me/preferences', prefs);
          // Sync to the server's defaulted echo (authoritative).
          const serverPrefs = res.data?.preferences as UserPreferences | undefined;
          if (serverPrefs) {
            const cur = get().user;
            if (cur) set({ user: { ...cur, preferences: serverPrefs } });
          }
        } catch (err) {
          // Roll back on failure.
          const cur = get().user;
          if (cur) set({ user: { ...cur, preferences: user.preferences } });
          // eslint-disable-next-line no-console
          console.warn('[CR-045] updatePreferences failed:', err);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        impersonation: state.impersonation,
        needsImpersonationSelection: state.needsImpersonationSelection,
      }),
    }
  )
);

// Check auth on app load
useAuthStore.getState().checkAuth();

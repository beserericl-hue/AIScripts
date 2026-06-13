import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { queryClient } from '../lib/queryClient';

// CR-045 — per-user UI preferences mirrored from GET /api/auth/me.
// CR-052 — `tours` records per-tour completion (e.g. { welcome: true })
// so tour status follows the user across devices.
export interface UserPreferences {
  hideLegacyImporter?: boolean;
  tours?: Record<string, boolean>;
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
        // SECURITY: never leak one session's cached data into the next login.
        queryClient.clear();
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

        // SECURITY: the effective identity is about to change. Drop every cached
        // query so the superuser's admin-scoped data (e.g. the all-institutions
        // submission list) can never be shown — or clicked into — under the
        // impersonated identity. Without this, a stale list survives the switch
        // and navigating into it hits the now-correct server scoping check and
        // 403s. The new identity's screens refetch from scratch.
        queryClient.clear();

        set({
          impersonation: {
            isImpersonating: true,
            originalUser: user,
            impersonatedRole: role as 'admin' | 'program_coordinator' | 'lead_reader' | 'reader',
            impersonatedUser: impersonatedUser || null,
          },
          needsImpersonationSelection: false,
        });

        // CR-058 — record the impersonation start in the append-only audit
        // trail. Fire-and-forget: a logging hiccup must never block the SU
        // from assuming the identity they just selected.
        const impName = impersonatedUser
          ? `${impersonatedUser.firstName || ''} ${impersonatedUser.lastName || ''}`.trim() ||
            impersonatedUser.email
          : undefined;
        Promise.resolve(
          api.post('/api/auth/impersonation/start', {
            impersonatedRole: role,
            impersonatedUserId: impersonatedUser?.id,
            impersonatedUserName: impName,
          })
        ).catch((err) => console.warn('[CR-058] impersonation start audit failed:', err));
      },

      stopImpersonation: () => {
        const { impersonation } = get();
        if (!impersonation.isImpersonating) return;

        // Capture what we're ending BEFORE clearing state, so the audit entry
        // names the identity that was active.
        const endingRole = impersonation.impersonatedRole;
        const endingUser = impersonation.impersonatedUser;
        const endingName = endingUser
          ? `${endingUser.firstName || ''} ${endingUser.lastName || ''}`.trim() || endingUser.email
          : undefined;

        // SECURITY: returning to the superuser identity — clear the impersonated
        // identity's cached data so it isn't shown back under the superuser.
        queryClient.clear();

        set({
          impersonation: {
            isImpersonating: false,
            originalUser: null,
            impersonatedRole: undefined,
            impersonatedUser: undefined,
          },
          needsImpersonationSelection: true, // Return to selection screen
        });

        // CR-058 — record the impersonation stop (fire-and-forget).
        Promise.resolve(
          api.post('/api/auth/impersonation/stop', {
            impersonatedRole: endingRole,
            impersonatedUserId: endingUser?.id,
            impersonatedUserName: endingName,
          })
        ).catch((err) => console.warn('[CR-058] impersonation stop audit failed:', err));
      },

      skipImpersonation: () => {
        // SU chooses to continue as themselves — clear any cache left from a
        // prior impersonated identity before resuming the superuser view.
        queryClient.clear();
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
        // CR-052 — `tours` is a Record<string, boolean>; a partial patch
        // must MERGE with the existing keys rather than replace them, so
        // a second tour completion doesn't wipe the first. (The server
        // also merges; this keeps the optimistic local state honest in
        // between the request and the response.)
        const merged: UserPreferences = { ...(user.preferences ?? {}), ...prefs };
        if (prefs.tours) {
          merged.tours = { ...(user.preferences?.tours ?? {}), ...prefs.tours };
        }
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

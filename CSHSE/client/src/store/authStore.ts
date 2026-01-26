import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'program_coordinator' | 'lead_reader' | 'reader';
  institutionId?: string;
  institutionName?: string;
  isSuperuser?: boolean;
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
  getEffectiveRole: () => string;
  getEffectiveUser: () => User | null;
  isSuperuser: () => boolean;
  canAccessAdminSettings: () => boolean;
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

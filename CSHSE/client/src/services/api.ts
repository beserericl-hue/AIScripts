import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token and impersonation header to requests
api.interceptors.request.use((config) => {
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
      // Send impersonated role so server can override for superusers
      if (state?.impersonation?.isImpersonating && state.impersonation.impersonatedRole) {
        config.headers['X-Impersonated-Role'] = state.impersonation.impersonatedRole;
        // CR-058 — when impersonating a *specific* user, forward their identity
        // so the server-side audit trail names them (not just the role). Names
        // are URI-encoded because HTTP header values must be ASCII-safe.
        const impUser = state.impersonation.impersonatedUser;
        if (impUser?.id) {
          config.headers['X-Impersonated-User-Id'] = impUser.id;
          const fullName = `${impUser.firstName || ''} ${impUser.lastName || ''}`.trim() || impUser.email || '';
          if (fullName) {
            config.headers['X-Impersonated-User-Name'] = encodeURIComponent(fullName);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect to login for auth routes - let them handle their own errors
    const isAuthRoute = error.config?.url?.includes('/api/auth/');

    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

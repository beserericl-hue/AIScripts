import { QueryClient } from '@tanstack/react-query';

// Single app-wide QueryClient. Exported as a module singleton (not created
// inline in main.tsx) so non-React code — notably the auth store — can reach it
// to clear cached data when the effective identity changes.
//
// SECURITY: every cached query is scoped to whoever was the effective user when
// it ran. When a superuser starts/stops impersonating (or logs out), the cache
// MUST be cleared so one identity's data can never be shown — or acted on —
// under another. A stale list survived an impersonation switch once and made a
// freshly-correct server scoping check 403 on click; clearing here prevents it.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

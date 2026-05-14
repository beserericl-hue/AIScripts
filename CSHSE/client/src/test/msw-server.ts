import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Default handlers — keep minimal. Each test should override what it cares about
// via `server.use(...)`. Anything not handled fails the test (onUnhandledRequest:'error').
export const handlers = [
  // checkAuth() runs at module load of authStore. Default: report unauthenticated.
  http.get('/api/auth/me', () => {
    return HttpResponse.json({ error: 'No token provided' }, { status: 401 });
  }),
];

export const server = setupServer(...handlers);
export { http, HttpResponse };

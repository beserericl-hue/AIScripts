import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-server';
import { api } from './api';

function setAuthStorage(state: { token?: string; impersonation?: any }) {
  localStorage.setItem('auth-storage', JSON.stringify({ state }));
}

describe('api client — request interceptor', () => {
  it('attaches the Bearer token from auth-storage when present', async () => {
    setAuthStorage({ token: 'tok-abc' });
    let seen: string | null = null;
    server.use(
      http.get('/api/echo', ({ request }) => {
        seen = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      })
    );

    await api.get('/api/echo');
    expect(seen).toBe('Bearer tok-abc');
  });

  it('forwards X-Impersonated-Role when a superuser is impersonating', async () => {
    setAuthStorage({
      token: 'tok-su',
      impersonation: { isImpersonating: true, impersonatedRole: 'reader' },
    });
    let seen: string | null = null;
    server.use(
      http.get('/api/echo2', ({ request }) => {
        seen = request.headers.get('x-impersonated-role');
        return HttpResponse.json({ ok: true });
      })
    );

    await api.get('/api/echo2');
    expect(seen).toBe('reader');
  });

  it('omits Authorization when there is no auth-storage', async () => {
    let seen: string | null = 'INIT';
    server.use(
      http.get('/api/echo3', ({ request }) => {
        seen = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      })
    );

    await api.get('/api/echo3');
    expect(seen).toBeNull();
  });
});

describe('api client — 401 response interceptor', () => {
  // jsdom doesn't allow mutating window.location directly, so stub it.
  const original = window.location;
  let hrefSetter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...original,
        get href() { return ''; },
        set href(value: string) { hrefSetter(value); },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  // TODO(testing): the localStorage shim and the window.location stub interact
  // weirdly here — the api interceptor's `localStorage.removeItem` doesn't
  // mutate the same Storage instance that `getItem` reads from in the test.
  // Reproduces only when the location stub is active. Likely fix: stop
  // redefining `window.location` and use `vi.spyOn(window.location, 'href', 'set')`
  // pattern with Object.getOwnPropertyDescriptor on Location.prototype.
  it.skip('clears auth-storage and redirects to /login on 401 for non-auth routes', async () => {
    setAuthStorage({ token: 'tok' });
    server.use(
      http.get('/api/submissions', () =>
        HttpResponse.json({ error: 'unauthenticated' }, { status: 401 })
      )
    );

    await expect(api.get('/api/submissions')).rejects.toThrow();
    expect(localStorage.getItem('auth-storage')).toBeNull();
    expect(hrefSetter).toHaveBeenCalledWith('/login');
  });

  it.skip('does NOT redirect when 401 comes from an /api/auth/* route', async () => {
    setAuthStorage({ token: 'tok' });
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'bad' }, { status: 401 })
      )
    );

    await expect(api.post('/api/auth/login', {})).rejects.toThrow();
    expect(localStorage.getItem('auth-storage')).not.toBeNull();
    expect(hrefSetter).not.toHaveBeenCalled();
  });
});

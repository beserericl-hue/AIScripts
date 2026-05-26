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
  // Earlier attempts redefined `window.location` via Object.defineProperty,
  // which broke localStorage in jsdom (the two share an internal Window
  // reference). Instead, spy on the `href` SETTER directly via the
  // Location prototype's descriptor — leaves window.location intact, so
  // localStorage keeps working.
  let hrefSetter: ReturnType<typeof vi.fn>;
  let restoreHref: () => void = () => {};

  beforeEach(() => {
    localStorage.clear();
    hrefSetter = vi.fn();
    // Wrap window.location in a Proxy that intercepts the `href` setter
    // but delegates everything else to the real Location instance. This
    // keeps `Location.origin` identity intact so jsdom's Storage backing
    // (which is keyed off origin) still maps to the SAME `localStorage`
    // the test reads from. Plain object replacement breaks that link.
    const original = window.location;
    const proxy: any = new Proxy(original, {
      get(target, prop, receiver) {
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
      set(target, prop, value) {
        if (prop === 'href') {
          hrefSetter(value);
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    });
    delete (window as any).location;
    (window as any).location = proxy;
    restoreHref = () => {
      delete (window as any).location;
      (window as any).location = original;
    };
  });

  afterEach(() => {
    restoreHref();
  });

  it('clears auth-storage and redirects to /login on 401 for non-auth routes', async () => {
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

  it('does NOT redirect when 401 comes from an /api/auth/* route', async () => {
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

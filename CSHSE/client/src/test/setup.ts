import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw-server';

// Some test paths replace `window.location`, which can leave `localStorage`
// in a state where its prototype methods aren't bound. Install a fresh
// Map-backed Storage shim BEFORE any test module loads (authStore.ts triggers
// `checkAuth()` and the zustand persist middleware at module-load time).
function installStorageShim(target: 'localStorage' | 'sessionStorage') {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  };
  Object.defineProperty(window, target, {
    configurable: true,
    writable: true,
    value: storage,
  });
}

installStorageShim('localStorage');
installStorageShim('sessionStorage');

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Defensive: jsdom may have had localStorage redefined by a previous test
  // (e.g. window.location stubbing in api.test.ts can disturb the Storage proto).
  try { window.localStorage?.clear?.(); } catch { /* noop */ }
  try { window.sessionStorage?.clear?.(); } catch { /* noop */ }
});

afterAll(() => {
  server.close();
});

// jsdom doesn't implement matchMedia; some Radix / Tailwind code reads it.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom doesn't implement Element.scrollIntoView; HelpChat (and others) call it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

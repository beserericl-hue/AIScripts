# Testing

Three test layers, each runnable independently.

| Layer | Tool | Where it lives | What it covers |
|-------|------|----------------|----------------|
| Server unit + integration | Vitest + supertest + mongodb-memory-server | `server/tests/` | Models, services, route integration tests against an in-memory Mongo |
| Client unit + component | Vitest + React Testing Library + MSW + jsdom | `client/src/**/*.test.{ts,tsx}` | Stores, services, components, with `/api/*` mocked at the network boundary |
| End-to-end | Playwright | `e2e/tests/` | Full browser flows against a running dev stack |

## Quick start

```bash
# 1. Install deps (one-time per layer)
cd server && npm install
cd ../client && npm install
cd ../e2e    && npm install && npm run install-browsers   # downloads Chromium

# 2. Run tests
cd server && npm test                  # server unit + integration
cd ../client && npm test               # client unit + component

# 3. E2E (requires a running dev stack)
cd ../server && npm run dev            # terminal A
cd ../client && npm run dev            # terminal B
cd ../e2e    && npm test               # terminal C
```

## Server tests

`vitest.config.ts` runs every file matching `tests/**/*.test.ts`.

`tests/setup.ts` spins up an in-memory MongoDB once per run, drops collections between tests, and stops the binary on shutdown. The first run on a machine downloads the MongoDB binary (~100MB) — subsequent runs reuse it.

`server/src/index.ts` skips `app.listen` and `setupProcessErrorHandlers` when `NODE_ENV=test` (set automatically by the setup file), so tests can import the configured Express `app` and drive it with supertest without binding a port.

### Patterns

- **Use `createUser({ … })`** from `tests/helpers/factories.ts` — it wires the bcrypt pre-save hook correctly.
- **Use `signTokenFor(user)`** to forge a valid JWT for any user. The test secret is set in `tests/setup.ts`.
- **Each test starts with empty collections** (the `afterEach` in setup wipes everything). Don't rely on order.
- **Integration tests live in `tests/integration/`** and exercise the real route handlers via supertest.
- **Unit tests live in `tests/unit/`** and exercise pure functions or model methods directly.

### What the seed tests cover today

- `unit/user-model.test.ts` — bcrypt round-trip, no double-hashing, JSON serialization, email validation.
- `integration/auth-routes.test.ts` — login (happy path + 4 failure modes), `/me` (incl. forged-token rejection), `/change-password` (self vs. other-user privilege), `/logout` documenting the known token-not-invalidated issue.
- `integration/webhook-callback-security.test.ts` — **regression guard** for the 2026-05-10 audit C2 finding. Asserts the callback endpoints currently accept unauthenticated POSTs. When the HMAC fix lands, invert the assertions.

## Client tests

`vitest.config.ts` extends `vite.config.ts` and runs in jsdom. `src/test/setup.ts` boots an MSW server with `onUnhandledRequest: 'error'` — any test that hits an unmocked `/api/*` URL fails loudly.

### Patterns

- **MSW handlers** live in `src/test/msw-server.ts`. Default handlers should be minimal; per-test overrides via `server.use(http.get(…))`.
- **Reset Zustand state** between tests by calling `useStore.setState({ … })` in `beforeEach`.
- **No real `window.location` navigation** — the api-interceptor test stubs `window.location.href` setter to assert the redirect.
- **Don't import the real `App`** unless you actually want the whole router tree; component tests should mount the smallest unit needed.

### What the seed tests cover today

- `src/store/authStore.test.ts` — role gating logic: `canAccessAdminSettings`, `isSuperuser`, `getEffectiveRole`, impersonation start/stop, logout reset.
- `src/services/api.test.ts` — request interceptor (Bearer token, X-Impersonated-Role). **Two tests are `.skip`-ped** — see "Known issues" below.
- `src/components/HelpChat.test.tsx` — bubble hidden when status `available: false`, rendered when `true`, full message round-trip, error path.

### Known issues

- The two skipped 401-interceptor tests in `api.test.ts` need a different stubbing pattern. The current `Object.defineProperty(window, 'location', …)` interferes with the localStorage shim in `src/test/setup.ts`. Recommended fix: use `vi.spyOn(window.location, 'href', 'set')` after grabbing `Object.getOwnPropertyDescriptor(Location.prototype, 'href')`. Tracked inline with a TODO.

## E2E tests

Playwright runs against whatever stack is up at `E2E_BASE_URL` (default `http://localhost:3000`).

`playwright.config.ts` keeps `webServer` commented out on purpose — the dev stack needs MongoDB + (optionally) S3/n8n configured, and we don't want Playwright to manage that today. Start the stack yourself.

### What the seed tests cover today

- `tests/login.spec.ts` — login page renders; bad credentials show an error. The "happy-path lands on dashboard" test is `.skip`-ped pending a seed endpoint.
- `tests/health.spec.ts` — GET /health responds 200; GET /api/auth/me with no token responds 401.

### Adding seed data for E2E

Recommended pattern when you're ready: expose a guarded `/api/test/seed` endpoint (only mounted when `NODE_ENV=test` or `E2E_SEED=1`) that creates known fixture users and submissions, then update `e2e/helpers/auth.ts` to point at those credentials and remove `.skip` markers.

## Coverage

`npm test -- --coverage` (in either `server/` or `client/`) writes a `coverage/` HTML report. We don't have a CI-enforced coverage threshold; the goal of this initial pass is shape, not numbers.

## Future work (not done in the initial pass)

- GitHub Actions workflow (intentionally deferred).
- Seed/teardown endpoints for E2E.
- Integration tests for: GridFS marker round-trip (`insertHtmlMarker` ↔ `restoreMarker`), evidence upload S3 path with mocked S3, validation outbound webhook with nock-style mocking.
- Component tests for: `DocumentViewer` table-aware row removal, `NarrativeEditor` auto-save debounce, `EvidenceManager` happy + error paths.
- E2E coverage of: import → tag → finish, narrative edit + auto-save, reviewer assessment + submit.

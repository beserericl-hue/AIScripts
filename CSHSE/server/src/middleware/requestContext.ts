import { AsyncLocalStorage } from 'async_hooks';

/**
 * CR-058 — request-scoped impersonation context.
 *
 * When a superuser drives the app while impersonating a role / specific user,
 * the `authenticate` middleware stashes the *true* actor + the impersonated
 * identity here for the lifetime of the request. `recordAuditEvent` reads it
 * automatically, so EVERY governance action taken while impersonating is
 * flagged with who really did it — without having to thread the context
 * through all ~9 audit-writing controllers.
 *
 * The store is populated only when an impersonation is actually in effect; a
 * normal (non-impersonated) request leaves it empty and audit entries carry no
 * impersonation block.
 */
export interface ImpersonationContext {
  /** the real superuser's id */
  actualUserId: string;
  /** the real superuser's display name */
  actualName: string;
  /** the real superuser's stored role (almost always 'admin') */
  actualRole: string;
  /** the role being impersonated, if a role/user was chosen */
  impersonatedRole?: string;
  /** the specific user being impersonated, if one was chosen */
  impersonatedUserId?: string;
  impersonatedUserName?: string;
}

interface RequestStore {
  impersonation?: ImpersonationContext;
}

const storage = new AsyncLocalStorage<RequestStore>();

/** Run `fn` with the given request-scoped store bound for its async lifetime. */
export function runWithRequestContext<T>(store: RequestStore, fn: () => T): T {
  return storage.run(store, fn);
}

/** The impersonation context for the in-flight request, or undefined. */
export function getImpersonationContext(): ImpersonationContext | undefined {
  return storage.getStore()?.impersonation;
}

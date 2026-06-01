import { AuditLogEntry, AuditAction, AuditTargetType } from '../models/AuditLogEntry';
import mongoose from 'mongoose';
import { getImpersonationContext, ImpersonationContext } from '../middleware/requestContext';

interface AuditActor {
  id: string;
  role: string;
  name: string;
}

interface AuditWriteOptions {
  action: AuditAction;
  actor: AuditActor;
  targetType: AuditTargetType;
  targetId: string;
  submissionId?: string;
  payload?: Record<string, unknown>;
  reason?: string;
  /**
   * CR-058 — explicit impersonation context. Normally omitted: when an action
   * runs inside an impersonated request, `recordAuditEvent` auto-reads the
   * request-scoped context (set by the `authenticate` middleware) so every
   * audit entry is flagged with the true actor. Pass this explicitly only from
   * code paths that run *outside* the middleware chain (e.g. the
   * impersonation start/stop endpoints in the public auth router).
   */
  impersonation?: ImpersonationContext;
}

function toImpersonationDoc(ctx: ImpersonationContext) {
  return {
    actualUserId: new mongoose.Types.ObjectId(ctx.actualUserId),
    actualName: ctx.actualName,
    actualRole: ctx.actualRole,
    impersonatedRole: ctx.impersonatedRole,
    impersonatedUserId: ctx.impersonatedUserId
      ? new mongoose.Types.ObjectId(ctx.impersonatedUserId)
      : undefined,
    impersonatedUserName: ctx.impersonatedUserName
  };
}

export async function recordAuditEvent(opts: AuditWriteOptions): Promise<void> {
  try {
    // CR-058 — flag actions taken while impersonating. An explicitly-passed
    // context wins; otherwise fall back to the request-scoped one.
    const ctx = opts.impersonation ?? getImpersonationContext();
    await AuditLogEntry.create({
      action: opts.action,
      actorId: new mongoose.Types.ObjectId(opts.actor.id),
      actorRole: opts.actor.role,
      actorName: opts.actor.name,
      targetType: opts.targetType,
      targetId: opts.targetId,
      submissionId: opts.submissionId ? new mongoose.Types.ObjectId(opts.submissionId) : undefined,
      payload: opts.payload,
      reason: opts.reason,
      impersonation: ctx ? toImpersonationDoc(ctx) : undefined
    });
  } catch (err) {
    // Audit log failures must not break the user-facing action — log + swallow.
    // A monitoring system upstream should alert on missing audit events.
    console.error('[auditLog] failed to record event', opts.action, err);
  }
}

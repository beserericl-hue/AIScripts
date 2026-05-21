import { AuditLogEntry, AuditAction, AuditTargetType } from '../models/AuditLogEntry';
import mongoose from 'mongoose';

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
}

export async function recordAuditEvent(opts: AuditWriteOptions): Promise<void> {
  try {
    await AuditLogEntry.create({
      action: opts.action,
      actorId: new mongoose.Types.ObjectId(opts.actor.id),
      actorRole: opts.actor.role,
      actorName: opts.actor.name,
      targetType: opts.targetType,
      targetId: opts.targetId,
      submissionId: opts.submissionId ? new mongoose.Types.ObjectId(opts.submissionId) : undefined,
      payload: opts.payload,
      reason: opts.reason
    });
  } catch (err) {
    // Audit log failures must not break the user-facing action — log + swallow.
    // A monitoring system upstream should alert on missing audit events.
    console.error('[auditLog] failed to record event', opts.action, err);
  }
}

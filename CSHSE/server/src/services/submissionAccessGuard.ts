/**
 * SECURITY — canonical cross-tenant access gate for submission-scoped resources.
 *
 * The 2026-07 isolation audit found ~40 endpoints that gated on the raw role
 * string (e.g. `role === 'lead_reader'`) or nothing at all, letting the
 * global-ish reviewer roles — and sometimes any authenticated user — read or
 * write ANOTHER institution's submission-scoped data (comments, scores,
 * reviews, validation verdicts, checklists, program courses, site visits…).
 *
 * This module centralizes the ONE correct rule so every submission-scoped
 * handler enforces it identically. A caller may access a submission iff:
 *   - they are a global admin / superuser (effective), OR
 *   - they are a Program Coordinator AT that submission's institution
 *     (or, for institution-less dev data, its submitter), OR
 *   - they have an ACTIVE Assignment to that submission (reader / lead_reader),
 *     keyed by the EFFECTIVE (impersonation-aware) user id.
 *
 * Mirrors the previously-correct getSubmission gate + reportController's
 * readerMayAccess. Use `requireSubmissionAccess` at the top of every
 * submission-scoped handler; for :reviewId / :compilationId handlers, resolve
 * the parent submissionId first and pass it here.
 */
import { Response } from 'express';
import { Submission } from '../models/Submission';
import { Assignment } from '../models/Assignment';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { isGlobalAdmin, hasRoleAt } from './roleResolver';
import { AuthenticatedRequest } from '../middleware/auth';

export interface SubmissionAccessResult {
  ok: boolean;
  reason?: 'not_found' | 'forbidden';
  submission?: any;
}

/** The impersonation-aware effective user id (reader Assignments key on this). */
export function effectiveUserId(req: AuthenticatedRequest): string {
  return String(req.user?.impersonation?.impersonatedUserId || req.user?.id || '');
}

/**
 * Decide whether the caller may access a submission. Loads a lightweight
 * projection when passed an id; accepts an already-loaded doc to avoid a
 * re-query. NEVER trusts a client-supplied institution — always derives it
 * from the submission itself.
 */
export async function canAccessSubmission(
  req: AuthenticatedRequest,
  submissionOrId: string | any
): Promise<SubmissionAccessResult> {
  let submission: any = submissionOrId;
  if (!submissionOrId) return { ok: false, reason: 'not_found' };
  if (typeof submissionOrId === 'string') {
    submission = await Submission.findById(submissionOrId).select('institutionId submitterId status');
    if (!submission) return { ok: false, reason: 'not_found' };
  }

  if (isGlobalAdmin(req.user)) return { ok: true, submission };

  const instId = submission.institutionId ? submission.institutionId.toString() : null;
  const isSubmitter = String(submission.submitterId || '') === String(req.user?.id || '');
  const isPCHere = instId ? hasRoleAt(req.user, 'program_coordinator', instId) : isSubmitter;
  if (isPCHere) return { ok: true, submission };

  const assigned = await Assignment.exists({
    submissionId: submission._id,
    userId: effectiveUserId(req),
    status: 'active',
  });
  if (assigned) return { ok: true, submission };

  return { ok: false, reason: 'forbidden', submission };
}

/**
 * Guard helper for handlers: returns the submission when access is allowed,
 * else writes a 404/403 and returns null (caller must `return`).
 *
 *   const submission = await requireSubmissionAccess(req, res, submissionId);
 *   if (!submission) return;
 */
export async function requireSubmissionAccess(
  req: AuthenticatedRequest,
  res: Response,
  submissionOrId: string | any
): Promise<any | null> {
  const { ok, reason, submission } = await canAccessSubmission(req, submissionOrId);
  if (ok) return submission ?? true;
  if (reason === 'not_found') {
    res.status(404).json({ error: 'Submission not found' });
  } else {
    res.status(403).json({ error: 'Forbidden: you do not have access to this submission' });
  }
  return null;
}

/**
 * Guard for import-scoped handlers: resolves the SelfStudyImport's parent
 * submission and applies the same tenant gate. Returns the import doc when
 * allowed, else writes 404/403 and returns null.
 *
 *   const imp = await requireImportAccess(req, res, req.params.importId);
 *   if (!imp) return;
 */
export async function requireImportAccess(
  req: AuthenticatedRequest,
  res: Response,
  importId: string
): Promise<any | null> {
  if (!importId) {
    res.status(404).json({ error: 'Import not found' });
    return null;
  }
  const imp = await SelfStudyImport.findById(importId);
  if (!imp) {
    res.status(404).json({ error: 'Import not found' });
    return null;
  }
  const { ok, reason } = await canAccessSubmission(req, String(imp.submissionId));
  if (ok) return imp;
  // A missing/dangling parent submission on an existing import is treated as
  // forbidden (not 404) so we never reveal foreign import existence.
  res.status(403).json({ error: 'Forbidden: you do not have access to this import' });
  return null;
}

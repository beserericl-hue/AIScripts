import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CR-054 — shared-secret guard for the inbound n8n callback endpoints
 * (spec-loader, document-matcher). These endpoints accept writes from the n8n
 * instance and were previously fully unauthenticated (security audit
 * 2026-05-10, findings C2/M7).
 *
 * Enforcement is gated on the `N8N_CALLBACK_SECRET` env var so it can be rolled
 * out without breaking the live n8n workflows:
 *   - secret UNSET  → pass through (no behavior change; matches today).
 *   - secret SET    → require the n8n caller to present the same value in the
 *                     `X-Callback-Secret` header (constant-time compared);
 *                     otherwise 401. Enable this only after the n8n workflows
 *                     have been updated to send the header.
 *
 * The help-upload callback is excluded — it already verifies a per-document
 * `callbackToken`. The n8n *validation* callback no longer exists (retired).
 */
export function verifyN8nCallback(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.N8N_CALLBACK_SECRET;

  // Not configured yet → do not enforce (safe rollout; the live matcher /
  // spec-loader workflows keep working until their env + headers are set).
  if (!secret) {
    return next();
  }

  // The existing spec-loader n8n workflow already sends the shared secret as
  // `X-API-Key`; accept either header so enabling enforcement (set the env to
  // the rotated key value) does not require re-editing the live workflow.
  const provided = req.header('X-Callback-Secret') || req.header('X-API-Key') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    console.warn('[verifyN8nCallback] Rejected callback with missing/invalid secret:', req.path);
    res.status(401).json({ error: 'Invalid or missing callback secret' });
    return;
  }

  next();
}

export default verifyN8nCallback;

/**
 * CR-042 Phase B — per-API-key tier-based rate limiting.
 *
 * Lightweight in-memory rate limiter for the public /api/v1/* surface.
 * Reads the x-cshse-api-key header, looks up the key's tier
 * (metadata.rateLimit override OR default for scope), and applies a
 * fixed-window count.
 *
 * Default tiers (requests per minute):
 *   - sso-login:   60 / min   (a partner site brokering many logins)
 *   - general-api: 30 / min
 *   - anonymous:   10 / min   (no key → IP-based bucket)
 *
 * Override per-key via APIKey.metadata.rateLimit (number).
 *
 * Returns RFC 6585 "429 Too Many Requests" with Retry-After + a
 * problem+json body the OpenAPI spec advertises.
 *
 * For multi-instance scale this would move to Redis ZINCRBY — current
 * deploy is single-instance Railway so in-memory is correct.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { APIKey } from '../models/APIKey';

interface Bucket {
  count: number;
  resetAt: number;
}

const _BUCKETS = new Map<string, Bucket>();
const WINDOW_MS = 60 * 1000;

function _bucketKey(req: Request, apiKeyId: string | null): string {
  if (apiKeyId) return `key:${apiKeyId}`;
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

function _tick(key: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let b = _BUCKETS.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    _BUCKETS.set(key, b);
  }
  b.count += 1;
  return {
    allowed: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    resetAt: b.resetAt,
  };
}

// Test-only helper so a test can pre-fill a bucket without hammering.
export function _testResetRateLimits(): void {
  _BUCKETS.clear();
}

export async function apiKeyRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawKey = (req.header('x-cshse-api-key') ?? '').trim();
    let apiKeyId: string | null = null;
    let limit = 10; // anonymous default
    if (rawKey) {
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const k = await APIKey.findOne({ keyHash, isActive: true }).select(
        'scope metadata createdByName _id'
      );
      if (k) {
        apiKeyId = String(k._id);
        // CR-042 Phase B follow-on — bootstrap keys (created via
        // /api/test/bootstrap-sso-key, only mounted when NODE_ENV != production)
        // are exempt from the rate limiter. The E2E suite hammers ONE
        // bootstrap key with login-per-seeded-user, often >60 logins per
        // run — the production-tier 60/min sso-login cap would 429 the
        // suite mid-flight. Production keys never carry the
        // 'e2e-bootstrap' creator stamp.
        if (k.createdByName === 'e2e-bootstrap') {
          res.setHeader('X-RateLimit-Limit', 'unlimited');
          res.setHeader('X-RateLimit-Bypass', 'e2e-bootstrap');
          next();
          return;
        }
        const override = k.metadata?.rateLimit;
        if (typeof override === 'number' && override > 0) {
          limit = override;
        } else if (k.scope === 'sso-login') {
          limit = 60;
        } else {
          limit = 30;
        }
        // Stamp usage telemetry on the key (best-effort, non-blocking).
        APIKey.updateOne(
          { _id: k._id },
          { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
        ).catch(() => {});
      }
    }
    const bk = _bucketKey(req, apiKeyId);
    const { allowed, remaining, resetAt } = _tick(bk, limit);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));
    if (!allowed) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        type: 'https://docs.cshse.org/sso/errors/rate-limit-exceeded',
        title: 'Rate limit exceeded',
        status: 429,
        detail: `Limit is ${limit} requests per minute for this key.`,
        retryAfter,
      });
      return;
    }
    next();
  } catch (err) {
    // Non-fatal — if the key lookup blows up (e.g. a transient DB hiccup
    // under load) we still serve the request, but DON'T silently disable
    // throttling AND drop the X-RateLimit-* headers the contract promises
    // on every response. Fall back to the anonymous IP bucket so the
    // limiter degrades to "treat as anonymous" rather than "unlimited +
    // headerless". Without this, a transient findOne failure produced a
    // headerless 200 — the source of the cr042-rate-limit flake under
    // full-suite load.
    try {
      const bk = _bucketKey(req, null);
      const { allowed, remaining, resetAt } = _tick(bk, 10);
      res.setHeader('X-RateLimit-Limit', '10');
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));
      if (!allowed) {
        const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({
          type: 'https://docs.cshse.org/sso/errors/rate-limit-exceeded',
          title: 'Rate limit exceeded',
          status: 429,
          detail: 'Limit is 10 requests per minute.',
          retryAfter,
        });
        return;
      }
    } catch {
      /* never block the request on the limiter */
    }
    next();
  }
}

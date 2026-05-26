/**
 * CR-042 — Public v1 auth routes.
 *
 * Mounted at /api/v1/auth. Exposes:
 *   POST /api/v1/auth/sso-login         — direct server-to-server login
 *   POST /api/v1/auth/sso-mint-ticket   — mint a single-use browser-redirect ticket
 *
 * CORS is intentionally NOT enabled on this router — both are
 * server-to-server calls.
 */
import { Router } from 'express';
import { ssoLogin } from '../controllers/ssoController';
import { ssoMintTicket } from '../controllers/ssoTicketController';
import { apiKeyRateLimit } from '../middleware/apiKeyRateLimit';

const router = Router();

// CR-042 Phase B — tier-based rate limit applied to every authenticated
// v1 endpoint. The limiter stamps X-RateLimit-* response headers + a
// 429 problem+json body when the per-key (or anonymous IP) bucket is
// exceeded.
router.use(apiKeyRateLimit);

router.post('/sso-login', ssoLogin);
router.post('/sso-mint-ticket', ssoMintTicket);

export default router;

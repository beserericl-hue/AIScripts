/**
 * CR-042 Phase B — browser-facing SSO routes (NOT under /api).
 *
 * Mounted at /sso/v1/* so the URLs match the public CSHSE-SSO spec.
 * Two endpoints:
 *
 *   GET /sso/v1/start?ticket=...
 *     Consumes the ticket → mints JWT → 303-redirects to returnTo
 *     with #token=<JWT> fragment. The client auth bootstrap reads
 *     the fragment + lands the user logged in.
 *
 *   POST /sso/v1/from-memberclick
 *     MemberClick relay. Four-defense validation; on success mints a
 *     ticket internally + redirects to /sso/v1/start.
 */
import { Router } from 'express';
import { ssoRedeemTicket, ssoFromMemberClick } from '../controllers/ssoTicketController';

const router = Router();

router.get('/v1/start', ssoRedeemTicket);
router.post('/v1/from-memberclick', ssoFromMemberClick);

export default router;

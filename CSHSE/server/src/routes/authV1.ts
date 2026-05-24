/**
 * CR-042 — Public v1 auth routes.
 *
 * Mounted at /api/v1/auth. Currently exposes only the SSO direct-login
 * endpoint; the ticket/redirect flow (Phase A Slice 4) will join the same
 * router when it ships.
 *
 * CORS is intentionally NOT enabled on this router — direct sso-login is a
 * server-to-server call. The browser ticket flow uses a same-origin redirect.
 */
import { Router } from 'express';
import { ssoLogin } from '../controllers/ssoController';

const router = Router();

router.post('/sso-login', ssoLogin);

export default router;

/**
 * CR-042 Phase B — OpenAPI 3.1 spec + public docs.
 *
 * Endpoints:
 *   GET /api/v1/openapi.json   — machine-readable spec
 *   GET /api/v1/docs           — minimal HTML viewer using Redoc CDN
 *
 * The spec lives inline so it stays in sync with the code (no separate
 * YAML to drift). For richer docs we can swap the inline JSON for a
 * generated swagger-jsdoc pipeline later.
 */
import { Router, Request, Response } from 'express';

const router = Router();

const SPEC: Record<string, unknown> = {
  openapi: '3.1.0',
  info: {
    title: 'CSHSE Public API — v1',
    version: '1.0.0',
    description:
      'Public API for the CSHSE Self-Study Portal. Currently exposes the SSO ' +
      'endpoints (CR-042) used by integration partners such as MemberClick.',
    contact: {
      name: 'CSHSE Engineering',
      url: 'https://docs.cshse.org/',
    },
  },
  servers: [
    { url: 'https://cshse.org', description: 'Production' },
    { url: 'https://cshse-develop.up.railway.app', description: 'Develop' },
  ],
  paths: {
    '/api/v1/auth/sso-login': {
      post: {
        summary: 'Direct server-to-server SSO login',
        description:
          'Exchanges an authenticated API key + email for a 30-day JWT. ' +
          'Used by integrators that hold both the API key (server-side) ' +
          'and the user\'s session (also server-side).',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'JWT issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessionToken: { type: 'string' },
                    token: { type: 'string', description: 'Alias for sessionToken' },
                    user: { type: 'object' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/auth/sso-mint-ticket': {
      post: {
        summary: 'Mint a single-use browser SSO ticket',
        description:
          'Server-to-server. Returns a 90-second single-use ticket. ' +
          'Redirect the user to /sso/v1/start?ticket=<ticket> to log them in.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  returnTo: { type: 'string', description: 'Path on the CSHSE origin to land the user on. Defaults to /dashboard.' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Ticket issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ticket: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/sso/v1/start': {
      get: {
        summary: 'Redeem an SSO ticket + redirect to the app',
        description:
          'Browser-facing. Consumes the ticket, mints a JWT, and ' +
          '303-redirects to `returnTo#token=<JWT>`. The client auth ' +
          'bootstrap reads the URL fragment and persists the token.',
        parameters: [
          {
            name: 'ticket',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '303': { description: 'Redirect to `returnTo#token=<JWT>`' },
          '400': { description: 'Missing ticket parameter' },
          '401': { description: 'Ticket expired, already used, or unknown' },
          '403': { description: 'No active CSHSE account for the ticket email' },
        },
      },
    },
    '/sso/v1/from-memberclick': {
      post: {
        summary: 'MemberClick SSO relay',
        description:
          'Validates Referer + IP + HMAC + domain-allowlist, then mints ' +
          'an internal ticket and 303-redirects to /sso/v1/start.',
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['email', 'timestamp', 'signature'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  timestamp: { type: 'integer', description: 'Unix seconds; must be within ±5 minutes of server clock' },
                  signature: { type: 'string', description: 'HMAC-SHA256(MEMBERCLICK_SHARED_SECRET, `${email}.${timestamp}`)' },
                  returnTo: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '303': { description: 'Redirect to /sso/v1/start with a fresh ticket' },
          '400': { description: 'Invalid email' },
          '403': { description: 'One of: referer-mismatch / ip-mismatch / stale-timestamp / bad-signature / sso-domain-not-yet-trusted' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-cshse-api-key',
        description: 'API key issued via the Settings → API Keys page. Required scope: sso-login.',
      },
    },
    responses: {
      Unauthorized: { description: 'API key missing, invalid, expired, or wrong scope.' },
      Forbidden: { description: 'Domain not on the trusted allowlist, or wrong key scope.' },
      BadRequest: { description: 'Validation failed (invalid email, missing field).' },
    },
  },
};

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(SPEC);
});

router.get('/docs', (_req: Request, res: Response) => {
  res.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CSHSE Public API — v1</title>
  <link rel="icon" type="image/svg+xml" href="/cshse-logo.svg">
</head>
<body style="margin:0">
  <redoc spec-url="/api/v1/openapi.json"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`);
});

export default router;

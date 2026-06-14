/**
 * Postal email client (courseworx.media).
 *
 * ALL outbound mail for this app goes through the Postal instance at
 * postal-admin.courseworx.media. The From address is FIXED to
 * POSTAL_DEFAULT_FROM (cshse@courseworx.media) and is intentionally NOT a caller
 * parameter — branding stays constant. Per-user identity goes in `reply_to`, so
 * replies route to the human who triggered the send while From stays branded.
 *
 * Wire contract. NOTE: empirically verified against the live
 * postal-admin.courseworx.media instance on 2026-06-14, the send route is
 * `/api/v1/send/message` (the standard Postal path) — `/send/message` returns
 * 404 there. (The integration brief claimed the reverse; the live probe is
 * authoritative: /send/message → 404, /api/v1/send/message → 200.) Override with
 * POSTAL_SEND_PATH if a future deployment differs.
 *   POST  {POSTAL_API_URL}{POSTAL_SEND_PATH=/api/v1/send/message}
 *   header  x-server-api-key: <POSTAL_API_KEY>   (lowercase; not Authorization)
 *   Content-Type: application/json
 *   body: { to[], from, subject, html_body, plain_body, reply_to?, cc?, bcc?,
 *           sender?, headers?, tag?, attachments? }
 *   200 → { status: 'success', data: { message_id } }
 *   401 bad key · 422 malformed body · 404 wrong path · 5xx degraded (retry)
 *
 * Thin client by design — no Postal SDK dependency.
 */

const POSTAL_API_URL = (process.env.POSTAL_API_URL || 'https://postal-admin.courseworx.media').replace(/\/+$/, '');
const POSTAL_DEFAULT_FROM = process.env.POSTAL_DEFAULT_FROM || 'cshse@courseworx.media';
// Empirically /api/v1/send/message on the live courseworx.media Postal instance.
const POSTAL_SEND_PATH = process.env.POSTAL_SEND_PATH || '/api/v1/send/message';

export interface PostalAttachment {
  name: string;
  contentType: string;
  /** base64-encoded bytes */
  data: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Per-user identity — replies route here, NOT to the branded From. */
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  /** Postal categorisation; defaults to 'transactional'. */
  tag?: string;
  attachments?: PostalAttachment[];
}

function asArray(v?: string | string[]): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => String(s).trim()).filter(Boolean);
}

/** True once POSTAL_API_KEY is present (the only var without a safe default). */
export function isPostalConfigured(): boolean {
  return !!process.env.POSTAL_API_KEY;
}

/**
 * Boot-time visibility. Logs loudly when the API key is missing so a misconfig
 * is obvious in the logs BEFORE the first send — but does NOT crash the process
 * (the app must still boot before the key is provisioned on a fresh env).
 */
export function assertPostalConfig(): void {
  if (!process.env.POSTAL_API_KEY) {
    console.error(
      '[postal] POSTAL_API_KEY is NOT set — outbound email is DISABLED until it is provisioned ' +
      `(target ${POSTAL_API_URL}, from ${POSTAL_DEFAULT_FROM}).`
    );
  } else {
    console.log(`[postal] email configured — ${POSTAL_API_URL}, from ${POSTAL_DEFAULT_FROM}`);
  }
}

/**
 * Send one message through Postal. Returns the server-generated message_id.
 * Throws (never swallows) on failure, with the Postal error body included.
 * 15s timeout; retries connection errors + 5xx (2s, 4s backoff, max 3 attempts);
 * never retries 4xx (a client bug — retrying won't fix it).
 */
export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  const apiKey = process.env.POSTAL_API_KEY;
  if (!apiKey) throw new Error('[postal] POSTAL_API_KEY is not set — cannot send email');

  const to = asArray(input.to);
  if (to.length === 0) throw new Error('[postal] at least one "to" recipient is required');
  if (!input.subject) throw new Error('[postal] subject is required');
  if (!input.html && !input.text) throw new Error('[postal] html or text body is required');

  // bcc merges the optional operations/audit mailbox (POSTAL_BCC).
  const mergedBcc = [...asArray(input.bcc), ...asArray(process.env.POSTAL_BCC)];
  const cc = asArray(input.cc);

  const body: Record<string, unknown> = {
    to,
    from: POSTAL_DEFAULT_FROM, // FIXED branded sender — never caller-overridable
    subject: input.subject,
    tag: input.tag || 'transactional',
  };
  if (input.html) body.html_body = input.html;
  if (input.text) body.plain_body = input.text;
  if (input.replyTo) body.reply_to = input.replyTo;
  if (cc.length) body.cc = cc;
  if (mergedBcc.length) body.bcc = mergedBcc;
  if (input.attachments?.length) {
    body.attachments = input.attachments.map((a) => ({
      name: a.name,
      content_type: a.contentType,
      data: a.data,
    }));
  }

  const url = `${POSTAL_API_URL}${POSTAL_SEND_PATH}`;
  const recipientsForLog = to.join(',');
  let lastErr: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let fatal = false;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'x-server-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const duration_ms = Date.now() - started;
      let payload: any = null;
      try { payload = await res.json(); } catch { /* non-JSON error body */ }

      if (res.ok && payload?.status === 'success' && payload?.data?.message_id) {
        const messageId = String(payload.data.message_id);
        // Structured success log — never the body (html_body may hold user content).
        console.log(JSON.stringify({
          src: 'postal', message_id: messageId, to: recipientsForLog,
          subject: input.subject, status: 'sent', duration_ms,
        }));
        return { messageId };
      }

      const errBody = (payload ? JSON.stringify(payload) : await res.text().catch(() => '')) || '';
      console.warn(JSON.stringify({
        src: 'postal', to: recipientsForLog, subject: input.subject, status: 'error',
        error_code: res.status, error_message: String(errBody).slice(0, 500), attempt,
      }));
      lastErr = new Error(`[postal] send failed (HTTP ${res.status}): ${errBody}`);
      // 4xx is a client bug — do not retry.
      if (res.status >= 400 && res.status < 500) fatal = true;
    } catch (e: any) {
      console.warn(JSON.stringify({
        src: 'postal', to: recipientsForLog, subject: input.subject, status: 'error',
        error_code: e?.name || 'network', error_message: String(e?.message || e).slice(0, 500), attempt,
      }));
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }

    if (fatal) break;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1))); // 2s, 4s
  }

  throw lastErr instanceof Error ? lastErr : new Error('[postal] send failed after retries');
}

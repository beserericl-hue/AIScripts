/**
 * SendGrid email client (Twilio SendGrid v3 API).
 *
 * Drop-in alternative to the Postal client. The self-hosted Postal server runs
 * on a Railway/GCP egress IP with no reverse DNS, so strict receivers (Microsoft
 * / .edu) blocklist it (Spamhaus) and reject outbound mail. SendGrid owns clean,
 * reverse-DNS-aligned sending IPs and authenticates `courseworx.media` via its
 * own DKIM/return-path CNAMEs, so it delivers where the self-hosted IP can't.
 *
 * Same contract as postal.ts: From is FIXED to SENDGRID_FROM (cshse@courseworx
 * .media), per-user identity rides in reply_to. Thin client — no SDK.
 *
 *   POST  https://api.sendgrid.com/v3/mail/send
 *   header  Authorization: Bearer <SENDGRID_API_KEY>
 *   202 Accepted (empty body) → success; X-Message-Id header is the id
 *   401 bad key · 403 unverified sender · 413 too big · 429 rate · 4xx malformed
 */

const SENDGRID_SEND_URL = 'https://api.sendgrid.com/v3/mail/send';
const SENDGRID_FROM =
  process.env.SENDGRID_FROM || process.env.POSTAL_DEFAULT_FROM || 'cshse@courseworx.media';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'CSHSE Self-Study Portal';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Per-user identity — replies route here, NOT to the branded From. */
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

function asArray(v?: string | string[]): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => String(s).trim()).filter(Boolean);
}

/** True once SENDGRID_API_KEY is present. */
export function isSendgridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}

/** Boot-time visibility (mirrors assertPostalConfig). */
export function assertSendgridConfig(): void {
  if (process.env.SENDGRID_API_KEY) {
    console.log(`[sendgrid] email configured — from ${SENDGRID_FROM}`);
  }
}

/**
 * Send one message through SendGrid. Returns the X-Message-Id. Throws (never
 * swallows) on failure with the SendGrid error body. 15s timeout; retries
 * connection errors + 5xx + 429 (2s, 4s backoff, max 3); never retries other 4xx.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('[sendgrid] SENDGRID_API_KEY is not set — cannot send email');

  const to = asArray(input.to);
  if (to.length === 0) throw new Error('[sendgrid] at least one "to" recipient is required');
  if (!input.subject) throw new Error('[sendgrid] subject is required');
  if (!input.html && !input.text) throw new Error('[sendgrid] html or text body is required');

  const cc = asArray(input.cc);
  const mergedBcc = [...asArray(input.bcc), ...asArray(process.env.SENDGRID_BCC)];

  const personalization: Record<string, unknown> = { to: to.map((email) => ({ email })) };
  if (cc.length) personalization.cc = cc.map((email) => ({ email }));
  if (mergedBcc.length) personalization.bcc = mergedBcc.map((email) => ({ email }));

  // SendGrid requires content in increasing preference order: text/plain THEN text/html.
  const content: Array<{ type: string; value: string }> = [];
  if (input.text) content.push({ type: 'text/plain', value: input.text });
  if (input.html) content.push({ type: 'text/html', value: input.html });

  const body: Record<string, unknown> = {
    personalizations: [personalization],
    from: { email: SENDGRID_FROM, name: SENDGRID_FROM_NAME }, // FIXED branded sender
    subject: input.subject,
    content,
  };
  if (input.replyTo) body.reply_to = { email: input.replyTo };

  const recipientsForLog = to.join(',');
  let lastErr: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let fatal = false;
    try {
      const res = await fetch(SENDGRID_SEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const duration_ms = Date.now() - started;

      if (res.status === 202) {
        const messageId = res.headers.get('x-message-id') || '';
        console.log(JSON.stringify({
          src: 'sendgrid', message_id: messageId, to: recipientsForLog,
          subject: input.subject, status: 'sent', duration_ms,
        }));
        return { messageId };
      }

      const errBody = await res.text().catch(() => '');
      console.warn(JSON.stringify({
        src: 'sendgrid', to: recipientsForLog, subject: input.subject, status: 'error',
        error_code: res.status, error_message: String(errBody).slice(0, 500), attempt,
      }));
      lastErr = new Error(`[sendgrid] send failed (HTTP ${res.status}): ${errBody}`);
      // 4xx (except 429 rate-limit) is a client bug — do not retry.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) fatal = true;
    } catch (e: any) {
      console.warn(JSON.stringify({
        src: 'sendgrid', to: recipientsForLog, subject: input.subject, status: 'error',
        error_code: e?.name || 'network', error_message: String(e?.message || e).slice(0, 500), attempt,
      }));
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }

    if (fatal) break;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
  }

  throw lastErr instanceof Error ? lastErr : new Error('[sendgrid] send failed after retries');
}

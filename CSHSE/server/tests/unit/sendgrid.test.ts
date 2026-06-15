/**
 * SendGrid thin-client contract test. No real network — global fetch is mocked.
 * Pins the v3 mail/send wire format.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sendgrid client', () => {
  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    process.env.SENDGRID_FROM = 'cshse@courseworx.media';
    delete process.env.SENDGRID_BCC;
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('POSTs v3 mail/send with Bearer auth, fixed From, and ordered content', async () => {
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 202,
      headers: { 'x-message-id': 'sg-msg-123' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { sendEmail } = await import('../../src/services/sendgrid');
    const res = await sendEmail({
      to: 'r@example.com',
      subject: 'Hello',
      html: '<p>hi</p>',
      text: 'hi',
      replyTo: 'user@example.com',
    });

    expect(res.messageId).toBe('sg-msg-123');
    const [url, opts] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(opts.headers.Authorization).toBe('Bearer SG.test-key');

    const body = JSON.parse(opts.body);
    expect(body.from.email).toBe('cshse@courseworx.media');
    expect(body.personalizations[0].to).toEqual([{ email: 'r@example.com' }]);
    expect(body.reply_to).toEqual({ email: 'user@example.com' });
    // text/plain MUST come before text/html (SendGrid ordering rule).
    expect(body.content[0]).toEqual({ type: 'text/plain', value: 'hi' });
    expect(body.content[1]).toEqual({ type: 'text/html', value: '<p>hi</p>' });
  });

  it('throws on a 4xx and does NOT retry', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ errors: [{ message: 'bad request' }] }), { status: 400 }
    ));
    vi.stubGlobal('fetch', fetchMock);
    const { sendEmail } = await import('../../src/services/sendgrid');
    await expect(sendEmail({ to: 'r@example.com', subject: 's', text: 't' })).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when SENDGRID_API_KEY is missing', async () => {
    delete process.env.SENDGRID_API_KEY;
    vi.resetModules();
    const { sendEmail, isSendgridConfigured } = await import('../../src/services/sendgrid');
    expect(isSendgridConfigured()).toBe(false);
    await expect(sendEmail({ to: 'r@example.com', subject: 's', text: 't' }))
      .rejects.toThrow(/SENDGRID_API_KEY/);
  });
});

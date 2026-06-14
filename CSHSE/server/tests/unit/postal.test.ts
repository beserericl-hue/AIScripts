/**
 * Postal thin-client contract test. No real network — global fetch is mocked.
 * Pins the wire format that the live courseworx.media instance requires.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const POSTAL_API_URL = 'https://postal-test.example';
const POSTAL_DEFAULT_FROM = 'cshse@courseworx.media';

describe('postal client', () => {
  beforeEach(() => {
    process.env.POSTAL_API_URL = POSTAL_API_URL;
    process.env.POSTAL_DEFAULT_FROM = POSTAL_DEFAULT_FROM;
    process.env.POSTAL_API_KEY = 'test-key-123';
    delete process.env.POSTAL_BCC;
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('POSTs /send/message with x-server-api-key, default From, and contract body keys', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ status: 'success', data: { message_id: 'msg-abc-123' } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { sendEmail } = await import('../../src/services/postal');
    const res = await sendEmail({
      to: ['r@example.com'],
      subject: 'Hello',
      html: '<p>hi</p>',
      text: 'hi',
      replyTo: 'user@example.com',
    });

    // Returns the server message_id.
    expect(res.messageId).toBe('msg-abc-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, any];

    // URL is the live instance's send path (/api/v1/send/message — verified).
    expect(url).toBe(`${POSTAL_API_URL}/api/v1/send/message`);
    // Lowercase x-server-api-key header (not Authorization).
    expect(opts.headers['x-server-api-key']).toBe('test-key-123');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    // From defaults to POSTAL_DEFAULT_FROM (there is no caller "from" param).
    expect(body.from).toBe(POSTAL_DEFAULT_FROM);
    // Contract keys: html_body / plain_body (NOT html / text).
    expect(body.html_body).toBe('<p>hi</p>');
    expect(body.plain_body).toBe('hi');
    expect('html' in body).toBe(false);
    expect('text' in body).toBe(false);
    // to is an array; reply_to carries the per-user identity.
    expect(body.to).toEqual(['r@example.com']);
    expect(body.reply_to).toBe('user@example.com');
  });

  it('throws with the Postal error body on 4xx and does NOT retry', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ status: 'error', error: 'missing field: subject' }),
      { status: 422, headers: { 'content-type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { sendEmail } = await import('../../src/services/postal');
    await expect(
      sendEmail({ to: 'r@example.com', subject: 's', text: 't' })
    ).rejects.toThrow(/422/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 4xx is a client bug — no retry
  });

  it('does not double /api/v1 when POSTAL_API_URL already includes it (WritersWorkbench convention)', async () => {
    process.env.POSTAL_API_URL = 'https://postal-test.example/api/v1';
    vi.resetModules();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ status: 'success', data: { message_id: 'm' } }), { status: 200 }
    ));
    vi.stubGlobal('fetch', fetchMock);
    const { sendEmail } = await import('../../src/services/postal');
    await sendEmail({ to: 'r@example.com', subject: 's', text: 't' });
    const [url] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://postal-test.example/api/v1/send/message');
  });

  it('throws when POSTAL_API_KEY is missing', async () => {
    delete process.env.POSTAL_API_KEY;
    vi.resetModules();
    const { sendEmail } = await import('../../src/services/postal');
    await expect(sendEmail({ to: 'r@example.com', subject: 's', text: 't' }))
      .rejects.toThrow(/POSTAL_API_KEY/);
  });
});

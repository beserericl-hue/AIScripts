import { describe, it, expect, vi, afterEach } from 'vitest';
import { emailService } from '../../src/services/emailService';

// A 1x1 PNG (base64, no data: prefix).
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('emailService.sendBugReportEmail', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emails both support inboxes with the screenshot as a real attachment', async () => {
    const spy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

    await emailService.sendBugReportEmail({
      reference: 'abc123',
      description: 'I clicked Save and nothing happened',
      route: '/dashboard',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      reporterName: 'Michelle Miller',
      reporterEmail: 'michelle@mccneb.edu',
      reporterRole: 'program_coordinator',
      screenshot: `data:image/png;base64,${PNG_B64}`,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const arg: any = spy.mock.calls[0][0];
    // Both required recipients.
    expect(arg.to).toEqual(['eric@agileadtesting.com', 'info@cshse.org']);
    // Reply-To routes back to the reporter.
    expect(arg.replyTo).toBe('michelle@mccneb.edu');
    // The text of the report is in the email.
    expect(arg.text).toContain('I clicked Save and nothing happened');
    expect(arg.text).toContain('/dashboard');
    expect(arg.text).toContain('Michelle Miller');
    expect(arg.html).toContain('I clicked Save and nothing happened');
    // The image is attached (decoded from the data URL).
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].contentType).toBe('image/png');
    expect(arg.attachments[0].data).toBe(PNG_B64);
    expect(arg.attachments[0].name).toBe('screenshot-abc123.png');
    expect(arg.subject).toMatch(/Bug report/i);
  });

  it('still emails both inboxes when no screenshot was captured', async () => {
    const spy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

    await emailService.sendBugReportEmail({
      reference: 'r2',
      description: 'no image case',
      route: '/x',
      userAgent: 'UA',
    });

    const arg: any = spy.mock.calls[0][0];
    expect(arg.to).toEqual(['eric@agileadtesting.com', 'info@cshse.org']);
    expect(arg.attachments).toBeUndefined();
    expect(arg.text).toContain('No screenshot was attached');
  });

  it('JPEG data URL attaches with a .jpg name', async () => {
    const spy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue(true);
    await emailService.sendBugReportEmail({
      reference: 'jpg1',
      description: 'x',
      route: '/x',
      userAgent: 'UA',
      screenshot: `data:image/jpeg;base64,${PNG_B64}`,
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.attachments[0].contentType).toBe('image/jpeg');
    expect(arg.attachments[0].name).toBe('screenshot-jpg1.jpg');
  });
});

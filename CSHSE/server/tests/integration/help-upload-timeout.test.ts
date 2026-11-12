/** Help uploads that never get n8n's callback are marked failed after 15 minutes. */
import { describe, it, expect } from 'vitest';
import { HelpDocument } from '../../src/models/HelpDocument';
import { expireStuckHelpUploads, HELP_UPLOAD_TIMEOUT_MS } from '../../src/controllers/helpChatController';

describe('help document upload timeout', () => {
  it('POSITIVE: a document still processing after 15 minutes becomes error with a reason', async () => {
    const old = await HelpDocument.create({ fileName: 'stuck.pdf', title: 't', source: 'handbook', fileSize: 1, status: 'processing', uploadedAt: new Date(Date.now() - HELP_UPLOAD_TIMEOUT_MS - 60000) } as any);
    const n = await expireStuckHelpUploads();
    expect(n).toBeGreaterThanOrEqual(1);
    const after: any = await HelpDocument.findById(old._id).lean();
    expect(after.status).toBe('error');
    expect(after.error).toMatch(/did not confirm/);
  });
  it('NEGATIVE: a recent upload, and a loaded one, are left alone', async () => {
    const fresh = await HelpDocument.create({ fileName: 'fresh.pdf', title: 't', source: 'handbook', fileSize: 1, status: 'processing', uploadedAt: new Date() } as any);
    const loaded = await HelpDocument.create({ fileName: 'ok.pdf', title: 't', source: 'handbook', fileSize: 1, status: 'loaded', uploadedAt: new Date(Date.now() - 86400000) } as any);
    await expireStuckHelpUploads();
    expect(((await HelpDocument.findById(fresh._id).lean()) as any).status).toBe('processing');
    expect(((await HelpDocument.findById(loaded._id).lean()) as any).status).toBe('loaded');
  });
});

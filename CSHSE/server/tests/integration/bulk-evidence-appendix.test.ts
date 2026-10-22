/**
 * POST /api/submissions/:id/review/bulk-evidence — appendix-named folder drop
 * (Kennesaw State, Oct 2026). Storage, text extraction and the AI placement
 * client are mocked; routing logic and persistence are real.
 *
 * Positive: appendix files are FILED NOW under the cited standard/spec; a .url
 * shortcut becomes link evidence; the response reports every file's placement.
 * Negative: an unsupported file is skipped without failing the batch; a re-drop
 * of the same file is not uploaded again; a topic-only guess is NOT stamped.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/services/s3Service', async (orig) => {
  const real: any = await orig();
  return { ...real, isS3Configured: () => true, uploadFile: vi.fn(async () => ({ bucket: 'test-bucket', key: 'k' })),
    generateS3Key: (a: string, b: string, c: string) => `${a}/${b}/${c}` };
});
vi.mock('../../src/services/cshseAiClient', async (orig) => {
  const real: any = await orig();
  return { ...real, extractFileText: vi.fn(async () => ({ text: '' })), recommendPlacement: vi.fn(async () => ({ std: '9', spec: 'a', confidence: 0.4 })) };
});
vi.mock('../../src/services/evidenceIndexer', async (orig) => {
  const real: any = await orig();
  return { ...real, indexEvidenceFile: vi.fn(async () => undefined) };
});

import request from 'supertest';
import app from '../../src/index';
import { Institution } from '../../src/models/Institution';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { createUser, signTokenFor } from '../helpers/factories';

async function setup() {
  const inst = await Institution.create({
    name: `KSU-${Date.now().toString(36)}`, type: 'university',
    address: { street: '1 Main', city: 'Kennesaw', state: 'GA', zip: '30144', country: 'USA' },
    primaryContact: { name: 'PC', email: 'pc@test.local', phone: '555' },
  });
  const { user } = await createUser({ role: 'program_coordinator', institutionId: String(inst._id) });
  (user as any).roleAssignments = [{ role: 'program_coordinator', institutionId: inst._id }]; await user.save();
  const bucket = (std: string, spec: string, text: string) => ({ standardCode: std, specCode: spec, narratives: [{ sectionId: `s-${std}${spec}`, snippet: text, confidence: 0.9 }], evidenceText: [], evidenceFiles: [] });
  const sub = await Submission.create({
    submissionId: `KSU-${Date.now().toString(36)}`, institutionName: inst.name, institutionId: inst._id,
    programName: 'Human Services', programLevel: 'bachelors', submitterId: user._id, type: 'initial', status: 'draft',
    aiReviewState: { buckets: {
      '4.a': bucket('4', 'a', 'See Appendix IV Standard IV Program Evaluation 2 AOL Plan'),
      '4.c': bucket('4', 'c', 'For student satisfaction data, please see Appendix IV Program Evaluation, 8 Results from Exit Survey 2022_2026, and 9 Alumni Survey Data.'),
      '21.e': bucket('21', 'e', 'Agencies follow the CORE Manual for internships.'),
    }, evidenceDocs: [] },
  });
  return { inst, sub, token: signTokenFor(user) };
}

const pdf = Buffer.from('%PDF-1.4\n%test\n');

describe('bulk evidence — appendix-named folder drop', () => {
  it('files appendix documents under the cited spec immediately and reports each placement', async () => {
    const { sub, token } = await setup();
    const res = await request(app).post(`/api/submissions/${sub._id}/review/bulk-evidence`)
      .set('Authorization', `Bearer ${token}`)
      .attach('files', pdf, { filename: 'APPENDIX IV 9 Alumni Survey Data.pdf', contentType: 'application/pdf' })
      .attach('files', pdf, { filename: 'APPENDIX IV 2 AOL Plan.pdf', contentType: 'application/pdf' })
      .attach('files', Buffer.from('[InternetShortcut]\r\nURL=https://example.edu/core-manual\r\n'), { filename: 'APPENDIX IV 21 CORE Manual.url', contentType: 'application/octet-stream' })
      .attach('files', Buffer.from('MZ'), { filename: 'setup.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(200);
    const by = Object.fromEntries(res.body.added.map((a: any) => [a.fileName, a]));
    expect(by['APPENDIX IV 9 Alumni Survey Data.pdf']).toMatchObject({ placedStd: '4', placedSpec: 'c' });
    expect(by['APPENDIX IV 2 AOL Plan.pdf']).toMatchObject({ placedStd: '4', placedSpec: 'a' });
    expect(by['APPENDIX IV 21 CORE Manual.url']).toMatchObject({ placedStd: '4', link: 'https://example.edu/core-manual' });
    expect(res.body.skipped).toEqual([expect.objectContaining({ fileName: 'setup.exe' })]);

    const alumni = await SupportingEvidence.findOne({ submissionId: sub._id, 'file.originalName': 'APPENDIX IV 9 Alumni Survey Data.pdf' }).lean();
    expect(alumni).toMatchObject({ standardCode: '4', specCode: 'c' });
    const link: any = await SupportingEvidence.findOne({ submissionId: sub._id, evidenceType: 'url' }).lean();
    expect(link.url.href).toBe('https://example.edu/core-manual');
    expect(link.standardCode).toBe('4');
  });

  it('a re-drop of the same file is not uploaded again (negative)', async () => {
    const { sub, token } = await setup();
    const send = () => request(app).post(`/api/submissions/${sub._id}/review/bulk-evidence`)
      .set('Authorization', `Bearer ${token}`)
      .attach('files', pdf, { filename: 'APPENDIX IV 9 Alumni Survey Data.pdf', contentType: 'application/pdf' });
    await send();
    const again = await send();
    expect(again.status).toBe(200);
    expect(again.body.added[0]).toMatchObject({ duplicateOf: expect.any(String), placedStd: '4', placedSpec: 'c' });
    expect(await SupportingEvidence.countDocuments({ submissionId: sub._id, 'file.originalName': 'APPENDIX IV 9 Alumni Survey Data.pdf' })).toBe(1);
  });

  it('a topic-only guess is suggested but NOT filed until approved (negative)', async () => {
    const { sub, token } = await setup();
    const res = await request(app).post(`/api/submissions/${sub._id}/review/bulk-evidence`)
      .set('Authorization', `Bearer ${token}`)
      .attach('files', pdf, { filename: 'Budget overview.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.added[0].placedStd).toBeNull();
    const ev: any = await SupportingEvidence.findOne({ submissionId: sub._id, 'file.originalName': 'Budget overview.pdf' }).lean();
    expect(ev.standardCode).toBeUndefined();
  });

  it('a drop of ONLY unsupported files returns a clear error listing them (negative)', async () => {
    const { sub, token } = await setup();
    const res = await request(app).post(`/api/submissions/${sub._id}/review/bulk-evidence`)
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('MZ'), { filename: 'setup.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
    expect(res.body.skipped[0].fileName).toBe('setup.exe');
  });
});

/**
 * Importer kind "Curriculum matrix": the upload is filed under 2.e and its rows
 * load into the Curriculum Matrix (aiMatrixState + CurriculumMatrix) — no
 * section parsing, no draft narratives. The ai-service call is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

const extractMatrix = vi.fn();
vi.mock('../../src/services/cshseAiClient', async (orig) => ({ ...(await orig<any>()), extractMatrix: (...a: any[]) => extractMatrix(...a) }));

import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { CurriculumMatrix } from '../../src/models/CurriculumMatrix';
import { createUser, signTokenFor } from '../helpers/factories';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WIRE = {
  matrixId: 'matrix-hsr',
  name: 'Matrix for Human Services Courses',
  htmlSnippet: '<table><tr id="matrix-hsr-row-11-b"><td>The historical roots of human services.</td><td>IKM</td></tr></table>',
  rowsMatched: 55,
  cells: [{ std: '11', spec: 'b', codeRaw: 'IKM', columnHeader: 'HDAL 3110' }, { std: '12', spec: 'a', codeRaw: 'KTM', columnHeader: 'HDAL 2510' }],
};

async function seed() {
  const inst = new mongoose.Types.ObjectId();
  const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: inst.toString() });
  const sub = await Submission.create({
    submissionId: `MX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    institutionName: 'Test U', institutionId: inst, programName: 'Human Services', programLevel: 'bachelors',
    submitterId: pc._id, type: 'initial', status: 'draft',
  });
  return { token: signTokenFor(pc as any), sub };
}
const upload = (token: string, sid: any, name = 'Matrix- Completed 2026.docx', type = DOCX) =>
  request(app).post('/api/imports/upload').set('Authorization', `Bearer ${token}`)
    .field('submissionId', String(sid)).field('documentKind', 'matrix')
    .attach('file', Buffer.from('PK docx bytes'), { filename: name, contentType: type });

describe('import upload — Curriculum matrix kind', () => {
  beforeEach(() => { extractMatrix.mockReset(); });

  it('loads the matrix into the Curriculum Matrix and files the document under 2.e', async () => {
    extractMatrix.mockResolvedValue({ matrices: [WIRE] });
    const { token, sub } = await seed();
    const res = await upload(token, sub._id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ directStored: true, kind: 'matrix', rows: 55, cells: 2 });
    expect(extractMatrix.mock.calls[0][0]).toMatchObject({ programLevel: 'bachelors' });
    const ev: any = await SupportingEvidence.findById(res.body.evidenceId).lean();
    expect(ev).toMatchObject({ standardCode: '2', specCode: 'e' });
    expect(ev.tags).toContain('kind:matrix');
    const s: any = await Submission.findById(sub._id).lean();
    expect(s.aiMatrixState.matrices.map((m: any) => m.matrixId)).toEqual(['standalone-matrix-hsr']);
    const cm: any = await CurriculumMatrix.findOne({ submissionId: sub._id }).lean();
    expect(cm.rawContent.map((r: any) => r.id)).toEqual(['matrix-standalone-matrix-hsr']);
    expect(cm.rawContent[0].content).toContain('matrix-hsr-row-11-b');
  });

  it('uploading a corrected matrix REPLACES the previous one (no duplicates)', async () => {
    extractMatrix.mockResolvedValue({ matrices: [WIRE] });
    const { token, sub } = await seed();
    await upload(token, sub._id);
    await upload(token, sub._id, 'Matrix v2.docx');
    const cm: any = await CurriculumMatrix.findOne({ submissionId: sub._id }).lean();
    expect(cm.rawContent).toHaveLength(1);
    expect(cm.rawContent[0].title).toContain('Matrix v2.docx');
  });

  it('reuses the same file already in the library instead of storing a second copy', async () => {
    extractMatrix.mockResolvedValue({ matrices: [WIRE] });
    const { token, sub } = await seed();
    const first = await upload(token, sub._id);
    await SupportingEvidence.updateOne({ _id: first.body.evidenceId }, { $unset: { standardCode: '', specCode: '' }, $set: { tags: [] } });
    const again = await upload(token, sub._id);
    expect(String(again.body.evidenceId)).toBe(String(first.body.evidenceId));
    expect(await SupportingEvidence.countDocuments({ submissionId: sub._id, isDeleted: { $ne: true } })).toBe(1);
    const ev: any = await SupportingEvidence.findById(first.body.evidenceId).lean();
    expect(ev).toMatchObject({ standardCode: '2', specCode: 'e' });
    expect(ev.tags).toContain('kind:matrix');
  });

  it('NEGATIVE: a document with no recognisable matrix answers 422 and changes no matrix (the file is kept under 2.e)', async () => {
    extractMatrix.mockResolvedValue({ matrices: [] });
    const { token, sub } = await seed();
    const res = await upload(token, sub._id, 'Not a matrix.docx');
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/No curriculum-matrix rows/);
    expect(await CurriculumMatrix.countDocuments({ submissionId: sub._id })).toBe(0);
    const ev: any = await SupportingEvidence.findById(res.body.evidenceId).lean();
    expect(ev).toMatchObject({ standardCode: '2', specCode: 'e' });
  });

  it('NEGATIVE: a PDF is refused before anything is stored (matrix must be .docx)', async () => {
    const { token, sub } = await seed();
    const res = await upload(token, sub._id, 'matrix.pdf', 'application/pdf');
    expect(res.status).toBe(422);
    expect(extractMatrix).not.toHaveBeenCalled();
    expect(await SupportingEvidence.countDocuments({ submissionId: sub._id })).toBe(0);
  });
});

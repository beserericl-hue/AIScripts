/**
 * CSHSE board decision (Nov 2026, via Lauri): the curriculum matrix is removed
 * from the self-study — every endpoint, field and process that used it is gone,
 * and a matrix DOCUMENT stays in the File Library but is excluded from indexing,
 * AI evaluation, AI placement, coverage, reader views and the report outputs.
 *
 * POSITIVE: ordinary files keep flowing (indexed, evaluated, AI-placed, listed
 * to readers); the filled Reader Report still fills its tokens.
 * NEGATIVE: matrix routes 404; no aiMatrixState; no CurriculumMatrix written;
 * documentKind 'matrix' 400; a matrix upload is tagged + un-assigned and never
 * indexed / evaluated / placed / shown to a reader; no "atrix" / "Conditional
 * accreditation" in the filled Word forms.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import JSZip from 'jszip';
import app from '../../src/index';
import { Institution } from '../../src/models/Institution';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { ReaderReport } from '../../src/models/ReaderReport';
import { ValidationService } from '../../src/services/validationService';
import * as ai from '../../src/services/cshseAiClient';
import * as s3 from '../../src/services/s3Service';
import { indexEvidenceFile, indexAllForSubmission } from '../../src/services/evidenceIndexer';
import { CURRICULUM_MATRIX_EXCLUDED_TAG } from '../../src/services/curriculumMatrixExclusion';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';

afterEach(() => { vi.restoreAllMocks(); });

const FORM_TITLE = 'Matrix Illustrating Relationship of Required Courses to Curriculum Standards';

async function seed(level: 'associate' | 'bachelors' | 'masters' = 'bachelors') {
  const name = `MTX-${Math.random().toString(36).slice(2)}`;
  const inst = await Institution.create({
    name, type: 'university',
    address: { street: '1 St', city: 'C', state: 'ST', zip: '00000', country: 'US' },
    primaryContact: { name: 'C', email: `${name}@example.com`, title: 'Dir', phone: '555-0100' },
  } as any);
  const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
  const sub: any = await Submission.create({
    submissionId: `sub-${Math.random().toString(36).slice(2)}`,
    institutionId: inst._id, institutionName: inst.name,
    programName: 'Human Services', programLevel: level,
    submitterId: pc._id, type: 'initial', status: 'draft',
  } as any);
  const mk = (originalName: string, extra: any = {}) =>
    SupportingEvidence.create({
      institutionId: inst._id, submissionId: sub._id, uploadedBy: pc._id, evidenceType: 'document',
      file: { filename: originalName, originalName, mimeType: 'application/pdf', size: 10, s3Key: `k/${originalName}`, storageType: 's3', uploadedBy: pc._id },
      ...extra,
    });
  return { inst, pc, sub, token: signTokenFor(pc as any), mk };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('matrix endpoints and fields are gone', () => {
  it('NEGATIVE: every removed matrix route returns 404', async () => {
    const s = await seed();
    const id = String(s.sub._id);
    const imp = new mongoose.Types.ObjectId().toString();
    const calls: Array<[string, string]> = [
      ['get', `/api/submissions/${id}/matrix`],
      ['get', `/api/submissions/${id}/matrices`],
      ['get', `/api/submissions/${id}/matrix/abc`],
      ['post', `/api/submissions/${id}/matrix/abc/course`],
      ['put', `/api/submissions/${id}/matrix/abc/assessment`],
      ['get', `/api/submissions/${id}/matrix/abc/export`],
      ['post', `/api/submissions/${id}/matrix/abc/parse`],
      ['get', `/api/submissions/${id}/matrix-state`],
      ['post', `/api/submissions/${id}/matrix-state`],
      ['post', `/api/submissions/${id}/review/denoise-narratives`],
      ['get', `/api/program-courses/${id}/courses`],
      ['post', `/api/program-courses/${id}/courses`],
      ['post', `/api/imports/${imp}/matrix/infer-columns`],
      ['post', `/api/imports/${imp}/matrix/confirm-column`],
      ['post', `/api/imports/${imp}/matrix/infer-row-spec`],
    ];
    for (const [m, url] of calls) {
      const r = await (request(app) as any)[m](url).set(auth(s.token)).send({});
      expect(r.status, `${m.toUpperCase()} ${url}`).toBe(404);
    }
  });

  it('POSITIVE/NEGATIVE: GET review state works and carries no aiMatrixState', async () => {
    const s = await seed();
    await Submission.updateOne({ _id: s.sub._id }, { $set: { aiReviewState: { buckets: {}, approvedIds: [], discardedIds: [] } } });
    const r = await request(app).get(`/api/submissions/${s.sub._id}/review`).set(auth(s.token));
    expect(r.status).toBe(200);
    expect(r.body.aiReviewState).toBeTruthy();
    expect('aiMatrixState' in r.body).toBe(false);
  });

  it('NEGATIVE: set-approved writes no CurriculumMatrix and reports no matricesApplied', async () => {
    const s = await seed();
    // Legacy data carrying a matrix state must not be materialized anywhere.
    await mongoose.connection.collection('submissions').updateOne({ _id: s.sub._id }, {
      $set: {
        aiReviewState: { buckets: {}, approvedIds: [], discardedIds: [] },
        aiMatrixState: { matrices: [{ matrixId: 'm', name: 'Curriculum Matrix', htmlSnippet: '<table><tr><td>X</td></tr></table>', cells: [] }] },
      },
    });
    const r = await request(app).post(`/api/submissions/${s.sub._id}/review/set-approved`).set(auth(s.token)).send({ approvedIds: [] });
    expect(r.status).toBe(200);
    expect(r.body.matricesApplied).toBeUndefined();
    for (const c of ['curriculummatrixes', 'curriculummatrices']) {
      expect(await mongoose.connection.collection(c).countDocuments({ submissionId: s.sub._id })).toBe(0);
    }
  });

  it("NEGATIVE: importer documentKind 'matrix' is rejected with 400", async () => {
    const s = await seed();
    const r = await request(app).post('/api/imports/upload').set(auth(s.token))
      .field('submissionId', String(s.sub._id)).field('documentKind', 'matrix')
      .attach('file', Buffer.from('PK fake'), 'Self Study.docx');
    expect(r.status).toBe(400);
  });

  it('NEGATIVE: a matrix file dropped into the importer is kept in the File Library, not parsed', async () => {
    const s = await seed();
    const r = await request(app).post('/api/imports/upload').set(auth(s.token))
      .field('submissionId', String(s.sub._id))
      .attach('file', Buffer.from('PK fake'), 'Curriculum_Matrix_2025.docx');
    expect(r.status).toBe(201);
    expect(r.body.excluded).toBe(true);
    expect(r.body.importId).toBeUndefined();
    const ev: any = await SupportingEvidence.findById(r.body.evidenceId).lean();
    expect(ev.tags).toContain(CURRICULUM_MATRIX_EXCLUDED_TAG);
    expect(ev.standardCode).toBeFalsy();
  });
});

describe('a matrix document is excluded from the self-study', () => {
  it('NEGATIVE: on upload it is tagged and un-assigned (even when filed under 2.e); POSITIVE: an ordinary file keeps its Standard', async () => {
    const s = await seed();
    const mx = await s.mk('Appendix A6 - Curriculum Matrix.pdf', { standardCode: '2', specCode: 'e' });
    const byText = await s.mk('Appendix A6.pdf', { standardCode: '2', specCode: 'e', extractedText: `Program X\n${FORM_TITLE}\nHUS 101 ...` });
    const ok = await s.mk('Syllabus HUS 101.pdf', { standardCode: '2', specCode: 'e' });
    for (const e of [mx, byText]) {
      const got: any = await SupportingEvidence.findById(e._id).lean();
      expect(got.tags).toContain(CURRICULUM_MATRIX_EXCLUDED_TAG);
      expect(got.standardCode).toBeFalsy();
      expect(got.specCode).toBeFalsy();
    }
    const okGot: any = await SupportingEvidence.findById(ok._id).lean();
    expect(okGot.standardCode).toBe('2');
    expect(okGot.tags || []).not.toContain(CURRICULUM_MATRIX_EXCLUDED_TAG);
    // The PC cannot file it under a Standard by hand either.
    const r = await request(app).patch(`/api/submissions/${s.sub._id}/evidence/${mx._id}`).set(auth(s.token)).send({ standardCode: '2', specCode: 'e' });
    expect(r.status).toBe(400);
  });

  it('NEGATIVE: never indexed; POSITIVE: an ordinary file is indexed', async () => {
    const s = await seed();
    const spy = vi.spyOn(ai, 'extractEvidence').mockResolvedValue({ ready: true, data: { chunksUpserted: 3 } } as any);
    vi.spyOn(s3, 'isS3Configured').mockReturnValue(false);
    const mx = await s.mk('curriculum matrix.pdf', { extractedText: 'grid' });
    const ok = await s.mk('Advisory minutes.pdf', { extractedText: 'Advisory committee minutes' });
    expect(await indexEvidenceFile(String(s.inst._id), String(s.sub._id), mx.toObject())).toBe(0);
    expect(await indexEvidenceFile(String(s.inst._id), String(s.sub._id), ok.toObject())).toBe(3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ sourceFilename: 'Advisory minutes.pdf' });
    // Backfill: only the ordinary file is visited.
    spy.mockClear();
    const out = await indexAllForSubmission(String(s.inst._id), String(s.sub._id));
    expect(out.files).toBe(1);
    expect(spy.mock.calls.map((c: any) => c[0].sourceFilename)).toEqual(['Advisory minutes.pdf']);
  });

  it('NEGATIVE: never gathered as AI evaluation evidence; POSITIVE: ordinary evidence is', async () => {
    const s = await seed();
    await s.mk('Curriculum Matrix.pdf', { metadata: { description: 'MATRIX-BODY-SHOULD-NOT-APPEAR' } });
    await s.mk('Program map.pdf', { metadata: { description: `${FORM_TITLE} TEXT-MATRIX-SHOULD-NOT-APPEAR` } });
    await s.mk('Philosophy statement.pdf', { standardCode: '2', specCode: 'e', metadata: { description: 'ORDINARY-EVIDENCE-BODY' } });
    const spy = vi.spyOn(ai, 'evaluateSection').mockResolvedValue({
      perSpec: [{ standardCode: '2', specCode: 'e', verdict: 'pass', rationale: 'ok', criteriaCoverage: [], improvementSuggestions: [], sourcesUsed: {} }],
      links: [],
    } as any);
    await new ValidationService().validateSection({ submissionId: String(s.sub._id), standardCode: '2', specCode: 'e', narrativeText: '<p>Courses.</p>' });
    const req: any = spy.mock.calls[0][0];
    const joined = (req.supportingEvidenceText || []).join('\n');
    expect(joined).toContain('ORDINARY-EVIDENCE-BODY');
    expect(joined).not.toContain('SHOULD-NOT-APPEAR');
    expect(req.libraryFileNames).toContain('Philosophy statement.pdf');
    expect(req.libraryFileNames).not.toContain('Curriculum Matrix.pdf');
    // The 2.e rubric no longer mentions the matrix.
    expect(req.specs[0].criteria).toMatch(/Identify the required courses/);
    expect(req.specs[0].criteria).not.toMatch(/matri/i);
  });

  it('NEGATIVE: never AI-placed or auto-filed (incl. Use Recommended); POSITIVE: an ordinary file is', async () => {
    const s = await seed();
    const mx = await s.mk('Matrices 2025.pdf', { metadata: { description: 'grid' } });
    const ok = await s.mk('Budget.pdf', { metadata: { description: 'Program budget' } });
    const spy = vi.spyOn(ai, 'xrefPlacement').mockImplementation((async (req: any) => ({
      results: req.files.map((f: any) => ({ id: f.id, kind: 'evidence', std: '2', spec: 'e', confidence: 0.95, reason: 'x' })),
    })) as any);
    const r = await request(app).post(`/api/submissions/${s.sub._id}/evidence/ai-place-unassigned`).set(auth(s.token)).send({});
    expect(r.status).toBe(200);
    expect(spy.mock.calls[0][0].files.map((f: any) => f.name)).toEqual(['Budget.pdf']);
    // Legacy data: a matrix file that already carries an AI placement (written before the hook existed).
    await mongoose.connection.collection('supportingevidences').updateOne({ _id: mx._id }, {
      $set: { 'metadata.aiPlacement': { kind: 'evidence', standardCode: '2', specCode: 'e', confidence: 0.99 } },
      $pull: { tags: CURRICULUM_MATRIX_EXCLUDED_TAG } as any,
    });
    const acc = await request(app).post(`/api/submissions/${s.sub._id}/evidence/accept-ai-placements`).set(auth(s.token)).send({ all: true });
    expect(acc.status).toBe(200);
    expect(acc.body.accepted).toBe(1);
    expect(((await SupportingEvidence.findById(ok._id).lean()) as any).standardCode).toBe('2');
    expect(((await SupportingEvidence.findById(mx._id).lean()) as any).standardCode).toBeFalsy();
  });

  it('NEGATIVE: hidden from readers (list + download) but still listed to the PC; does not block submit', async () => {
    const s = await seed();
    const mx = await s.mk('Curriculum Matrix.pdf');
    await s.mk('Syllabus.pdf', { standardCode: '11', specCode: 'a' });
    const reader = (await createUser({ role: 'reader' })).user;
    await assignToSubmission(s.sub, reader, 'reader');
    const rt = signTokenFor(reader as any);
    const rl = await request(app).get(`/api/submissions/${s.sub._id}/evidence`).set(auth(rt));
    expect(rl.status).toBe(200);
    expect(rl.body.evidence.map((e: any) => e.file.originalName)).toEqual(['Syllabus.pdf']);
    const one = await request(app).get(`/api/submissions/${s.sub._id}/evidence/${mx._id}`).set(auth(rt));
    expect(one.status).toBe(404);
    const dl = await request(app).get(`/api/submissions/${s.sub._id}/evidence/${mx._id}/download`).set(auth(rt));
    expect(dl.status).toBe(404);
    const pl = await request(app).get(`/api/submissions/${s.sub._id}/evidence`).set(auth(s.token));
    expect(pl.body.evidence.map((e: any) => e.file.originalName).sort()).toEqual(['Curriculum Matrix.pdf', 'Syllabus.pdf']);
    const pre = await request(app).get(`/api/submissions/${s.sub._id}/preflight`).set(auth(s.token));
    expect(JSON.stringify(pre.body)).not.toMatch(/UNASSIGNED_FILES|Curriculum Matrix\.pdf/);
  });

  it('NEGATIVE: the Lead Reader Report course list ignores the matrix file; POSITIVE: syllabi still feed it', async () => {
    const s = await seed();
    await s.mk('HUS 101 Syllabus.pdf', { standardCode: '11', specCode: 'a' });
    await s.mk('Curriculum Matrix ENG 999.pdf');
    const lead = (await createUser({ role: 'lead_reader' })).user;
    await assignToSubmission(s.sub, lead, 'lead_reader');
    const r = await request(app).get(`/api/submissions/${s.sub._id}/lead-reader-report`).set(auth(signTokenFor(lead as any)));
    expect(r.status).toBe(200);
    const all = [...r.body.system.generalEducationCourses, ...r.body.system.programCourses].join(' ');
    expect(all).toContain('HUS 101');
    expect(all).not.toContain('ENG 999');
  });

  it('NEGATIVE: a bulk-dropped matrix (even in a "Standard 2" folder) is not routed, indexed or put on the rail; POSITIVE: a sibling file is', async () => {
    const s = await seed();
    vi.spyOn(s3, 'isS3Configured').mockReturnValue(true);
    vi.spyOn(s3, 'uploadFile').mockImplementation((async () => ({ bucket: 'b', key: 'k' })) as any);
    vi.spyOn(s3, 'generateS3Key').mockImplementation(((a: string, b: string, c: string) => `${a}/${b}/${c}`) as any);
    vi.spyOn(ai, 'extractFileText').mockImplementation((async (r: any) => ({
      text: /A6/.test(r.filename) ? `${FORM_TITLE}\nHUS 101 X X` : 'Philosophy of the program',
    })) as any);
    vi.spyOn(ai, 'recommendPlacement').mockImplementation((async () => ({ std: '2', spec: 'e', confidence: 0.4 })) as any);
    const idx = vi.spyOn(ai, 'extractEvidence').mockResolvedValue({ ready: true, data: { chunksUpserted: 1 } } as any);
    const r = await request(app).post(`/api/submissions/${s.sub._id}/review/bulk-evidence`).set(auth(s.token))
      .field('paths', JSON.stringify(['Evidence/Standard 2/Appendix A6.pdf', 'Evidence/Standard 2/Philosophy 2.e.pdf']))
      .attach('files', Buffer.from('%PDF a'), 'Appendix A6.pdf')
      .attach('files', Buffer.from('%PDF b'), 'Philosophy 2.e.pdf');
    expect(r.status).toBe(200);
    const mx = r.body.added.find((a: any) => a.fileName === 'Appendix A6.pdf');
    expect(mx.excludedCurriculumMatrix).toBe(true);
    expect(mx.placedStd).toBeNull();
    const evs: any[] = await SupportingEvidence.find({ submissionId: s.sub._id }).lean();
    const mxEv = evs.find((e) => e.file.originalName === 'Appendix A6.pdf');
    const okEv = evs.find((e) => e.file.originalName === 'Philosophy 2.e.pdf');
    expect(mxEv.standardCode).toBeFalsy();
    expect(mxEv.tags).toContain(CURRICULUM_MATRIX_EXCLUDED_TAG);
    expect(okEv.standardCode).toBe('2');
    const sub: any = await Submission.findById(s.sub._id).lean();
    expect((sub.aiReviewState?.evidenceDocs || []).map((d: any) => d.fileName)).toEqual(['Philosophy 2.e.pdf']);
    await new Promise((res) => setTimeout(res, 50));
    expect(idx.mock.calls.map((c: any) => c[0].sourceFilename)).not.toContain('Appendix A6.pdf');
  });
});

describe('filled Reader Report Word form has no matrix and no conditional accreditation', () => {
  const binary = (r: any) => r.buffer(true).parse((res: any, cb: any) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  for (const level of ['associate', 'bachelors', 'masters'] as const) {
    it(`${level}: tokens filled (POSITIVE), no "atrix" / "Conditional accreditation" (NEGATIVE)`, async () => {
      const s = await seed(level);
      await Submission.updateOne({ _id: s.sub._id }, { $set: { status: 'submitted' } });
      const reader = (await createUser({ role: 'reader', firstName: 'Ria', lastName: 'Reader' })).user;
      await assignToSubmission(s.sub, reader, 'reader');
      await ReaderReport.create({
        submissionId: s.sub._id, reviewerId: reader._id, acceptanceVote: 'accept',
        rows: [{ standardCode: '2', specCode: 'e', mark: 'compliant', comment: 'REQUIRED-COURSES-OK' }],
      } as any);
      const res = await binary(request(app)
        .get(`/api/reports/submission/${s.sub._id}/reader-report/download?format=docx`)
        .set(auth(signTokenFor(reader as any))));
      expect(res.status).toBe(200);
      const xml = await (await JSZip.loadAsync(res.body)).file('word/document.xml')!.async('string');
      const text = (xml.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('');
      expect(text).toContain('Identify the required courses');
      expect(text).toContain('REQUIRED-COURSES-OK');
      expect(text).not.toMatch(/\{\{[a-z0-9_]+\}\}/);
      expect(text).not.toMatch(/atrix/i);
      expect(text).not.toContain('Conditional accreditation');
    });
  }
});

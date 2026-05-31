/**
 * CR-011 / Sprint 5.2 — suggestions consolidation DOCX.
 *
 * GET /api/submissions/:id/compilation/suggestions-doc?mode=internal|pc_facing
 *
 *   - lead_reader / admin / superuser → 200 with a real .docx buffer
 *   - PC / reader → 403
 *   - mode=internal exposes reader names + raw content + override notes
 *   - mode=pc_facing strips identity (only relayed comments survive, with
 *     pcLabel attribution + relayedText body); reader override notes are
 *     suppressed entirely
 *   - 404 for unknown submission
 *
 * Redaction is verified by unzipping the .docx (it's a Zip-of-XML) and
 * grepping word/document.xml for identity strings.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import JSZip from 'jszip';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Comment } from '../../src/models/Comment';
import { ValidationResult } from '../../src/models/ValidationResult';
import { Score } from '../../src/models/Score';
import { createUser, signTokenFor } from '../helpers/factories';

async function readDocxBodyText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('document.xml missing from docx');
  return doc.async('string');
}

afterEach(() => vi.restoreAllMocks());

async function seed() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const { user: r1 } = await createUser({ role: 'reader', firstName: 'Jane', lastName: 'Reader' });
  const { user: r2 } = await createUser({ role: 'reader', firstName: 'Bob', lastName: 'Reviewer' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  const sub: any = await Submission.create({
    submissionId: `SUG-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Suggestions U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'review_complete'
  });

  // Reader 1 leaves an UNRELAYED comment on 1.a (PC must never see).
  await Comment.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'a',
    selectedText: 'governance',
    selectionStart: 0,
    selectionEnd: 5,
    authorId: r1._id,
    authorName: 'Jane Reader',
    authorRole: 'reader',
    content: 'The governance structure is unclear — please expand the org chart.',
    relayed: false,
    boardEscalated: false
  });

  // Reader 2 leaves a RELAYED comment on 1.b with sanitized text + pcLabel.
  await Comment.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'b',
    selectedText: 'syllabus',
    selectionStart: 0,
    selectionEnd: 8,
    authorId: r2._id,
    authorName: 'Bob Reviewer',
    authorRole: 'reader',
    content: 'CONFIDENTIAL identity-bearing version: I recall Bob from State U.',
    relayed: true,
    relayedText: 'Please add the 2023 syllabus revision history.',
    pcLabel: 'Reader A',
    originalReaderId: r2._id,
    boardEscalated: false
  });

  // Reader-overridden ValidationResult on 1.a with a note.
  await ValidationResult.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'a',
    validationType: 'submit',
    validatedAt: new Date(),
    attemptNumber: 1,
    result: {
      status: 'needs_improvement',
      verdict: 'needs_improvement',
      readerOverridden: true,
      readerOverrideNote: 'Reader override: needs more detail in §3.',
      rationale: 'The narrative is short and skips org-chart detail.',
      suggestions: ['Expand the org-chart section with named roles.'],
      criteriaCoverage: [
        { criterion: 'Org structure', met: false, note: 'No named roles.' },
        { criterion: 'Mission', met: true }
      ]
    }
  });

  return {
    sid: String(sub._id),
    lead: signTokenFor(lead as any),
    admin: signTokenFor(admin as any),
    reader: signTokenFor(r1 as any),
    pc: signTokenFor(pc as any)
  };
}

describe('CR-011 — suggestions DOCX (internal mode)', () => {
  it('lead_reader gets a .docx buffer including reader names, raw content, override notes, and AI suggestions', async () => {
    const { sid, lead } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc?mode=internal`)
      .set('Authorization', `Bearer ${lead}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/wordprocessingml/);
    expect(res.headers['x-suggestions-mode']).toBe('internal');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    // .docx is a zip — magic bytes "PK".
    expect(res.body.slice(0, 2).toString()).toBe('PK');

    const text = await readDocxBodyText(res.body);
    // Internal mode shows reader names.
    expect(text).toContain('Jane Reader');
    expect(text).toContain('Bob Reviewer');
    // Reader-2's original content surfaces in internal mode.
    expect(text).toContain('CONFIDENTIAL');
    // Reader override note shows up.
    expect(text).toContain('needs more detail');
    // AI suggestion surfaces.
    expect(text).toContain('Expand the org-chart');
  });
});

describe('CR-011 — suggestions DOCX (PC-facing mode)', () => {
  it('strips reader identity + drops unrelayed + suppresses override notes', async () => {
    const { sid, lead } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc?mode=pc_facing`)
      .set('Authorization', `Bearer ${lead}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['x-suggestions-mode']).toBe('pc_facing');

    const text = await readDocxBodyText(res.body);
    // pc_facing: no reader names anywhere.
    expect(text).not.toContain('Jane Reader');
    expect(text).not.toContain('Bob Reviewer');
    // The CONFIDENTIAL raw content must not leak in pc_facing mode.
    expect(text).not.toContain('CONFIDENTIAL');
    // The unrelayed governance comment (Jane) must be dropped entirely.
    expect(text).not.toContain('governance structure is unclear');
    // The relayed comment surfaces with its sanitized text + pcLabel.
    expect(text).toContain('Reader A');
    expect(text).toContain('2023 syllabus revision history');
    // Reader override notes must NOT appear in pc_facing mode.
    expect(text).not.toContain('needs more detail');
    // AI suggestion is generic enough to survive pc_facing.
    expect(text).toContain('Expand the org-chart');
  });
});

describe('CR-011 / S11.4 — CSHSE-branded header / footer / logo', () => {
  async function zipOf(buffer: Buffer) {
    return JSZip.loadAsync(buffer);
  }

  it('embeds a header with the CSHSE org name, a page-numbered footer, and the logo image', async () => {
    const { sid, lead } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc?mode=internal`)
      .set('Authorization', `Bearer ${lead}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    const zip = await zipOf(res.body);
    const names = Object.keys(zip.files);

    // A header part exists and carries the CSHSE organization name.
    const headerName = names.find((n) => /word\/header\d+\.xml$/.test(n));
    expect(headerName).toBeTruthy();
    const headerXml = await zip.file(headerName as string)!.async('string');
    expect(headerXml).toContain('Council for Standards in Human Service Education');

    // A footer part exists, carries the confidentiality line + page-number fields.
    const footerName = names.find((n) => /word\/footer\d+\.xml$/.test(n));
    expect(footerName).toBeTruthy();
    const footerXml = await zip.file(footerName as string)!.async('string');
    expect(footerXml).toContain('Confidential accreditation document');
    // Word page-number fields are emitted as <w:fldChar>/PAGE instructions.
    expect(footerXml).toMatch(/PAGE|fldChar/);

    // The logo image is embedded under word/media/.
    const media = names.filter((n) => /word\/media\/.+\.(png|jpe?g)$/i.test(n));
    expect(media.length).toBeGreaterThan(0);
  });

  it('brands the site-visit checklist DOCX the same way', async () => {
    // Drive the checklist generator directly (its own endpoint lives
    // elsewhere; the branding is what we assert here).
    const { generateChecklistDocx } = await import('../../src/services/siteVisitChecklistDocx');
    const { sid } = await seed();
    const buffer = await generateChecklistDocx(sid);
    const zip = await zipOf(buffer);
    const names = Object.keys(zip.files);

    const headerName = names.find((n) => /word\/header\d+\.xml$/.test(n));
    expect(headerName).toBeTruthy();
    const headerXml = await zip.file(headerName as string)!.async('string');
    expect(headerXml).toContain('Council for Standards in Human Service Education');

    const media = names.filter((n) => /word\/media\/.+\.(png|jpe?g)$/i.test(n));
    expect(media.length).toBeGreaterThan(0);
  });

  it('the CSHSE logo asset is bundled (hasBrandLogo)', async () => {
    const { hasBrandLogo } = await import('../../src/services/docxBranding');
    expect(hasBrandLogo()).toBe(true);
  });
});

describe('CR-003 / S11.1 — 0-3 reader scores in the suggestions DOCX', () => {
  async function seedWithScores() {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: r1 } = await createUser({ role: 'reader', firstName: 'Carol', lastName: 'Scorer' });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub: any = await Submission.create({
      submissionId: `SUGSC-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      institutionName: 'Score U',
      programName: 'HS',
      programLevel: 'bachelors',
      submitterId: pc._id,
      type: 'initial',
      status: 'review_complete'
    });
    // A spec with ONLY a score (no comment) — must still surface.
    await Score.create({
      submissionId: sub._id,
      standardCode: '2',
      specCode: 'c',
      reviewerId: r1._id,
      reviewerName: 'Carol Scorer',
      reviewerRole: 'reader',
      score: 1 // Partial
    });
    return { sid: String(sub._id), lead: signTokenFor(lead as any) };
  }

  it('internal mode shows the rubric label + reviewer name for a score-only spec', async () => {
    const { sid, lead } = await seedWithScores();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc?mode=internal`)
      .set('Authorization', `Bearer ${lead}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });
    expect(res.status).toBe(200);
    const text = await readDocxBodyText(res.body);
    expect(text).toContain('Compliance score (0-3)');
    expect(text).toContain('Partial (1)');
    expect(text).toContain('Carol Scorer');
    // The score-only spec heading is present.
    expect(text).toContain('Standard 2.c');
  });

  it('pc_facing mode keeps the score but redacts the reviewer name', async () => {
    const { sid, lead } = await seedWithScores();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc?mode=pc_facing`)
      .set('Authorization', `Bearer ${lead}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });
    expect(res.status).toBe(200);
    const text = await readDocxBodyText(res.body);
    expect(text).toContain('Partial (1)');
    expect(text).toContain('Reader 1');
    expect(text).not.toContain('Carol Scorer');
  });
});

describe('CR-011 — suggestions DOCX role gates', () => {
  it('rejects a PC (403)', async () => {
    const { sid, pc } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc`)
      .set('Authorization', `Bearer ${pc}`);
    expect(res.status).toBe(403);
  });

  it('rejects a reader (403)', async () => {
    const { sid, reader } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc`)
      .set('Authorization', `Bearer ${reader}`);
    expect(res.status).toBe(403);
  });

  it('admin can export', async () => {
    const { sid, admin } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc?mode=internal`)
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
  });

  it('404 for an unknown submission', async () => {
    const { lead } = await seed();
    const bogus = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/submissions/${bogus}/compilation/suggestions-doc`)
      .set('Authorization', `Bearer ${lead}`);
    expect(res.status).toBe(404);
  });

  it('unknown mode falls back to internal', async () => {
    const { sid, lead } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation/suggestions-doc?mode=bogus`)
      .set('Authorization', `Bearer ${lead}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-suggestions-mode']).toBe('internal');
  });
});

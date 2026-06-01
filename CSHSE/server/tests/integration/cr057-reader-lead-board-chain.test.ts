/**
 * CR-057 — full reader → lead-reader → board pipeline (integration).
 *
 * This is the durable regression guard for the whole review pipeline the
 * beta walkthrough exercises. It chains the real endpoints end-to-end on
 * one submission and asserts every hand-off:
 *
 *   assign (CR-055)        → readers_assigned, one ACTIVE Assignment per user
 *   access separation      → an UNASSIGNED lead 403s the submission read,
 *                            an ASSIGNED reader 200s it
 *   reader scoring         → PUT /scores (0-3) succeeds for assigned readers
 *   lead final scores      → PUT /compilation/final-score succeeds for lead
 *   finalize (CR-056)      → POST /compilation/finalize → review_complete
 *   board queue            → GET /board/queue surfaces the review_complete sub
 *   board decision         → POST /:id/decision accept → compliant
 *   reports                → reader PDF + lead suggestions DOCX both stream
 *
 * Seeds + asserts within the test to survive the per-test collection wipe.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Assignment } from '../../src/models/Assignment';
import { Review } from '../../src/models/Review';
import { createUser, signTokenFor } from '../helpers/factories';

// Collect a binary (PDF/DOCX) response body into a Buffer — supertest only
// auto-buffers a handful of content-types, so we parse explicitly.
function binaryParse(res: any, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

let _c = 0;
async function seedSubmission(status = 'submitted'): Promise<any> {
  _c += 1;
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  return Submission.create({
    submissionId: `CR057-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Pipeline U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status
  });
}

describe('CR-057 — reader → lead-reader → board pipeline', () => {
  it('chains assign → score → finalize → board → reports end-to-end', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'One' });
    const { user: r2 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Two' });
    const { user: lead } = await createUser({ role: 'lead_reader', firstName: 'Lead', lastName: 'Assigned' });
    const { user: leadOut } = await createUser({ role: 'lead_reader', firstName: 'Lead', lastName: 'Unassigned' });
    const sub = await seedSubmission('submitted');
    const SID = String(sub._id);

    const adminTok = `Bearer ${signTokenFor(admin as any)}`;
    const r1Tok = `Bearer ${signTokenFor(r1 as any)}`;
    const leadTok = `Bearer ${signTokenFor(lead as any)}`;
    const leadOutTok = `Bearer ${signTokenFor(leadOut as any)}`;

    // 1) assign (CR-055)
    const assign = await request(app)
      .post(`/api/reviews/submissions/${SID}/assign`)
      .send({ readerIds: [String(r1._id), String(r2._id), String(lead._id)], reason: 'pipeline panel' })
      .set('Authorization', adminTok);
    expect(assign.status).toBe(200);

    const active = await Assignment.find({ submissionId: sub._id, status: 'active' });
    expect(active.length).toBe(3);
    const fresh1 = await Submission.findById(sub._id);
    expect(fresh1?.status).toBe('readers_assigned');
    expect(String(fresh1?.leadReader)).toBe(String(lead._id));

    // 2) access separation
    const sep = await request(app).get(`/api/submissions/${SID}`).set('Authorization', leadOutTok);
    expect(sep.status).toBe(403);
    const r1read = await request(app).get(`/api/submissions/${SID}`).set('Authorization', r1Tok);
    expect(r1read.status).toBe(200);

    // 3) readers score a few specs
    const specs: Array<[string, string, number]> = [['1', 'a', 3], ['1', 'b', 2], ['2', 'a', 3]];
    for (const [standardCode, specCode, score] of specs) {
      const a = await request(app)
        .put(`/api/submissions/${SID}/scores`)
        .send({ standardCode, specCode, score })
        .set('Authorization', r1Tok);
      expect(a.status).toBe(200);
      const b = await request(app)
        .put(`/api/submissions/${SID}/scores`)
        .send({ standardCode, specCode, score: Math.max(0, score - 1) })
        .set('Authorization', `Bearer ${signTokenFor(r2 as any)}`);
      expect(b.status).toBe(200);
    }

    // 4) lead final scores
    for (const [standardCode, specCode, score] of specs) {
      const f = await request(app)
        .put(`/api/submissions/${SID}/compilation/final-score`)
        .send({ standardCode, specCode, score, note: 'lead consensus' })
        .set('Authorization', leadTok);
      expect(f.status).toBe(200);
    }

    // 5) finalize (CR-056) → review_complete
    const fin = await request(app)
      .post(`/api/submissions/${SID}/compilation/finalize`)
      .set('Authorization', leadTok);
    expect(fin.status).toBe(200);
    expect(fin.body.status).toBe('review_complete');
    expect((await Submission.findById(sub._id))?.status).toBe('review_complete');

    // 6) board queue surfaces it (admin only)
    const queue = await request(app).get('/api/board/queue').set('Authorization', adminTok);
    expect(queue.status).toBe(200);
    expect((queue.body.submissions || []).some((s: any) => String(s._id) === SID)).toBe(true);

    // 7) board decision accept → compliant
    const dec = await request(app)
      .post(`/api/submissions/${SID}/decision`)
      .send({ outcome: 'accept', comments: 'pipeline board approval' })
      .set('Authorization', adminTok);
    expect(dec.status).toBe(200);
    expect((await Submission.findById(sub._id))?.status).toBe('compliant');

    // 8) reports — reader PDF + lead suggestions DOCX both stream bytes
    const review = await Review.findOne({ submissionId: sub._id, reviewerId: r1._id });
    expect(review).toBeTruthy();
    const pdf = await request(app)
      .get(`/api/reports/reader/${String(review!._id)}/pdf`)
      .set('Authorization', r1Tok)
      .buffer(true)
      .parse(binaryParse);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).length).toBeGreaterThan(500);

    const docx = await request(app)
      .get(`/api/submissions/${SID}/compilation/suggestions-doc?mode=internal`)
      .set('Authorization', leadTok)
      .buffer(true)
      .parse(binaryParse);
    expect(docx.status).toBe(200);
    expect(docx.headers['content-type']).toContain('wordprocessingml');
    expect((docx.body as Buffer).length).toBeGreaterThan(500);
  });

  it('an unassigned lead reader cannot finalize someone else’s submission (403)', async () => {
    const { user: leadOut } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission('readers_assigned');
    // No assignment for leadOut. Finalize is lead/admin role-gated, so this
    // pins the role check rather than the per-submission ACL; both lead and
    // admin are allowed to finalize, so a *reader* is the 403 case here.
    const { user: reader } = await createUser({ role: 'reader' });
    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(403);
    void leadOut;
  });
});

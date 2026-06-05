/**
 * Approve auto-applies to the editor — idempotently.
 *
 * "Apply to editor" was removed; Approve / Approve-all now materialize the
 * approved text into Submission.narratives via set-approved. The critical
 * safety property is IDEMPOTENCY: re-approving must not duplicate content.
 * Pins:
 *   1. Approving a narrative writes it into submission.narratives[std][spec].
 *   2. Re-running set-approved with the same set does NOT duplicate it.
 *   3. Multiple approved narratives in one spec are concatenated.
 *   4. Approving an evidence file materializes ONE SupportingEvidence (deduped).
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { Institution } from '../../src/models/Institution';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seed(ownerId: any) {
  _c += 1;
  const inst = await Institution.create({
    name: `AA Inst ${Date.now().toString(36)}-${_c}`,
    type: 'university',
    address: { street: '1', city: 'X', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'A', email: 'a@x.test', phone: '555-0000' },
  } as any);
  return (await Submission.create({
    submissionId: `AAP-${Date.now().toString(36)}-${_c}`,
    institutionName: inst.name,
    institutionId: inst._id,
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: ownerId,
    type: 'initial',
    status: 'in_progress',
    aiReviewState: {
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
          narratives: [
            { sectionId: 'n1', heading: 'h1', snippet: 'FIRST narrative.', htmlSnippet: '<p>FIRST narrative.</p>', wordCount: 2, confidence: 0.9, acceptState: 'pending', rationale: '' },
            { sectionId: 'n2', heading: 'h2', snippet: 'SECOND narrative.', htmlSnippet: '<p>SECOND narrative.</p>', wordCount: 2, confidence: 0.9, acceptState: 'pending', rationale: '' },
          ],
          evidenceText: [],
          evidenceFiles: [
            { sectionId: 'f1', heading: 'Evidence File One', snippet: 'file body', wordCount: 2, confidence: 0.9, acceptState: 'pending', rationale: '' },
          ],
          matrixCells: [],
        },
      },
      tags: [], cvs: [], evidenceDocs: [], introductions: {},
      placeholderSections: [], approvedIds: [], discardedIds: [],
      itemSources: {}, mergeLog: [], lastUpdatedAt: new Date(),
    },
  })) as any;
}

function specContent(sub: any, std: string, spec: string): string {
  const stdMap = sub.narratives?.get?.(std);
  const entry = stdMap?.get?.(spec);
  return entry?.content ?? '';
}

describe('Approve → auto-apply (idempotent)', () => {
  it('writes approved narratives into the editor and does NOT duplicate on re-approve', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const token = signTokenFor(pc as any);

    // Approve n1.
    await request(app)
      .post(`/api/submissions/${sub._id}/review/set-approved`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedIds: ['n1'] })
      .expect(200);

    let fresh: any = await Submission.findById(sub._id);
    expect(specContent(fresh, '1', 'a')).toContain('FIRST narrative.');
    const occurrences = (s: string, sub: string) => s.split(sub).length - 1;
    expect(occurrences(specContent(fresh, '1', 'a'), 'FIRST narrative.')).toBe(1);

    // Re-approve the SAME set twice more — content must NOT duplicate.
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post(`/api/submissions/${sub._id}/review/set-approved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ approvedIds: ['n1'] })
        .expect(200);
    }
    fresh = await Submission.findById(sub._id);
    expect(occurrences(specContent(fresh, '1', 'a'), 'FIRST narrative.')).toBe(1);

    // Approve n2 as well → both concatenated, still once each.
    await request(app)
      .post(`/api/submissions/${sub._id}/review/set-approved`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedIds: ['n1', 'n2'] })
      .expect(200);
    fresh = await Submission.findById(sub._id);
    const c = specContent(fresh, '1', 'a');
    expect(occurrences(c, 'FIRST narrative.')).toBe(1);
    expect(occurrences(c, 'SECOND narrative.')).toBe(1);
  });

  it('approving an evidence file materializes exactly one SupportingEvidence (deduped on re-run)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const token = signTokenFor(pc as any);

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/submissions/${sub._id}/review/set-approved`)
        .set('Authorization', `Bearer ${token}`)
        .send({ approvedIds: ['f1'] })
        .expect(200);
    }
    const count = await SupportingEvidence.countDocuments({
      submissionId: sub._id,
      tags: 'rev:f1',
      isDeleted: false,
    });
    expect(count).toBe(1);
  });
});

/**
 * E2E — PC lockout enforcement + lead-reader send-back round-trip.
 *
 * Two real-world scenarios, exercised through the live Express app + Mongo
 * (the project's server-level E2E):
 *
 *   SCENARIO A — "the PC is locked out of editing the system."
 *     A submission under reader review is read-only to its PC. The PC must
 *     NOT be able to:
 *       - approve a card in the Review section  (POST review/approve)
 *       - save an edit in the final editor      (PATCH narrative)
 *       - save the introduction                 (PATCH introduction)
 *     Every attempt must 403 LOCKED *and leave the data unchanged*. A
 *     "failure" here is the server SAVING the data / approving the card.
 *
 *   SCENARIO B — "the lead reader unlocks it so the PC can add more items."
 *     Readers deem the self-study incomplete and have questions. The lead
 *     reader sends it back for correction. The PC must then be able to add
 *     items again (save narrative, approve cards) — even though the
 *     submission's status is still `under_review`. Once the PC re-submits
 *     the corrections (clear-sent-back), the lock re-engages.
 *
 * Scenario B pins the bug fixed alongside this test: `sendBackForCorrection`
 * only clears `readerLock.isLocked`; it does NOT revert `status`. The lockout
 * middleware independently locks on `status` alone, so before the fix the PC
 * stayed locked out after a send-back. The fix gives the middleware (and the
 * client editor) a `sent_back_for_correction` carve-out, matching the
 * already-correct getLockStatus / clearSentBack design.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
function reviewState(overrides: any = {}) {
  return {
    buckets: {
      '1.a': {
        standardCode: '1',
        specCode: 'a',
        standardTitle: '',
        specPrompt: '',
        narratives: [
          { sectionId: 'sec-1', heading: 'h', snippet: 'a new item', wordCount: 3, confidence: 0.9, sourceImportId: 'imp-A', sourceFilename: 'f.docx' },
        ],
        evidenceText: [],
        evidenceFiles: [],
        matrixCells: [],
      },
    },
    tags: [],
    cvs: [],
    evidenceDocs: [],
    introductions: {},
    placeholderSections: [],
    approvedIds: [],
    discardedIds: [],
    itemSources: { 'sec-1': { importId: 'imp-A', sourceFilename: 'f.docx', sourceContentHash: 'h', importedAt: new Date() } },
    mergeLog: [],
    lastUpdatedAt: new Date(),
    ...overrides,
  };
}

async function seedSubmission(overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `LSB-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Lock/SendBack U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'under_review',
    submittedAt: overrides.submittedAt ?? new Date(),
    assignedReaders: overrides.assignedReaders ?? [],
    leadReader: overrides.leadReader,
    readerLock: overrides.readerLock,
    aiReviewState: overrides.aiReviewState,
  })) as any;
}

// --- SCENARIO A — the lockout holds --------------------------------------

describe('E2E A — a reader-locked submission is read-only to its PC', () => {
  it('does NOT approve a Review card (403 LOCKED, approvedIds unchanged)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({
      submitterId: pc._id,
      status: 'under_review',
      assignedReaders: [reader._id],
      readerLock: { isLocked: true, lockedBy: reader._id, lockedByName: 'Reader', lockedByRole: 'reader', lockedAt: new Date(), lockReason: 'reader_review' },
      aiReviewState: reviewState(),
    });

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sectionId: 'sec-1', approved: true });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCKED');

    // The card was NOT approved — data is untouched.
    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.aiReviewState.approvedIds).toEqual([]);
  });

  it('does NOT save a final-editor narrative edit (403 LOCKED, narrative unchanged)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({
      submitterId: pc._id,
      status: 'under_review',
      assignedReaders: [reader._id],
      readerLock: { isLocked: true, lockedBy: reader._id, lockedByName: 'Reader', lockedByRole: 'reader', lockedAt: new Date(), lockReason: 'reader_review' },
    });

    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>sneaky edit</p>' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCKED');

    const fresh: any = await Submission.findById(sub._id);
    const narr = fresh.narratives?.['1']?.['a'] ?? fresh.narratives?.get?.('1');
    // Whatever the shape, the sneaky content must not be present.
    expect(JSON.stringify(fresh.narratives ?? {})).not.toContain('sneaky edit');
    void narr;
  });

  it('does NOT save the introduction (403 LOCKED)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: pc._id,
      status: 'under_review',
      readerLock: { isLocked: true, lockedByName: 'Reader', lockedByRole: 'reader', lockedAt: new Date(), lockReason: 'reader_review' },
    });

    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/introduction`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ key: 'program', content: '<p>intro edit</p>' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCKED');
  });
});

// --- SCENARIO B — lead-reader send-back re-opens editing -----------------

describe('E2E B — lead reader sends back → PC can add items again', () => {
  it('full round-trip: lock → send-back → PC edits → clear → re-locked', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission({
      submitterId: pc._id,
      status: 'under_review',
      leadReader: lead._id,
      assignedReaders: [lead._id],
      readerLock: { isLocked: true, lockedBy: lead._id, lockedByName: 'Lead', lockedByRole: 'lead_reader', lockedAt: new Date(), lockReason: 'lead_reader_review' },
      aiReviewState: reviewState(),
    });

    // While locked, the PC is read-only.
    const blocked = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>blocked</p>' });
    expect(blocked.status).toBe(403);

    // The lead reader sends it back: "not complete — we have questions."
    const sendBack = await request(app)
      .post(`/api/submissions/${sub._id}/send-back`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`)
      .send({ reason: 'Standard 1 narrative is incomplete — please add the missing items.' });
    expect(sendBack.status).toBe(200);
    expect(sendBack.body.readerLock.isLocked).toBe(false);
    expect(sendBack.body.readerLock.lockReason).toBe('sent_back_for_correction');

    // The PC can now ADD items — save a narrative...
    const edit = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>the additional item the readers asked for</p>' });
    expect(edit.status).not.toBe(403);
    expect(edit.status).toBeLessThan(300);

    // ...and approve a Review card.
    const approve = await request(app)
      .post(`/api/submissions/${sub._id}/review/approve`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sectionId: 'sec-1', approved: true });
    expect(approve.status).not.toBe(403);
    expect(approve.status).toBeLessThan(300);

    const afterEdit: any = await Submission.findById(sub._id);
    expect(afterEdit.aiReviewState.approvedIds).toContain('sec-1');

    // The PC re-submits the corrections → clear-sent-back.
    const clear = await request(app)
      .post(`/api/submissions/${sub._id}/clear-sent-back`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({});
    expect(clear.status).toBe(200);

    // The lock re-engages (status is still under_review, no sent-back flag).
    const reLocked = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>after clear</p>' });
    expect(reLocked.status).toBe(403);
    expect(reLocked.body.error).toBe('LOCKED');
  });

  it('a plain reader (not just lead) can also send back, re-opening PC edits', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({
      submitterId: pc._id,
      status: 'under_review',
      assignedReaders: [reader._id],
      readerLock: { isLocked: true, lockedBy: reader._id, lockedByName: 'Reader', lockedByRole: 'reader', lockedAt: new Date(), lockReason: 'reader_review' },
    });

    await request(app)
      .post(`/api/submissions/${sub._id}/send-back`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`)
      .send({ reason: 'Questions about Standard 2.' })
      .expect(200);

    const edit = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '2', specCode: 'a', content: '<p>more detail</p>' });
    expect(edit.status).not.toBe(403);
    expect(edit.status).toBeLessThan(300);
  });
});

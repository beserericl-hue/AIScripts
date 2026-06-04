/**
 * POST /api/submissions/:id/review/split-item — move part of a card into
 * another subspec.
 *
 * The parser sometimes dumps a whole Standard into its first subspec. This
 * endpoint trims the source item to the remainder and creates a new item (the
 * moved selection) in the target spec bucket. Pins:
 *   1. Source item content shrinks to the remainder.
 *   2. A new item appears in the target bucket with the moved HTML.
 *   3. Target bucket is created if it didn't exist.
 *   4. Survives a GET /review reload.
 *   5. Validates input; owner-only.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedWithCard(pcId: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `SPL-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Split U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: pcId,
    type: 'initial',
    status: 'in_progress',
    aiReviewState: {
      buckets: {
        '2.a': {
          standardCode: '2',
          specCode: 'a',
          standardTitle: '',
          specPrompt: '',
          narratives: [
            {
              sectionId: 'sec-2a-1',
              heading: 'Everything for Standard 2',
              snippet: 'Keep this part. Move this part.',
              htmlSnippet: '<p>Keep this part.</p><p>Move this part.</p>',
              wordCount: 6,
              confidence: 0.9,
              acceptState: 'pending',
              rationale: '',
            },
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
      itemSources: { 'sec-2a-1': { importId: 'imp-1', sourceFilename: 'ss.docx' } },
      mergeLog: [],
      lastUpdatedAt: new Date(),
    },
  })) as any;
}

describe('POST /review/split-item — move text to another subspec', () => {
  it('trims the source and creates the moved item in the target bucket; survives reload', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedWithCard(pc._id);

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/split-item`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({
        sourceSectionId: 'sec-2a-1',
        kind: 'narratives',
        remainderHtml: '<p>Keep this part.</p>',
        movedHtml: '<p>Move this part.</p>',
        targetStd: '2',
        targetSpec: 'b',
        newSectionId: 'sec-2a-1::split-1',
        heading: 'Moved to 2.b',
      });
    expect(res.status).toBe(200);
    expect(res.body.targetKey).toBe('2.b');

    const fresh: any = await Submission.findById(sub._id);
    const state = fresh.aiReviewState;
    // Source trimmed.
    const src = state.buckets['2.a'].narratives.find((i: any) => i.sectionId === 'sec-2a-1');
    expect(src.htmlSnippet).toBe('<p>Keep this part.</p>');
    expect(src.snippet).toBe('Keep this part.');
    // Target bucket created + moved item present.
    const moved = state.buckets['2.b'].narratives.find(
      (i: any) => i.sectionId === 'sec-2a-1::split-1'
    );
    expect(moved).toBeTruthy();
    expect(moved.htmlSnippet).toBe('<p>Move this part.</p>');
    expect(moved.snippet).toBe('Move this part.');
    // Provenance carried.
    expect(state.itemSources['sec-2a-1::split-1']).toBeTruthy();

    // Survives a reload.
    const reload = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    const movedAfter = reload.body.aiReviewState.buckets['2.b'].narratives.find(
      (i: any) => i.sectionId === 'sec-2a-1::split-1'
    );
    expect(movedAfter.snippet).toBe('Move this part.');
  });

  it('appends to an existing target bucket instead of clobbering it', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedWithCard(pc._id);
    // Pre-create 2.b with an existing item.
    (sub as any).aiReviewState.buckets['2.b'] = {
      standardCode: '2', specCode: 'b', standardTitle: '', specPrompt: '',
      narratives: [{ sectionId: 'existing-2b', heading: 'Existing', snippet: 'existing', htmlSnippet: '<p>existing</p>', wordCount: 1, confidence: 1, acceptState: 'pending', rationale: '' }],
      evidenceText: [], evidenceFiles: [], matrixCells: [],
    };
    (sub as any).markModified('aiReviewState');
    await sub.save();

    await request(app)
      .post(`/api/submissions/${sub._id}/review/split-item`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({
        sourceSectionId: 'sec-2a-1', kind: 'narratives',
        remainderHtml: '<p>Keep this part.</p>', movedHtml: '<p>Move this part.</p>',
        targetStd: '2', targetSpec: 'b', newSectionId: 'sec-2a-1::split-2',
      })
      .expect(200);

    const fresh: any = await Submission.findById(sub._id);
    const names = fresh.aiReviewState.buckets['2.b'].narratives.map((i: any) => i.sectionId);
    expect(names).toContain('existing-2b');
    expect(names).toContain('sec-2a-1::split-2');
  });

  it('400s when movedHtml has no text', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedWithCard(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/split-item`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sourceSectionId: 'sec-2a-1', kind: 'narratives', remainderHtml: '<p>x</p>', movedHtml: '<p></p>', targetStd: '2', targetSpec: 'b', newSectionId: 'n' });
    expect(res.status).toBe(400);
  });

  it('404s for an unknown source item', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedWithCard(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/split-item`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ sourceSectionId: 'nope', kind: 'narratives', remainderHtml: '<p>x</p>', movedHtml: '<p>y</p>', targetStd: '2', targetSpec: 'b', newSectionId: 'n' });
    expect(res.status).toBe(404);
  });

  it('a different PC cannot split on someone else\'s submission', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: other } = await createUser({ role: 'program_coordinator' });
    const sub = await seedWithCard(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/split-item`)
      .set('Authorization', `Bearer ${signTokenFor(other as any)}`)
      .send({ sourceSectionId: 'sec-2a-1', kind: 'narratives', remainderHtml: '<p>x</p>', movedHtml: '<p>y</p>', targetStd: '2', targetSpec: 'b', newSectionId: 'n' });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});

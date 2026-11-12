/**
 * Approved INTRODUCTION drafts reach the editor; EMPTY ones (a template
 * Standard heading with no program text — ETSU had 20 of 21) never do.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { createUser, signTokenFor } from '../helpers/factories';
import { introItemHasBody, dropEmptyIntroItems, isEmptyHtml } from '../../src/services/introItems';

let _c = 0;
async function seed(ownerId: any, existingIntro?: string) {
  _c += 1;
  const inst = await Institution.create({
    name: `IM Inst ${Date.now().toString(36)}-${_c}`, type: 'university',
    address: { street: '1', city: 'X', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'A', email: 'a@x.test', phone: '555-0000' },
  } as any);
  return (await Submission.create({
    submissionId: `IMP-${Date.now().toString(36)}-${_c}`,
    institutionName: inst.name, institutionId: inst._id, programName: 'HS', programLevel: 'bachelors',
    submitterId: ownerId, type: 'initial', status: 'in_progress',
    ...(existingIntro ? { standardIntroductions: new Map([['5', existingIntro]]) } : {}),
    aiReviewState: {
      buckets: {}, tags: [], cvs: [], evidenceDocs: [],
      introductions: {
        'standard-4': { scope: 'standard', standardCode: '4', items: [
          { sectionId: 'i4', heading: 'Standard 4: The program shall…', snippet: 'Our program evaluates itself every year.', htmlSnippet: '<p>Our program evaluates itself every year.</p>', wordCount: 7 },
        ] },
        'standard-5': { scope: 'standard', standardCode: '5', items: [
          { sectionId: 'i5', heading: 'Standard 5: The program shall…', snippet: '', htmlSnippet: '', wordCount: 32 },
        ] },
      },
      placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [], lastUpdatedAt: new Date(),
    },
  })) as any;
}

describe('Approved introductions → editor', () => {
  it('POSITIVE: an approved Standard 4 introduction is written into standardIntroductions[4]', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    await request(app).post(`/api/submissions/${sub._id}/review/set-approved`).set('Authorization', `Bearer ${signTokenFor(pc as any)}`).send({ approvedIds: ['i4'] }).expect(200);
    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.standardIntroductions.get('4')).toContain('Our program evaluates itself every year.');
  });

  it('NEGATIVE: approving an EMPTY introduction draft never writes "<p></p>" or wipes existing text', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id, '<p>Written by hand.</p>');
    await request(app).post(`/api/submissions/${sub._id}/review/set-approved`).set('Authorization', `Bearer ${signTokenFor(pc as any)}`).send({ approvedIds: ['i5'] }).expect(200);
    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.standardIntroductions.get('5')).toBe('<p>Written by hand.</p>');
  });

  it('helpers: empty drafts are recognised and dropped; real ones kept', () => {
    expect(introItemHasBody({ snippet: '', htmlSnippet: '' })).toBe(false);
    expect(introItemHasBody({ snippet: '', htmlSnippet: '<p>&nbsp;</p>' })).toBe(false);
    expect(introItemHasBody({ snippet: '', htmlSnippet: '<table><tr><td></td></tr></table>' })).toBe(true);
    expect(introItemHasBody({ snippet: 'x' })).toBe(true);
    expect(isEmptyHtml('<p></p>')).toBe(true);
    expect(isEmptyHtml('<p>a</p>')).toBe(false);
    const out = dropEmptyIntroItems({
      'standard-4': { items: [{ snippet: 'real' }] },
      'standard-5': { items: [{ snippet: '', htmlSnippet: '' }] },
    } as any);
    expect(Object.keys(out)).toEqual(['standard-4']);
  });
});

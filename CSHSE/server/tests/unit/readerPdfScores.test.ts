/**
 * CR-003 / S11.1 — the reader report PDF must render the captured 0-3
 * compliance score alongside the legacy pass/fail verdict.
 *
 * PDFKit output is a binary stream, so we can't easily assert the glyphs.
 * Instead we pin the contract that mattered for the bug: passing a
 * `scoresByKey` map produces a valid, non-trivial PDF (magic header `%PDF`)
 * without throwing, AND a larger document than the same review with no
 * scores (the score lines + rubric legend add content). This guards the new
 * addSpecificationRow / legend code path against regressions.
 */
import { describe, it, expect } from 'vitest';
import { PDFGeneratorService } from '../../src/services/pdfGenerator';

function minimalReview(): any {
  return {
    reviewerNumber: 1,
    totalReviewers: 3,
    institutionName: 'Score U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    reviewDate: new Date('2026-05-31'),
    submissionId: 'sub-1',
    reviewerId: 'rev-1',
    assessments: [
      {
        standardCode: '1',
        overallComments: '',
        specifications: [
          { specCode: 'a', compliance: 'compliant', comments: 'Looks good.' },
          { specCode: 'b', compliance: 'non_compliant', comments: 'Needs an org chart.' }
        ]
      }
    ],
    finalAssessment: {
      recommendation: 'accreditation_no_conditions',
      additionalComments: '',
      signature: '',
      signedAt: undefined
    }
  };
}

const reader = { firstName: 'Carol', lastName: 'Scorer', email: 'carol@example.com' };

describe('CR-003 / S11.1 — reader PDF renders 0-3 scores', () => {
  it('produces a valid PDF when given a scoresByKey map', async () => {
    const svc = new PDFGeneratorService();
    const buf = await svc.generateReaderReport(minimalReview(), reader, {
      '1.a': 3, // Fully compliant
      '1.b': 1 // Partial
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('still works (no scores) for the legacy call shape', async () => {
    const svc = new PDFGeneratorService();
    const buf = await svc.generateReaderReport(minimalReview(), reader);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('the scored report is larger than the unscored one (score lines added)', async () => {
    const withScores = await new PDFGeneratorService().generateReaderReport(minimalReview(), reader, {
      '1.a': 2,
      '1.b': 0
    });
    const without = await new PDFGeneratorService().generateReaderReport(minimalReview(), reader);
    expect(withScores.length).toBeGreaterThan(without.length);
  });
});

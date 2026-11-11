/**
 * Lauri CR (Nov 2026) — the reader report PDF no longer prints a 0-3
 * compliance score or the "Compliance Score Rubric (0-3)" legend. Where it
 * shows the reader's decision it prints their Reader Report mark:
 * Compliant / Non-compliant.
 *
 * PDFKit compresses its content streams, so instead of decoding glyphs we
 * record every string handed to doc.text() while the report is built.
 */
import { describe, it, expect } from 'vitest';
import { PDFGeneratorService } from '../../src/services/pdfGenerator';

function minimalReview(): any {
  return {
    reviewerNumber: 1,
    totalReviewers: 3,
    institutionName: 'Mark U',
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

const reader = { firstName: 'Carol', lastName: 'Marker', email: 'carol@example.com' };

async function renderCapturingText(marks?: Record<string, 'compliant' | 'noncompliant'>) {
  const svc = new PDFGeneratorService();
  const doc: any = (svc as any).doc;
  const seen: string[] = [];
  const orig = doc.text.bind(doc);
  doc.text = (t: any, ...rest: any[]) => {
    if (typeof t === 'string') seen.push(t);
    return orig(t, ...rest);
  };
  const buf = await svc.generateReaderReport(minimalReview(), reader, marks);
  return { buf, text: seen.join('\n') };
}

describe('Lauri CR — reader PDF prints Compliant / Non-compliant marks, never a 0-3 score', () => {
  it('prints the reader mark per spec and no score rubric', async () => {
    const { buf, text } = await renderCapturingText({ '1.a': 'compliant', '1.b': 'noncompliant' });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(text).toContain('Reader mark: Compliant');
    expect(text).toContain('Reader mark: Non-compliant');
    // Negative — none of the retired 0-3 vocabulary.
    expect(text).not.toContain('0-3');
    expect(text).not.toMatch(/Compliance Score/i);
    expect(text).not.toMatch(/Score:/);
    expect(text).not.toMatch(/Largely compliant|Fully compliant \(3\)|Partial \(1\)/);
  });

  it('still works with no marks (legacy call shape) and prints no mark line', async () => {
    const { buf, text } = await renderCapturingText();
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(text).not.toContain('Reader mark:');
    expect(text).not.toContain('0-3');
  });
});

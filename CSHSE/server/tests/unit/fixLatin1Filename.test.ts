import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/services/cshseAiClient', () => ({}));
import { fixLatin1Filename } from '../../src/controllers/aiReviewController';

describe('fixLatin1Filename (multer decodes filenames as latin1)', () => {
  it('restores an en dash / curly quote / accent', () => {
    const garble = (s: string) => Buffer.from(s, 'utf8').toString('latin1');
    expect(fixLatin1Filename(garble('Program Differentiators – East Tennessee.docx'))).toBe('Program Differentiators – East Tennessee.docx');
    expect(fixLatin1Filename(garble('Student’s Guide – Résumé.pdf'))).toBe('Student’s Guide – Résumé.pdf');
  });
  it('leaves plain ASCII and genuine latin1 names alone', () => {
    expect(fixLatin1Filename('Fall 2025 Minutes.docx')).toBe('Fall 2025 Minutes.docx');
    expect(fixLatin1Filename('Résumé.pdf')).toBe('Résumé.pdf');
  });
});

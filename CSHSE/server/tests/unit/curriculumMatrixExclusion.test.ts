/**
 * The one helper that decides what a curriculum-matrix document is, and the
 * matrix-free Specification 2.e text (CSHSE board decision, Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import {
  CURRICULUM_MATRIX_EXCLUDED_TAG,
  isCurriculumMatrixDocument,
  isCurriculumMatrixFileName,
  isCurriculumMatrixText,
  withoutCurriculumMatrixDocuments,
  applyCurriculumMatrixExclusion,
} from '../../src/services/curriculumMatrixExclusion';
import { getSpecCriteria } from '../../src/data/levelStandards';
import catalog from '../../src/data/standardsByLevel.json';

describe('isCurriculumMatrixDocument', () => {
  it('POSITIVE: matches by file name, official form title, or tag', () => {
    for (const n of ['Curriculum Matrix.docx', 'Appendix A6 - Curriculum Matrix.pdf', 'curriculum_matrix_2025.xlsx', 'MATRICES.pdf', 'matrix-hs.pdf']) {
      expect(isCurriculumMatrixFileName(n), n).toBe(true);
    }
    expect(isCurriculumMatrixText('Program\nMatrix  Illustrating Relationship of Required Courses to\nCurriculum Standards')).toBe(true);
    expect(isCurriculumMatrixDocument({ file: { originalName: 'A6.pdf' }, extractedText: 'Matrix Illustrating Relationship of Required Courses to Curriculum Standards' })).toBe(true);
    expect(isCurriculumMatrixDocument({ file: { originalName: 'A6.pdf' }, metadata: { description: 'Matrix Illustrating Relationship of Required Courses to Curriculum Standards' } })).toBe(true);
    expect(isCurriculumMatrixDocument({ file: { originalName: 'x.pdf' }, tags: [CURRICULUM_MATRIX_EXCLUDED_TAG] })).toBe(true);
  });

  it('NEGATIVE: ordinary files and look-alike words do not match', () => {
    for (const n of ['Syllabus HUS 101.pdf', 'Matrixed Org Chart.pdf', 'Dematrix.pdf', 'Program map.pdf', '']) {
      expect(isCurriculumMatrixFileName(n), n).toBe(false);
    }
    expect(isCurriculumMatrixDocument({ file: { originalName: 'Advisory minutes.pdf' }, extractedText: 'we reviewed the course matrix informally' })).toBe(false);
    expect(isCurriculumMatrixDocument(null)).toBe(false);
  });

  it('filters lists and marks a document in place (tag + un-assign)', () => {
    const list = [{ file: { originalName: 'Matrix.pdf' } }, { file: { originalName: 'Budget.pdf' } }];
    expect(withoutCurriculumMatrixDocuments(list)).toEqual([{ file: { originalName: 'Budget.pdf' } }]);
    const doc: any = { file: { originalName: 'Matrix.pdf' }, standardCode: '2', specCode: 'e', tags: ['ai-import'], metadata: { aiPlacement: { standardCode: '2' } } };
    expect(applyCurriculumMatrixExclusion(doc)).toBe(true);
    expect(doc.tags).toEqual(['ai-import', CURRICULUM_MATRIX_EXCLUDED_TAG]);
    expect(doc.standardCode).toBeUndefined();
    expect(doc.specCode).toBeUndefined();
    expect(doc.metadata.aiPlacement).toBeUndefined();
    const ok: any = { file: { originalName: 'Budget.pdf' }, standardCode: '9', specCode: 'a' };
    expect(applyCurriculumMatrixExclusion(ok)).toBe(false);
    expect(ok.standardCode).toBe('9');
  });
});

describe('Specification 2.e without the matrix', () => {
  it('NEGATIVE: no level\'s criteria (or any criteria) mention the matrix', () => {
    expect(JSON.stringify(catalog)).not.toMatch(/matri/i);
    for (const lvl of ['associate', 'bachelors', 'masters']) {
      const c = getSpecCriteria(lvl, '2', 'e');
      expect(c?.criteria, lvl).toMatch(/^Identify the required courses for all students/);
      expect(c?.criteria, lvl).not.toMatch(/matri/i);
    }
  });

  it('POSITIVE: the level-specific wording', () => {
    expect(getSpecCriteria('bachelors', '2', 'e')?.criteria).toMatch(/\(11-20\).*reflect congruence.*syllabi\.$/);
    expect(getSpecCriteria('associate', '2', 'e')?.criteria).toMatch(/\(11-20\).*specific concentrations/);
    expect(getSpecCriteria('masters', '2', 'e')?.criteria).toMatch(/\(11-18\).*clearly align.*specific concentrations/);
  });
});

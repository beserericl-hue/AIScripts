import { describe, it, expect } from 'vitest';
import { folderStandardFromPath } from '../../src/services/evidenceStandardSuggester';

// Real folder names from East Tennessee State's delivered evidence tree (Nov 2026).
describe('folderStandardFromPath — routing by the folder a file was delivered in', () => {
  it('reads "Standard N" folders', () => {
    expect(folderStandardFromPath('East Tennessee State/CSHSE EVIDENCE AND LINKS/Standard 13/BG4BN2.pdf')).toMatchObject({ std: '13', folder: 'Standard 13' });
    expect(folderStandardFromPath('CSHSE EVIDENCE AND LINKS/Standard 1/ETSU SACS Letter.pdf')).toMatchObject({ std: '1' });
  });
  it('reads "STD N <topic>" and "Standard N <words>" folders', () => {
    expect(folderStandardFromPath('CSHSE Reaccreditation/STD 4 Program Assessment/A Assessment Regimen and Timeline.pdf')).toMatchObject({ std: '4' });
    expect(folderStandardFromPath('CSHSE Reaccreditation/STD 14 Inquiry and Information/14d AI.pdf')).toMatchObject({ std: '14' });
    expect(folderStandardFromPath('CSHSE Reaccreditation/Standard 1 ETSU Stuff/I.docx')).toMatchObject({ std: '1' });
    expect(folderStandardFromPath('CSHSE Reaccreditation/STD 3 Community Assessment/x.docx')).toMatchObject({ std: '3' });
  });
  it('deepest standard folder wins', () => {
    expect(folderStandardFromPath('Standard 2/Standard 12/x.pdf')).toMatchObject({ std: '12' });
  });
  it('a sub-spec in the folder name is kept', () => {
    expect(folderStandardFromPath('Std 11.a Course Contents/x.pdf')).toMatchObject({ std: '11', spec: 'a' });
  });
  it('never reads the FILENAME (that is the filename parser\'s job)', () => {
    expect(folderStandardFromPath('Standard 19d2 2320.pdf')).toBeNull();
    expect(folderStandardFromPath('Syllabi/Standard 14a 4950.pdf')).toBeNull();
  });
  it('folders without a standard number → null (no false routing)', () => {
    expect(folderStandardFromPath('CSHSE EVIDENCE AND LINKS/Faculty CVs/Zorotovich CV.pdf')).toBeNull();
    expect(folderStandardFromPath('CSHSE Reaccreditation/Syllabi - Updated with Standards/3610 Syllabus S26.pdf')).toBeNull();
    expect(folderStandardFromPath('Monthly Meeting Agendas and Minutes/2025/October 2025/10-15-25 Minutes.docx')).toBeNull();
    expect(folderStandardFromPath('Handbook/CSHSE-National-Standards-Baccalaureate-Degree-Revised - July 28-2025 (1).pdf')).toBeNull();
    expect(folderStandardFromPath('x.pdf')).toBeNull();
    expect(folderStandardFromPath(undefined)).toBeNull();
  });
});

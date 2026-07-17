/**
 * The CSHSE Reader Report is the official per-degree-level compliance checklist,
 * one template per level. The generator picks the template by the submission's
 * programLevel (readerReportGenerator.resolveLevel). This test proves the three
 * shipped templates are genuinely level-distinct — each is tagged for exactly
 * its level's Standards — so a report is always based on the institution's
 * degree type:
 *   associate    → Standards 1-20 (no 21/22)
 *   baccalaureate→ Standards 1-20 + 22 (bachelor's-specific), no 21
 *   masters      → Standards 1-18 (no 19/20)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

const DIR = path.resolve(__dirname, '../../src/assets/reader-report-templates');

async function tokensOf(file: string): Promise<Set<number>> {
  const { value } = await mammoth.extractRawText({ buffer: fs.readFileSync(path.join(DIR, file)) });
  const stds = new Set<number>();
  for (const m of value.matchAll(/\{\{c_(\d+)\}\}/g)) stds.add(Number(m[1]));
  return stds;
}

describe('Reader report is based on the institution degree type', () => {
  it('associate.docx is tagged for Standards 1-20 only', async () => {
    const s = await tokensOf('associate.docx');
    for (let i = 1; i <= 20; i++) expect(s.has(i), `associate c_${i}`).toBe(true);
    expect(s.has(21)).toBe(false);
    expect(s.has(22)).toBe(false);
  });

  it('baccalaureate.docx is tagged for Standards 1-20 + 22 (bachelor-specific)', async () => {
    const s = await tokensOf('baccalaureate.docx');
    for (let i = 1; i <= 20; i++) expect(s.has(i), `bacc c_${i}`).toBe(true);
    expect(s.has(22), 'bacc adds Standard 22').toBe(true);
  });

  it('masters.docx is tagged for Standards 1-18 only', async () => {
    const s = await tokensOf('masters.docx');
    for (let i = 1; i <= 18; i++) expect(s.has(i), `masters c_${i}`).toBe(true);
    expect(s.has(19)).toBe(false);
    expect(s.has(20)).toBe(false);
  });

  it('the three levels are genuinely distinct (associate ≠ masters coverage)', async () => {
    const [assoc, mast] = [await tokensOf('associate.docx'), await tokensOf('masters.docx')];
    expect(assoc.size).not.toBe(mast.size); // 20 vs 18
  });
});

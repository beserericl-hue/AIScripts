/**
 * The Master's reader-report template is now fully placeholder-tagged (header
 * institution/program name + per-standard compliance marks for Standards 1-18),
 * so masters reports use the official template instead of the procedural
 * fallback. Verifies the template tagging AND a full runtime fill.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { fillTemplate } from '../../src/services/readerReportGenerator';

const TPL = path.resolve(__dirname, '../../src/assets/reader-report-templates/masters.docx');

async function textOf(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

describe("Master's reader-report template", () => {
  it('is tagged with header + all Standards 1-18 placeholders', async () => {
    const text = await textOf(fs.readFileSync(TPL));
    expect(text).toContain('{{inst_name}}');
    expect(text).toContain('{{prog_name}}');
    for (let i = 1; i <= 18; i++) {
      expect(text, `c_${i}`).toContain(`{{c_${i}}}`);
      expect(text, `n_${i}`).toContain(`{{n_${i}}}`);
      expect(text, `cm_${i}`).toContain(`{{cm_${i}}}`);
    }
    // The other inline header labels survive (not clobbered).
    expect(text).toMatch(/Program Director/);
  });

  it('fills institution/program + marks with NO leftover tokens', async () => {
    const mk = (t: string) => t;
    const patches: Record<string, string> = {
      inst_name: mk('KENNESAW STATE UNIVERSITY'),
      prog_name: mk('HUMAN SERVICES (M.S.)'),
    };
    for (let i = 1; i <= 18; i++) {
      const compliant = i % 3 !== 0;
      patches[`c_${i}`] = mk(compliant ? '☒' : '☐');
      patches[`n_${i}`] = mk(compliant ? '☐' : '☒');
      patches[`cm_${i}`] = mk(`Draft comment ${i}.`);
    }
    for (const k of ['c_introduction', 'n_introduction', 'cm_introduction', 'reader_recommendation']) {
      patches[k] = mk('');
    }
    // These share the multi-label header paragraph with inst/prog: never empty
    // (the generator writes underscores when unknown).
    patches.reader_name = mk('Nancy Reader');
    patches.report_date = mk('10/20/2026');
    // Per-specification rows (scripts/add_spec_placeholders.py).
    const specRows: string[] = JSON.parse(fs.readFileSync(path.join(path.dirname(TPL), 'spec-rows.json'), 'utf8')).masters;
    expect(specRows.length).toBeGreaterThan(80);
    for (const key of specRows) {
      const k = key.replace('.', '_');
      patches[`c_${k}`] = mk('☐');
      patches[`n_${k}`] = mk('☐');
      patches[`cm_${k}`] = mk(key === '7.b' ? 'Spec comment 7.b.' : '');
    }
    const out = await fillTemplate(fs.readFileSync(TPL), patches);
    const text = await textOf(out);
    expect(text).toContain('KENNESAW STATE UNIVERSITY');
    expect(text).toContain('HUMAN SERVICES (M.S.)');
    expect(text).toMatch(/Program Director/); // other labels preserved
    expect(text).toContain('Draft comment 7.');
    expect(text).toContain('Spec comment 7.b.');
    expect(text).toContain('Nancy Reader');
    expect(text.match(/\{\{[^}]+\}\}/g)).toBeNull(); // every token was filled
  });
});

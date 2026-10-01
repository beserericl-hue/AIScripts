import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { splitIntroByRubric } from '../../src/services/introNarrativeSplit';

const text = (h: string) => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('splitIntroByRubric — per-row Introduction split', () => {
  it('maps each numbered section to the matching reader-form row by its prompt text', () => {
    const html = [
      '<p>A. Required Introductory Material</p>',
      '<p>1.</p>', '<p>Specify the degree(s) offered for which accreditation is being sought.</p>',
      '<p>Associate of Applied Sciences in Human Services.</p>',
      '<p>2.</p>', '<p>Describe the institution.</p>',
      '<p>a.</p>', '<p>Describe the organizational structure, whether state or private.</p>', '<p>Public two-year college founded 1961.</p>',
      '<p>b.</p>', '<p>Describe the institutional context of the Program.</p>', '<p>Offers associate degrees and certificates.</p>',
      '<p>B.</p>', '<p>Include a glossary of terms as used in the self-study.</p>', '<p>HS = Human Services.</p>',
    ].join('');
    const { bySpec, matchedSections } = splitIntroByRubric(html);
    expect(matchedSections).toBeGreaterThanOrEqual(3);
    expect(text(bySpec.get('a') || '')).toMatch(/Associate of Applied Sciences/);     // degree
    expect(text(bySpec.get('b') || '')).toMatch(/organizational structure/);           // 2a
    expect(text(bySpec.get('c') || '')).toMatch(/institutional context/);              // 2b
    expect(text(bySpec.get('r') || '')).toMatch(/glossary|Human Services/);            // glossary
  });

  it('maps by TEXT, not the program’s own (drifting) numbers', () => {
    // A program that numbers "course requirements" as section 6 and "multiple
    // sites" as section 4 — the row assignment must follow the prompt, not the #.
    const html = [
      '<p>6.</p>', '<p>Describe institutional course requirements for all students and general education.</p>', '<p>Students take 15 credits of gen-ed.</p>',
      '<p>4.</p>', '<p>If the Program is delivered at multiple sites, describe the physical location.</p>', '<p>Two campuses.</p>',
    ].join('');
    const { bySpec } = splitIntroByRubric(html);
    expect(text(bySpec.get('e') || '')).toMatch(/course requirements/);   // form row e, not "6"
    expect(text(bySpec.get('k') || '')).toMatch(/multiple sites/);        // form row k, not "4"
  });

  it('falls back (no split) when the narrative has no section markers', () => {
    const { bySpec, matchedSections } = splitIntroByRubric('<p>Just a flat paragraph with no markers at all.</p>');
    expect(matchedSections).toBe(0);
    expect(bySpec.size).toBe(0); // caller keeps the whole blob on row 'a'
  });

  it('empty / whitespace input is safe', () => {
    expect(splitIntroByRubric('').matchedSections).toBe(0);
    expect(splitIntroByRubric('   ').matchedSections).toBe(0);
  });

  it('real AACC introduction: scrambled numbering lands on the right rows + nothing dropped', () => {
    const fixture = path.join(__dirname, '../fixtures/aacc_intro.html');
    if (!fs.existsSync(fixture)) return; // fixture optional in CI
    const html = fs.readFileSync(fixture, 'utf8');
    const { bySpec, matchedSections } = splitIntroByRubric(html);
    expect(matchedSections).toBeGreaterThanOrEqual(8);
    // AACC's own numbers are scrambled vs the official form — assert by content:
    expect(text(bySpec.get('a') || '')).toMatch(/degree|Associate/i);
    expect(text(bySpec.get('b') || '')).toMatch(/organizational structure/i);
    expect(text(bySpec.get('c') || '')).toMatch(/institutional context/i);
    expect(text(bySpec.get('e') || '')).toMatch(/course requirements/i);       // AACC "6."
    expect(text(bySpec.get('k') || '')).toMatch(/multiple sites/i);            // AACC "4."
    // AACC's hybrid section (its "5.") is specifically about technical training
    // & support → it lands in the hybrid group (o/p/q), on the row the CONTENT
    // addresses (q = "adequate technical training and support").
    const hybrid = text(`${bySpec.get('o') || ''}${bySpec.get('p') || ''}${bySpec.get('q') || ''}`);
    expect(hybrid).toMatch(/hybrid|online|technical/i);
    // The institution overview (its "2.") lands on row b, not the degree row a.
    expect(text(bySpec.get('b') || '')).toMatch(/Anne Arundel|nationally recognized/i);
    // Fidelity: the concatenated chunks together are not shorter than the
    // substantive source (allow for whitespace/marker reshuffling).
    const joined = [...bySpec.values()].join('');
    expect(text(joined).length).toBeGreaterThan(text(html).length * 0.9);
  });
});

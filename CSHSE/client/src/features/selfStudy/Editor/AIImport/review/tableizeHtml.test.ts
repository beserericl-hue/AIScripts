/**
 * Unit tests for tableizeIfBareRows (CR-032 / table-snippet fix 2026-05-22).
 */
import { describe, expect, it } from 'vitest';
import { tableizeIfBareRows } from './tableizeHtml';

describe('tableizeIfBareRows', () => {
  it('returns empty string unchanged', () => {
    expect(tableizeIfBareRows('')).toBe('');
  });

  it('returns plain prose unchanged', () => {
    const html = '<p>Faculty Members and their roles.</p>';
    expect(tableizeIfBareRows(html)).toBe(html);
  });

  it('leaves a complete table alone', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr></table>';
    expect(tableizeIfBareRows(html)).toBe(html);
  });

  it('wraps bare <tr> rows in <table><tbody>', () => {
    const html = '<tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr>';
    const out = tableizeIfBareRows(html);
    expect(out).toMatch(/^<table><tbody>/);
    expect(out).toMatch(/<\/tbody><\/table>$/);
    expect(out).toContain(html);
  });

  it('wraps bare <td> cells in <table><tbody><tr>', () => {
    const html = '<td>A</td><td>B</td>';
    const out = tableizeIfBareRows(html);
    expect(out).toBe('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
  });

  it('wraps bare <th> cells the same way', () => {
    const html = '<th>Header</th>';
    const out = tableizeIfBareRows(html);
    expect(out).toBe('<table><tbody><tr><th>Header</th></tr></tbody></table>');
  });

  it('is idempotent on already-wrapped output', () => {
    const html = '<tr><td>A</td></tr>';
    const once = tableizeIfBareRows(html);
    const twice = tableizeIfBareRows(once);
    expect(twice).toBe(once);
  });

  it('handles whitespace + attributes inside <tr>', () => {
    const html = '  <tr class="r1"><td colspan="2">A</td></tr>  ';
    const out = tableizeIfBareRows(html);
    expect(out.startsWith('<table><tbody>')).toBe(true);
    expect(out).toContain('class="r1"');
  });
});

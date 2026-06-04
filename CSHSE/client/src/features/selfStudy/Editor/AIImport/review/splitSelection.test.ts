/**
 * Unit tests for splitSelection — the DOM splitter behind "move text to
 * another subspec". Builds a container + a real Range in jsdom and asserts the
 * moved fragment and the remainder are correct, and that the live container is
 * never mutated.
 */
import { describe, it, expect } from 'vitest';
import { splitSelection, countWords } from './splitSelection';

function container(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

/** Build a Range spanning whole child nodes [startIdx, endIdx). */
function rangeOverChildren(el: HTMLElement, startIdx: number, endIdx: number): Range {
  const r = document.createRange();
  r.setStart(el, startIdx);
  r.setEnd(el, endIdx);
  return r;
}

describe('splitSelection', () => {
  it('moves a whole paragraph out and leaves the rest', () => {
    const el = container('<p>Keep one.</p><p>MOVE me.</p><p>Keep two.</p>');
    // Select the middle <p> (child index 1..2).
    const result = splitSelection(el, rangeOverChildren(el, 1, 2));
    expect(result).not.toBeNull();
    expect(result!.movedHtml).toBe('<p>MOVE me.</p>');
    expect(result!.remainderHtml).toBe('<p>Keep one.</p><p>Keep two.</p>');
    expect(result!.movedText).toBe('MOVE me.');
    // Live DOM untouched.
    expect(el.innerHTML).toBe('<p>Keep one.</p><p>MOVE me.</p><p>Keep two.</p>');
  });

  it('moves multiple consecutive blocks', () => {
    const el = container('<p>A</p><p>B</p><p>C</p><p>D</p>');
    const result = splitSelection(el, rangeOverChildren(el, 1, 3)); // B + C
    expect(result!.movedHtml).toBe('<p>B</p><p>C</p>');
    expect(result!.remainderHtml).toBe('<p>A</p><p>D</p>');
  });

  it('moves a partial text selection within a paragraph', () => {
    const el = container('<p>Hello brave new world</p>');
    const p = el.firstChild as HTMLElement;
    const textNode = p.firstChild as Text; // "Hello brave new world"
    const r = document.createRange();
    r.setStart(textNode, 6); // before "brave"
    r.setEnd(textNode, 15); // after "new"
    const result = splitSelection(el, r);
    expect(result!.movedText).toBe('brave new');
    expect(result!.remainderHtml).toBe('<p>Hello  world</p>');
  });

  it('returns null for a collapsed (empty) selection', () => {
    const el = container('<p>Nothing selected</p>');
    const r = document.createRange();
    const t = (el.firstChild as HTMLElement).firstChild as Text;
    r.setStart(t, 3);
    r.setEnd(t, 3);
    expect(splitSelection(el, r)).toBeNull();
  });

  it('returns null when the range is outside the container', () => {
    const el = container('<p>Inside</p>');
    const outside = container('<p>Outside</p>');
    const r = document.createRange();
    r.selectNodeContents(outside.firstChild as HTMLElement);
    expect(splitSelection(el, r)).toBeNull();
  });

  it('countWords ignores tags and entities', () => {
    expect(countWords('<p>one two three</p>')).toBe(3);
    expect(countWords('<p>a&nbsp;b</p><p>c</p>')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});

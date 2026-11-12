import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverflowNav } from './OverflowNav';

beforeAll(() => {
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} disconnect() {} };
});

const items = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, name: `A rather long navigation item ${i}` }));
const renderItem = (it: { name: string }) => <a href="#">{it.name}</a>;

describe('OverflowNav measuring layer', () => {
  it('POSITIVE: the full-width measuring row is clipped inside a 0×0 overflow-hidden box (cannot widen the page)', () => {
    render(<OverflowNav items={items} renderItem={renderItem} />);
    const clip = screen.getByTestId('nav-measure-clip');
    for (const c of ['absolute', 'h-0', 'w-0', 'overflow-hidden']) expect(clip.className).toContain(c);
    // every item is still in the measuring row, at max-content width
    const row = clip.firstElementChild as HTMLElement;
    expect(row.className).toContain('w-max');
    expect(row.children.length).toBe(items.length);
  });

  it('NEGATIVE: the measuring copies are hidden from users and assistive tech', () => {
    render(<OverflowNav items={items} renderItem={renderItem} />);
    const clip = screen.getByTestId('nav-measure-clip');
    expect(clip.getAttribute('aria-hidden')).not.toBeNull();
    expect((clip.firstElementChild as HTMLElement).className).toContain('invisible');
  });
});

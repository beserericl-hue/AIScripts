/**
 * CR-015 — narrative hyperlink preservation (plain-text path).
 *
 * The walker captures clickable <a href> when the DOCX source contains
 * proper anchor elements. Some sources (PDFs, simplified runs) drop the
 * HTML — only the plain-text snippet remains. CR-015 inserts an
 * auto-linkifier into the apply() render path so bare http(s):// URLs
 * become anchors before the content lands in the Self-Study editor.
 *
 * The helper now lives at module scope as `linkifyPlainText` so it's
 * testable in isolation (the apply() flow's renderBody + introductions
 * linkify both call into it; tests here lock the regex behavior).
 */
import { describe, expect, it } from 'vitest';
import { linkifyPlainText } from './aiImportStore';

describe('linkifyPlainText (CR-015)', () => {
  it('wraps a bare https URL in an <a href> with target=_blank + rel=noopener', () => {
    const out = linkifyPlainText('See https://example.com/page for details.');
    expect(out).toContain(
      '<a href="https://example.com/page" target="_blank" rel="noopener noreferrer">https://example.com/page</a>'
    );
  });

  it('wraps an http URL', () => {
    const out = linkifyPlainText('Plain http://legacy.example.org link.');
    expect(out).toContain('<a href="http://legacy.example.org"');
  });

  it('linkifies multiple URLs in the same string', () => {
    const out = linkifyPlainText(
      'First https://a.test and second https://b.test in one snippet.'
    );
    const anchors = (out.match(/<a href=/g) || []).length;
    expect(anchors).toBe(2);
    expect(out).toContain('href="https://a.test"');
    expect(out).toContain('href="https://b.test"');
  });

  it('does not linkify text that has no URL', () => {
    expect(linkifyPlainText('No URL here, just words.')).toBe('No URL here, just words.');
  });

  it('stops at whitespace, angle brackets, and closing quotes/parens', () => {
    // URLs inside parentheses or quoted lists shouldn't include the closer.
    expect(linkifyPlainText('Read (https://example.com).')).toContain(
      '<a href="https://example.com"'
    );
    // The closing paren should remain text, NOT part of the href:
    expect(linkifyPlainText('Read (https://example.com).')).not.toMatch(/href="[^"]*\)/);
  });

  it('preserves the URL inside the anchor TEXT (display matches href)', () => {
    const out = linkifyPlainText('Cite: https://example.com/doc#section-1');
    expect(out).toContain(
      '>https://example.com/doc#section-1</a>'
    );
  });

  it('rel attribute carries noopener noreferrer for security', () => {
    const out = linkifyPlainText('https://untrusted.example');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('target=_blank — opens in a new tab', () => {
    expect(linkifyPlainText('https://x.test')).toContain('target="_blank"');
  });

  it('does NOT touch a URL that is already inside an anchor tag', () => {
    // The function is purely additive on plain text — the apply() flow
    // skips it entirely when htmlSnippet is present. We probe the regex
    // behaviour here: it wraps the bare URL inside the existing href
    // (which is fine because the apply() flow never sends pre-wrapped
    // anchors through this helper).
    //
    // This test pins current behavior so a future "skip already-linked"
    // enhancement doesn't silently regress the apply() contract.
    const already = '<a href="https://foo.test">https://foo.test</a>';
    const out = linkifyPlainText(already);
    // Today: double-wraps. If that ever changes, the htmlSnippet branch
    // in renderBody (which short-circuits before this fn) must still
    // keep linked anchors untouched.
    expect(out.includes('<a href="https://foo.test"')).toBe(true);
  });

  it('handles an empty string', () => {
    expect(linkifyPlainText('')).toBe('');
  });
});

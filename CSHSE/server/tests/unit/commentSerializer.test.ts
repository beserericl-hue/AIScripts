/**
 * CR-004 — commentSerializer unit tests.
 *
 * Pins the redaction contract so a future refactor can't silently leak
 * reader identity into a PC viewer's response.
 */
import { describe, it, expect } from 'vitest';
import { serializeCommentForViewer, serializeCommentsForViewer } from '../../src/services/commentSerializer';

const oid = (s: string) => ({ toString: () => s, _id: s });

function raw(overrides: any = {}) {
  return {
    _id: oid('cid-1'),
    submissionId: oid('sub-1'),
    standardCode: '1',
    specCode: 'a',
    selectedText: 'governance',
    selectionStart: 0,
    selectionEnd: 10,
    authorId: oid('reader-1'),
    authorName: 'Jane Reader',
    authorRole: 'reader',
    content: 'This passage is weak.',
    replies: [],
    isResolved: false,
    relayed: false,
    boardEscalated: false,
    ...overrides,
  };
}

describe('serializeCommentForViewer — reader viewer', () => {
  it('reader sees the full raw doc (no redaction)', () => {
    const r = raw();
    const out = serializeCommentForViewer(r, 'reader');
    expect(out).not.toBeNull();
    expect(out!.authorName).toBe('Jane Reader');
    expect(out!.content).toBe('This passage is weak.');
    expect(out!.authorId).toBeDefined();
  });

  it('lead_reader sees the full raw doc', () => {
    const out = serializeCommentForViewer(raw(), 'lead_reader');
    expect(out!.authorName).toBe('Jane Reader');
  });

  it('admin sees the full raw doc', () => {
    const out = serializeCommentForViewer(raw(), 'admin');
    expect(out!.authorName).toBe('Jane Reader');
  });
});

describe('serializeCommentForViewer — PC viewer', () => {
  it('PC does NOT see an unrelayed comment', () => {
    const out = serializeCommentForViewer(raw({ relayed: false }), 'program_coordinator');
    expect(out).toBeNull();
  });

  it('PC sees a relayed comment with reader identity stripped', () => {
    const out = serializeCommentForViewer(
      raw({ relayed: true, pcLabel: 'Reader A', originalReaderId: oid('reader-1') }),
      'program_coordinator'
    );
    expect(out).not.toBeNull();
    expect(out!.authorName).toBe('Reader A');
    // hard guarantees — no reader id surfaces in ANY form
    expect((out as any).authorId).toBeUndefined();
    expect((out as any).originalReaderId).toBeUndefined();
    expect((out as any).relayedBy).toBeUndefined();
  });

  it('PC sees relayedText (the sanitized version) in place of content', () => {
    const out = serializeCommentForViewer(
      raw({
        relayed: true,
        content: 'This passage is weak; Jane thinks the syllabus is rubbish.',
        relayedText: 'This passage could be strengthened with a clearer syllabus example.',
      }),
      'program_coordinator'
    );
    expect(out!.content).toBe('This passage could be strengthened with a clearer syllabus example.');
    // raw content must not leak in any other field
    expect(JSON.stringify(out)).not.toContain('rubbish');
    expect(JSON.stringify(out)).not.toContain('Jane');
  });

  it('PC sees fully redacted attribution when pcLabel is empty', () => {
    const out = serializeCommentForViewer(
      raw({ relayed: true }),
      'program_coordinator'
    );
    expect(out!.authorName).toBe('');
  });
});

describe('serializeCommentForViewer — reply gating for PC viewer', () => {
  const parent = (replies: any[]) =>
    raw({
      relayed: true,
      pcLabel: 'Reader A',
      replies,
    });

  it('PC sees only RELAYED reader replies', () => {
    const replies = [
      {
        _id: oid('r1'),
        authorId: oid('reader-1'),
        authorName: 'Jane',
        authorRole: 'reader',
        content: 'unrelayed reader detail',
        relayed: false,
      },
      {
        _id: oid('r2'),
        authorId: oid('reader-2'),
        authorName: 'Bob',
        authorRole: 'reader',
        content: 'this is a sanitized reader follow-up',
        relayed: true,
        relayedText: 'this is the sanitized version',
      },
    ];
    const out = serializeCommentForViewer(parent(replies), 'program_coordinator');
    expect(out!.replies!.length).toBe(1);
    expect((out!.replies![0] as any).authorId).toBeUndefined();
    expect(out!.replies![0].content).toBe('this is the sanitized version');
    expect(JSON.stringify(out!.replies)).not.toContain('unrelayed reader detail');
  });

  it('PC always sees their own replies, even if unrelayed', () => {
    const replies = [
      {
        _id: oid('r1'),
        authorId: oid('pc-1'),
        authorName: 'PC Person',
        authorRole: 'program_coordinator',
        content: 'thanks for the note',
        relayed: false,
      },
    ];
    const out = serializeCommentForViewer(parent(replies), 'program_coordinator');
    expect(out!.replies!.length).toBe(1);
    expect(out!.replies![0].content).toBe('thanks for the note');
    expect(out!.replies![0].authorRole).toBe('program_coordinator');
  });
});

describe('serializeCommentsForViewer — list', () => {
  it('drops unrelayed comments and preserves order for a PC viewer', () => {
    const list = [
      raw({ _id: oid('a'), relayed: false }),
      raw({ _id: oid('b'), relayed: true, pcLabel: 'Reader A' }),
      raw({ _id: oid('c'), relayed: true, pcLabel: 'Reader B' }),
    ];
    const out = serializeCommentsForViewer(list, 'program_coordinator');
    expect(out.length).toBe(2);
    expect((out[0] as any).authorName).toBe('Reader A');
    expect((out[1] as any).authorName).toBe('Reader B');
  });

  it('readers see every comment in the input list (no drops)', () => {
    const list = [
      raw({ _id: oid('a') }),
      raw({ _id: oid('b'), relayed: true }),
    ];
    const out = serializeCommentsForViewer(list, 'reader');
    expect(out.length).toBe(2);
  });
});

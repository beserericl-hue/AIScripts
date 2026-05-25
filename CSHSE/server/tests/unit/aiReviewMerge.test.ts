/**
 * CR-043 — Unit tests for aiReviewMerge.ts
 *
 * Section 1 of test-plan-cr043-cr044-regression-2026-05-25.md.
 *
 * Covers:
 *   - sha256Hex          (deterministic hex digest)
 *   - buildEmptyReviewState
 *   - mergeImportIntoReviewState
 *       Group A — fresh import (add semantics + idempotency + audit log)
 *       Group B — reimport with strict-match dedupe
 *       Group C — per-kind dedupe (tags / cvs / evidenceDocs /
 *                 introductions / placeholders)
 *       Group D — coverage report passthrough
 *   - clearPreCR043State
 */

import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import {
  buildEmptyReviewState,
  clearPreCR043State,
  mergeImportIntoReviewState,
  sha256Hex,
} from '../../src/services/aiReviewMerge';

// --- Test factories --------------------------------------------------------

interface InputOverrides {
  importId?: string;
  sourceFilename?: string;
  sourceContentHash?: string;
  importedAt?: Date;
  reimport?: boolean;
  buckets?: Record<string, any>;
  tags?: any[];
  cvs?: any[];
  evidenceDocs?: any[];
  introductions?: Record<string, any>;
  placeholderSections?: any[];
  coverageReport?: any;
}

function makeInputs(overrides: InputOverrides = {}) {
  return {
    importId: overrides.importId ?? 'import-A',
    sourceFilename: overrides.sourceFilename ?? 'file-A.docx',
    sourceContentHash: overrides.sourceContentHash ?? 'hash-A',
    importedAt: overrides.importedAt ?? new Date('2026-05-25T10:00:00Z'),
    reimport: overrides.reimport ?? false,
    buckets: overrides.buckets ?? {},
    tags: overrides.tags ?? [],
    cvs: overrides.cvs ?? [],
    evidenceDocs: overrides.evidenceDocs ?? [],
    introductions: overrides.introductions ?? {},
    placeholderSections: overrides.placeholderSections ?? [],
    coverageReport: overrides.coverageReport,
  };
}

function makeBucket(specKey: string, narratives: any[] = [], evidenceText: any[] = [], evidenceFiles: any[] = []) {
  const [standardCode, specCode] = specKey.split('.');
  return {
    [specKey]: {
      standardCode,
      specCode,
      standardTitle: '',
      specPrompt: '',
      narratives,
      evidenceText,
      evidenceFiles,
      matrixCells: [],
      coverageScore: null,
      coverageCovered: null,
      coverageGaps: [],
      coverageStrengths: [],
    },
  };
}

// --- sha256Hex -------------------------------------------------------------

describe('sha256Hex', () => {
  it('returns 64 hex chars for any string', () => {
    expect(sha256Hex('hello').length).toBe(64);
    expect(sha256Hex('hello')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across calls', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
  });

  it('differs for different inputs', () => {
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
  });

  it('accepts a Buffer with the same result as the equivalent string', () => {
    expect(sha256Hex(Buffer.from('hello'))).toBe(sha256Hex('hello'));
  });
});

// --- buildEmptyReviewState -------------------------------------------------

describe('buildEmptyReviewState', () => {
  it('returns the canonical empty shape', () => {
    const s = buildEmptyReviewState();
    expect(s.buckets).toEqual({});
    expect(s.tags).toEqual([]);
    expect(s.cvs).toEqual([]);
    expect(s.evidenceDocs).toEqual([]);
    expect(s.introductions).toEqual({});
    expect(s.placeholderSections).toEqual([]);
    expect(s.approvedIds).toEqual([]);
    expect(s.discardedIds).toEqual([]);
    expect(s.itemSources).toEqual({});
    expect(s.mergeLog).toEqual([]);
    expect(s.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it('coverageReport defaults to undefined', () => {
    const s = buildEmptyReviewState();
    expect(s.coverageReport).toBeUndefined();
  });
});

// --- mergeImportIntoReviewState — Group A: fresh import --------------------

describe('mergeImportIntoReviewState — fresh import', () => {
  it('AC#3: adds new buckets to an empty state', () => {
    const state = buildEmptyReviewState();
    const report = mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-1',
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-1', snippet: 'narrative one' }]),
      })
    );
    expect(state.buckets['1.a'].narratives.length).toBe(1);
    expect(state.buckets['1.a'].narratives[0].sourceImportId).toBe('import-1');
    expect(state.buckets['1.a'].narratives[0].sourceFilename).toBe('file-A.docx');
    expect(state.itemSources['sec-1']).toBeDefined();
    expect(state.itemSources['sec-1'].sourceContentHash).toBe('hash-A');
    expect(state.itemSources['sec-1'].importId).toBe('import-1');
    expect(report.counts.narratives).toEqual({ kept: 0, replaced: 0, added: 1 });
  });

  it('AC#3: second file ADDS items without touching prior items (same spec)', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-A',
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A1', snippet: 'A' }]),
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-B',
        sourceFilename: 'file-B.docx',
        sourceContentHash: 'hash-B',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-B1', snippet: 'B' }]),
      })
    );
    expect(state.buckets['1.a'].narratives.length).toBe(2);
    const ids = state.buckets['1.a'].narratives.map((n: any) => n.sectionId);
    expect(ids).toContain('sec-A1');
    expect(ids).toContain('sec-B1');
  });

  it('AC#3: second file across a DIFFERENT spec adds new bucket without touching prior bucket', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A1' }]),
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-B',
        sourceFilename: 'file-B.docx',
        sourceContentHash: 'hash-B',
        buckets: makeBucket('7.b', [{ sectionId: 'sec-B1' }]),
      })
    );
    expect(Object.keys(state.buckets).sort()).toEqual(['1.a', '7.b']);
    expect(state.buckets['1.a'].narratives[0].sectionId).toBe('sec-A1');
    expect(state.buckets['7.b'].narratives[0].sectionId).toBe('sec-B1');
  });

  it('idempotent: same import twice (without reimport flag) does not duplicate', () => {
    const state = buildEmptyReviewState();
    const inputs = makeInputs({
      importId: 'import-1',
      sourceContentHash: 'hash-A',
      buckets: makeBucket('1.a', [{ sectionId: 'sec-1', snippet: 'one' }]),
    });
    mergeImportIntoReviewState(state, inputs);
    mergeImportIntoReviewState(state, inputs);
    expect(state.buckets['1.a'].narratives.length).toBe(1);
  });

  it('audit log appends one entry per merge with correct counts', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-1',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-1' }, { sectionId: 'sec-2' }]),
      })
    );
    expect(state.mergeLog.length).toBe(1);
    expect(state.mergeLog[0].reimport).toBe(false);
    expect(state.mergeLog[0].importId).toBe('import-1');
    expect(state.mergeLog[0].counts.narratives.added).toBe(2);
  });

  it('audit log preserves prior entries across multiple merges', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A' }]),
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-B',
        sourceFilename: 'file-B.docx',
        sourceContentHash: 'hash-B',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-B' }]),
      })
    );
    expect(state.mergeLog.length).toBe(2);
    expect(state.mergeLog[0].importId).toBe('import-A');
    expect(state.mergeLog[1].importId).toBe('import-B');
  });

  it('updates lastUpdatedAt on each merge', () => {
    const state = buildEmptyReviewState();
    const t0 = state.lastUpdatedAt.getTime();
    mergeImportIntoReviewState(
      state,
      makeInputs({ buckets: makeBucket('1.a', [{ sectionId: 'sec-1' }]) })
    );
    expect(state.lastUpdatedAt.getTime()).toBeGreaterThanOrEqual(t0);
  });
});

// --- mergeImportIntoReviewState — Group B: reimport strict-match -----------

describe('mergeImportIntoReviewState — reimport strict-match', () => {
  it('AC#4: reimport REPLACES items with same (filename, contentHash)', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-1',
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'old-sec', snippet: 'old version' }]),
      })
    );
    expect(state.buckets['1.a'].narratives[0].snippet).toBe('old version');

    const report = mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'new-sec', snippet: 'new version' }]),
      })
    );
    expect(state.buckets['1.a'].narratives.length).toBe(1);
    expect(state.buckets['1.a'].narratives[0].snippet).toBe('new version');
    expect(state.buckets['1.a'].narratives[0].sectionId).toBe('new-sec');
    expect(report.counts.narratives.replaced).toBe(1);
    expect(report.counts.narratives.added).toBe(1);
  });

  it('AC#4: approved mark on a replaced item is dropped (re-confirm invariant)', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-1',
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'old-sec', snippet: 'old' }]),
      })
    );
    state.approvedIds.push('old-sec');
    expect(state.approvedIds).toContain('old-sec');

    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'new-sec', snippet: 'new' }]),
      })
    );
    expect(state.approvedIds).not.toContain('old-sec');
    expect(state.approvedIds).not.toContain('new-sec');
  });

  it('AC#4: discarded mark on a replaced item is also dropped', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'old-sec' }]),
      })
    );
    state.discardedIds.push('old-sec');

    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'new-sec' }]),
      })
    );
    expect(state.discardedIds).not.toContain('old-sec');
  });

  it('AC#5: reimport with DIFFERENT filename adds, does not replace', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A' }]),
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A-v2.docx',
        sourceContentHash: 'hash-V2',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-V2' }]),
      })
    );
    expect(state.buckets['1.a'].narratives.length).toBe(2);
    const ids = state.buckets['1.a'].narratives.map((n: any) => n.sectionId);
    expect(ids).toContain('sec-A');
    expect(ids).toContain('sec-V2');
  });

  it('AC#5: reimport with SAME filename but DIFFERENT hash adds, does not replace', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A' }]),
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A-EDITED',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A2' }]),
      })
    );
    expect(state.buckets['1.a'].narratives.length).toBe(2);
  });

  it('AC#5: items from a DIFFERENT source survive reimport-replace', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-A',
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A' }]),
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-B',
        sourceFilename: 'file-B.docx',
        sourceContentHash: 'hash-B',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-B' }]),
      })
    );
    expect(state.buckets['1.a'].narratives.length).toBe(2);

    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-A2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'sec-A-new' }]),
      })
    );
    const ids = state.buckets['1.a'].narratives.map((n: any) => n.sectionId);
    expect(ids).toContain('sec-B');
    expect(ids).toContain('sec-A-new');
    expect(ids).not.toContain('sec-A');
  });

  it('AC#4: itemSources entries for replaced items are dropped', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'old-sec' }]),
      })
    );
    expect(state.itemSources['old-sec']).toBeDefined();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [{ sectionId: 'new-sec' }]),
      })
    );
    expect(state.itemSources['old-sec']).toBeUndefined();
    expect(state.itemSources['new-sec']).toBeDefined();
  });
});

// --- mergeImportIntoReviewState — Group C: per-kind dedupe -----------------

describe('mergeImportIntoReviewState — per-kind dedupe (tags / cvs / evidenceDocs)', () => {
  it('cvs: reimport replaces same-source CVs', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        cvs: [{ sectionId: 'cv-1', facultyName: 'old name' }],
      })
    );
    expect(state.cvs.length).toBe(1);
    expect(state.cvs[0].facultyName).toBe('old name');

    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        cvs: [{ sectionId: 'cv-1-new', facultyName: 'new name' }],
      })
    );
    expect(state.cvs.length).toBe(1);
    expect(state.cvs[0].facultyName).toBe('new name');
  });

  it('cvs: different-source CVs both survive reimport', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        cvs: [{ sectionId: 'cv-A' }],
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-B',
        sourceFilename: 'file-B.docx',
        sourceContentHash: 'hash-B',
        cvs: [{ sectionId: 'cv-B' }],
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-A2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        cvs: [{ sectionId: 'cv-A-new' }],
      })
    );
    const ids = state.cvs.map((c: any) => c.sectionId);
    expect(ids).toContain('cv-B');
    expect(ids).toContain('cv-A-new');
    expect(ids).not.toContain('cv-A');
  });

  it('evidenceDocs: reimport replaces same-source papers/syllabi', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        evidenceDocs: [{ sectionId: 'ed-1', kind: 'syllabus' }],
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        evidenceDocs: [{ sectionId: 'ed-1-new', kind: 'paper' }],
      })
    );
    expect(state.evidenceDocs.length).toBe(1);
    expect(state.evidenceDocs[0].sectionId).toBe('ed-1-new');
  });

  it('tags: reimport replaces same-source tags', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        tags: [{ tagId: 'tag-1', sectionId: 'tag-sec-1', summary: 'old' }],
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        tags: [{ tagId: 'tag-2', sectionId: 'tag-sec-2', summary: 'new' }],
      })
    );
    expect(state.tags.length).toBe(1);
    expect(state.tags[0].summary).toBe('new');
  });

  it('introductions: reimport replaces same-source intro items per bucket key', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        introductions: {
          document: { scope: 'document', items: [{ sectionId: 'intro-1', snippet: 'old intro' }] },
        },
      })
    );
    expect(state.introductions['document'].items.length).toBe(1);

    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        introductions: {
          document: { scope: 'document', items: [{ sectionId: 'intro-2', snippet: 'new intro' }] },
        },
      })
    );
    expect(state.introductions['document'].items.length).toBe(1);
    expect(state.introductions['document'].items[0].snippet).toBe('new intro');
  });

  it('introductions: different-source intro items survive reimport', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        introductions: { document: { scope: 'document', items: [{ sectionId: 'intro-A' }] } },
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-B',
        sourceFilename: 'file-B.docx',
        sourceContentHash: 'hash-B',
        introductions: { document: { scope: 'document', items: [{ sectionId: 'intro-B' }] } },
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-A2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        introductions: { document: { scope: 'document', items: [{ sectionId: 'intro-A-new' }] } },
      })
    );
    const ids = state.introductions['document'].items.map((i: any) => i.sectionId);
    expect(ids).toContain('intro-B');
    expect(ids).toContain('intro-A-new');
    expect(ids).not.toContain('intro-A');
  });

  it('placeholderSections: reimport replaces same-source placeholders', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        placeholderSections: [{ sectionId: 'ph-1', paragraphIndex: 0, heading: 'old ph' }],
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        placeholderSections: [{ sectionId: 'ph-2', paragraphIndex: 1, heading: 'new ph' }],
      })
    );
    expect(state.placeholderSections.length).toBe(1);
    expect(state.placeholderSections[0].heading).toBe('new ph');
  });

  it('evidenceFiles within a bucket: reimport replaces same-source files', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [], [], [{ sectionId: 'ef-1', heading: 'old file' }]),
      })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({
        importId: 'import-2',
        reimport: true,
        sourceFilename: 'file-A.docx',
        sourceContentHash: 'hash-A',
        buckets: makeBucket('1.a', [], [], [{ sectionId: 'ef-2', heading: 'new file' }]),
      })
    );
    expect(state.buckets['1.a'].evidenceFiles.length).toBe(1);
    expect(state.buckets['1.a'].evidenceFiles[0].heading).toBe('new file');
  });
});

// --- mergeImportIntoReviewState — Group D: coverage report -----------------

describe('mergeImportIntoReviewState — coverage report', () => {
  it('writes coverageReport when provided', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({ coverageReport: { totalParagraphs: 1000, covered: 850 } })
    );
    expect(state.coverageReport).toEqual({ totalParagraphs: 1000, covered: 850 });
  });

  it('preserves prior coverageReport when new merge omits it', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(
      state,
      makeInputs({ coverageReport: { totalParagraphs: 1000 } })
    );
    mergeImportIntoReviewState(
      state,
      makeInputs({ importId: 'import-2' })
    );
    expect(state.coverageReport).toEqual({ totalParagraphs: 1000 });
  });

  it('overwrites coverageReport on a later merge that provides one', () => {
    const state = buildEmptyReviewState();
    mergeImportIntoReviewState(state, makeInputs({ coverageReport: { v: 1 } }));
    mergeImportIntoReviewState(
      state,
      makeInputs({ importId: 'import-2', coverageReport: { v: 2 } })
    );
    expect(state.coverageReport).toEqual({ v: 2 });
  });
});

// --- clearPreCR043State (DB integration) -----------------------------------

describe('clearPreCR043State', () => {
  it('AC#13: clears aiBuckets/aiTags/aiCVs/aiEvidenceDocs/aiIntroductions/aiIntroductionHints/aiPlaceholderSections/aiMatrices on prior imports', async () => {
    const submission = await Submission.create({
      submissionId: 'CLR-001',
      institutionName: 'X',
      programName: 'P',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
    });
    const oldImport = await SelfStudyImport.create({
      submissionId: submission._id,
      originalFilename: 'old.docx',
      fileType: 'docx',
      uploadedBy: new mongoose.Types.ObjectId(),
      extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
      aiBuckets: { '1.a': { standardCode: '1', specCode: 'a', narratives: [{ sectionId: 'x' }] } } as any,
      aiTags: [{ tagId: 't1', sectionId: 's', summary: 's', fullText: 'f' } as any],
      aiCVs: [{ sectionId: 'cv-1' }],
      aiEvidenceDocs: [{ sectionId: 'ed-1' }],
      aiIntroductions: { document: { items: [] } } as any,
      aiIntroductionHints: { 's1': 'document' } as any,
      aiPlaceholderSections: [{ paragraphIndex: 0, heading: 'h', standardHint: null, specHint: null } as any],
      aiMatrices: [{ slug: 'm1' }],
    });

    const cleared = await clearPreCR043State(SelfStudyImport, submission._id);
    expect(cleared).toBe(1);

    const reloaded = await SelfStudyImport.findById(oldImport._id).lean();
    expect(reloaded?.aiBuckets).toBeUndefined();
    expect(reloaded?.aiTags).toBeUndefined();
    expect(reloaded?.aiCVs).toBeUndefined();
    expect(reloaded?.aiEvidenceDocs).toBeUndefined();
    expect(reloaded?.aiIntroductions).toBeUndefined();
    expect(reloaded?.aiIntroductionHints).toBeUndefined();
    expect(reloaded?.aiPlaceholderSections).toBeUndefined();
    expect(reloaded?.aiMatrices).toBeUndefined();
  });

  it('AC#14: excludeImportId leaves the named import untouched', async () => {
    const submission = await Submission.create({
      submissionId: 'CLR-002',
      institutionName: 'X',
      programName: 'P',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
    });
    const oldImport = await SelfStudyImport.create({
      submissionId: submission._id,
      originalFilename: 'old.docx',
      fileType: 'docx',
      uploadedBy: new mongoose.Types.ObjectId(),
      extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
      aiBuckets: { '1.a': { standardCode: '1', specCode: 'a' } } as any,
    });
    const newImport = await SelfStudyImport.create({
      submissionId: submission._id,
      originalFilename: 'new.docx',
      fileType: 'docx',
      uploadedBy: new mongoose.Types.ObjectId(),
      extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
      aiBuckets: { '1.a': { standardCode: '1', specCode: 'a' } } as any,
    });

    const cleared = await clearPreCR043State(SelfStudyImport, submission._id, newImport._id);
    expect(cleared).toBe(1);

    const reloadedOld = await SelfStudyImport.findById(oldImport._id).lean();
    const reloadedNew = await SelfStudyImport.findById(newImport._id).lean();
    expect(reloadedOld?.aiBuckets).toBeUndefined();
    expect(reloadedNew?.aiBuckets).toBeDefined();
  });

  it('AC#14: scoped to submission — other submissions stay intact', async () => {
    const submitterId = new mongoose.Types.ObjectId();
    const subA = await Submission.create({
      submissionId: 'CLR-003-A',
      institutionName: 'X',
      programName: 'P',
      programLevel: 'bachelors',
      submitterId,
      type: 'initial',
    });
    const subB = await Submission.create({
      submissionId: 'CLR-003-B',
      institutionName: 'X',
      programName: 'P',
      programLevel: 'bachelors',
      submitterId,
      type: 'initial',
    });
    const importA = await SelfStudyImport.create({
      submissionId: subA._id,
      originalFilename: 'a.docx',
      fileType: 'docx',
      uploadedBy: new mongoose.Types.ObjectId(),
      extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
      aiBuckets: { '1.a': { standardCode: '1', specCode: 'a' } } as any,
    });
    const importB = await SelfStudyImport.create({
      submissionId: subB._id,
      originalFilename: 'b.docx',
      fileType: 'docx',
      uploadedBy: new mongoose.Types.ObjectId(),
      extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
      aiBuckets: { '1.a': { standardCode: '1', specCode: 'a' } } as any,
    });

    const cleared = await clearPreCR043State(SelfStudyImport, subA._id);
    expect(cleared).toBe(1);

    const reloadedA = await SelfStudyImport.findById(importA._id).lean();
    const reloadedB = await SelfStudyImport.findById(importB._id).lean();
    expect(reloadedA?.aiBuckets).toBeUndefined();
    expect(reloadedB?.aiBuckets).toBeDefined();
  });

  it('returns 0 when no prior state exists', async () => {
    const submission = await Submission.create({
      submissionId: 'CLR-004',
      institutionName: 'X',
      programName: 'P',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
    });
    const cleared = await clearPreCR043State(SelfStudyImport, submission._id);
    expect(cleared).toBe(0);
  });
});

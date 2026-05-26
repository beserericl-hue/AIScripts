/**
 * P1 follow-on — coverage for Zustand store actions the existing
 * aiImportStore.test.ts left out. Focus on the load-bearing flows
 * that prior production bugs touched:
 *
 *   - dirty=true preservation in _applySnapshot (the 2026-05-21
 *     regression that wiped coordinator edits on next /ai-status poll)
 *   - enqueueFiles / popNextPendingFile / clearPendingFiles
 *     (CR-041 US-1 multi-file queue)
 *   - setHoldForReview (CR-041 US-5)
 *   - startOver vs reset (CR-043 follow-on — startOver preserves
 *     submissionId/programLevel/isReimport)
 *   - moveItemToIntroduction (CR-039 — move narrative to intro bucket)
 *   - setCVs / setMatrices (detector outputs)
 *   - introductionHints rehydration in _applySnapshot (CR-039 Phase 2c)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useAIImportStore } from './aiImportStore';

function reset(): void {
  useAIImportStore.getState().reset();
}

describe('aiImportStore — _applySnapshot dirty=true preservation', () => {
  beforeEach(reset);

  it('keeps local buckets when dirty=true and a snapshot arrives', () => {
    // Coordinator made a local edit; dirty flips true.
    useAIImportStore.setState({
      dirty: true,
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [
            { sectionId: 'sec-local', heading: 'h', snippet: 'local edit', wordCount: 2, confidence: 0.9, acceptState: 'auto_accept', rationale: '' },
          ],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: 0.8, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
        },
      },
    });
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [
            { sectionId: 'sec-from-server', heading: 'h', snippet: 'AI original', wordCount: 2, confidence: 0.9, acceptState: 'auto_accept', rationale: '' },
          ],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: 0.8, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [], stages: [],
    });
    const s = useAIImportStore.getState();
    // Local edit survives — bug fix from 2026-05-21.
    expect(s.buckets['1.a'].narratives[0].sectionId).toBe('sec-local');
    expect(s.buckets['1.a'].narratives[0].snippet).toBe('local edit');
  });

  it('replaces buckets when dirty=false (no local edits pending)', () => {
    useAIImportStore.setState({
      dirty: false,
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [{ sectionId: 'sec-stale', heading: 'h', snippet: 'stale', wordCount: 1, confidence: 0.5, acceptState: 'auto_accept', rationale: '' }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: 0.5, coverageCovered: false, coverageGaps: [], coverageStrengths: [],
        },
      },
    });
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [{ sectionId: 'sec-new', heading: 'h', snippet: 'new', wordCount: 1, confidence: 0.9, acceptState: 'auto_accept', rationale: '' }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: 0.9, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [], stages: [],
    });
    const s = useAIImportStore.getState();
    expect(s.buckets['1.a'].narratives[0].sectionId).toBe('sec-new');
  });
});

describe('aiImportStore — pending-file queue (CR-041 US-1)', () => {
  beforeEach(reset);

  // Helper since File isn't directly constructable in some environments.
  function mkFile(name: string): File {
    return new File(['stub'], name, { type: 'text/plain' });
  }

  it('enqueueFiles with no current uploadFile promotes the first', () => {
    useAIImportStore.getState().enqueueFiles([mkFile('a.docx'), mkFile('b.docx'), mkFile('c.docx')]);
    const s = useAIImportStore.getState();
    expect(s.uploadFile?.name).toBe('a.docx');
    expect(s.pendingFiles.length).toBe(2);
    expect(s.pendingFiles[0].name).toBe('b.docx');
  });

  it('enqueueFiles when uploadFile already set just appends', () => {
    useAIImportStore.setState({ uploadFile: mkFile('first.docx') });
    useAIImportStore.getState().enqueueFiles([mkFile('a.docx'), mkFile('b.docx')]);
    const s = useAIImportStore.getState();
    expect(s.uploadFile?.name).toBe('first.docx');
    expect(s.pendingFiles.length).toBe(2);
  });

  it('enqueueFiles is a no-op on empty input', () => {
    useAIImportStore.setState({ uploadFile: mkFile('x.docx') });
    useAIImportStore.getState().enqueueFiles([]);
    expect(useAIImportStore.getState().uploadFile?.name).toBe('x.docx');
    expect(useAIImportStore.getState().pendingFiles.length).toBe(0);
  });

  it('popNextPendingFile dequeues FIFO', () => {
    useAIImportStore.setState({
      pendingFiles: [mkFile('1.docx'), mkFile('2.docx'), mkFile('3.docx')],
    });
    const first = useAIImportStore.getState().popNextPendingFile();
    expect(first?.name).toBe('1.docx');
    const second = useAIImportStore.getState().popNextPendingFile();
    expect(second?.name).toBe('2.docx');
    expect(useAIImportStore.getState().pendingFiles.length).toBe(1);
  });

  it('popNextPendingFile returns null when queue empty', () => {
    expect(useAIImportStore.getState().popNextPendingFile()).toBeNull();
  });

  it('clearPendingFiles empties the queue', () => {
    useAIImportStore.setState({
      pendingFiles: [mkFile('a'), mkFile('b'), mkFile('c')],
    });
    useAIImportStore.getState().clearPendingFiles();
    expect(useAIImportStore.getState().pendingFiles.length).toBe(0);
  });
});

describe('aiImportStore — setHoldForReview (CR-041 US-5)', () => {
  beforeEach(reset);

  it('toggles the holdForReview flag', () => {
    expect(useAIImportStore.getState().holdForReview).toBe(true); // default
    useAIImportStore.getState().setHoldForReview(false);
    expect(useAIImportStore.getState().holdForReview).toBe(false);
    useAIImportStore.getState().setHoldForReview(true);
    expect(useAIImportStore.getState().holdForReview).toBe(true);
  });
});

describe('aiImportStore — startOver (CR-043 follow-on)', () => {
  beforeEach(reset);

  it('preserves submissionId / programLevel / isReimport on startOver', () => {
    useAIImportStore.setState({
      submissionId: 'sub-123',
      programLevel: 'masters',
      isReimport: true,
      importId: 'imp-old',
      step: 'apply',
      status: 'applied',
      buckets: { '1.a': {} as any },
      dirty: true,
    });
    useAIImportStore.getState().startOver();
    const s = useAIImportStore.getState();
    // Kept fields.
    expect(s.submissionId).toBe('sub-123');
    expect(s.programLevel).toBe('masters');
    expect(s.isReimport).toBe(true);
    // Reset fields.
    expect(s.importId).toBeNull();
    expect(s.step).toBe('upload');
    expect(s.status).toBe('idle');
    expect(s.buckets).toEqual({});
    expect(s.dirty).toBe(false);
  });

  it('reset wipes EVERYTHING (including submissionId)', () => {
    useAIImportStore.setState({
      submissionId: 'sub-456',
      programLevel: 'masters',
      isReimport: true,
    });
    useAIImportStore.getState().reset();
    const s = useAIImportStore.getState();
    expect(s.submissionId).toBeNull();
    expect(s.programLevel).toBe('bachelors');
    expect(s.isReimport).toBe(false);
  });
});

describe('aiImportStore — moveItemToIntroduction (CR-039)', () => {
  beforeEach(reset);

  it('moves a narrative from a spec bucket into the document intro bucket', () => {
    useAIImportStore.setState({
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [
            { sectionId: 'sec-mission', heading: 'Mission', snippet: 'Our mission is...', wordCount: 4, confidence: 0.6, acceptState: 'auto_accept', rationale: '' },
          ],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: 0.6, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
        },
      },
      introductions: {
        document: {
          scope: 'document',
          standardCode: null,
          items: [],
        },
      },
    });
    useAIImportStore.getState().moveItemToIntroduction('sec-mission', 'document');
    const s = useAIImportStore.getState();
    // Pulled from the spec bucket.
    expect(s.buckets['1.a'].narratives.length).toBe(0);
    // Landed in the Document Introduction bucket.
    expect(s.introductions['document'].items.length).toBe(1);
    expect(s.introductions['document'].items[0].sectionId).toBe('sec-mission');
    // Coordinator action marks state dirty so a subsequent
    // _applySnapshot doesn't overwrite the move.
    expect(s.dirty).toBe(true);
  });

  it('is a no-op when the item is not found anywhere', () => {
    const before = useAIImportStore.getState();
    useAIImportStore.getState().moveItemToIntroduction('does-not-exist', 'document');
    const after = useAIImportStore.getState();
    expect(after.introductions).toEqual(before.introductions);
    expect(after.buckets).toEqual(before.buckets);
  });
});

describe('aiImportStore — introductionHints rehydration in _applySnapshot (CR-039 Phase 2c)', () => {
  beforeEach(reset);

  it('lifts hinted sections out of matcher buckets into intro buckets', () => {
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [
            { sectionId: 'sec-intro', heading: 'About the Program', snippet: 'The program...', wordCount: 2, confidence: 0.5, acceptState: 'auto_accept', rationale: '' },
            { sectionId: 'sec-keep', heading: 'Real spec content', snippet: '...', wordCount: 1, confidence: 0.95, acceptState: 'auto_accept', rationale: '' },
          ],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: 0.8, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [], stages: [],
      introductionHints: { 'sec-intro': 'introduction:document' },
    });
    const s = useAIImportStore.getState();
    // sec-intro pulled out of 1.a, into document intro bucket.
    expect(s.buckets['1.a'].narratives.find((n: any) => n.sectionId === 'sec-intro')).toBeUndefined();
    expect(s.buckets['1.a'].narratives.find((n: any) => n.sectionId === 'sec-keep')).toBeDefined();
    expect(s.introductions['document']?.items?.find((it: any) => it.sectionId === 'sec-intro')).toBeDefined();
  });

  it('respects dirty=true and skips intro-hint rehydration when local edits pending', () => {
    // Pre-state: coordinator already moved their items locally.
    useAIImportStore.setState({
      dirty: true,
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [{ sectionId: 'sec-local', heading: 'h', snippet: 'local', wordCount: 1, confidence: 0.9, acceptState: 'auto_accept', rationale: '' }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
        },
      },
    });
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
          narratives: [{ sectionId: 'sec-from-server', heading: 'h', snippet: 'from server', wordCount: 1, confidence: 0.9, acceptState: 'auto_accept', rationale: '' }],
          evidenceText: [], evidenceFiles: [], matrixCells: [],
          coverageScore: 0.8, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
        },
      },
      tags: [], placeholderSections: [], matrices: [], stages: [],
      introductionHints: { 'sec-from-server': 'introduction:document' },
    });
    const s = useAIImportStore.getState();
    // Local buckets preserved, intro hints NOT applied.
    expect(s.buckets['1.a'].narratives[0].sectionId).toBe('sec-local');
    expect(s.introductions['document']?.items?.length).toBe(0);
  });
});

describe('aiImportStore — setSubmissionId (CR-043)', () => {
  beforeEach(reset);

  it('sets submissionId for later API calls (loadPersistedReviewState etc.)', () => {
    useAIImportStore.getState().setSubmissionId('sub-xyz');
    expect(useAIImportStore.getState().submissionId).toBe('sub-xyz');
  });
});

describe('aiImportStore — setCVs (CR-033 Phase 2c)', () => {
  beforeEach(reset);

  it('replaces the cvs array', () => {
    useAIImportStore.getState().setCVs([{ sectionId: 'cv-1' } as any, { sectionId: 'cv-2' } as any]);
    expect(useAIImportStore.getState().cvs.length).toBe(2);
    useAIImportStore.getState().setCVs([]);
    expect(useAIImportStore.getState().cvs.length).toBe(0);
  });
});

describe('aiImportStore — setStep clears stale errors (CR-027)', () => {
  beforeEach(reset);

  it('clears errors[] when navigating BACK to Upload outside a running status', () => {
    useAIImportStore.setState({ status: 'failed', errors: ['matcher returned zero items'] });
    useAIImportStore.getState().setStep('upload');
    const s = useAIImportStore.getState();
    expect(s.step).toBe('upload');
    expect(s.errors).toEqual([]);
  });

  it('KEEPS errors[] when navigating to Upload mid-run (status=uploading)', () => {
    useAIImportStore.setState({ status: 'uploading', errors: ['transient blip'] });
    useAIImportStore.getState().setStep('upload');
    const s = useAIImportStore.getState();
    expect(s.step).toBe('upload');
    // Mid-run errors stay visible so the coordinator sees what just broke.
    expect(s.errors).toEqual(['transient blip']);
  });

  it('KEEPS errors[] when navigating mid-run with status=parsing', () => {
    useAIImportStore.setState({ status: 'parsing', errors: ['boom'] });
    useAIImportStore.getState().setStep('upload');
    expect(useAIImportStore.getState().errors).toEqual(['boom']);
  });

  it('KEEPS errors[] when navigating mid-run with status=applying', () => {
    useAIImportStore.setState({ status: 'applying', errors: ['boom'] });
    useAIImportStore.getState().setStep('upload');
    expect(useAIImportStore.getState().errors).toEqual(['boom']);
  });

  it('does NOT clear errors when navigating to a step OTHER than upload', () => {
    useAIImportStore.setState({ status: 'failed', errors: ['boom'] });
    useAIImportStore.getState().setStep('parse');
    expect(useAIImportStore.getState().errors).toEqual(['boom']);
  });

  it('is a no-op clear when errors is already empty', () => {
    useAIImportStore.setState({ status: 'idle', errors: [] });
    useAIImportStore.getState().setStep('upload');
    expect(useAIImportStore.getState().errors).toEqual([]);
    expect(useAIImportStore.getState().step).toBe('upload');
  });

  it('handles queued status as in-flight (keeps errors)', () => {
    useAIImportStore.setState({ status: 'queued', errors: ['x'] });
    useAIImportStore.getState().setStep('upload');
    expect(useAIImportStore.getState().errors).toEqual(['x']);
  });
});

describe('aiImportStore — matrix row edits (CR-035 + CR-026)', () => {
  beforeEach(reset);

  const slug = 'mx-1';
  const anchor = 'matrix-mx-1-row-3-a';
  const key = `${slug}|${anchor}`;

  it('retagMatrixRow records a {kind:"retag", newStd, newSpec} entry + dirty=true', () => {
    useAIImportStore.getState().retagMatrixRow(slug, anchor, '4', 'b');
    const s = useAIImportStore.getState();
    expect(s.matrixRowEdits[key]).toEqual({ kind: 'retag', newStd: '4', newSpec: 'b' });
    expect(s.dirty).toBe(true);
  });

  it('removeMatrixRow records a {kind:"remove"} entry + dirty=true', () => {
    useAIImportStore.getState().removeMatrixRow(slug, anchor);
    const s = useAIImportStore.getState();
    expect(s.matrixRowEdits[key]).toEqual({ kind: 'remove' });
    expect(s.dirty).toBe(true);
  });

  it('restoreMatrixRow deletes the entry + bumps dirty=true', () => {
    useAIImportStore.setState({
      matrixRowEdits: { [key]: { kind: 'remove' } },
      dirty: false,
    });
    useAIImportStore.getState().restoreMatrixRow(slug, anchor);
    const s = useAIImportStore.getState();
    expect(s.matrixRowEdits[key]).toBeUndefined();
    expect(s.dirty).toBe(true);
  });

  it('retag overrides a prior remove for the same row (last write wins)', () => {
    useAIImportStore.getState().removeMatrixRow(slug, anchor);
    useAIImportStore.getState().retagMatrixRow(slug, anchor, '5', 'c');
    expect(useAIImportStore.getState().matrixRowEdits[key]).toEqual({
      kind: 'retag',
      newStd: '5',
      newSpec: 'c',
    });
  });

  it('different (matrixSlug, anchor) tuples write to different keys', () => {
    useAIImportStore.getState().retagMatrixRow('mx-a', 'row-1', '1', 'a');
    useAIImportStore.getState().retagMatrixRow('mx-b', 'row-2', '2', 'b');
    const edits = useAIImportStore.getState().matrixRowEdits;
    expect(Object.keys(edits).length).toBe(2);
    expect(edits['mx-a|row-1']).toEqual({ kind: 'retag', newStd: '1', newSpec: 'a' });
    expect(edits['mx-b|row-2']).toEqual({ kind: 'retag', newStd: '2', newSpec: 'b' });
  });
});

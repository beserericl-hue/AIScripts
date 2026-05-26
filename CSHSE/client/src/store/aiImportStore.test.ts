/**
 * AI Import Wizard — Zustand store unit tests (sub-sprint 1.a).
 *
 * Covers:
 *   - default state shape matches UI spec §9
 *   - basic setters (step, programLevel, isReimport, forceFormat, mergeMode)
 *   - _applySnapshot folds a server status snapshot into state
 *   - status-driven step derivation (queued/parsing → parse, parsed → review)
 *
 * Network-bound actions (startUpload, apply, cancelImport) are exercised
 * by the server integration tests + E2E; here we keep the unit suite fast.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useAIImportStore } from './aiImportStore';

function reset() {
  useAIImportStore.getState().reset();
}

describe('aiImportStore — default state', () => {
  beforeEach(reset);

  it('starts on the upload step with idle status', () => {
    const s = useAIImportStore.getState();
    expect(s.step).toBe('upload');
    expect(s.status).toBe('idle');
    expect(s.importId).toBeNull();
    expect(s.programLevel).toBe('bachelors');
    expect(s.eventsTransport).toBe('sse');
  });

  it('has empty buckets / tags / placeholders / errors initially', () => {
    const s = useAIImportStore.getState();
    expect(s.buckets).toEqual({});
    expect(s.tags).toEqual([]);
    expect(s.placeholderSections).toEqual([]);
    expect(s.errors).toEqual([]);
  });
});

describe('aiImportStore — setters', () => {
  beforeEach(reset);

  it('setStep / setProgramLevel / setIsReimport / setForceFormat / setMergeMode', () => {
    const s = useAIImportStore.getState();
    s.setStep('review');
    s.setProgramLevel('masters');
    s.setIsReimport(true);
    s.setForceFormat('template');
    s.setMergeMode('replace');

    const after = useAIImportStore.getState();
    expect(after.step).toBe('review');
    expect(after.programLevel).toBe('masters');
    expect(after.isReimport).toBe(true);
    expect(after.forceFormat).toBe('template');
    expect(after.mergeMode).toBe('replace');
  });

  it('selectSpec clears any previously selected section', () => {
    const s = useAIImportStore.getState();
    s.selectSection('sec-1');
    expect(useAIImportStore.getState().selectedSectionId).toBe('sec-1');
    s.selectSpec('1.a');
    const after = useAIImportStore.getState();
    expect(after.selectedSpecKey).toBe('1.a');
    expect(after.selectedSectionId).toBeNull();
  });
});

describe('aiImportStore — _applySnapshot', () => {
  beforeEach(reset);

  it('folds queued snapshot into state with queue fields', () => {
    useAIImportStore.getState()._applySnapshot({
      status: 'queued',
      queuePosition: 3,
      queueDepth: 5,
      etaSeconds: 240,
      stages: [],
      errors: []
    });
    const s = useAIImportStore.getState();
    expect(s.status).toBe('queued');
    expect(s.queuePosition).toBe(3);
    expect(s.queueDepth).toBe(5);
    expect(s.etaSeconds).toBe(240);
    // queued + currentStep=upload → derive to 'parse' so the user moves forward
    expect(s.step).toBe('parse');
  });

  it('folds parsed snapshot with full bucket payload', () => {
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      buckets: {
        '1.a': {
          standardCode: '1',
          specCode: 'a',
          standardTitle: 'T',
          specPrompt: 'p',
          narratives: [
            {
              sectionId: 'sec-1',
              heading: 'h',
              snippet: 's',
              wordCount: 10,
              confidence: 0.9,
              acceptState: 'auto_accept',
              rationale: 'r'
            }
          ],
          evidenceText: [],
          evidenceFiles: [],
          matrixCells: [],
          coverageScore: 0.8,
          coverageCovered: false,
          coverageGaps: [],
          coverageStrengths: []
        }
      },
      tags: [],
      placeholderSections: [],
      matrices: [],
      stages: [{ name: 'done', state: 'done' }]
    });
    const s = useAIImportStore.getState();
    expect(s.status).toBe('parsed');
    expect(s.buckets['1.a']).toBeDefined();
    expect(s.buckets['1.a'].narratives).toHaveLength(1);
    // CR-043 follow-on — wizard is Upload + Parse only; Review,
    // Matrix, Apply are toolbar surfaces. status='parsed' keeps the
    // wizard on 'parse' (where the "Open Review" CTA lives).
    expect(s.step).toBe('parse');
  });

  it('does not bounce the user back when they have already moved past', () => {
    // CR-043 follow-on — the wizard no longer routes through `apply`
    // as a step. The closest forward state is `parse` (parsing) and
    // anything past it stays in the toolbar Review/Matrix surfaces.
    // We pin the regression-relevant invariant: a `parsed` snapshot
    // doesn't yank a user already on `parse` somewhere else.
    useAIImportStore.getState().setStep('parse');
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      stages: []
    });
    expect(useAIImportStore.getState().step).toBe('parse');
  });

  it('preserves current state when snapshot omits optional fields', () => {
    // Seed with some state
    useAIImportStore.setState({ buckets: { '1.a': {} as any }, tags: [{ tagId: 'tag-x' } as any] });
    useAIImportStore.getState()._applySnapshot({
      status: 'parsing',
      stages: []
    });
    const s = useAIImportStore.getState();
    expect(s.buckets['1.a']).toBeDefined();
    expect(s.tags).toHaveLength(1);
  });
});

describe('aiImportStore — reset', () => {
  beforeEach(reset);

  it('returns to the initial state shape', () => {
    const s = useAIImportStore.getState();
    s.setStep('review');
    s.setProgramLevel('associate');
    s.reset();
    const after = useAIImportStore.getState();
    expect(after.step).toBe('upload');
    expect(after.programLevel).toBe('bachelors');
    expect(after.buckets).toEqual({});
  });
});

describe('aiImportStore — CR-032 inline edit', () => {
  beforeEach(() => {
    reset();
    useAIImportStore.setState({
      buckets: {
        '1.a': {
          standardCode: '1',
          specCode: 'a',
          standardTitle: 'Program Context',
          specPrompt: 'name + accreditation',
          narratives: [
            {
              sectionId: 'sec-n1',
              heading: 'h',
              snippet: 'AI original text for narrative.',
              wordCount: 5,
              confidence: 0.9,
              acceptState: 'auto_accept',
              rationale: '',
            },
          ],
          evidenceText: [],
          evidenceFiles: [],
          matrixCells: [],
          coverageScore: null,
          coverageCovered: null,
          coverageGaps: [],
          coverageStrengths: [],
        },
      },
      tags: [
        {
          tagId: 'tag-1',
          sectionId: 'sec-t1',
          summary: 's',
          fullText: 'AI original tag text.',
          suggestedStd: null,
          suggestedSpec: null,
          confidence: 0.2,
          sourceHeading: '',
          acceptState: 'review_unknown',
          rationale: '',
        },
      ],
    });
  });

  it('editBucketItem mutates snippet, preserves originalSnippet, sets dirty', () => {
    const s = useAIImportStore.getState();
    s.editBucketItem('1.a', 'sec-n1', 'narratives', 'Coordinator edit.');
    const after = useAIImportStore.getState();
    const item = after.buckets['1.a'].narratives[0];
    expect(item.snippet).toBe('Coordinator edit.');
    expect(item.originalSnippet).toBe('AI original text for narrative.');
    expect(item.editedAt).toBeTypeOf('number');
    expect(item.wordCount).toBe(2);
    expect(after.dirty).toBe(true);
  });

  it('editBucketItem does NOT overwrite originalSnippet on a second edit', () => {
    const s = useAIImportStore.getState();
    s.editBucketItem('1.a', 'sec-n1', 'narratives', 'First edit.');
    s.editBucketItem('1.a', 'sec-n1', 'narratives', 'Second edit.');
    const after = useAIImportStore.getState();
    const item = after.buckets['1.a'].narratives[0];
    expect(item.snippet).toBe('Second edit.');
    expect(item.originalSnippet).toBe('AI original text for narrative.');
  });

  it('revertBucketItem restores from originalSnippet + clears editedAt', () => {
    const s = useAIImportStore.getState();
    s.editBucketItem('1.a', 'sec-n1', 'narratives', 'Coordinator edit.');
    s.revertBucketItem('1.a', 'sec-n1', 'narratives');
    const after = useAIImportStore.getState();
    const item = after.buckets['1.a'].narratives[0];
    expect(item.snippet).toBe('AI original text for narrative.');
    expect(item.originalSnippet).toBeUndefined();
    expect(item.editedAt).toBeUndefined();
  });

  it('editTag + revertTag follow the same shape on Unplaced tags', () => {
    const s = useAIImportStore.getState();
    s.editTag('tag-1', 'Coordinator tag edit.');
    let after = useAIImportStore.getState();
    expect(after.tags[0].fullText).toBe('Coordinator tag edit.');
    expect(after.tags[0].originalSnippet).toBe('AI original tag text.');
    expect(after.tags[0].editedAt).toBeTypeOf('number');
    expect(after.dirty).toBe(true);

    s.revertTag('tag-1');
    after = useAIImportStore.getState();
    expect(after.tags[0].fullText).toBe('AI original tag text.');
    expect(after.tags[0].originalSnippet).toBeUndefined();
    expect(after.tags[0].editedAt).toBeUndefined();
  });

  it('revertBucketItem is a no-op for never-edited items', () => {
    const s = useAIImportStore.getState();
    const before = useAIImportStore.getState().buckets['1.a'].narratives[0];
    s.revertBucketItem('1.a', 'sec-n1', 'narratives');
    const after = useAIImportStore.getState().buckets['1.a'].narratives[0];
    expect(after).toEqual(before);
  });
});

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
    // parsed + previously on 'upload' → step derives to 'review'
    expect(s.step).toBe('review');
  });

  it('does not bounce the user back when they have already moved past', () => {
    useAIImportStore.getState().setStep('apply');
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      stages: []
    });
    expect(useAIImportStore.getState().step).toBe('apply');
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

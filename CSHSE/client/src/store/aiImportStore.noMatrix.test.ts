/**
 * CSHSE board decision (Nov 2026, via Lauri): the Curriculum Matrix is removed
 * from the self-study. The AI-import store must hold no matrix state, must not
 * send matrix payloads on Apply, and must ignore any legacy matrix fields a
 * server response might still carry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../services/api';
import { useAIImportStore } from './aiImportStore';

const bucket = {
  standardCode: '1',
  specCode: 'a',
  standardTitle: 'History',
  specPrompt: 'prompt',
  narratives: [{ sectionId: 's1', heading: 'H', snippet: 'Body', wordCount: 1, confidence: 0.9, acceptState: 'auto_accept', rationale: '' }],
  evidenceText: [],
  evidenceFiles: [],
  coverageScore: null,
  coverageCovered: null,
  coverageGaps: [],
  coverageStrengths: [],
};

describe('aiImportStore — no curriculum matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAIImportStore.getState().reset();
  });

  it('holds no matrix state and exposes no matrix actions', () => {
    const keys = Object.keys(useAIImportStore.getState());
    expect(keys.filter((k) => /matri/i.test(k))).toEqual([]);
  });

  it('Apply posts no matrix payload (matrices / matrixCells)', async () => {
    (api.post as any).mockResolvedValue({ data: { appliedCounts: {} } });
    useAIImportStore.setState({ importId: 'imp1', submissionId: 'sub1', buckets: { '1.a': bucket as any } });
    await useAIImportStore.getState().apply();
    const call = (api.post as any).mock.calls.find((c: any[]) => String(c[0]).includes('/apply-ai'));
    expect(call).toBeTruthy();
    const body = call[1];
    expect(Object.keys(body).filter((k) => /matri/i.test(k))).toEqual([]);
    expect(body.narratives).toBeTruthy();
    // No matrix endpoint is ever called.
    for (const c of (api.post as any).mock.calls) expect(String(c[0])).not.toMatch(/matri/i);
  });

  it('loading the review state ignores a legacy aiMatrixState field', async () => {
    (api.get as any).mockResolvedValue({
      data: {
        aiReviewState: { buckets: { '1.a': bucket } },
        aiMatrixState: { matrices: [{ matrixId: 'mx' }], matrixRowEdits: { a: { kind: 'remove' } } },
      },
    });
    useAIImportStore.setState({ submissionId: 'sub1' });
    await useAIImportStore.getState().loadPersistedReviewState();
    const st = useAIImportStore.getState() as any;
    expect(st.buckets['1.a']).toBeTruthy();
    expect(st.matrices).toBeUndefined();
    expect(st.matrixRowEdits).toBeUndefined();
    for (const c of (api.get as any).mock.calls) expect(String(c[0])).not.toMatch(/matri/i);
  });

  it('a snapshot carrying legacy matrices does not put them in the store', () => {
    useAIImportStore.getState()._applySnapshot({
      status: 'parsed',
      stages: [],
      buckets: { '1.a': bucket as any },
      matrices: [{ matrixId: 'mx' }],
    } as any);
    const st = useAIImportStore.getState() as any;
    expect(st.buckets['1.a']).toBeTruthy();
    expect(st.matrices).toBeUndefined();
  });
});

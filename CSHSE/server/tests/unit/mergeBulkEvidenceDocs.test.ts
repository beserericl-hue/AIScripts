import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/services/cshseAiClient', () => ({}));
import { mergeBulkEvidenceDocs } from '../../src/controllers/aiReviewController';

// A 380-file folder upload adds docs server-side while the coordinator keeps
// editing in Review; the autosave must not wipe what the browser hasn't seen.
describe('mergeBulkEvidenceDocs (save-state during a folder upload)', () => {
  const server = [
    { sectionId: 'bulk-1', bulkImported: true, referencedBySpecs: [{ std: '13' }, { std: '19' }] },
    { sectionId: 'bulk-2', bulkImported: true, referencedBySpecs: [{ std: '4' }] },
    { sectionId: 'mcc-appx-1', referencedBySpecs: [{ std: '2', spec: 'a' }] },
  ];
  it('keeps server-only bulk docs the stale browser copy lacks', () => {
    const out = mergeBulkEvidenceDocs(server, [{ sectionId: 'bulk-1', referencedBySpecs: [{ std: '13' }] }]);
    expect(out.map((d) => d.sectionId)).toEqual(['bulk-1', 'bulk-2']);
  });
  it('keeps server-added folder links on a doc both sides have; browser fields win', () => {
    const out = mergeBulkEvidenceDocs(server, [{ sectionId: 'bulk-1', title: 'Edited', referencedBySpecs: [{ std: '13' }] }]);
    expect(out[0].title).toBe('Edited');
    expect(out[0].referencedBySpecs.map((r: any) => r.std)).toEqual(['13', '19']);
  });
  it('does NOT resurrect non-bulk docs the browser removed (existing behavior)', () => {
    const out = mergeBulkEvidenceDocs(server, [{ sectionId: 'bulk-1' }, { sectionId: 'bulk-2' }]);
    expect(out.some((d) => d.sectionId === 'mcc-appx-1')).toBe(false);
  });
});

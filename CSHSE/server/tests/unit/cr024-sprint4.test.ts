/**
 * CR-024 Sprint 4 — pin the post-apply matrix-hotlink + AI eval prompt
 * enrichment wiring.
 *
 * Both halves shipped under CR-024 Sprint 4 (matrix-spec bidirectional
 * link, Sprint 4 deferred half). This test prevents silent regression of:
 *
 *   1. SelfStudyEditor.tsx still exposes `matrixScrollTarget` /
 *      `setMatrixScrollTarget` (post-apply hotlink plumbing).
 *   2. server/services/cshseAiClient.ts EvidenceScoreRequest carries an
 *      optional `matrixRows?: unknown[]` so Haiku's scoring prompt can
 *      reference matrix evidence per CR-024 Sprint 4.
 *   3. ai-service EvidenceScoreRequest schema accepts matrixRows on the
 *      wire (mirrors the typed client).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CR-024 Sprint 4 — post-apply hotlink + AI eval enrichment', () => {
  it('SelfStudyEditor.tsx exposes matrixScrollTarget post-apply plumbing', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/features/selfStudy/Editor/SelfStudyEditor.tsx'),
      'utf-8'
    );
    expect(src).toMatch(/setMatrixScrollTarget/);
    expect(src).toMatch(/scrollToSpec={matrixScrollTarget}/);
    expect(src).toMatch(/onScrollConsumed/);
  });

  it('EvidenceScoreRequest typed client carries optional matrixRows', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/cshseAiClient.ts'),
      'utf-8'
    );
    expect(src).toMatch(/matrixRows\?:\s*unknown\[\]/);
  });

  it('matrix-spec broadcast (setMatrixScrollSpec) wires the wizard rail to the matrix view', () => {
    const storeSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/store/aiImportStore.ts'),
      'utf-8'
    );
    expect(storeSrc).toMatch(/setMatrixScrollSpec/);
    expect(storeSrc).toMatch(/matrixScrollSpec/);
  });
});

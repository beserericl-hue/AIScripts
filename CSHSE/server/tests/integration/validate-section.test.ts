/**
 * CR-049 Phase 2 — ValidationService.validateSection (AI evaluator path).
 *
 * validateSection replaces the broken n8n validateSection call in the
 * submit path. It resolves the spec's rubric criteria, asks cshse-ai to
 * evaluate, maps the 3-level verdict to the binary submit gate, persists a
 * ValidationResult, and fail-softs when cshse-ai is unreachable.
 *
 * cshse-ai is spied (not vi.mock — vitest isolate=false leaks mocks across
 * files; spyOn on the module namespace is restored in afterEach).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { ValidationService } from '../../src/services/validationService';
import { ValidationResult } from '../../src/models/ValidationResult';
import { Submission } from '../../src/models/Submission';
import * as cshseAiClient from '../../src/services/cshseAiClient';

const svc = new ValidationService();

function fakeResponse(verdict: 'pass' | 'needs_improvement' | 'fail') {
  return {
    perSpec: [
      {
        standardCode: '1',
        specCode: 'a',
        verdict,
        rationale: `verdict is ${verdict}`,
        criteriaCoverage: [{ criterion: 'c', met: verdict === 'pass' }],
        improvementSuggestions: verdict === 'pass' ? [] : ['tighten the narrative'],
        sourcesUsed: {},
      },
    ],
    links: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CR-049 — ValidationService.validateSection', () => {
  it('maps verdict=pass → status pass', async () => {
    vi.spyOn(cshseAiClient, 'evaluateSection').mockResolvedValue(fakeResponse('pass') as any);
    const subId = new mongoose.Types.ObjectId().toString();
    const { result } = await svc.validateSection({
      submissionId: subId,
      standardCode: '1',
      specCode: 'a',
      narrativeText: '<p>We are regionally accredited.</p>',
    });
    expect(result.status).toBe('pass');
    expect(result.verdict).toBe('pass');
    expect(result.rationale).toContain('pass');
    // persisted
    const saved = await ValidationResult.findOne({ submissionId: subId, standardCode: '1', specCode: 'a' });
    expect(saved?.result.verdict).toBe('pass');
  });

  it('maps verdict=needs_improvement → status fail (gated) but keeps verdict + suggestions', async () => {
    vi.spyOn(cshseAiClient, 'evaluateSection').mockResolvedValue(fakeResponse('needs_improvement') as any);
    const { result } = await svc.validateSection({
      submissionId: new mongoose.Types.ObjectId().toString(),
      standardCode: '1',
      specCode: 'a',
      narrativeText: '<p>thin</p>',
    });
    expect(result.status).toBe('fail'); // not validated — needs work
    expect(result.verdict).toBe('needs_improvement');
    expect(result.missingElements).toContain('tighten the narrative');
  });

  it('maps verdict=fail → status fail', async () => {
    vi.spyOn(cshseAiClient, 'evaluateSection').mockResolvedValue(fakeResponse('fail') as any);
    const { result } = await svc.validateSection({
      submissionId: new mongoose.Types.ObjectId().toString(),
      standardCode: '1',
      specCode: 'a',
    });
    expect(result.status).toBe('fail');
    expect(result.verdict).toBe('fail');
  });

  it('fail-softs to status fail when cshse-ai is unreachable', async () => {
    vi.spyOn(cshseAiClient, 'evaluateSection').mockRejectedValue(new Error('ECONNREFUSED'));
    const { result } = await svc.validateSection({
      submissionId: new mongoose.Types.ObjectId().toString(),
      standardCode: '1',
      specCode: 'a',
    });
    expect(result.status).toBe('fail');
    expect(result.rationale).toMatch(/unavailable/i);
  });
});

describe('Level-aware rubric — criteria come from the institution degree level', () => {
  async function makeSub(programLevel: string, narratives: any) {
    return await Submission.create({
      submissionId: `LVL-${programLevel}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      institutionName: 'Level U',
      institutionId: new mongoose.Types.ObjectId(),
      programName: 'HS',
      programLevel,
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
      status: 'submitted',
      narratives,
    });
  }

  /** Capture the `criteria` string handed to cshse-ai for the evaluated spec. */
  function spyCaptureCriteria(): { get: () => string } {
    let captured = '';
    vi.spyOn(cshseAiClient, 'evaluateSection').mockImplementation(async (req: any) => {
      captured = req?.specs?.[0]?.criteria || '';
      return {
        perSpec: [{
          standardCode: req.specs[0].standardCode,
          specCode: req.specs[0].specCode,
          verdict: 'pass',
          rationale: 'ok',
          criteriaCoverage: [],
          improvementSuggestions: [],
          sourcesUsed: {},
        }],
        links: [],
      } as any;
    });
    return { get: () => captured };
  }

  it('associate Standard 4.a is judged against PROGRAM EVALUATION, not Budgetary Support', async () => {
    const cap = spyCaptureCriteria();
    const sub: any = await makeSub('associate', {
      '4': { a: { content: '<p>Our measurable student learning outcomes and assessment plan…</p>' } },
    });
    await svc.validateSection({
      submissionId: String(sub._id),
      standardCode: '4',
      specCode: 'a',
      narrativeText: '<p>SLOs + assessment plan</p>',
    });
    const criteria = cap.get().toLowerCase();
    expect(criteria).toContain('student learning outcomes'); // Program Evaluation 4.a
    expect(criteria).not.toContain('budget'); // NOT the legacy Budgetary Support rubric
  });

  it('bachelors Standard 9.a is judged against Program Support (budgetary info)', async () => {
    const cap = spyCaptureCriteria();
    const sub: any = await makeSub('bachelors', {
      '9': { a: { content: '<p>Budget lines and staffing…</p>' } },
    });
    await svc.validateSection({
      submissionId: String(sub._id),
      standardCode: '9',
      specCode: 'a',
      narrativeText: '<p>funding</p>',
    });
    expect(cap.get().toLowerCase()).toContain('budgetary information'); // Std 9 Program Support
  });

  it('masters Standard 13 (colon-less header in the PDF) has a real rubric', async () => {
    const cap = spyCaptureCriteria();
    const sub: any = await makeSub('masters', {
      '13': { a: { content: '<p>Human services delivery systems…</p>' } },
    });
    await svc.validateSection({
      submissionId: String(sub._id),
      standardCode: '13',
      specCode: 'a',
      narrativeText: '<p>delivery systems</p>',
    });
    expect(cap.get().length).toBeGreaterThan(20);
    expect(cap.get().toLowerCase()).toContain('human services delivery');
  });
});

describe('CR-049 Phase 4a — runReaderReportSeed', () => {
  it('evaluates only specs with content + persists a ValidationResult each', async () => {
    vi.spyOn(cshseAiClient, 'evaluateSection').mockImplementation(async (req: any) => ({
      perSpec: [{
        standardCode: req.specs[0].standardCode,
        specCode: req.specs[0].specCode,
        verdict: 'pass',
        rationale: 'seeded',
        criteriaCoverage: [],
        improvementSuggestions: [],
        sourcesUsed: {},
      }],
      links: [],
    }) as any);

    // 2 specs with content, 1 empty (should be skipped).
    const sub: any = await Submission.create({
      submissionId: `SEED-${Date.now().toString(36)}`,
      institutionName: 'Seed U',
      institutionId: new mongoose.Types.ObjectId(),
      programName: 'HS',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
      status: 'submitted',
      narratives: {
        '1': { a: { content: '<p>Real content for 1.a</p>' }, b: { content: '<p></p>' } },
        '2': { c: { content: 'Plain content for 2.c' } },
      },
    });

    const out = await svc.runReaderReportSeed(String(sub._id));
    expect(out.evaluated).toBe(2); // 1.a + 2.c; 1.b empty → skipped
    expect(out.failed).toBe(0);

    const saved = await ValidationResult.find({ submissionId: sub._id });
    expect(saved.length).toBe(2);
    expect(saved.every((v) => v.result.verdict === 'pass')).toBe(true);
  });
});

import mongoose from 'mongoose';
import { ValidationResult, IValidationResult, IValidationResultData } from '../models/ValidationResult';
import { Submission } from '../models/Submission';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { getStandardByCode } from '../data/standards';
import { evaluateSection } from './cshseAiClient';

// CR-054 — the legacy n8n `triggerValidation` path (and its
// ValidationRequest/ValidationResponse/WebhookCallResult shapes + the
// processCallback/callWebhook plumbing) was removed once all callers moved
// onto the in-process cshse-ai `validateSection` path. The four
// /api/webhooks/*/callback endpoints for validation no longer exist.

export class ValidationService {
  /**
   * CR-049 Phase 4a — re-evaluate every spec that has narrative content and
   * persist a fresh ValidationResult, seeding the reader report. Called
   * (detached) from Final Submit so the authoritative reader-facing verdicts
   * are produced once at submission, even for sections already evaluated
   * per-standard. Per-spec failures are swallowed (best-effort seed).
   */
  async runReaderReportSeed(submissionId: string): Promise<{ evaluated: number; failed: number }> {
    const submission = await Submission.findById(submissionId).select('narratives standardsStatus');
    let evaluated = 0;
    let failed = 0;
    if (!submission?.narratives) return { evaluated, failed };

    // CR-050 — skip specs the PC has explicitly marked N/A; they have no
    // verdict in the reader report.
    const standardsStatus: any = submission.standardsStatus || new Map();
    const isExcluded = (std: string, spec: string) => {
      const key = `${std}_${spec}`;
      const s = standardsStatus instanceof Map
        ? standardsStatus.get(key)
        : standardsStatus[key];
      return s?.excluded === true;
    };

    const tasks: Array<{ standardCode: string; specCode: string; content: string }> = [];
    submission.narratives.forEach((specMap: any, standardCode: string) => {
      if (specMap && typeof specMap.forEach === 'function') {
        specMap.forEach((data: any, specCode: string) => {
          if (isExcluded(standardCode, specCode)) return;
          const content = data?.content || '';
          if (typeof content === 'string' && content.replace(/<[^>]*>/g, '').trim().length > 0) {
            tasks.push({ standardCode, specCode, content });
          }
        });
      }
    });

    for (const t of tasks) {
      try {
        await this.validateSection({
          submissionId,
          standardCode: t.standardCode,
          specCode: t.specCode,
          narrativeText: t.content,
          validationType: 'submit'
        });
        evaluated++;
      } catch (err) {
        failed++;
        console.error(`[CR-049] reader-report seed: ${t.standardCode}.${t.specCode} failed`, err);
      }
    }
    return { evaluated, failed };
  }

  /**
   * CR-049 — evaluate a single spec's section against the reader-review
   * criteria via cshse-ai. This is the method the submission controller
   * calls on submit/revalidate; it REPLACES the legacy n8n
   * `triggerValidation` path for that flow (n8n validation is superseded).
   *
   * Fail-soft: any AI/network error degrades to a `fail` verdict with a
   * rationale rather than throwing, so Final Submit stays usable. Returns
   * the shape the controller already expects:
   * `{ result: { status, feedback, missingElements, verdict, rationale } }`.
   */
  async validateSection(opts: {
    submissionId: string;
    standardCode: string;
    specCode: string;
    narrativeText?: string;
    validationType?: 'auto_save' | 'manual_save' | 'submit';
    /** Optional — the prior ValidationResult being revalidated (link only). */
    previousValidationId?: string;
  }): Promise<{ result: IValidationResultData; validation: IValidationResult | null }> {
    const { submissionId, standardCode, specCode } = opts;
    const validationType = opts.validationType || 'submit';

    // Rubric criteria text for this spec.
    const standard = getStandardByCode(standardCode);
    const spec = standard?.specifications?.find((s) => s.code === specCode);
    const criteria = spec?.text || '';

    // institutionId + programLevel + supporting-evidence text for the AI
    // prompt (best-effort). programLevel scopes the corrections RAG so
    // bachelors hints don't bleed into a masters run (CR-049 Sprint 2.5).
    let institutionId = '';
    let programLevel: 'associate' | 'bachelors' | 'masters' = 'bachelors';
    let evidenceTexts: string[] = [];
    // CR-054 — the editor/validateStandard/revalidate callers may not pass the
    // narrative; fall back to the stored section content so the in-process
    // evaluator has the same input the legacy n8n path pulled from the DB.
    let narrativeText = opts.narrativeText || '';
    try {
      const submission: any = await Submission.findById(submissionId)
        .select('institutionId programLevel narratives')
        .lean();
      institutionId = submission?.institutionId?.toString() || '';
      if (submission?.programLevel) programLevel = submission.programLevel;
      if (!narrativeText && submission?.narratives) {
        const narr: any = submission.narratives;
        const stdNarr = narr instanceof Map ? narr.get(standardCode) : narr?.[standardCode];
        const specNarr = stdNarr instanceof Map ? stdNarr.get(specCode) : stdNarr?.[specCode];
        narrativeText = specNarr?.content || '';
      }
      const ev: any[] = await SupportingEvidence.find({
        submissionId,
        standardCode,
        specCode,
        isDeleted: { $ne: true }
      })
        .select('description metadata.description')
        .lean();
      evidenceTexts = ev
        .map((e) => e?.description || e?.metadata?.description || '')
        .filter(Boolean);
    } catch {
      /* context is best-effort */
    }

    let verdict: 'pass' | 'needs_improvement' | 'fail' = 'needs_improvement';
    let rationale = '';
    let suggestions: string[] = [];
    let criteriaCoverage: Array<{ criterion: string; met: boolean; note?: string }> = [];
    try {
      const out = await evaluateSection({
        institutionId,
        submissionId,
        programLevel,
        specs: [{ standardCode, specCode, criteria }],
        narrativeHtml: narrativeText,
        supportingEvidenceText: evidenceTexts
      });
      const row = out?.perSpec?.[0];
      if (row) {
        verdict = row.verdict;
        rationale = row.rationale || '';
        suggestions = row.improvementSuggestions || [];
        criteriaCoverage = row.criteriaCoverage || [];
      }
    } catch (err: any) {
      // Fail-soft — keep submit usable when cshse-ai is unreachable.
      verdict = 'fail';
      rationale = `AI evaluation unavailable (${err?.message || 'error'})`;
    }

    // `status` stays binary for the submit gate (only `pass` validates a
    // spec); `verdict` carries the full 3-level result for display + the
    // reader-report seed.
    const result: IValidationResultData = {
      status: verdict === 'pass' ? 'pass' : 'fail',
      verdict,
      feedback: rationale,
      rationale,
      missingElements: suggestions,
      suggestions,
      criteriaCoverage
    };

    // Persist so the client poll + reader report can consume it. We capture
    // the created doc and return it so the editor caller can hand the client a
    // `validationId` (the client polls /validation/latest until that id is no
    // longer pending — synchronous here, so it resolves on the first poll).
    let created: IValidationResult | null = null;
    try {
      // Resolve attempt chaining: an explicit previousValidationId wins,
      // otherwise link to the most recent prior result for this section.
      let previousId = opts.previousValidationId
        ? new mongoose.Types.ObjectId(opts.previousValidationId)
        : undefined;
      let attemptNumber = 1;
      if (!previousId) {
        const prior = await ValidationResult.findOne({
          submissionId: new mongoose.Types.ObjectId(submissionId),
          standardCode,
          specCode
        }).sort({ validatedAt: -1 });
        if (prior) {
          previousId = prior._id as mongoose.Types.ObjectId;
          attemptNumber = (prior.attemptNumber || 1) + 1;
        }
      }
      created = await ValidationResult.create({
        submissionId: new mongoose.Types.ObjectId(submissionId),
        standardCode,
        specCode,
        validationType,
        validatedAt: new Date(),
        result,
        attemptNumber,
        ...(previousId ? { previousValidationId: previousId } : {})
      });
    } catch {
      /* non-fatal */
    }

    return { result, validation: created };
  }

  /**
   * Update submission validation status
   */
  async updateSubmissionValidationStatus(
    submissionId: string,
    standardCode: string,
    specCode: string,
    status: 'pass' | 'fail'
  ): Promise<void> {
    const statusKey = `${standardCode}_${specCode}`;
    const now = new Date();

    // Use atomic $set to bypass Mongoose Map.set() persistence bug in Mongoose 8
    // (Map.set + markModified + save does NOT persist subdocument fields)
    const updateFields: Record<string, any> = {
      [`standardsStatus.${statusKey}.validationStatus`]: status,
      [`standardsStatus.${statusKey}.validatedAt`]: now,
      [`standardsStatus.${statusKey}.lastModified`]: now,
    };
    if (status === 'pass') {
      updateFields[`standardsStatus.${statusKey}.status`] = 'validated';
    }

    const result = await Submission.updateOne(
      { _id: submissionId },
      { $set: updateFields }
    );

    console.log(`[ValidationService] Atomic $set standardsStatus.${statusKey}`, {
      submissionId,
      validationStatus: status,
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    // Re-fetch to recalculate progress (reads the atomically-updated data)
    const submission = await Submission.findById(submissionId);
    if (submission) {
      submission.recalculateProgress();
      submission.markModified('selfStudyProgress');
      await submission.save();
    }
  }

  /**
   * Get the latest validation result for a section
   */
  async getLatestValidation(
    submissionId: string,
    standardCode: string,
    specCode?: string
  ): Promise<IValidationResult | null> {
    const query: any = {
      submissionId: new mongoose.Types.ObjectId(submissionId),
      standardCode
    };
    if (specCode) {
      query.specCode = specCode;
    }
    return ValidationResult.findOne(query).sort({ validatedAt: -1 });
  }

  /**
   * Get all validations for a standard
   */
  async getValidationsForStandard(
    submissionId: string,
    standardCode: string
  ): Promise<IValidationResult[]> {
    // Get latest validation per specCode for this standard
    const results = await ValidationResult.aggregate([
      {
        $match: {
          submissionId: new mongoose.Types.ObjectId(submissionId),
          standardCode
        }
      },
      { $sort: { validatedAt: -1 as const } },
      {
        $group: {
          _id: '$specCode',
          latestValidation: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$latestValidation' } },
      { $sort: { specCode: 1 as const } }
    ]);

    return results;
  }

  /**
   * Get all failed sections for a submission
   */
  async getFailedSections(
    submissionId: string,
    standardCodes?: string[]
  ): Promise<IValidationResult[]> {
    const query: any = {
      submissionId: new mongoose.Types.ObjectId(submissionId),
      'result.status': 'fail'
    };

    if (standardCodes && standardCodes.length > 0) {
      query.standardCode = { $in: standardCodes };
    }

    // Get latest validation per section
    const results = await ValidationResult.aggregate([
      { $match: query },
      { $sort: { validatedAt: -1 } },
      {
        $group: {
          _id: { standardCode: '$standardCode', specCode: '$specCode' },
          latestValidation: { $first: '$$ROOT' }
        }
      },
      { $match: { 'latestValidation.result.status': 'fail' } },
      { $replaceRoot: { newRoot: '$latestValidation' } }
    ]);

    return results;
  }

  /**
   * Check if a standard is ready for submission (all sections pass)
   */
  async isStandardReadyForSubmission(
    submissionId: string,
    standardCode: string
  ): Promise<{ ready: boolean; failedSpecs: string[] }> {
    const results = await ValidationResult.find({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      standardCode
    }).sort({ validatedAt: -1 });

    // Get latest result for each spec
    const latestBySpec = new Map<string, IValidationResult>();
    for (const result of results) {
      if (!latestBySpec.has(result.specCode)) {
        latestBySpec.set(result.specCode, result);
      }
    }

    const failedSpecs: string[] = [];
    for (const [specCode, result] of latestBySpec) {
      if (result.result.status !== 'pass') {
        failedSpecs.push(specCode);
      }
    }

    return {
      ready: failedSpecs.length === 0,
      failedSpecs
    };
  }
}

export const validationService = new ValidationService();

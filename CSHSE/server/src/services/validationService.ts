import mongoose from 'mongoose';
import { ValidationResult, IValidationResult, IValidationResultData } from '../models/ValidationResult';
import { Submission } from '../models/Submission';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { getStandardByCode } from '../data/standards';
import { getSpecCriteria } from '../data/levelStandards';
import { INTRO_STANDARD_CODE, getIntroRubricRow } from '../data/introRubric';
import { evaluateSection, extractFileText } from './cshseAiClient';
import { isS3Configured } from './s3Service';

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

    // Rubric criteria text for this spec. Seeded from the legacy flat catalog and
    // OVERRIDDEN below with the institution's level-specific criteria once the
    // submission's programLevel is known (the official CSHSE standards differ by
    // degree level — e.g. associate Standard 4 is "Program Evaluation", not
    // "Budgetary Support"). Without this, correct narratives are judged against
    // the wrong rubric and systematically fail.
    const standard = getStandardByCode(standardCode);
    const spec = standard?.specifications?.find((s) => s.code === specCode);
    let criteria = spec?.text || '';

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
      // Select the rubric from the institution's degree level (the two sources
      // the evaluation must use: the Standard + its reader-report criteria).
      const levelCrit = getSpecCriteria(programLevel, standardCode, specCode);
      if (levelCrit?.criteria) {
        criteria = levelCrit.criteria;
        console.log(
          `[ValidationService] rubric ${standardCode}.${specCode} level=${programLevel} ` +
            `source=${levelCrit.source} ("${(levelCrit.standardTitle || '').slice(0, 40)}")`
        );
      }
      // Introduction rows are evaluated against the official Reader Form rubric
      // (introRubric), not standardsByLevel. The ai-service /ai/section/evaluate
      // endpoint is code-agnostic, so we feed the per-row criteria here and the
      // verdict is stored at standardsStatus.introduction_<spec> like any spec.
      if (standardCode === INTRO_STANDARD_CODE) {
        const introRow = getIntroRubricRow(specCode);
        if (introRow?.criteria) {
          criteria = introRow.criteria;
          console.log(`[ValidationService] intro rubric ${INTRO_STANDARD_CODE}.${specCode} ("${introRow.title.slice(0, 40)}")`);
        }
      }
      if (!narrativeText && submission?.narratives) {
        const narr: any = submission.narratives;
        const stdNarr = narr instanceof Map ? narr.get(standardCode) : narr?.[standardCode];
        const specNarr = stdNarr instanceof Map ? stdNarr.get(specCode) : stdNarr?.[specCode];
        narrativeText = specNarr?.content || '';
      }
      // 2026-06-08 (user-reported): evidence that has been PLACED in a spec must
      // be visible to THAT spec's AI evaluation, and must carry the real file
      // text (read from metadata.description, set by materializeApprovedToEditor;
      // `description` holds the short title). We prioritise evidence routed to
      // this exact (standardCode, specCode); a small, strictly-bounded number of
      // un-routed items fills any remaining budget so general material isn't
      // wholly invisible — but the total is hard-capped so a large evidence
      // library can never overflow the ai-service prompt (which previously
      // truncated the JSON-format instructions and produced
      // "could not parse model response").
      const ev: any[] = await SupportingEvidence.find({
        submissionId,
        isDeleted: { $ne: true },
        $or: [
          { standardCode, specCode },
          { standardCode: { $in: [null, ''] } },
          { standardCode: { $exists: false } },
        ],
      })
        .select('description metadata.description extractedText standardCode specCode file.originalName file.s3Key file.mimeType')
        .lean();
      // Routed-to-this-spec items first; un-routed only fills leftover budget.
      const isRouted = (e: any) => e?.standardCode === standardCode && e?.specCode === specCode;
      const ranked = ev.slice().sort((a, b) => (isRouted(a) ? 0 : 1) - (isRouted(b) ? 0 : 1));
      const MAX_ITEMS = 12;     // hard cap on number of evidence snippets
      const MAX_LEN = 1200;     // per-item char cap
      const TOTAL_BUDGET = 12_000; // hard cap on total evidence chars in the prompt

      // Read a file's actual TEXT for the evaluator: prefer the body set at
      // approve-time (metadata.description), then the cached full-text extraction
      // (extractedText, shared with the coverage reviewer), and finally extract it
      // on-demand from S3 (caching it back). Without this, a spec whose only
      // support is a File-Library PDF had an EMPTY description and was skipped —
      // so validation falsely reported "no supporting evidence" (AACC 18.g: 3
      // assigned PDFs, empty descriptions → skipped). Now their content is read.
      const s3BucketName = process.env.AWS_S3_BUCKET_NAME || '';
      const evidenceBody = async (e: any): Promise<string> => {
        const meta = (e?.metadata?.description || '').trim();
        if (meta) return meta;
        if (typeof e?.extractedText === 'string' && e.extractedText.trim()) return e.extractedText.trim();
        const s3Key = e?.file?.s3Key;
        if (s3Key && isS3Configured()) {
          try {
            const ex = await extractFileText({ s3Key, s3Bucket: s3BucketName, mimeType: e?.file?.mimeType, filename: e?.file?.originalName });
            const t = (ex?.text || '').trim().slice(0, 6000);
            if (t) {
              await SupportingEvidence.updateOne({ _id: e._id }, { $set: { extractedText: t } }).catch(() => undefined);
              return t;
            }
          } catch {
            /* extraction is best-effort */
          }
        }
        return '';
      };

      let used = 0;
      evidenceTexts = [];
      for (const e of ranked) {
        if (evidenceTexts.length >= MAX_ITEMS || used >= TOTAL_BUDGET) break;
        // Once routed items are exhausted, only keep adding un-routed while budget
        // remains — this keeps the per-spec prompt small and on-topic.
        const title = (e?.description || e?.file?.originalName || '').trim();
        const body = await evidenceBody(e);
        const text = body || title;
        if (!text) continue;
        const labeled = title && body && !body.startsWith(title) ? `${title}: ${body}` : text;
        const clipped = labeled.length > MAX_LEN ? `${labeled.slice(0, MAX_LEN)}…` : labeled;
        const remaining = TOTAL_BUDGET - used;
        const finalText = clipped.length > remaining ? `${clipped.slice(0, remaining)}…` : clipped;
        evidenceTexts.push(finalText);
        used += finalText.length;
      }
    } catch {
      /* context is best-effort */
    }

    // The AI reader must actually VISIT the web links this spec cites (CR-049
    // scraper). Collect hrefs + bare URLs from the spec narrative and any
    // URL-type supporting evidence, then hand them to the evaluator, which
    // fetches each page and judges its text against the spec criteria. Without
    // this the scraper never runs (no URLs are passed) and web evidence is
    // ignored. Bounded so one link-heavy spec can't blow the eval budget.
    const webLinks: string[] = [];
    try {
      const seen = new Set<string>();
      const pushUrl = (u?: string) => {
        const url = (u || '').replace(/&amp;/gi, '&').trim().replace(/[)>.,;'"]+$/, '');
        if (!/^https?:\/\//i.test(url) || seen.has(url) || webLinks.length >= 8) return;
        seen.add(url);
        webLinks.push(url);
      };
      const hay = narrativeText || '';
      let m: RegExpExecArray | null;
      const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
      while ((m = hrefRe.exec(hay)) !== null) pushUrl(m[1]);
      for (const u of hay.match(/https?:\/\/[^\s"'<>)]+/gi) || []) pushUrl(u);
      // URL-type supporting evidence cards for this spec.
      const urlEv: any[] = await SupportingEvidence.find({
        submissionId,
        isDeleted: { $ne: true },
        evidenceType: 'url',
        $or: [{ standardCode, specCode }, { standardCode: { $in: [null, ''] } }],
      })
        .select('url')
        .limit(8)
        .lean();
      for (const e of urlEv) pushUrl(e?.url);
    } catch {
      /* link collection is best-effort */
    }

    let verdict: 'pass' | 'needs_improvement' | 'fail' = 'needs_improvement';
    let rationale = '';
    let suggestions: string[] = [];
    let criteriaCoverage: Array<{ criterion: string; met: boolean; note?: string }> = [];
    let scrapedLinks: Array<{ url: string; evaluable: boolean; reason?: string }> = [];
    try {
      // All library file names — so the evaluator can honor the "a cited document
      // that EXISTS counts as provided" rule (match narrative mentions to files),
      // even for files not explicitly assigned to this spec.
      let libraryFileNames: string[] = [];
      try {
        const allFiles: any[] = await SupportingEvidence.find({ submissionId, isDeleted: { $ne: true } })
          .select('file.originalName title')
          .lean();
        libraryFileNames = [...new Set(allFiles.map((f) => f.file?.originalName || f.title).filter(Boolean))].slice(0, 200);
      } catch { /* best-effort */ }
      const out = await evaluateSection({
        institutionId,
        submissionId,
        programLevel,
        specs: [{ standardCode, specCode, criteria }],
        narrativeHtml: narrativeText,
        supportingEvidenceText: evidenceTexts,
        webLinks,
        libraryFileNames
      });
      scrapedLinks = out?.links || [];
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
      criteriaCoverage,
      webLinksEvaluated: scrapedLinks
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
    status: 'pass' | 'fail',
    verdict?: 'pass' | 'needs_improvement' | 'fail'
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
    if (verdict) updateFields[`standardsStatus.${statusKey}.verdict`] = verdict;
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

    // Re-fetch to recalculate progress (reads the atomically-updated data),
    // then persist ONLY selfStudyProgress with an atomic $set.
    //
    // BUG FIX 2026-07-13 (prod: Approve-all → editor showed empty/partial) —
    // this used `submission.save()`, which rewrites the ENTIRE document from a
    // snapshot loaded here. The eval-queue worker runs this continuously (in
    // batches) while a coordinator's Approve-all is materializing narratives; a
    // stale full-save then clobbered the just-written narratives (lost update).
    // Writing only the computed selfStudyProgress field leaves narratives (and
    // every other field) untouched.
    const submission = await Submission.findById(submissionId);
    if (submission) {
      submission.recalculateProgress();
      await Submission.updateOne(
        { _id: submissionId },
        { $set: { selfStudyProgress: submission.selfStudyProgress } }
      );
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

import mongoose from 'mongoose';
import { ValidationResult, IValidationResult, IValidationResultData } from '../models/ValidationResult';
import { WebhookSettings, IWebhookSettings } from '../models/WebhookSettings';
import { Submission } from '../models/Submission';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { getStandardByCode } from '../data/standards';
import { evaluateSection } from './cshseAiClient';

export interface ValidationRequest {
  submissionId: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  standardCode: string;
  specCode: string;
  narrativeText: string;
  evidenceText: string;
  standardText: string;
  specificationText: string;
  standardTitle: string;
  standardDescription: string;
  specTitle: string;
  specText: string;
  supportingEvidence: {
    documents: Array<{ filename: string; type: string; size?: number }>;
    urls: Array<{ href: string; title: string; description?: string }>;
  };
  callbackUrl: string;
}

export interface ValidationResponse {
  executionId: string;
  submissionId: string;
  standardCode: string;
  specCode: string;
  result: IValidationResultData;
}

export interface WebhookCallResult {
  success: boolean;
  executionId?: string;
  error?: string;
  responseTimeMs: number;
}

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
  }): Promise<{ result: IValidationResultData }> {
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
    try {
      const submission: any = await Submission.findById(submissionId)
        .select('institutionId programLevel')
        .lean();
      institutionId = submission?.institutionId?.toString() || '';
      if (submission?.programLevel) programLevel = submission.programLevel;
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
        narrativeHtml: opts.narrativeText || '',
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

    // Persist (best-effort) so the reader report can later consume it.
    try {
      await ValidationResult.create({
        submissionId: new mongoose.Types.ObjectId(submissionId),
        standardCode,
        specCode,
        validationType,
        validatedAt: new Date(),
        result,
        attemptNumber: 1,
        ...(opts.previousValidationId
          ? { previousValidationId: new mongoose.Types.ObjectId(opts.previousValidationId) }
          : {})
      });
    } catch {
      /* non-fatal */
    }

    return { result };
  }

  /**
   * Trigger validation for a section via N8N webhook
   */
  async triggerValidation(
    submissionId: string,
    standardCode: string,
    specCode: string,
    validationType: 'auto_save' | 'manual_save' | 'submit' = 'manual_save',
    evidenceText: string = ''
  ): Promise<IValidationResult> {
    console.log('[ValidationService] triggerValidation called:', {
      submissionId,
      standardCode,
      specCode,
      validationType
    });

    // Create pending validation result
    const previousValidation = await ValidationResult.findOne({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      standardCode,
      specCode
    }).sort({ validatedAt: -1 });

    console.log('[ValidationService] Previous validation:', previousValidation ? {
      id: previousValidation._id,
      attemptNumber: previousValidation.attemptNumber,
      status: previousValidation.result?.status
    } : 'none');

    const validationResult = new ValidationResult({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      standardCode,
      specCode,
      validationType,
      result: { status: 'pending' },
      attemptNumber: previousValidation ? previousValidation.attemptNumber + 1 : 1,
      previousValidationId: previousValidation?._id
    });

    await validationResult.save();
    console.log('[ValidationService] Created validation result:', {
      validationId: validationResult._id,
      attemptNumber: validationResult.attemptNumber
    });

    // Get the submission data
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      console.error('[ValidationService] Submission not found:', submissionId);
      throw new Error('Submission not found');
    }
    console.log('[ValidationService] Found submission:', {
      submissionId: submission._id,
      programLevel: submission.programLevel
    });

    // Get webhook settings
    const webhookSettings = await WebhookSettings.findOne({
      settingType: 'n8n_validation',
      isActive: true
    });

    if (!webhookSettings) {
      console.log('[ValidationService] No active validation webhook configured');
      // No webhook configured - mark as pending for manual review
      validationResult.result = {
        status: 'pending',
        feedback: 'No validation webhook configured. Manual review required.'
      };
      await validationResult.save();
      return validationResult;
    }
    console.log('[ValidationService] Found webhook settings:', {
      webhookUrl: webhookSettings.webhookUrl,
      isActive: webhookSettings.isActive,
      hasAuth: !!webhookSettings.authentication?.type
    });

    // Get narrative content
    const narratives = submission.narratives;
    const standardNarratives = narratives?.get(standardCode);
    const narrative = standardNarratives?.get(specCode);

    if (!narrative || !narrative.content) {
      console.log('[ValidationService] No narrative content found for:', { standardCode, specCode });
      validationResult.result = {
        status: 'fail',
        score: 0,
        feedback: 'No narrative content found for this section.',
        missingElements: ['Narrative content']
      };
      await validationResult.save();
      return validationResult;
    }
    console.log('[ValidationService] Found narrative content:', {
      standardCode,
      specCode,
      contentLength: narrative.content.length
    });

    // Build the validation request
    // Priority: APP_URL > RAILWAY_PUBLIC_DOMAIN > localhost fallback
    const baseUrl = process.env.APP_URL
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
      || `http://localhost:${process.env.PORT || 8080}`;
    const callbackUrl = `${baseUrl}/api/webhooks/n8n/callback`;

    console.log('[ValidationService] Callback URL:', callbackUrl);

    // Look up standard and specification text
    const standardDef = getStandardByCode(standardCode);
    const specDef = standardDef?.specifications.find(sp => sp.code === specCode);

    const standardTextFull = standardDef
      ? `Standard ${standardDef.code}: ${standardDef.title}\n${standardDef.description}`
      : '';
    const specTextFull = specDef
      ? `Specification ${specDef.code}: ${specDef.title}\n${specDef.text}`
      : '';

    console.log('[ValidationService] Standard text:', standardTextFull ? 'found' : 'not found');
    console.log('[ValidationService] Spec text:', specTextFull ? 'found' : 'not found');

    // Fetch supporting evidence from MongoDB
    const evidenceDocs: Array<{ filename: string; type: string; size?: number }> = [];
    const evidenceUrls: Array<{ href: string; title: string; description?: string }> = [];

    try {
      const evidence = await SupportingEvidence.find({
        submissionId: new mongoose.Types.ObjectId(submissionId),
        standardCode,
        specCode,
        isDeleted: false
      });

      for (const item of evidence) {
        if (item.evidenceType === 'url' && item.url) {
          evidenceUrls.push({
            href: item.url.href,
            title: item.url.title || item.url.href,
            description: item.url.description
          });
        } else if (item.evidenceType === 'document' && item.file) {
          evidenceDocs.push({
            filename: item.file.originalName || item.file.filename,
            type: item.file.mimeType,
            size: item.file.size
          });
        }
      }

      console.log('[ValidationService] Found evidence:', {
        urls: evidenceUrls.length,
        documents: evidenceDocs.length
      });
    } catch (err) {
      console.log('[ValidationService] Error fetching evidence (continuing):', err);
    }

    const request: ValidationRequest = {
      submissionId,
      programLevel: submission.programLevel,
      standardCode,
      specCode,
      narrativeText: narrative.content,
      evidenceText,
      standardText: standardTextFull,
      specificationText: specTextFull,
      standardTitle: standardDef?.title || '',
      standardDescription: standardDef?.description || '',
      specTitle: specDef?.title || '',
      specText: specDef?.text || '',
      supportingEvidence: {
        documents: evidenceDocs,
        urls: evidenceUrls
      },
      callbackUrl
    };

    console.log('[ValidationService] Sending webhook request:', {
      submissionId: request.submissionId,
      programLevel: request.programLevel,
      standardCode: request.standardCode,
      specCode: request.specCode,
      narrativeLength: request.narrativeText.length,
      evidenceTextLength: request.evidenceText.length,
      standardText: request.standardText ? 'present' : 'empty',
      specText: request.specificationText ? 'present' : 'empty',
      evidenceUrls: request.supportingEvidence.urls.length,
      evidenceDocs: request.supportingEvidence.documents.length,
      callbackUrl: request.callbackUrl
    });

    // Call the webhook
    try {
      const webhookResult = await this.callWebhook(webhookSettings, request);

      console.log('[ValidationService] Webhook call result:', webhookResult);

      if (webhookResult.success) {
        if (webhookResult.executionId) {
          validationResult.n8nExecutionId = webhookResult.executionId;
        }
        await validationResult.save();
        console.log('[ValidationService] Webhook accepted, executionId:', webhookResult.executionId || 'none (async callback)');
      } else {
        console.log('[ValidationService] Webhook call failed:', webhookResult.error);
        validationResult.result = {
          status: 'pending',
          feedback: webhookResult.error || 'Webhook call failed. Will retry.'
        };
        await validationResult.save();
      }
    } catch (error) {
      console.error('[ValidationService] Exception calling webhook:', error);
      validationResult.result = {
        status: 'pending',
        feedback: error instanceof Error ? error.message : 'Unknown error'
      };
      await validationResult.save();
    }

    console.log('[ValidationService] triggerValidation complete:', {
      validationId: validationResult._id,
      status: validationResult.result.status
    });

    return validationResult;
  }

  /**
   * Process callback from N8N webhook
   */
  async processCallback(response: ValidationResponse): Promise<IValidationResult | null> {
    console.log('[ValidationService] processCallback called:', {
      executionId: response.executionId,
      submissionId: response.submissionId,
      standardCode: response.standardCode,
      specCode: response.specCode,
      resultStatus: response.result?.status,
      resultScore: response.result?.score
    });

    // Find the pending validation
    const validation = await ValidationResult.findOne({
      n8nExecutionId: response.executionId
    });

    console.log('[ValidationService] Lookup by executionId:', validation ? {
      validationId: validation._id,
      status: validation.result?.status
    } : 'not found');

    if (!validation) {
      console.log('[ValidationService] Trying fallback lookup by submission/section');
      // Try to find by submission and section
      const validation2 = await ValidationResult.findOne({
        submissionId: new mongoose.Types.ObjectId(response.submissionId),
        standardCode: response.standardCode,
        specCode: response.specCode,
        'result.status': 'pending'
      }).sort({ validatedAt: -1 });

      if (!validation2) {
        console.error('[ValidationService] No pending validation found for callback:', {
          executionId: response.executionId,
          submissionId: response.submissionId,
          standardCode: response.standardCode,
          specCode: response.specCode
        });
        return null;
      }

      console.log('[ValidationService] Found validation via fallback:', {
        validationId: validation2._id,
        previousStatus: validation2.result?.status
      });

      validation2.n8nExecutionId = response.executionId;
      validation2.result = response.result;
      validation2.validatedAt = new Date();
      await validation2.save();

      console.log('[ValidationService] Updated validation (fallback):', {
        validationId: validation2._id,
        newStatus: validation2.result?.status,
        score: validation2.result?.score
      });

      // Update submission status
      await this.updateSubmissionValidationStatus(
        response.submissionId,
        response.standardCode,
        response.specCode,
        response.result.status === 'pass' ? 'pass' : 'fail'
      );

      console.log('[ValidationService] Submission status updated');

      return validation2;
    }

    console.log('[ValidationService] Found validation by executionId:', {
      validationId: validation._id,
      previousStatus: validation.result?.status
    });

    validation.result = response.result;
    validation.validatedAt = new Date();
    await validation.save();

    console.log('[ValidationService] Updated validation:', {
      validationId: validation._id,
      newStatus: validation.result?.status,
      score: validation.result?.score
    });

    // Update submission status
    await this.updateSubmissionValidationStatus(
      response.submissionId,
      response.standardCode,
      response.specCode,
      response.result.status === 'pass' ? 'pass' : 'fail'
    );

    console.log('[ValidationService] processCallback complete:', {
      validationId: validation._id,
      finalStatus: validation.result?.status
    });

    return validation;
  }

  /**
   * Call N8N webhook
   */
  private async callWebhook(
    settings: IWebhookSettings,
    request: ValidationRequest
  ): Promise<WebhookCallResult> {
    const startTime = Date.now();

    console.log('[ValidationService] callWebhook starting:', {
      webhookUrl: settings.webhookUrl,
      authType: settings.authentication?.type || 'none',
      timeoutMs: settings.timeoutMs || 30000
    });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add authentication
      if (settings.authentication?.type === 'api_key' && settings.authentication.apiKey) {
        headers['X-API-Key'] = settings.authentication.apiKey;
        console.log('[ValidationService] Using API key authentication');
      } else if (settings.authentication?.type === 'bearer' && settings.authentication.bearerToken) {
        headers['Authorization'] = `Bearer ${settings.authentication.bearerToken}`;
        console.log('[ValidationService] Using Bearer token authentication');
      }

      // Add custom headers
      if (settings.headers) {
        const headerMap = settings.headers as unknown as Map<string, string>;
        if (headerMap.forEach) {
          headerMap.forEach((value, key) => {
            headers[key] = value;
          });
        }
        console.log('[ValidationService] Added custom headers');
      }

      console.log('[ValidationService] Sending POST to:', settings.webhookUrl);

      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(settings.timeoutMs || 30000)
      });

      const responseTimeMs = Date.now() - startTime;

      console.log('[ValidationService] Webhook response:', {
        status: response.status,
        statusText: response.statusText,
        responseTimeMs
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ValidationService] Webhook error response:', errorText);
        return {
          success: false,
          error: `Webhook returned ${response.status}: ${response.statusText}`,
          responseTimeMs
        };
      }

      const data = await response.json() as { executionId?: string; id?: string };

      console.log('[ValidationService] Webhook success response:', data);

      return {
        success: true,
        executionId: data.executionId || data.id,
        responseTimeMs
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      console.error('[ValidationService] Webhook exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTimeMs
      };
    }
  }

  /**
   * Update submission validation status
   */
  private async updateSubmissionValidationStatus(
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
   * Validate an entire standard (all specifications)
   */
  async validateStandard(
    submissionId: string,
    standardCode: string
  ): Promise<IValidationResult[]> {
    // Get all specs for this standard from the submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    const narratives = submission.narratives;
    const standardNarratives = narratives?.get(standardCode);

    if (!standardNarratives) {
      return [];
    }

    const results: IValidationResult[] = [];

    for (const [specCode] of standardNarratives) {
      const result = await this.triggerValidation(
        submissionId,
        standardCode,
        specCode,
        'submit'
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Revalidate only failed sections
   */
  async revalidateFailedSections(
    submissionId: string,
    standardCodes?: string[]
  ): Promise<IValidationResult[]> {
    const failedSections = await this.getFailedSections(submissionId, standardCodes);
    const results: IValidationResult[] = [];

    for (const failed of failedSections) {
      const result = await this.triggerValidation(
        submissionId,
        failed.standardCode,
        failed.specCode,
        'submit'
      );
      results.push(result);
    }

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

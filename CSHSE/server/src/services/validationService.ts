import mongoose from 'mongoose';
import { ValidationResult, IValidationResult, IValidationResultData } from '../models/ValidationResult';
import { WebhookSettings, IWebhookSettings } from '../models/WebhookSettings';
import { Submission } from '../models/Submission';

export interface ValidationRequest {
  submissionId: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  standardCode: string;
  specCode: string;
  narrativeText: string;
  standardText: string;
  specificationText: string;
  supportingEvidence: {
    documents: Array<{ filename: string; type: string; url?: string }>;
    urls: Array<{ href: string; title: string }>;
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
   * Trigger validation for a section via N8N webhook
   */
  async triggerValidation(
    submissionId: string,
    standardCode: string,
    specCode: string,
    validationType: 'auto_save' | 'manual_save' | 'submit' = 'manual_save'
  ): Promise<IValidationResult> {
    // Create pending validation result
    const previousValidation = await ValidationResult.findOne({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      standardCode,
      specCode
    }).sort({ validatedAt: -1 });

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

    // Get the submission data
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    // Get webhook settings
    const webhookSettings = await WebhookSettings.findOne({
      settingType: 'n8n_validation',
      isActive: true
    });

    if (!webhookSettings) {
      // No webhook configured - mark as pending for manual review
      validationResult.result = {
        status: 'pending',
        feedback: 'No validation webhook configured. Manual review required.'
      };
      await validationResult.save();
      return validationResult;
    }

    // Get narrative content
    const narratives = submission.narratives as Map<string, Map<string, any>>;
    const standardNarratives = narratives.get(standardCode);
    const narrative = standardNarratives?.get(specCode);

    if (!narrative || !narrative.content) {
      validationResult.result = {
        status: 'fail',
        score: 0,
        feedback: 'No narrative content found for this section.',
        missingElements: ['Narrative content']
      };
      await validationResult.save();
      return validationResult;
    }

    // Build the validation request
    const callbackUrl = process.env.API_URL
      ? `${process.env.API_URL}/api/webhooks/n8n/callback`
      : 'http://localhost:5000/api/webhooks/n8n/callback';

    const request: ValidationRequest = {
      submissionId,
      programLevel: submission.programLevel,
      standardCode,
      specCode,
      narrativeText: narrative.content,
      standardText: '', // Would be populated from standards template
      specificationText: '', // Would be populated from standards template
      supportingEvidence: {
        documents: [],
        urls: []
      },
      callbackUrl
    };

    // Call the webhook
    try {
      const webhookResult = await this.callWebhook(webhookSettings, request);

      if (webhookResult.success && webhookResult.executionId) {
        validationResult.n8nExecutionId = webhookResult.executionId;
        await validationResult.save();
      } else {
        validationResult.result = {
          status: 'pending',
          feedback: webhookResult.error || 'Webhook call failed. Will retry.'
        };
        await validationResult.save();
      }
    } catch (error) {
      validationResult.result = {
        status: 'pending',
        feedback: error instanceof Error ? error.message : 'Unknown error'
      };
      await validationResult.save();
    }

    return validationResult;
  }

  /**
   * Process callback from N8N webhook
   */
  async processCallback(response: ValidationResponse): Promise<IValidationResult | null> {
    // Find the pending validation
    const validation = await ValidationResult.findOne({
      n8nExecutionId: response.executionId
    });

    if (!validation) {
      // Try to find by submission and section
      const validation2 = await ValidationResult.findOne({
        submissionId: new mongoose.Types.ObjectId(response.submissionId),
        standardCode: response.standardCode,
        specCode: response.specCode,
        'result.status': 'pending'
      }).sort({ validatedAt: -1 });

      if (!validation2) {
        console.error('No pending validation found for callback:', response);
        return null;
      }

      validation2.n8nExecutionId = response.executionId;
      validation2.result = response.result;
      validation2.validatedAt = new Date();
      await validation2.save();

      // Update submission status
      await this.updateSubmissionValidationStatus(
        response.submissionId,
        response.standardCode,
        response.specCode,
        response.result.status === 'pass' ? 'pass' : 'fail'
      );

      return validation2;
    }

    validation.result = response.result;
    validation.validatedAt = new Date();
    await validation.save();

    // Update submission status
    await this.updateSubmissionValidationStatus(
      response.submissionId,
      response.standardCode,
      response.specCode,
      response.result.status === 'pass' ? 'pass' : 'fail'
    );

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

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add authentication
      if (settings.authentication?.type === 'api_key' && settings.authentication.apiKey) {
        headers['X-API-Key'] = settings.authentication.apiKey;
      } else if (settings.authentication?.type === 'bearer' && settings.authentication.bearerToken) {
        headers['Authorization'] = `Bearer ${settings.authentication.bearerToken}`;
      }

      // Add custom headers
      if (settings.headers) {
        const headerMap = settings.headers as Map<string, string>;
        headerMap.forEach((value, key) => {
          headers[key] = value;
        });
      }

      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(settings.timeoutMs || 30000)
      });

      const responseTimeMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          error: `Webhook returned ${response.status}: ${response.statusText}`,
          responseTimeMs
        };
      }

      const data = await response.json();

      return {
        success: true,
        executionId: data.executionId || data.id,
        responseTimeMs
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTimeMs: Date.now() - startTime
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
    const submission = await Submission.findById(submissionId);
    if (!submission) return;

    const standardsStatus = submission.standardsStatus as Map<string, any>;
    const currentStatus = standardsStatus.get(standardCode) || {
      status: 'in_progress',
      completionPercentage: 0,
      lastModified: new Date()
    };

    standardsStatus.set(standardCode, {
      ...currentStatus,
      validationStatus: status,
      validatedAt: new Date(),
      lastModified: new Date()
    });

    // Recalculate progress
    submission.recalculateProgress();
    await submission.save();
  }

  /**
   * Get the latest validation result for a section
   */
  async getLatestValidation(
    submissionId: string,
    standardCode: string,
    specCode: string
  ): Promise<IValidationResult | null> {
    return ValidationResult.findOne({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      standardCode,
      specCode
    }).sort({ validatedAt: -1 });
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

    const narratives = submission.narratives as Map<string, Map<string, any>>;
    const standardNarratives = narratives.get(standardCode);

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

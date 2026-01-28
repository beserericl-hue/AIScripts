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

    console.log('[ValidationService] Sending webhook request:', {
      submissionId: request.submissionId,
      programLevel: request.programLevel,
      standardCode: request.standardCode,
      specCode: request.specCode,
      narrativeLength: request.narrativeText.length,
      callbackUrl: request.callbackUrl
    });

    // Call the webhook
    try {
      const webhookResult = await this.callWebhook(webhookSettings, request);

      console.log('[ValidationService] Webhook call result:', webhookResult);

      if (webhookResult.success && webhookResult.executionId) {
        validationResult.n8nExecutionId = webhookResult.executionId;
        await validationResult.save();
        console.log('[ValidationService] Saved execution ID:', webhookResult.executionId);
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
    const submission = await Submission.findById(submissionId);
    if (!submission) return;

    const standardsStatus = submission.standardsStatus;
    const currentStatus = standardsStatus?.get(standardCode) || {
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

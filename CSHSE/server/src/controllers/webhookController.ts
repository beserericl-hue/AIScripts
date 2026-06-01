import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { validationService } from '../services/validationService';
import { WebhookSettings } from '../models/WebhookSettings';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * CR-054 — validate a single section in-process via cshse-ai (`validateSection`),
 * replacing the legacy async n8n trigger+callback. The call is synchronous, so
 * the persisted ValidationResult already carries its final verdict; the client
 * still polls /validation/latest by `validationId` and resolves on first poll.
 */
export const runSectionValidation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode, specCode, narrativeText } = req.body;

    if (!submissionId || !standardCode || !specCode) {
      return res.status(400).json({
        error: 'Missing required fields: submissionId, standardCode, specCode'
      });
    }

    const out = await validationService.validateSection({
      submissionId,
      standardCode,
      specCode,
      narrativeText: narrativeText || undefined,
      validationType: 'manual_save'
    });

    // Mirror the legacy n8n callback: reflect the verdict onto the submission's
    // standardsStatus so the editor's validated counter / submit gate update.
    try {
      await validationService.updateSubmissionValidationStatus(
        submissionId,
        standardCode,
        specCode,
        out.result.status === 'pass' ? 'pass' : 'fail'
      );
    } catch (statusErr) {
      console.error('[Validation] standardsStatus update failed (non-fatal):', statusErr);
    }

    return res.json({
      validationId: out.validation?._id,
      status: out.result.status,
      verdict: out.result.verdict,
      message: 'Validation complete'
    });
  } catch (error) {
    console.error('[Validation] runSectionValidation error:', error);
    return res.status(500).json({ error: 'Failed to validate section' });
  }
};

/**
 * Get webhook settings
 */
export const getWebhookSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await WebhookSettings.find({});

    // Remove sensitive data
    const sanitizedSettings = settings.map(s => ({
      id: s._id,
      settingType: s.settingType,
      name: s.name,
      description: s.description,
      webhookUrl: s.webhookUrl,
      isActive: s.isActive,
      hasAuthentication: s.authentication?.type !== 'none',
      authenticationType: s.authentication?.type,
      retryConfig: s.retryConfig,
      callbackUrl: s.callbackUrl,
      timeoutMs: s.timeoutMs,
      updatedAt: s.updatedAt
    }));

    return res.json({ settings: sanitizedSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ error: 'Failed to get webhook settings' });
  }
};

/**
 * Update webhook settings
 */
export const updateWebhookSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      settingType,
      name,
      description,
      webhookUrl,
      isActive,
      authentication,
      retryConfig,
      callbackUrl,
      headers,
      timeoutMs
    } = req.body;

    if (!settingType || !name || !webhookUrl) {
      return res.status(400).json({
        error: 'Missing required fields: settingType, name, webhookUrl'
      });
    }

    const updateData: any = {
      name,
      description,
      webhookUrl,
      isActive: isActive !== undefined ? isActive : true,
      updatedBy: new mongoose.Types.ObjectId(req.user?.id)
    };

    if (authentication) {
      updateData.authentication = authentication;
    }

    if (retryConfig) {
      updateData.retryConfig = retryConfig;
    }

    if (callbackUrl) {
      updateData.callbackUrl = callbackUrl;
    }

    if (headers) {
      updateData.headers = headers;
    }

    if (timeoutMs) {
      updateData.timeoutMs = timeoutMs;
    }

    const settings = await WebhookSettings.findOneAndUpdate(
      { settingType },
      updateData,
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      settings: {
        id: settings._id,
        settingType: settings.settingType,
        name: settings.name,
        webhookUrl: settings.webhookUrl,
        isActive: settings.isActive
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({ error: 'Failed to update webhook settings' });
  }
};

/**
 * Test webhook connection
 */
export const testWebhookConnection = async (req: Request, res: Response) => {
  try {
    const { settingType } = req.params;

    const settings = await WebhookSettings.findOne({ settingType });
    if (!settings) {
      return res.status(404).json({ error: 'Webhook settings not found' });
    }

    const result = await settings.testConnection();

    return res.json({
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
      responseTimeMs: result.responseTimeMs
    });
  } catch (error) {
    console.error('Test connection error:', error);
    return res.status(500).json({ error: 'Failed to test webhook connection' });
  }
};

/**
 * Get validation status for a section (path params)
 */
export const getValidationStatus = async (req: Request, res: Response) => {
  try {
    const { submissionId, standardCode, specCode } = req.params;

    const result = await validationService.getLatestValidation(
      submissionId,
      standardCode,
      specCode
    );

    if (!result) {
      return res.json({ status: 'not_validated' });
    }

    return res.json({
      validationId: result._id,
      status: result.result.status,
      score: result.result.score,
      feedback: result.result.feedback,
      suggestions: result.result.suggestions,
      missingElements: result.result.missingElements,
      validatedAt: result.validatedAt,
      attemptNumber: result.attemptNumber
    });
  } catch (error) {
    console.error('Get validation status error:', error);
    return res.status(500).json({ error: 'Failed to get validation status' });
  }
};

/**
 * Get latest validation status (query params version)
 * Called by client: GET /api/webhooks/validation/latest?submissionId=X&standardCode=Y&specCode=Z
 */
export const getLatestValidation = async (req: Request, res: Response) => {
  try {
    const { submissionId, standardCode, specCode } = req.query;

    if (!submissionId || !standardCode) {
      return res.status(400).json({ error: 'Missing required query params: submissionId, standardCode' });
    }

    const result = await validationService.getLatestValidation(
      submissionId as string,
      standardCode as string,
      specCode as string | undefined
    );

    if (!result) {
      return res.status(404).json({ status: 'not_validated' });
    }

    return res.json({
      _id: result._id,
      submissionId: result.submissionId,
      standardCode: result.standardCode,
      specCode: result.specCode,
      validationType: result.validationType,
      result: result.result,
      attemptNumber: result.attemptNumber,
      createdAt: result.createdAt
    });
  } catch (error) {
    console.error('Get latest validation error:', error);
    return res.status(500).json({ error: 'Failed to get validation status' });
  }
};

/**
 * Get validation summary for a standard
 * Called by client: GET /api/webhooks/validation/standard/:submissionId/:standardCode
 */
export const getStandardValidation = async (req: Request, res: Response) => {
  try {
    const { submissionId, standardCode } = req.params;

    // Get all validations for this standard
    const validations = await validationService.getValidationsForStandard(
      submissionId,
      standardCode
    );

    // Calculate summary
    const passCount = validations.filter(v => v.result.status === 'pass').length;
    const failCount = validations.filter(v => v.result.status === 'fail').length;
    const pendingCount = validations.filter(v => v.result.status === 'pending').length;

    return res.json({
      standardCode,
      totalSpecs: validations.length,
      passCount,
      failCount,
      pendingCount,
      validations: validations.map(v => ({
        specCode: v.specCode,
        status: v.result.status,
        score: v.result.score,
        validatedAt: v.validatedAt
      }))
    });
  } catch (error) {
    console.error('Get standard validation error:', error);
    return res.status(500).json({ error: 'Failed to get standard validation' });
  }
};

/**
 * Get all failed sections for a submission
 */
export const getFailedSections = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCodes } = req.query;

    const codes = standardCodes
      ? (standardCodes as string).split(',')
      : undefined;

    const failedSections = await validationService.getFailedSections(submissionId, codes);

    return res.json({
      count: failedSections.length,
      sections: failedSections.map(s => ({
        standardCode: s.standardCode,
        specCode: s.specCode,
        status: s.result.status,
        feedback: s.result.feedback,
        validatedAt: s.validatedAt
      }))
    });
  } catch (error) {
    console.error('Get failed sections error:', error);
    return res.status(500).json({ error: 'Failed to get failed sections' });
  }
};


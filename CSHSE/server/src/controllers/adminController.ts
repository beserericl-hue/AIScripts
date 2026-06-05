import { Request, Response } from 'express';
import { WebhookSettings } from '../models/WebhookSettings';
import { Submission } from '../models/Submission';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { ValidationResult } from '../models/ValidationResult';
import { User } from '../models/User';
import { Review } from '../models/Review';
import * as gridFsService from '../services/gridFsService';
import axios from 'axios';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    isSuperuser?: boolean;
  };
}

/**
 * Get webhook settings
 */
export const getWebhookSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only admins can access
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let settings = await WebhookSettings.findOne({ settingType: 'n8n_validation' });

    if (!settings) {
      // Return default settings
      return res.json({
        settingType: 'n8n_validation',
        webhookUrl: '',
        isActive: false,
        authentication: {
          type: 'api_key',
          apiKey: ''
        },
        callbackUrl: '',
        retryConfig: {
          maxRetries: 3,
          retryDelayMs: 1000,
          backoffMultiplier: 2
        }
      });
    }

    // Mask the API key for security
    const maskedSettings = {
      ...settings.toObject(),
      authentication: {
        ...settings.authentication,
        apiKey: settings.authentication?.apiKey
          ? `${'*'.repeat(20)}${settings.authentication.apiKey.slice(-4)}`
          : ''
      }
    };

    return res.json(maskedSettings);
  } catch (error) {
    console.error('Get webhook settings error:', error);
    return res.status(500).json({ error: 'Failed to get webhook settings' });
  }
};

/**
 * Update webhook settings
 */
export const updateWebhookSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only admins can update
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      webhookUrl,
      isActive,
      authentication,
      callbackUrl,
      retryConfig
    } = req.body;

    let settings = await WebhookSettings.findOne({ settingType: 'n8n_validation' });

    if (!settings) {
      settings = new WebhookSettings({
        settingType: 'n8n_validation'
      });
    }

    // Update fields
    if (webhookUrl !== undefined) settings.webhookUrl = webhookUrl;
    if (isActive !== undefined) settings.isActive = isActive;
    if (callbackUrl !== undefined) settings.callbackUrl = callbackUrl;

    // Only update API key if a new one is provided (not masked)
    if (authentication) {
      if (!settings.authentication) {
        settings.authentication = { type: 'api_key' };
      }
      if (authentication.type) settings.authentication.type = authentication.type;
      if (authentication.apiKey && !authentication.apiKey.includes('*')) {
        settings.authentication.apiKey = authentication.apiKey;
      }
    }

    // Update retry config
    if (retryConfig) {
      if (!settings.retryConfig) {
        settings.retryConfig = {};
      }
      if (retryConfig.maxRetries !== undefined) {
        settings.retryConfig.maxRetries = retryConfig.maxRetries;
      }
      if (retryConfig.retryDelayMs !== undefined) {
        settings.retryConfig.retryDelayMs = retryConfig.retryDelayMs;
      }
      if (retryConfig.backoffMultiplier !== undefined) {
        settings.retryConfig.backoffMultiplier = retryConfig.backoffMultiplier;
      }
    }

    await settings.save();

    // Return masked settings
    const maskedSettings = {
      ...settings.toObject(),
      authentication: {
        ...settings.authentication,
        apiKey: settings.authentication?.apiKey
          ? `${'*'.repeat(20)}${settings.authentication.apiKey.slice(-4)}`
          : ''
      }
    };

    return res.json({
      message: 'Settings updated successfully',
      settings: maskedSettings
    });
  } catch (error) {
    console.error('Update webhook settings error:', error);
    return res.status(500).json({ error: 'Failed to update webhook settings' });
  }
};

/**
 * Test webhook connection
 */
export const testWebhookConnection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only admins can test
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { webhookUrl, authentication } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (authentication?.apiKey && !authentication.apiKey.includes('*')) {
      if (authentication.type === 'bearer') {
        headers['Authorization'] = `Bearer ${authentication.apiKey}`;
      } else {
        headers['X-API-Key'] = authentication.apiKey;
      }
    } else {
      // Try to get existing API key from settings
      const settings = await WebhookSettings.findOne({ settingType: 'n8n_validation' });
      if (settings?.authentication?.apiKey) {
        if (settings.authentication.type === 'bearer') {
          headers['Authorization'] = `Bearer ${settings.authentication.apiKey}`;
        } else {
          headers['X-API-Key'] = settings.authentication.apiKey;
        }
      }
    }

    // Send test request
    const startTime = Date.now();
    try {
      const response = await axios.post(
        webhookUrl,
        {
          test: true,
          timestamp: new Date().toISOString(),
          message: 'CSHSE webhook connection test'
        },
        {
          headers,
          timeout: 10000 // 10 second timeout
        }
      );

      const latency = Date.now() - startTime;

      return res.json({
        success: true,
        message: 'Connection successful',
        latency,
        statusCode: response.status,
        response: response.data
      });
    } catch (axiosError: any) {
      const latency = Date.now() - startTime;

      if (axiosError.response) {
        // Server responded with error status
        return res.json({
          success: false,
          message: `Server returned error: ${axiosError.response.status}`,
          latency,
          statusCode: axiosError.response.status,
          error: axiosError.response.data
        });
      } else if (axiosError.code === 'ECONNREFUSED') {
        return res.json({
          success: false,
          message: 'Connection refused. Check if the server is running.',
          latency
        });
      } else if (axiosError.code === 'ETIMEDOUT') {
        return res.json({
          success: false,
          message: 'Connection timed out.',
          latency
        });
      } else {
        return res.json({
          success: false,
          message: axiosError.message || 'Unknown error',
          latency
        });
      }
    }
  } catch (error: any) {
    console.error('Test webhook connection error:', error);
    return res.status(500).json({
      error: 'Failed to test connection',
      details: error.message
    });
  }
};

/**
 * Get system health and stats
 */
export const getSystemStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only admins can access
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }


    const [
      totalSubmissions,
      activeSubmissions,
      totalUsers,
      totalReviews,
      totalValidations,
      webhookSettings
    ] = await Promise.all([
      Submission.countDocuments(),
      Submission.countDocuments({ status: { $in: ['in_progress', 'submitted'] } }),
      User.countDocuments(),
      Review.countDocuments(),
      ValidationResult.countDocuments(),
      WebhookSettings.findOne({ settingType: 'n8n_validation' })
    ]);

    return res.json({
      submissions: {
        total: totalSubmissions,
        active: activeSubmissions
      },
      users: totalUsers,
      reviews: totalReviews,
      validations: totalValidations,
      webhook: {
        configured: !!webhookSettings?.webhookUrl,
        active: webhookSettings?.isActive || false
      },
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    return res.status(500).json({ error: 'Failed to get system stats' });
  }
};

/**
 * Delete all self-study data for an institution
 * SUPERUSER ONLY - Destructive operation
 */
export const deleteInstitutionData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only superusers can perform this action
    if (!req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Superuser access required' });
    }

    const { institutionId } = req.params;

    if (!institutionId) {
      return res.status(400).json({ error: 'Institution ID is required' });
    }

    console.log(`[AdminController] Deleting all self-study data for institution: ${institutionId}`);

    // Find all submissions for this institution
    const submissions = await Submission.find({ institutionId });
    const submissionIds = submissions.map(s => s._id);

    console.log(`[AdminController] Found ${submissions.length} submissions to delete`);

    // Delete related data
    const deleteResults = {
      submissions: 0,
      imports: 0,
      matrices: 0,
      validations: 0,
      gridFsFiles: 0
    };

    // 1. Delete all imports for these submissions (including GridFS data)
    if (submissionIds.length > 0) {
      // First, find all imports to get their IDs for GridFS cleanup
      const imports = await SelfStudyImport.find({
        submissionId: { $in: submissionIds }
      }).select('_id');

      // Delete GridFS content for each import
      for (const imp of imports) {
        const importId = imp._id.toString();
        try {
          await gridFsService.deleteHtmlContent(importId);
          await gridFsService.deleteImportImages(importId);
          deleteResults.gridFsFiles++;
        } catch (gridFsError) {
          console.error(`[AdminController] Error deleting GridFS data for import ${importId}:`, gridFsError);
          // Continue with other deletions even if one fails
        }
      }
      console.log(`[AdminController] Deleted GridFS data for ${deleteResults.gridFsFiles} imports`);

      // Now delete the import documents
      const importsResult = await SelfStudyImport.deleteMany({
        submissionId: { $in: submissionIds }
      });
      deleteResults.imports = importsResult.deletedCount;
      console.log(`[AdminController] Deleted ${deleteResults.imports} imports`);

      // 2. Delete all curriculum matrices for these submissions
      const matricesResult = await CurriculumMatrix.deleteMany({
        submissionId: { $in: submissionIds }
      });
      deleteResults.matrices = matricesResult.deletedCount;
      console.log(`[AdminController] Deleted ${deleteResults.matrices} matrices`);

      // 3. Delete all validation results for these submissions
      const validationsResult = await ValidationResult.deleteMany({
        submissionId: { $in: submissionIds }
      });
      deleteResults.validations = validationsResult.deletedCount;
      console.log(`[AdminController] Deleted ${deleteResults.validations} validations`);
    }

    // 4. Delete all submissions for this institution
    const submissionsResult = await Submission.deleteMany({ institutionId });
    deleteResults.submissions = submissionsResult.deletedCount;
    console.log(`[AdminController] Deleted ${deleteResults.submissions} submissions`);

    console.log(`[AdminController] Delete operation complete:`, deleteResults);

    return res.json({
      success: true,
      message: 'Self-study data deleted successfully',
      deleted: deleteResults
    });
  } catch (error) {
    console.error('Delete institution data error:', error);
    return res.status(500).json({ error: 'Failed to delete institution data' });
  }
};

/**
 * Clean up orphaned GridFS files
 * SUPERUSER ONLY - Finds and deletes GridFS files whose associated import no longer exists
 */
export const cleanupOrphanedGridFsFiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only superusers can perform this action
    if (!req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Superuser access required' });
    }

    const dryRun = req.query.dryRun === 'true';

    console.log(`[AdminController] Starting GridFS cleanup (dryRun: ${dryRun})`);

    const result = await gridFsService.cleanupOrphanedFiles(dryRun);

    const message = dryRun
      ? `Dry run complete: Would delete ${result.orphanedHtmlFiles} HTML files and ${result.orphanedImageFiles} images (${(result.totalBytesFreed / 1024 / 1024).toFixed(2)} MB)`
      : `Cleanup complete: Deleted ${result.orphanedHtmlFiles} HTML files and ${result.orphanedImageFiles} images (${(result.totalBytesFreed / 1024 / 1024).toFixed(2)} MB freed)`;

    console.log(`[AdminController] ${message}`);

    return res.json({
      success: true,
      dryRun,
      message,
      ...result,
      totalMBFreed: parseFloat((result.totalBytesFreed / 1024 / 1024).toFixed(2))
    });
  } catch (error) {
    console.error('GridFS cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup orphaned files' });
  }
};

/**
 * Get GridFS storage statistics
 * SUPERUSER ONLY
 */
export const getGridFsStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only superusers can access
    if (!req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Superuser access required' });
    }

    const stats = await gridFsService.getStorageStats();

    return res.json({
      htmlContent: {
        fileCount: stats.fileCount,
        totalSizeBytes: stats.totalSize,
        totalSizeMB: parseFloat((stats.totalSize / 1024 / 1024).toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get GridFS stats error:', error);
    return res.status(500).json({ error: 'Failed to get storage stats' });
  }
};

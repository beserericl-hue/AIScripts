import { Request, Response } from 'express';
import { WebhookSettings } from '../models/WebhookSettings';
import axios from 'axios';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
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

    // Import models dynamically to avoid circular dependencies
    const { Submission } = await import('../models/Submission');
    const { User } = await import('../models/User');
    const { Review } = await import('../models/Review');
    const { ValidationResult } = await import('../models/ValidationResult');

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

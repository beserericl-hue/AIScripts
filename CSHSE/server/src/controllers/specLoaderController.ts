import { Request, Response } from 'express';
import mongoose from 'mongoose';
import FormData from 'form-data';
import { Spec } from '../models/Spec';
import { File } from '../models/File';
import { WebhookSettings } from '../models/WebhookSettings';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Construct callback URL from request headers
 */
function getCallbackUrl(req: Request, callbackPath: string): string {
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.get('host');
  return `${protocol}://${host}${callbackPath}`;
}

/**
 * Trigger loading a spec document to AI via n8n
 */
export const triggerSpecLoad = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Find the spec
    const spec = await Spec.findById(id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    // Check if spec has a document file
    if (!spec.documentFileId) {
      return res.status(400).json({ error: 'Spec does not have an uploaded document. Please upload a PDF first.' });
    }

    // Get the file binary
    const file = await File.findById(spec.documentFileId);
    if (!file) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    // Check file type is PDF
    if (file.mimeType !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF documents can be loaded to AI' });
    }

    // Get webhook settings for spec_loader
    const webhookSettings = await WebhookSettings.findOne({ settingType: 'spec_loader' });
    if (!webhookSettings || !webhookSettings.webhookUrl) {
      return res.status(400).json({ error: 'Spec Loader webhook URL is not configured. Please configure it in Settings.' });
    }
    if (!webhookSettings.isActive) {
      return res.status(400).json({ error: 'Spec Loader webhook is configured but not enabled. Please enable it in Settings.' });
    }

    // Update spec status to loading
    spec.aiLoadingStatus = 'loading';
    spec.aiLoadError = undefined;
    await spec.save();

    // Construct callback URL
    const callbackUrl = getCallbackUrl(req, '/api/webhooks/spec-loader/callback');

    // Create form data with the PDF binary
    const formData = new FormData();
    formData.append('data', file.data, {
      filename: file.originalName,
      contentType: file.mimeType
    });
    formData.append('specId', spec._id.toString());
    formData.append('specName', spec.name);
    formData.append('specVersion', spec.version);
    formData.append('callbackUrl', callbackUrl);

    // Build headers
    const headers: Record<string, string> = {
      ...formData.getHeaders()
    };

    if (webhookSettings.authentication?.type === 'api_key' && webhookSettings.authentication.apiKey) {
      headers['X-API-Key'] = webhookSettings.authentication.apiKey;
    } else if (webhookSettings.authentication?.type === 'bearer' && webhookSettings.authentication.bearerToken) {
      headers['Authorization'] = `Bearer ${webhookSettings.authentication.bearerToken}`;
    }

    // Send to n8n webhook
    const response = await fetch(webhookSettings.webhookUrl, {
      method: 'POST',
      headers,
      body: formData as any,
      signal: AbortSignal.timeout(webhookSettings.timeoutMs)
    });

    if (!response.ok) {
      const errorText = await response.text();
      spec.aiLoadingStatus = 'error';
      spec.aiLoadError = `n8n returned ${response.status}: ${errorText}`;
      await spec.save();
      return res.status(502).json({ error: 'Failed to send document to AI', details: errorText });
    }

    return res.json({
      success: true,
      message: 'Spec document sent to AI for loading',
      specId: spec._id,
      status: 'loading'
    });
  } catch (error) {
    console.error('Trigger spec load error:', error);

    // Try to update spec status to error
    try {
      const { id } = req.params;
      await Spec.findByIdAndUpdate(id, {
        aiLoadingStatus: 'error',
        aiLoadError: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (updateError) {
      console.error('Failed to update spec error status:', updateError);
    }

    return res.status(500).json({ error: 'Failed to trigger spec load' });
  }
};

/**
 * Receive callback from n8n when spec loading is complete
 */
export const receiveSpecLoaderCallback = async (req: Request, res: Response) => {
  try {
    const { specId, status, error: loadError } = req.body;

    if (!specId) {
      return res.status(400).json({ error: 'Missing specId in callback' });
    }

    const spec = await Spec.findById(specId);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    if (status === 'success' || status === 'loaded') {
      spec.aiLoadingStatus = 'loaded';
      spec.aiLoadedAt = new Date();
      spec.aiLoadError = undefined;
    } else if (status === 'error' || status === 'failed') {
      spec.aiLoadingStatus = 'error';
      spec.aiLoadError = loadError || 'Unknown error from AI service';
    } else {
      // Default to loaded if status is unclear but we got a callback
      spec.aiLoadingStatus = 'loaded';
      spec.aiLoadedAt = new Date();
    }

    await spec.save();

    return res.json({
      success: true,
      specId: spec._id,
      status: spec.aiLoadingStatus
    });
  } catch (error) {
    console.error('Spec loader callback error:', error);
    return res.status(500).json({ error: 'Failed to process callback' });
  }
};

/**
 * Get spec AI loading status
 */
export const getSpecAIStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const spec = await Spec.findById(id).select('aiLoadingStatus aiLoadedAt aiLoadError');
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    return res.json({
      specId: spec._id,
      aiLoadingStatus: spec.aiLoadingStatus,
      aiLoadedAt: spec.aiLoadedAt,
      aiLoadError: spec.aiLoadError
    });
  } catch (error) {
    console.error('Get spec AI status error:', error);
    return res.status(500).json({ error: 'Failed to get spec AI status' });
  }
};

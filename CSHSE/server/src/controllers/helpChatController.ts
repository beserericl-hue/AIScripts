import { Request, Response } from 'express';
import { WebhookSettings } from '../models/WebhookSettings';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Check if help chat is available (webhook configured and active).
 * Lightweight endpoint for any authenticated user.
 */
export const getHelpChatStatus = async (_req: Request, res: Response) => {
  try {
    const setting = await WebhookSettings.findOne({
      settingType: 'help_chat',
      isActive: true
    });
    return res.json({ available: !!setting });
  } catch {
    return res.json({ available: false });
  }
};

/**
 * Upload a help document to the N8N vectorization webhook.
 * Uses the callbackUrl field from help_chat settings as the upload endpoint.
 */
export const uploadHelpDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { source, title } = req.body;

    const webhookSettings = await WebhookSettings.findOne({
      settingType: 'help_chat',
      isActive: true
    });

    if (!webhookSettings?.callbackUrl) {
      return res.status(503).json({
        error: 'Help document upload webhook URL is not configured. Set the Upload URL in Help Chat settings.'
      });
    }

    // Build multipart form data to forward to N8N using native FormData
    const formData = new globalThis.FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    formData.append('source', source || 'handbook');
    formData.append('title', title || file.originalname);

    const response = await fetch(webhookSettings.callbackUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000) // 2 min timeout for large files
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[HelpUpload] N8N error:', response.status, errorText);
      return res.status(502).json({
        error: 'Failed to upload document to help system.'
      });
    }

    const data = await response.json() as any;

    return res.json({
      success: true,
      fileName: file.originalname,
      fileSize: file.size,
      source: source || 'handbook',
      message: data.message || 'Document uploaded and processed successfully'
    });
  } catch (error) {
    console.error('[HelpUpload] Error:', error);
    return res.status(500).json({ error: 'Failed to upload help document' });
  }
};

/**
 * Send a chat question to the N8N Help Chat webhook.
 * Proxies the request so the N8N URL stays server-side.
 */
export const sendChatMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question, sessionId } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const webhookSettings = await WebhookSettings.findOne({
      settingType: 'help_chat',
      isActive: true
    });

    if (!webhookSettings) {
      return res.status(503).json({
        error: 'Help chat is not configured. Please contact an administrator.'
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(webhookSettings.headers ? Object.fromEntries(webhookSettings.headers as any) : {})
    };

    if (webhookSettings.authentication?.type === 'api_key' && webhookSettings.authentication.apiKey) {
      headers['X-API-Key'] = webhookSettings.authentication.apiKey;
    } else if (webhookSettings.authentication?.type === 'bearer' && webhookSettings.authentication.bearerToken) {
      headers['Authorization'] = `Bearer ${webhookSettings.authentication.bearerToken}`;
    }

    const response = await fetch(webhookSettings.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: question.trim(),
        sessionId: sessionId || `${req.user?.id}-${Date.now()}`,
        userId: req.user?.id,
        userRole: req.user?.role,
        userName: `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim()
      }),
      signal: AbortSignal.timeout(webhookSettings.timeoutMs || 30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[HelpChat] N8N error:', response.status, errorText);
      return res.status(502).json({
        error: 'Help service temporarily unavailable. Please try again.'
      });
    }

    const data = await response.json() as { answer?: string; sources?: string[] };

    return res.json({
      answer: data.answer || 'I could not find an answer to your question.',
      sources: data.sources || []
    });
  } catch (error) {
    console.error('[HelpChat] Error:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return res.status(504).json({
        error: 'The help service took too long to respond. Please try again.'
      });
    }

    return res.status(500).json({ error: 'Failed to process help request' });
  }
};

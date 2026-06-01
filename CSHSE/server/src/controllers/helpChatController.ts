import { Request, Response } from 'express';
import crypto from 'crypto';
import { WebhookSettings } from '../models/WebhookSettings';
import { HelpDocument } from '../models/HelpDocument';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    firstName?: string;
    lastName?: string;
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
 * Creates a DB record to track status and sends callbackUrl for completion notification.
 */
export const uploadHelpDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { source, title } = req.body;

    const webhookSettings = await WebhookSettings.findOne({
      settingType: 'help_upload',
      isActive: true
    });

    if (!webhookSettings?.webhookUrl) {
      return res.status(503).json({
        error: 'Help document upload webhook is not configured. Set up the Help Document Upload webhook in Superuser Settings.'
      });
    }

    // Create DB record with status 'processing'
    const helpDoc = await HelpDocument.create({
      fileName: file.originalname,
      fileSize: file.size,
      source: source || 'handbook',
      title: title || file.originalname,
      status: 'processing',
      uploadedBy: req.user?.id
    });

    // Construct callback URL for n8n to notify on completion
    const callbackUrl = getCallbackUrl(req, '/api/webhooks/help/upload/callback');

    // Send as JSON with base64-encoded file data (matches spec loader pattern)
    const base64Data = file.buffer.toString('base64');
    const payload = {
      data: base64Data,
      filename: file.originalname,
      mimeType: file.mimetype,
      source: source || 'handbook',
      title: title || file.originalname,
      docId: helpDoc._id.toString(),
      callbackUrl,
      callbackToken: helpDoc.callbackToken
    };

    console.log('[HelpUpload] Sending to n8n:', {
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      docId: helpDoc._id.toString(),
      callbackUrl
    });

    const response = await fetch(webhookSettings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[HelpUpload] N8N error:', response.status, errorText);
      helpDoc.status = 'error';
      helpDoc.error = `n8n returned ${response.status}: ${errorText}`;
      await helpDoc.save();
      return res.status(502).json({
        error: 'Failed to upload document to help system.'
      });
    }

    return res.json({
      success: true,
      docId: helpDoc._id,
      fileName: file.originalname,
      fileSize: file.size,
      source: source || 'handbook',
      status: 'processing',
      message: 'Document upload started. Processing in background.'
    });
  } catch (error) {
    console.error('[HelpUpload] Error:', error);
    return res.status(500).json({ error: 'Failed to upload help document' });
  }
};

/**
 * Receive callback from n8n when help document vectorization is complete
 */
export const receiveHelpUploadCallback = async (req: Request, res: Response) => {
  try {
    console.log('[HelpUpload Callback] Received:', JSON.stringify(req.body));
    const { docId, callbackToken, status, error: loadError } = req.body;

    if (!docId) {
      return res.status(400).json({ error: 'Missing docId in callback' });
    }

    const helpDoc = await HelpDocument.findById(docId);
    if (!helpDoc) {
      return res.status(404).json({ error: 'Help document not found' });
    }

    // Verify callback token to prevent unauthorized status updates
    if (!callbackToken || callbackToken !== helpDoc.callbackToken) {
      console.warn('[HelpUpload Callback] Invalid callback token for doc', docId);
      return res.status(403).json({ error: 'Invalid callback token' });
    }

    if (status === 'success' || status === 'loaded' || status === 'completed') {
      helpDoc.status = 'loaded';
      helpDoc.completedAt = new Date();
      helpDoc.error = undefined;
    } else if (status === 'error' || status === 'failed') {
      helpDoc.status = 'error';
      helpDoc.error = loadError || 'Unknown error from vectorization service';
    } else {
      helpDoc.status = 'loaded';
      helpDoc.completedAt = new Date();
    }

    await helpDoc.save();
    console.log('[HelpUpload Callback] Updated doc', docId, 'to status:', helpDoc.status);

    return res.json({ success: true, docId, status: helpDoc.status });
  } catch (error) {
    console.error('[HelpUpload Callback] Error:', error);
    return res.status(500).json({ error: 'Failed to process callback' });
  }
};

/**
 * Get all help documents (DB-backed list replacing localStorage)
 */
export const getHelpDocuments = async (_req: Request, res: Response) => {
  try {
    const docs = await HelpDocument.find().select('-callbackToken').sort({ uploadedAt: -1 });
    console.log(`[HelpDocuments] Returning ${docs.length} documents`);
    return res.json(docs);
  } catch (error) {
    console.error('[HelpDocuments] Error fetching documents:', error);
    return res.status(500).json({ error: 'Failed to get help documents' });
  }
};

/**
 * Delete a help document record (does not remove from vector store)
 */
export const deleteHelpDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await HelpDocument.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ error: 'Help document not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('[HelpDocuments] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete help document' });
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

    // CR-054 (audit C5) — the n8n help-chat agent keys its Redis chat memory on
    // the sessionId we forward. Previously the raw client-supplied sessionId was
    // passed straight through, so anyone reusing/guessing another user's
    // sessionId could read their chat history. Bind the forwarded session to the
    // authenticated user: a per-user hash of (userId + client sessionId). The
    // client sessionId still scopes separate conversations within one user, but
    // it can never cross the user boundary.
    const clientSession = typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : 'default';
    const boundSessionId = crypto
      .createHash('sha256')
      .update(`${req.user?.id || 'anon'}:${clientSession}`)
      .digest('hex');

    const response = await fetch(webhookSettings.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: question.trim(),
        sessionId: boundSessionId,
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

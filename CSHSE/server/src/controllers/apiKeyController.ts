import { Request, Response } from 'express';
import { APIKey } from '../models/APIKey';
import crypto from 'crypto';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Get all API keys (Admin only)
 */
export const getAPIKeys = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { purpose, isActive, page = '1', limit = '50' } = req.query;

    const query: any = {};
    if (purpose) query.purpose = purpose;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [apiKeys, total] = await Promise.all([
      APIKey.find(query)
        .select('-keyHash')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      APIKey.countDocuments(query)
    ]);

    // Add masked key to each result
    const keysWithMasked = apiKeys.map(key => ({
      ...key,
      keyMasked: `${key.keyPrefix}****************************${key.keySuffix}`
    }));

    return res.json({
      apiKeys: keysWithMasked,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    return res.status(500).json({ error: 'Failed to get API keys' });
  }
};

/**
 * Create a new API key (Admin only)
 */
export const createAPIKey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, purpose, permissions, expiresInDays, description, ipWhitelist, rateLimit } = req.body;

    // Generate the key
    const randomPart = crypto.randomBytes(24).toString('base64url');
    const key = `cshse_${randomPart}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keySuffix = key.slice(-4);

    // Calculate expiration
    let expiresAt;
    if (expiresInDays) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    const apiKey = new APIKey({
      name,
      keyPrefix: 'cshse_',
      keyHash,
      keySuffix,
      purpose,
      permissions: permissions || ['webhook:callback'],
      isActive: true,
      expiresAt,
      createdBy: req.user!.id,
      createdByName: req.user!.name,
      metadata: {
        description,
        ipWhitelist,
        rateLimit
      }
    });

    await apiKey.save();

    return res.status(201).json({
      message: 'API key created successfully',
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        key, // Return full key only once
        keyMasked: `cshse_****************************${keySuffix}`,
        purpose: apiKey.purpose,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt
      },
      warning: 'Store this API key securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return res.status(500).json({ error: 'Failed to create API key' });
  }
};

/**
 * Get single API key details (Admin only)
 */
export const getAPIKey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const apiKey = await APIKey.findById(id)
      .select('-keyHash')
      .populate('createdBy', 'firstName lastName')
      .lean();

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    return res.json({
      ...apiKey,
      keyMasked: `${apiKey.keyPrefix}****************************${apiKey.keySuffix}`
    });
  } catch (error) {
    console.error('Get API key error:', error);
    return res.status(500).json({ error: 'Failed to get API key' });
  }
};

/**
 * Revoke an API key (Admin only)
 */
export const revokeAPIKey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const apiKey = await APIKey.findById(id);
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (!apiKey.isActive) {
      return res.status(400).json({ error: 'API key is already revoked' });
    }

    apiKey.isActive = false;
    apiKey.revokedAt = new Date();
    apiKey.revokedBy = req.user!.id as any;
    apiKey.revokedReason = reason;

    await apiKey.save();

    return res.json({
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return res.status(500).json({ error: 'Failed to revoke API key' });
  }
};

/**
 * Rotate an API key (generates new, revokes old) (Admin only)
 */
export const rotateAPIKey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const oldKey = await APIKey.findById(id);
    if (!oldKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (!oldKey.isActive) {
      return res.status(400).json({ error: 'Cannot rotate a revoked key' });
    }

    // Generate new key
    const randomPart = crypto.randomBytes(24).toString('base64url');
    const key = `cshse_${randomPart}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keySuffix = key.slice(-4);

    // Create new key with same settings
    const newApiKey = new APIKey({
      name: oldKey.name,
      keyPrefix: 'cshse_',
      keyHash,
      keySuffix,
      purpose: oldKey.purpose,
      permissions: oldKey.permissions,
      isActive: true,
      expiresAt: oldKey.expiresAt,
      createdBy: req.user!.id,
      createdByName: req.user!.name,
      metadata: oldKey.metadata
    });

    await newApiKey.save();

    // Revoke old key
    oldKey.isActive = false;
    oldKey.revokedAt = new Date();
    oldKey.revokedBy = req.user!.id as any;
    oldKey.revokedReason = 'Rotated';
    await oldKey.save();

    return res.json({
      message: 'API key rotated successfully',
      apiKey: {
        id: newApiKey._id,
        name: newApiKey.name,
        key, // Return full key only once
        keyMasked: `cshse_****************************${keySuffix}`,
        purpose: newApiKey.purpose,
        permissions: newApiKey.permissions,
        expiresAt: newApiKey.expiresAt
      },
      oldKeyId: oldKey._id,
      warning: 'Store this API key securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('Rotate API key error:', error);
    return res.status(500).json({ error: 'Failed to rotate API key' });
  }
};

/**
 * Verify API key (internal use for middleware)
 */
export const verifyAPIKeyMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    const apiKey = req.headers['x-api-key'] as string ||
                   (req.headers['authorization']?.startsWith('Bearer ')
                     ? req.headers['authorization'].slice(7)
                     : null);

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const key = await APIKey.findOne({ keyHash, isActive: true });

    if (!key) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    // Update usage stats
    key.lastUsedAt = new Date();
    key.usageCount += 1;
    await key.save();

    // Attach key info to request
    (req as any).apiKey = {
      id: key._id,
      name: key.name,
      purpose: key.purpose,
      permissions: key.permissions
    };

    next();
  } catch (error) {
    console.error('API key verification error:', error);
    return res.status(500).json({ error: 'Failed to verify API key' });
  }
};

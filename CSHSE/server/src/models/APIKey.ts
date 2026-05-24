import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export type APIKeyPurpose = 'webhook_callback' | 'webhook_outbound' | 'api_access' | 'integration';
export type APIKeyPermission =
  | 'webhook:callback'
  | 'webhook:outbound'
  | 'submissions:read'
  | 'submissions:write'
  | 'validations:read'
  | 'validations:write';

// CR-042: Phase A. `general-api` keys are everything legacy (webhooks, n8n, etc.);
// `sso-login` keys are only valid against /api/v1/auth/sso-* routes.
export type APIKeyScope = 'general-api' | 'sso-login';

export type APIKeyAllowedRole = 'program_coordinator' | 'reader' | 'lead_reader' | 'admin';

export interface IAPIKey extends Document {
  name: string;
  keyPrefix: string;
  keyHash: string;
  keySuffix: string; // Last 4 characters for identification

  purpose: APIKeyPurpose;
  permissions: APIKeyPermission[];

  // CR-042
  scope: APIKeyScope;
  autoProvision: boolean;
  allowedRoles?: APIKeyAllowedRole[];

  isActive: boolean;
  expiresAt?: Date;

  lastUsedAt?: Date;
  usageCount: number;

  createdBy: mongoose.Types.ObjectId;
  createdByName: string;

  revokedAt?: Date;
  revokedBy?: mongoose.Types.ObjectId;
  revokedReason?: string;

  metadata?: {
    description?: string;
    ipWhitelist?: string[];
    rateLimit?: number;
  };

  createdAt: Date;
  updatedAt: Date;

  // Methods
  isExpired(): boolean;
  getMaskedKey(): string;
}

const APIKeySchema = new Schema<IAPIKey>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  keyPrefix: {
    type: String,
    required: true,
    default: 'cshse_'
  },
  keyHash: {
    type: String,
    required: true,
    unique: true
  },
  keySuffix: {
    type: String,
    required: true
  },

  purpose: {
    type: String,
    enum: ['webhook_callback', 'webhook_outbound', 'api_access', 'integration'],
    required: true
  },
  permissions: [{
    type: String,
    enum: [
      'webhook:callback',
      'webhook:outbound',
      'submissions:read',
      'submissions:write',
      'validations:read',
      'validations:write'
    ]
  }],

  // CR-042
  scope: {
    type: String,
    enum: ['general-api', 'sso-login'],
    default: 'general-api',
    required: true,
    index: true
  },
  autoProvision: {
    type: Boolean,
    default: false
  },
  allowedRoles: [{
    type: String,
    enum: ['program_coordinator', 'reader', 'lead_reader', 'admin']
  }],

  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: Date,

  lastUsedAt: Date,
  usageCount: {
    type: Number,
    default: 0
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByName: {
    type: String,
    required: true
  },

  revokedAt: Date,
  revokedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  revokedReason: String,

  metadata: {
    description: String,
    ipWhitelist: [String],
    rateLimit: Number
  }
}, {
  timestamps: true
});

// Indexes
APIKeySchema.index({ keyHash: 1 });
APIKeySchema.index({ purpose: 1 });
APIKeySchema.index({ isActive: 1 });
APIKeySchema.index({ createdBy: 1 });
APIKeySchema.index({ expiresAt: 1 });

// Check if key is expired
APIKeySchema.methods.isExpired = function(): boolean {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
};

// Get masked key for display
APIKeySchema.methods.getMaskedKey = function(): string {
  return `${this.keyPrefix}****************************${this.keySuffix}`;
};

// Static method to generate a new API key
APIKeySchema.statics.generateKey = function(): { key: string; hash: string; suffix: string } {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const key = `cshse_${randomPart}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const suffix = key.slice(-4);
  return { key, hash, suffix };
};

// Static method to verify an API key
APIKeySchema.statics.verifyKey = async function(key: string) {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const apiKey = await this.findOne({ keyHash: hash, isActive: true });

  if (!apiKey) return null;
  if (apiKey.isExpired()) return null;

  // Update usage stats
  apiKey.lastUsedAt = new Date();
  apiKey.usageCount += 1;
  await apiKey.save();

  return apiKey;
};

export const APIKey = mongoose.model<IAPIKey>('APIKey', APIKeySchema);

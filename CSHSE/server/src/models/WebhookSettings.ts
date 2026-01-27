import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookAuthentication {
  type: 'none' | 'api_key' | 'bearer';
  apiKey?: string;
  bearerToken?: string;
}

export interface IRetryConfig {
  maxRetries: number;
  retryDelayMs: number;
}

export type WebhookSettingType = 'n8n_validation' | 'notification' | 'lead_reader_notification' | 'spec_loader' | 'document_matcher';

export interface IWebhookSettings extends Document {
  settingType: WebhookSettingType;
  name: string;
  description?: string;
  webhookUrl: string;
  isActive: boolean;
  authentication?: IWebhookAuthentication;
  retryConfig: IRetryConfig;
  callbackUrl?: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
}

const WebhookAuthenticationSchema = new Schema<IWebhookAuthentication>({
  type: {
    type: String,
    enum: ['none', 'api_key', 'bearer'],
    default: 'none'
  },
  apiKey: String,
  bearerToken: String
}, { _id: false });

const RetryConfigSchema = new Schema<IRetryConfig>({
  maxRetries: { type: Number, default: 3, min: 0, max: 10 },
  retryDelayMs: { type: Number, default: 1000, min: 100, max: 60000 }
}, { _id: false });

const WebhookSettingsSchema = new Schema<IWebhookSettings>({
  settingType: {
    type: String,
    enum: ['n8n_validation', 'notification', 'lead_reader_notification', 'spec_loader', 'document_matcher'],
    required: true
  },
  name: { type: String, required: true },
  description: String,
  webhookUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Webhook URL must be a valid HTTP/HTTPS URL'
    }
  },
  isActive: { type: Boolean, default: true },
  authentication: {
    type: WebhookAuthenticationSchema,
    default: { type: 'none' }
  },
  retryConfig: {
    type: RetryConfigSchema,
    default: { maxRetries: 3, retryDelayMs: 1000 }
  },
  callbackUrl: {
    type: String,
    validate: {
      validator: function(v: string) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Callback URL must be a valid HTTP/HTTPS URL'
    }
  },
  headers: {
    type: Map,
    of: String,
    default: {}
  },
  timeoutMs: { type: Number, default: 30000, min: 1000, max: 120000 },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Ensure unique setting type (only one webhook per type)
WebhookSettingsSchema.index({ settingType: 1 }, { unique: true });

// Static method to get active webhook by type
WebhookSettingsSchema.statics.getActiveWebhook = async function(
  settingType: WebhookSettingType
) {
  return this.findOne({ settingType, isActive: true });
};

// Method to test webhook connectivity
WebhookSettingsSchema.methods.testConnection = async function(): Promise<{
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTimeMs?: number;
}> {
  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.headers || {})
    };

    if (this.authentication?.type === 'api_key' && this.authentication.apiKey) {
      headers['X-API-Key'] = this.authentication.apiKey;
    } else if (this.authentication?.type === 'bearer' && this.authentication.bearerToken) {
      headers['Authorization'] = `Bearer ${this.authentication.bearerToken}`;
    }

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    return {
      success: response.ok,
      statusCode: response.status,
      responseTimeMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTimeMs: Date.now() - startTime
    };
  }
};

export const WebhookSettings = mongoose.model<IWebhookSettings>('WebhookSettings', WebhookSettingsSchema);

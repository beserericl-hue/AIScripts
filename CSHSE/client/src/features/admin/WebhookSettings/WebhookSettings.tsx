import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Settings,
  Save,
  TestTube,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface WebhookSettingsData {
  settingType: string;
  webhookUrl: string;
  isActive: boolean;
  authentication: {
    type: 'api_key' | 'bearer';
    apiKey: string;
  };
  callbackUrl: string;
  retryConfig: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
  };
}

interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
  statusCode?: number;
  error?: any;
}

/**
 * Admin webhook settings panel for N8N integration
 */
export function WebhookSettings() {
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState<Partial<WebhookSettingsData>>({});
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const { data: settings, isLoading } = useQuery<WebhookSettingsData>({
    queryKey: ['webhook-settings'],
    queryFn: async () => {
      const response = await api.get('/admin/webhook-settings');
      return response.data;
    },
  });

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<WebhookSettingsData>) => {
      const response = await api.put('/admin/webhook-settings', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-settings'] });
      setHasChanges(false);
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/admin/webhook-test', {
        webhookUrl: formData.webhookUrl,
        authentication: formData.authentication,
      });
      return response.data;
    },
    onSuccess: (data: TestResult) => {
      setTestResult(data);
    },
    onError: (error: any) => {
      setTestResult({
        success: false,
        message: error.response?.data?.error || 'Test failed',
      });
    },
  });

  // Handle form change
  const handleChange = (
    field: keyof WebhookSettingsData | string,
    value: any
  ) => {
    setFormData((prev) => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...(prev as any)[parent],
            [child]: value,
          },
        };
      }
      return { ...prev, [field]: value };
    });
    setHasChanges(true);
    setTestResult(null);
  };

  // Handle save
  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  // Handle test
  const handleTest = () => {
    testMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-gray-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              N8N Webhook Settings
            </h2>
            <p className="text-sm text-gray-500">
              Configure the N8N validation webhook integration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {formData.isActive ? (
            <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <Wifi className="w-4 h-4" />
              Active
            </span>
          ) : (
            <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
              <WifiOff className="w-4 h-4" />
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-6">
        {/* Webhook URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Webhook URL *
          </label>
          <input
            type="url"
            value={formData.webhookUrl || ''}
            onChange={(e) => handleChange('webhookUrl', e.target.value)}
            placeholder="https://your-n8n-instance.com/webhook/..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            The N8N webhook URL that will receive validation requests
          </p>
        </div>

        {/* Callback URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Callback URL
          </label>
          <input
            type="url"
            value={formData.callbackUrl || ''}
            onChange={(e) => handleChange('callbackUrl', e.target.value)}
            placeholder="https://your-api.com/api/webhooks/n8n/callback"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            URL where N8N should send validation results back
          </p>
        </div>

        {/* Authentication */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Authentication</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auth Type
              </label>
              <select
                value={formData.authentication?.type || 'api_key'}
                onChange={(e) =>
                  handleChange('authentication.type', e.target.value)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="api_key">API Key (X-API-Key header)</option>
                <option value="bearer">Bearer Token</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key / Token
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.authentication?.apiKey || ''}
                  onChange={(e) =>
                    handleChange('authentication.apiKey', e.target.value)
                  }
                  placeholder="Enter API key..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Retry Configuration */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">
            Retry Configuration
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Retries
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={formData.retryConfig?.maxRetries ?? 3}
                onChange={(e) =>
                  handleChange('retryConfig.maxRetries', parseInt(e.target.value))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retry Delay (ms)
              </label>
              <input
                type="number"
                min="100"
                max="30000"
                step="100"
                value={formData.retryConfig?.retryDelayMs ?? 1000}
                onChange={(e) =>
                  handleChange('retryConfig.retryDelayMs', parseInt(e.target.value))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backoff Multiplier
              </label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.5"
                value={formData.retryConfig?.backoffMultiplier ?? 2}
                onChange={(e) =>
                  handleChange(
                    'retryConfig.backoffMultiplier',
                    parseFloat(e.target.value)
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">
              Enable Webhook
            </h3>
            <p className="text-xs text-gray-500">
              When enabled, validation requests will be sent to the webhook
            </p>
          </div>
          <button
            onClick={() => handleChange('isActive', !formData.isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isActive ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-4 rounded-lg ${
              testResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {testResult.message}
                </p>
                {testResult.latency !== undefined && (
                  <p className="text-sm text-gray-600 mt-1">
                    Latency: {testResult.latency}ms
                    {testResult.statusCode && ` | Status: ${testResult.statusCode}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleTest}
          disabled={!formData.webhookUrl || testMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          Test Connection
        </button>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </button>
        </div>
      </div>

      {/* Save Success */}
      {saveMutation.isSuccess && (
        <div className="mx-6 mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Settings saved successfully</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebhookSettings;

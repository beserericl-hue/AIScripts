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
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  FileText,
  Zap,
  Brain,
} from 'lucide-react';

type WebhookType = 'n8n_validation' | 'spec_loader' | 'document_matcher';

interface WebhookSettingsData {
  id?: string;
  settingType: WebhookType;
  name: string;
  description?: string;
  webhookUrl: string;
  isActive: boolean;
  hasAuthentication?: boolean;
  authenticationType?: string;
  authentication?: {
    type: 'none' | 'api_key' | 'bearer';
    apiKey?: string;
    bearerToken?: string;
  };
  retryConfig: {
    maxRetries: number;
    retryDelayMs: number;
  };
  timeoutMs: number;
}

interface TestResult {
  success: boolean;
  message?: string;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
}

const WEBHOOK_CONFIGS: Record<WebhookType, { label: string; description: string; icon: React.ReactNode }> = {
  n8n_validation: {
    label: 'Section Validation',
    description: 'Validates self-study narrative sections against standards requirements',
    icon: <Zap className="w-5 h-5" />
  },
  spec_loader: {
    label: 'Spec Loader',
    description: 'Loads specification documents (PDF) to AI for intelligent section matching',
    icon: <FileText className="w-5 h-5" />
  },
  document_matcher: {
    label: 'Document Matcher',
    description: 'Analyzes imported documents and suggests standard/spec mappings',
    icon: <Brain className="w-5 h-5" />
  }
};

const WEBHOOK_TYPES: WebhookType[] = ['n8n_validation', 'spec_loader', 'document_matcher'];

/**
 * Admin webhook settings panel for N8N integration
 * Supports multiple webhook types without callback URL configuration
 */
export function WebhookSettings() {
  const queryClient = useQueryClient();
  const [expandedType, setExpandedType] = useState<WebhookType | null>('n8n_validation');
  const [formData, setFormData] = useState<Record<WebhookType, Partial<WebhookSettingsData>>>({
    n8n_validation: {},
    spec_loader: {},
    document_matcher: {}
  });
  const [showApiKey, setShowApiKey] = useState<Record<WebhookType, boolean>>({
    n8n_validation: false,
    spec_loader: false,
    document_matcher: false
  });
  const [testResults, setTestResults] = useState<Record<WebhookType, TestResult | null>>({
    n8n_validation: null,
    spec_loader: null,
    document_matcher: null
  });
  const [hasChanges, setHasChanges] = useState<Record<WebhookType, boolean>>({
    n8n_validation: false,
    spec_loader: false,
    document_matcher: false
  });

  // Fetch all webhook settings
  const { data: allSettings, isLoading } = useQuery<{ settings: WebhookSettingsData[] }>({
    queryKey: ['webhook-settings'],
    queryFn: async () => {
      const response = await api.get('/api/webhooks/settings');
      return response.data;
    },
  });

  // Update form data when settings load
  useEffect(() => {
    if (allSettings?.settings) {
      const newFormData: Record<WebhookType, Partial<WebhookSettingsData>> = {
        n8n_validation: {},
        spec_loader: {},
        document_matcher: {}
      };

      for (const setting of allSettings.settings) {
        if (WEBHOOK_TYPES.includes(setting.settingType as WebhookType)) {
          newFormData[setting.settingType as WebhookType] = {
            ...setting,
            authentication: setting.hasAuthentication ? {
              type: (setting.authenticationType as 'api_key' | 'bearer') || 'api_key',
              apiKey: ''
            } : { type: 'none' }
          };
        }
      }

      setFormData(newFormData);
      setHasChanges({
        n8n_validation: false,
        spec_loader: false,
        document_matcher: false
      });
    }
  }, [allSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ settingType, data }: { settingType: WebhookType; data: Partial<WebhookSettingsData> }) => {
      const config = WEBHOOK_CONFIGS[settingType];
      const response = await api.put('/api/webhooks/settings', {
        settingType,
        name: config.label,
        description: config.description,
        webhookUrl: data.webhookUrl,
        isActive: data.isActive ?? false,
        authentication: data.authentication,
        retryConfig: data.retryConfig || { maxRetries: 3, retryDelayMs: 1000 },
        timeoutMs: data.timeoutMs || 30000
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-settings'] });
      setHasChanges(prev => ({ ...prev, [variables.settingType]: false }));
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async (settingType: WebhookType) => {
      const response = await api.post(`/api/webhooks/settings/${settingType}/test`);
      return response.data;
    },
    onSuccess: (data: TestResult, settingType) => {
      setTestResults(prev => ({
        ...prev,
        [settingType]: {
          ...data,
          message: data.success ? 'Connection successful' : (data.error || 'Connection failed')
        }
      }));
    },
    onError: (error: any, settingType) => {
      setTestResults(prev => ({
        ...prev,
        [settingType]: {
          success: false,
          message: error.response?.data?.error || 'Test failed'
        }
      }));
    },
  });

  // Handle form change for a specific webhook type
  const handleChange = (
    type: WebhookType,
    field: string,
    value: any
  ) => {
    setFormData((prev) => {
      const typeData = prev[type] || {};
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [type]: {
            ...typeData,
            [parent]: {
              ...(typeData as any)[parent],
              [child]: value,
            },
          },
        };
      }
      return { ...prev, [type]: { ...typeData, [field]: value } };
    });
    setHasChanges(prev => ({ ...prev, [type]: true }));
    setTestResults(prev => ({ ...prev, [type]: null }));
  };

  // Handle save for a specific webhook type
  const handleSave = (type: WebhookType) => {
    saveMutation.mutate({ settingType: type, data: formData[type] });
  };

  // Handle test for a specific webhook type
  const handleTest = (type: WebhookType) => {
    testMutation.mutate(type);
  };

  // Toggle expanded section
  const toggleExpanded = (type: WebhookType) => {
    setExpandedType(expandedType === type ? null : type);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-gray-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">N8N Webhook Settings</h2>
            <p className="text-sm text-gray-500">
              Configure webhooks for AI-powered features. Callback URLs are automatically determined by the system.
            </p>
          </div>
        </div>
      </div>

      {/* Webhook Sections */}
      {WEBHOOK_TYPES.map((type) => {
        const config = WEBHOOK_CONFIGS[type];
        const data = formData[type] || {};
        const isExpanded = expandedType === type;
        const testResult = testResults[type];
        const isTestingThis = testMutation.isPending && testMutation.variables === type;
        const isSavingThis = saveMutation.isPending && saveMutation.variables?.settingType === type;

        return (
          <div key={type} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Accordion Header */}
            <button
              onClick={() => toggleExpanded(type)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${data.isActive ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'}`}>
                  {config.icon}
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">{config.label}</h3>
                  <p className="text-sm text-gray-500">{config.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {data.isActive ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                    <Wifi className="w-3 h-3" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                    <WifiOff className="w-3 h-3" />
                    Inactive
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Accordion Content */}
            {isExpanded && (
              <div className="border-t border-gray-200">
                <div className="p-6 space-y-6">
                  {/* Webhook URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook URL *
                    </label>
                    <input
                      type="url"
                      value={data.webhookUrl || ''}
                      onChange={(e) => handleChange(type, 'webhookUrl', e.target.value)}
                      placeholder="https://your-n8n-instance.com/webhook/..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The N8N webhook URL for {config.label.toLowerCase()}
                    </p>
                  </div>

                  {/* Authentication */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700">Authentication</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Auth Type
                        </label>
                        <select
                          value={data.authentication?.type || 'none'}
                          onChange={(e) => handleChange(type, 'authentication.type', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="none">None</option>
                          <option value="api_key">API Key (X-API-Key header)</option>
                          <option value="bearer">Bearer Token</option>
                        </select>
                      </div>

                      {data.authentication?.type && data.authentication.type !== 'none' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {data.authentication.type === 'bearer' ? 'Bearer Token' : 'API Key'}
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKey[type] ? 'text' : 'password'}
                              value={data.authentication?.apiKey || data.authentication?.bearerToken || ''}
                              onChange={(e) => handleChange(
                                type,
                                data.authentication?.type === 'bearer' ? 'authentication.bearerToken' : 'authentication.apiKey',
                                e.target.value
                              )}
                              placeholder={`Enter ${data.authentication.type === 'bearer' ? 'token' : 'API key'}...`}
                              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(prev => ({ ...prev, [type]: !prev[type] }))}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showApiKey[type] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Retry Configuration */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700">Retry Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Retries
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={data.retryConfig?.maxRetries ?? 3}
                          onChange={(e) => handleChange(type, 'retryConfig.maxRetries', parseInt(e.target.value))}
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
                          max="60000"
                          step="100"
                          value={data.retryConfig?.retryDelayMs ?? 1000}
                          onChange={(e) => handleChange(type, 'retryConfig.retryDelayMs', parseInt(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Enable Webhook</h4>
                      <p className="text-xs text-gray-500">
                        When enabled, this integration will be active
                      </p>
                    </div>
                    <button
                      onClick={() => handleChange(type, 'isActive', !data.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        data.isActive ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          data.isActive ? 'translate-x-6' : 'translate-x-1'
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
                          <p className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {testResult.message}
                          </p>
                          {testResult.responseTimeMs !== undefined && (
                            <p className="text-sm text-gray-600 mt-1">
                              Response time: {testResult.responseTimeMs}ms
                              {testResult.statusCode && ` | Status: ${testResult.statusCode}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => handleTest(type)}
                    disabled={!data.webhookUrl || isTestingThis}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTestingThis ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                    Test Connection
                  </button>

                  <div className="flex items-center gap-3">
                    {hasChanges[type] && (
                      <span className="text-sm text-amber-600">Unsaved changes</span>
                    )}
                    <button
                      onClick={() => handleSave(type)}
                      disabled={!hasChanges[type] || isSavingThis || !data.webhookUrl}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WebhookSettings;

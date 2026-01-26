import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  Shield
} from 'lucide-react';

interface APIKey {
  _id: string;
  name: string;
  keyPrefix: string;
  keySuffix: string;
  keyMasked: string;
  purpose: string;
  permissions: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  createdByName: string;
}

export function APIKeySettings() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    purpose: 'webhook_callback',
    permissions: ['webhook:callback'],
    expiresInDays: 365,
    description: ''
  });

  // Fetch API keys
  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get('/admin/api-keys');
      return response.data;
    }
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/admin/api-keys', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyData({
        key: data.apiKey.key,
        name: data.apiKey.name
      });
      setFormData({
        name: '',
        purpose: 'webhook_callback',
        permissions: ['webhook:callback'],
        expiresInDays: 365,
        description: ''
      });
    }
  });

  // Revoke API key mutation
  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    }
  });

  // Rotate API key mutation
  const rotateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/admin/api-keys/${id}/rotate`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyData({
        key: data.apiKey.key,
        name: data.apiKey.name
      });
    }
  });

  const handleCopyKey = async () => {
    if (newKeyData?.key) {
      await navigator.clipboard.writeText(newKeyData.key);
    }
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const apiKeys: APIKey[] = apiKeysData?.apiKeys || [];

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
              <p className="text-sm text-gray-500">
                Generate and manage API keys for webhook callbacks
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate New Key
          </button>
        </div>

        {/* API Keys List */}
        <div className="divide-y divide-gray-100">
          {apiKeys.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Key className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No API keys created yet</p>
              <p className="text-sm">Generate a key to enable webhook callbacks</p>
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key._id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{key.name}</h3>
                      {key.isActive ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          Revoked
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-600">
                        {key.keyMasked}
                      </code>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        {key.purpose.replace('_', ' ')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Last used: {formatDate(key.lastUsedAt)}
                      </span>
                      <span>
                        {key.usageCount} requests
                      </span>
                    </div>

                    {key.expiresAt && (
                      <p className="mt-2 text-sm text-amber-600">
                        Expires: {formatDate(key.expiresAt)}
                      </p>
                    )}
                  </div>

                  {key.isActive && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => rotateMutation.mutate(key._id)}
                        disabled={rotateMutation.isPending}
                        className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                        title="Rotate key"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => revokeMutation.mutate(key._id)}
                        disabled={revokeMutation.isPending}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Generate New API Key
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., N8N Callback Key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="webhook_callback">Webhook Callback</option>
                  <option value="webhook_outbound">Webhook Outbound</option>
                  <option value="api_access">API Access</option>
                  <option value="integration">Integration</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires In (days)
                </label>
                <input
                  type="number"
                  value={formData.expiresInDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expiresInDays: parseInt(e.target.value) || 365
                    })
                  }
                  min="1"
                  max="3650"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="What this key is used for..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!formData.name || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Display Modal */}
      {newKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                <h3 className="text-lg font-semibold">API Key Generated</h3>
              </div>
            </div>

            <div className="p-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Important: Copy this key now!
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      This is the only time you'll see the full API key. Store it securely.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {newKeyData.name}
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono break-all">
                    {newKeyData.key}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setNewKeyData(null);
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default APIKeySettings;

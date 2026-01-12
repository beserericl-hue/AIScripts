'use client';

import { useState, useRef } from 'react';
import { Download, Upload, Trash2, Check, AlertTriangle, Link, Save, User, Lock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Platform } from '@/lib/types';
import { PLATFORM_LABELS } from '@/lib/constants';

const ALL_PLATFORMS: Platform[] = ['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok'];

export default function SettingsPage() {
  const { settings, updateSettings, exportData, importData, resetAll, posts } = useAppStore();
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl || '');
  const [webhookUsername, setWebhookUsername] = useState(settings.webhookUsername || '');
  const [webhookPassword, setWebhookPassword] = useState(settings.webhookPassword || '');
  const [webhookSaved, setWebhookSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePlatformToggle = (platform: Platform) => {
    const current = settings.defaultPlatforms;
    const newPlatforms = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];

    // Must have at least one default platform
    if (newPlatforms.length === 0) return;

    updateSettings({ defaultPlatforms: newPlatforms });
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `social-media-drafts-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = importData(content);
      setImportStatus(success ? 'success' : 'error');
      setTimeout(() => setImportStatus('idle'), 3000);
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    resetAll();
    setShowResetConfirm(false);
  };

  const handleSaveWebhook = () => {
    updateSettings({
      webhookUrl: webhookUrl.trim() || undefined,
      webhookUsername: webhookUsername.trim() || undefined,
      webhookPassword: webhookPassword.trim() || undefined,
    });
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 3000);
  };

  return (
    <div className="text-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-[#737373]">
          Configure your preferences and manage data
        </p>
      </div>

        {/* Default Platforms */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4">
            Default Platforms for New Posts
          </h2>
          <p className="text-sm text-[#737373] mb-4">
            These platforms will be pre-selected when you create a new post.
          </p>
          <div className="flex flex-wrap gap-3">
            {ALL_PLATFORMS.map((platform) => {
              const isSelected = settings.defaultPlatforms.includes(platform);
              return (
                <button
                  key={platform}
                  onClick={() => handlePlatformToggle(platform)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#111111] border-[#262626] text-[#737373] hover:border-[#404040]'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                  {PLATFORM_LABELS[platform]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Webhook URL */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4">
            <Link className="w-5 h-5 inline mr-2" />
            Webhook Integration
          </h2>
          <p className="text-sm text-[#737373] mb-4">
            Configure a webhook URL to push posts to your social media automation service.
            The post data will be sent as JSON to this URL when you click &quot;Push to Social&quot;.
          </p>
          <div className="p-4 bg-[#111111] border border-[#262626] rounded-lg space-y-4">
            {/* Webhook URL */}
            <div>
              <label className="block text-sm font-medium text-[#A3A3A3] mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-webhook-url.com/endpoint"
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Authorization */}
            <div className="pt-3 border-t border-[#262626]">
              <label className="block text-sm font-medium text-[#A3A3A3] mb-3">
                <Lock className="w-4 h-4 inline mr-1" />
                Authorization (Optional)
              </label>
              <p className="text-xs text-[#525252] mb-3">
                If your webhook requires Basic Authentication, enter the credentials below.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#525252] mb-1">
                    <User className="w-3 h-3 inline mr-1" />
                    Username
                  </label>
                  <input
                    type="text"
                    value={webhookUsername}
                    onChange={(e) => setWebhookUsername(e.target.value)}
                    placeholder="username"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#525252] mb-1">
                    <Lock className="w-3 h-3 inline mr-1" />
                    Password
                  </label>
                  <input
                    type="password"
                    value={webhookPassword}
                    onChange={(e) => setWebhookPassword(e.target.value)}
                    placeholder="password"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-3 border-t border-[#262626]">
              <p className="text-xs text-[#525252]">
                JSON payload: {`{ postId, platforms, content, mediaUrl, mediaData, tags, scheduledDate }`}
              </p>
              <button
                onClick={handleSaveWebhook}
                className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-medium"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
            {webhookSaved && (
              <p className="text-sm text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Webhook settings saved!
              </p>
            )}
          </div>
        </section>

        {/* Data Management */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4">Data Management</h2>
          <p className="text-sm text-[#737373] mb-4">
            Export your data for backup or import from a previous backup.
          </p>

          <div className="space-y-4">
            {/* Export */}
            <div className="p-4 bg-[#111111] border border-[#262626] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">Export Data</h3>
                  <p className="text-sm text-[#737373]">
                    Download all your posts, folders, and settings as a JSON file.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-white border border-[#262626] hover:border-[#D4AF37] rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Import */}
            <div className="p-4 bg-[#111111] border border-[#262626] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">Import Data</h3>
                  <p className="text-sm text-[#737373]">
                    Restore from a backup file. This will replace all current data.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {importStatus === 'success' && (
                    <span className="text-sm text-emerald-400 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Imported
                    </span>
                  )}
                  {importStatus === 'error' && (
                    <span className="text-sm text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Failed
                    </span>
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-white border border-[#262626] hover:border-[#D4AF37] rounded-lg transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Import
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Reset */}
            <div className="p-4 bg-[#111111] border border-red-900/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">Reset All Data</h3>
                  <p className="text-sm text-[#737373]">
                    Permanently delete all posts, folders, and settings. This cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </section>

      {/* Stats */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Storage</h2>
        <div className="p-4 bg-[#111111] border border-[#262626] rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#737373]">Total Posts</span>
            <span className="text-white">{posts.length}</span>
          </div>
        </div>
      </section>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-[#262626] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">
                Reset All Data?
              </h2>
            </div>
            <p className="text-[#737373] mb-6">
              This will permanently delete all {posts.length} posts, folders, activity history, and settings.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 border border-[#262626] text-[#A3A3A3] rounded-lg hover:bg-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


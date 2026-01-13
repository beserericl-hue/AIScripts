'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Trash2, Check, AlertTriangle, Link, Save, User, Lock, Database, RefreshCw, CloudDownload, CloudUpload, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Platform } from '@/lib/types';
import { PLATFORM_LABELS } from '@/lib/constants';

const ALL_PLATFORMS: Platform[] = ['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok'];

export default function SettingsPage() {
  const {
    settings,
    updateSettings,
    exportData,
    importData,
    resetAll,
    posts,
    mongoSync,
    syncToMongo,
    loadFromMongo,
    testMongoConnection,
  } = useAppStore();
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl || '');
  const [webhookUsername, setWebhookUsername] = useState(settings.webhookUsername || '');
  const [webhookPassword, setWebhookPassword] = useState(settings.webhookPassword || '');
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // MongoDB state
  const [mongoUrl, setMongoUrl] = useState(settings.mongoUrl || '');
  const [mongoUsername, setMongoUsername] = useState(settings.mongoUsername || '');
  const [mongoPassword, setMongoPassword] = useState(settings.mongoPassword || '');
  const [mongoDatabaseName, setMongoDatabaseName] = useState(settings.mongoDatabaseName || 'social_media_drafts');
  const [mongoSaved, setMongoSaved] = useState(false);
  const [mongoSaving, setMongoSaving] = useState(false);
  const [mongoSaveError, setMongoSaveError] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<{ testing: boolean; result: { connected: boolean; message: string } | null }>({ testing: false, result: null });

  // Sync local state with store settings
  useEffect(() => {
    setMongoUrl(settings.mongoUrl || '');
    setMongoUsername(settings.mongoUsername || '');
    setMongoPassword(settings.mongoPassword || '');
    setMongoDatabaseName(settings.mongoDatabaseName || 'social_media_drafts');
  }, [settings.mongoUrl, settings.mongoUsername, settings.mongoPassword, settings.mongoDatabaseName]);

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

  const handleSaveWebhook = async () => {
    const url = webhookUrl.trim();

    // If no URL provided, just clear the settings
    if (!url) {
      updateSettings({
        webhookUrl: undefined,
        webhookUsername: undefined,
        webhookPassword: undefined,
      });
      setWebhookSaved(true);
      setWebhookError(null);
      setTimeout(() => setWebhookSaved(false), 3000);
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setWebhookError('Invalid URL format');
      return;
    }

    setWebhookTesting(true);
    setWebhookError(null);

    try {
      // Test the webhook with an OPTIONS or HEAD request to verify it's reachable
      // We'll use our API route to proxy the test to avoid CORS issues
      const response = await fetch('/api/webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          username: webhookUsername.trim() || undefined,
          password: webhookPassword.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Connection successful, save the settings
        updateSettings({
          webhookUrl: url,
          webhookUsername: webhookUsername.trim() || undefined,
          webhookPassword: webhookPassword.trim() || undefined,
        });
        setWebhookSaved(true);
        setWebhookError(null);
        setTimeout(() => setWebhookSaved(false), 3000);
      } else {
        setWebhookError(result.message || 'Failed to connect to webhook URL');
      }
    } catch (error) {
      setWebhookError(error instanceof Error ? error.message : 'Network error');
    } finally {
      setWebhookTesting(false);
    }
  };

  const handleSaveMongo = async () => {
    const url = mongoUrl.trim();

    // If no URL provided, just clear the settings
    if (!url) {
      updateSettings({
        mongoUrl: undefined,
        mongoUsername: undefined,
        mongoPassword: undefined,
        mongoDatabaseName: 'social_media_drafts',
      });
      setMongoSaved(true);
      setMongoSaveError(null);
      setConnectionTest({ testing: false, result: null });
      setTimeout(() => setMongoSaved(false), 3000);
      return;
    }

    // Validate URL format
    const mongoRegex = /^mongodb(\+srv)?:\/\/.+/i;
    if (!mongoRegex.test(url)) {
      setMongoSaveError('Invalid MongoDB URL format. Must start with mongodb:// or mongodb+srv://');
      return;
    }

    setMongoSaving(true);
    setMongoSaveError(null);

    try {
      // Test connection with the form values BEFORE saving
      const params = new URLSearchParams({
        mongoUrl: url,
        ...(mongoUsername.trim() && { mongoUsername: mongoUsername.trim() }),
        ...(mongoPassword.trim() && { mongoPassword: mongoPassword.trim() }),
        mongoDatabaseName: mongoDatabaseName.trim() || 'social_media_drafts',
      });

      const response = await fetch(`/api/db/health?${params}`);
      const result = await response.json();

      if (result.connected) {
        // Connection successful, save the settings
        updateSettings({
          mongoUrl: url,
          mongoUsername: mongoUsername.trim() || undefined,
          mongoPassword: mongoPassword.trim() || undefined,
          mongoDatabaseName: mongoDatabaseName.trim() || 'social_media_drafts',
        });
        setMongoSaved(true);
        setMongoSaveError(null);
        setConnectionTest({ testing: false, result: { connected: true, message: 'Connected' } });
        setTimeout(() => setMongoSaved(false), 3000);
      } else {
        setMongoSaveError(result.message || 'Failed to connect to MongoDB');
        setConnectionTest({ testing: false, result: { connected: false, message: result.message } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      setMongoSaveError(message);
      setConnectionTest({ testing: false, result: { connected: false, message } });
    } finally {
      setMongoSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const url = mongoUrl.trim();

    if (!url) {
      setConnectionTest({ testing: false, result: { connected: false, message: 'MongoDB URL is required' } });
      return;
    }

    // Validate URL format
    const mongoRegex = /^mongodb(\+srv)?:\/\/.+/i;
    if (!mongoRegex.test(url)) {
      setConnectionTest({ testing: false, result: { connected: false, message: 'Invalid URL format' } });
      return;
    }

    setConnectionTest({ testing: true, result: null });

    try {
      // Test with form values, not saved settings
      const params = new URLSearchParams({
        mongoUrl: url,
        ...(mongoUsername.trim() && { mongoUsername: mongoUsername.trim() }),
        ...(mongoPassword.trim() && { mongoPassword: mongoPassword.trim() }),
        mongoDatabaseName: mongoDatabaseName.trim() || 'social_media_drafts',
      });

      const response = await fetch(`/api/db/health?${params}`);
      const result = await response.json();

      setConnectionTest({ testing: false, result: { connected: result.connected, message: result.message } });
    } catch (error) {
      setConnectionTest({
        testing: false,
        result: { connected: false, message: error instanceof Error ? error.message : 'Network error' }
      });
    }
  };

  const handleSyncToMongo = async () => {
    await syncToMongo();
  };

  const handleLoadFromMongo = async () => {
    await loadFromMongo();
  };

  const isMongoConfigured = Boolean(settings.mongoUrl);

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
                disabled={webhookTesting}
                className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {webhookTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {webhookTesting ? 'Validating...' : 'Save'}
              </button>
            </div>
            {webhookSaved && (
              <p className="text-sm text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Webhook validated and saved!
              </p>
            )}
            {webhookError && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {webhookError}
              </p>
            )}
          </div>
        </section>

        {/* MongoDB Database Section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4">
            <Database className="w-5 h-5 inline mr-2" />
            MongoDB Database
          </h2>
          <p className="text-sm text-[#737373] mb-4">
            Connect to MongoDB to sync your posts across devices. Your data will be automatically
            saved to the cloud whenever you make changes.
          </p>
          <div className="p-4 bg-[#111111] border border-[#262626] rounded-lg space-y-4">
            {/* MongoDB URL */}
            <div>
              <label className="block text-sm font-medium text-[#A3A3A3] mb-2">
                MongoDB Connection URL
              </label>
              <input
                type="url"
                value={mongoUrl}
                onChange={(e) => setMongoUrl(e.target.value)}
                placeholder="mongodb+srv://cluster.mongodb.net or mongodb://localhost:27017"
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37]"
              />
              <p className="text-xs text-[#525252] mt-1">
                Works with MongoDB Atlas (mongodb+srv://) or self-hosted (mongodb://)
              </p>
            </div>

            {/* Database Name */}
            <div>
              <label className="block text-sm font-medium text-[#A3A3A3] mb-2">
                Database Name
              </label>
              <input
                type="text"
                value={mongoDatabaseName}
                onChange={(e) => setMongoDatabaseName(e.target.value)}
                placeholder="social_media_drafts"
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Authorization */}
            <div className="pt-3 border-t border-[#262626]">
              <label className="block text-sm font-medium text-[#A3A3A3] mb-3">
                <Lock className="w-4 h-4 inline mr-1" />
                Authentication (Optional)
              </label>
              <p className="text-xs text-[#525252] mb-3">
                If your MongoDB requires authentication, enter the credentials below.
                For MongoDB Atlas, credentials are usually in the connection string.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#525252] mb-1">
                    <User className="w-3 h-3 inline mr-1" />
                    Username
                  </label>
                  <input
                    type="text"
                    value={mongoUsername}
                    onChange={(e) => setMongoUsername(e.target.value)}
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
                    value={mongoPassword}
                    onChange={(e) => setMongoPassword(e.target.value)}
                    placeholder="password"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Save and Test Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[#262626]">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={!mongoUrl || connectionTest.testing}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-white border border-[#262626] hover:border-[#D4AF37] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectionTest.testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Test Connection
                </button>
                {connectionTest.result && (
                  <span className={`text-sm flex items-center gap-1 ${connectionTest.result.connected ? 'text-green-400' : 'text-red-400'}`}>
                    {connectionTest.result.connected ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {connectionTest.result.message}
                  </span>
                )}
              </div>
              <button
                onClick={handleSaveMongo}
                disabled={mongoSaving || connectionTest.testing}
                className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mongoSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {mongoSaving ? 'Validating...' : 'Save'}
              </button>
            </div>
            {mongoSaved && (
              <p className="text-sm text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> MongoDB validated and saved!
              </p>
            )}
            {mongoSaveError && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {mongoSaveError}
              </p>
            )}

            {/* Sync Actions */}
            {isMongoConfigured && (
              <div className="pt-3 border-t border-[#262626]">
                <label className="block text-sm font-medium text-[#A3A3A3] mb-3">
                  Manual Sync
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSyncToMongo}
                    disabled={mongoSync.status === 'syncing'}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-white border border-[#262626] hover:border-[#D4AF37] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {mongoSync.status === 'syncing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CloudUpload className="w-4 h-4" />
                    )}
                    Push to Cloud
                  </button>
                  <button
                    onClick={handleLoadFromMongo}
                    disabled={mongoSync.status === 'syncing'}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-white border border-[#262626] hover:border-[#D4AF37] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {mongoSync.status === 'syncing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CloudDownload className="w-4 h-4" />
                    )}
                    Pull from Cloud
                  </button>

                  {/* Sync Status Indicator */}
                  {mongoSync.status === 'success' && (
                    <span className="text-sm text-green-400 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Synced
                    </span>
                  )}
                  {mongoSync.status === 'error' && (
                    <span className="text-sm text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> {mongoSync.errorMessage}
                    </span>
                  )}
                </div>
                {mongoSync.lastSyncedAt && (
                  <p className="text-xs text-[#525252] mt-2">
                    Last synced: {new Date(mongoSync.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </div>
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


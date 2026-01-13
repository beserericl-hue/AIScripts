'use client';

import { Cloud, CloudOff, Loader2, Check, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function SyncStatusIndicator() {
  const { settings, mongoSync } = useAppStore();

  const isConfigured = Boolean(settings.mongoUrl);

  if (!isConfigured) {
    return (
      <div className="flex items-center gap-1.5 text-[#525252]" title="MongoDB not configured">
        <CloudOff className="w-4 h-4" />
        <span className="text-xs hidden sm:inline">Offline</span>
      </div>
    );
  }

  switch (mongoSync.status) {
    case 'syncing':
      return (
        <div className="flex items-center gap-1.5 text-[#D4AF37]" title="Syncing...">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs hidden sm:inline">Syncing</span>
        </div>
      );
    case 'success':
      return (
        <div className="flex items-center gap-1.5 text-green-400" title="Synced">
          <Check className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Synced</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-1.5 text-red-400" title={mongoSync.errorMessage}>
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Error</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-1.5 text-[#737373]" title="Connected to MongoDB">
          <Cloud className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Cloud</span>
        </div>
      );
  }
}

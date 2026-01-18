'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

interface ServerConfig {
  mongoUrl?: string;
  mongoDatabaseName?: string;
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
}

export default function AppInitializer({ children }: { children: React.ReactNode }) {
  const { settings, loadFromMongo, migrateFromLegacy, updateSettings } = useAppStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initialize = async () => {
      // Run migrations first
      migrateFromLegacy();

      // Fetch server config (environment variables)
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config: ServerConfig = await response.json();

          // If server has MongoDB URL configured via env var, use it
          // This overrides any client-side settings
          if (config.mongoUrl && !settings.mongoUrl) {
            updateSettings({
              mongoUrl: config.mongoUrl,
              mongoDatabaseName: config.mongoDatabaseName || 'social_media_drafts',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch server config:', error);
      }

      // If MongoDB is configured (either from env or settings), attempt to load data
      const currentSettings = useAppStore.getState().settings;
      if (currentSettings.mongoUrl) {
        loadFromMongo().catch(console.error);
      }
    };

    initialize();
  }, [settings.mongoUrl, loadFromMongo, migrateFromLegacy, updateSettings]);

  return <>{children}</>;
}

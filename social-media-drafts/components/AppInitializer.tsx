'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

export default function AppInitializer({ children }: { children: React.ReactNode }) {
  const { settings, loadFromMongo, migrateFromLegacy } = useAppStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Run migrations first
    migrateFromLegacy();

    // If MongoDB is configured, attempt to load data
    if (settings.mongoUrl) {
      loadFromMongo().catch(console.error);
    }
  }, [settings.mongoUrl, loadFromMongo, migrateFromLegacy]);

  return <>{children}</>;
}

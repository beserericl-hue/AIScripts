'use client';

import { Check, Plus, X } from 'lucide-react';
import { Platform } from '@/lib/types';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/constants';

interface PlatformTabsProps {
  platforms: Platform[];
  activePlatform: Platform;
  onPlatformChange: (platform: Platform) => void;
  onPlatformToggle: (platform: Platform) => void;
}

const ALL_PLATFORMS: Platform[] = ['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok'];

export default function PlatformTabs({
  platforms,
  activePlatform,
  onPlatformChange,
  onPlatformToggle,
}: PlatformTabsProps) {
  const unselectedPlatforms = ALL_PLATFORMS.filter((p) => !platforms.includes(p));

  return (
    <div className="flex items-center justify-between border-b border-[#262626] px-2">
      <div className="flex items-center gap-1">
        {platforms.map((platform) => {
          const isActive = activePlatform === platform;

          return (
            <div key={platform} className="relative flex items-center">
              <button
                onClick={() => onPlatformChange(platform)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive
                    ? 'text-white'
                    : 'text-[#737373] hover:text-white'
                }`}
              >
                <Check
                  className="w-3.5 h-3.5"
                  style={{ color: PLATFORM_COLORS[platform] }}
                />
                <span>{PLATFORM_LABELS[platform]}</span>
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                  />
                )}
              </button>
              {platforms.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlatformToggle(platform);
                  }}
                  className="p-1 text-[#525252] hover:text-red-400 transition-colors"
                  title={`Remove ${PLATFORM_LABELS[platform]}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Platform Dropdown */}
      {unselectedPlatforms.length > 0 && (
        <div className="relative group">
          <button className="flex items-center gap-1 px-3 py-2 text-sm text-[#D4AF37] hover:bg-[#1a1a1a] rounded-md transition-colors">
            <Plus className="w-4 h-4" />
            Add Platform
          </button>
          <div className="absolute right-0 top-full mt-1 w-48 bg-[#111111] border border-[#262626] rounded-lg shadow-xl py-1 z-20 hidden group-hover:block">
            {unselectedPlatforms.map((platform) => (
              <button
                key={platform}
                onClick={() => onPlatformToggle(platform)}
                className="w-full px-4 py-2 text-left text-sm text-[#A3A3A3] hover:bg-[#1a1a1a] hover:text-white transition-colors flex items-center gap-2"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                />
                {PLATFORM_LABELS[platform]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { Platform, PostStatus } from './types';

export const CHARACTER_LIMITS: Record<Platform, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#00F2EA',
};

export const STATUS_LABELS: Record<PostStatus, string> = {
  idea: 'Idea',
  draft: 'Draft',
  ready: 'Ready',
  published: 'Published',
};

export const STATUS_COLORS: Record<PostStatus, string> = {
  idea: '#737373',      // neutral gray
  draft: '#D97706',     // amber
  ready: '#10B981',     // green
  published: '#3B82F6', // blue
};

export const STATUS_BG_CLASSES: Record<PostStatus, string> = {
  idea: 'bg-neutral-700 text-neutral-300',
  draft: 'bg-amber-900/50 text-amber-400 border border-amber-800',
  ready: 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  published: 'bg-blue-900/50 text-blue-400 border border-blue-800',
};

export const STORAGE_KEYS = {
  posts: 'social_media_posts',
  folders: 'social_media_folders',
  settings: 'social_media_settings',
  activity: 'social_media_activity',
  // Legacy keys for migration
  legacyDrafts: 'social_media_drafts',
} as const;

export const FOLDER_COLORS = [
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
];

export const DEFAULT_PLATFORMS: Platform[] = ['twitter', 'instagram'];

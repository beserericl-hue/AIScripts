export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok';
export type PostStatus = 'idea' | 'draft' | 'ready' | 'published';

export interface PlatformContent {
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface Post {
  id: string;
  platforms: Platform[];
  content: PlatformContent;
  tags: string[];
  status: PostStatus;
  folderId?: string;
  scheduledDate?: number;
  mediaUrl?: string; // Optional video URL or external image URL
  mediaData?: string; // Base64-encoded image data for uploaded images
  mediaType?: 'image' | 'video'; // Type indicator for media
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface ActivityItem {
  id: string;
  type: 'created' | 'edited' | 'published' | 'scheduled' | 'deleted';
  postId: string;
  postTitle: string;
  timestamp: number;
}

export interface FilterOptions {
  platform?: Platform | 'all';
  status?: PostStatus | 'all';
  tags?: string[];
  searchQuery?: string;
  folderId?: string;
}

export interface AppSettings {
  defaultPlatforms: Platform[];
  webhookUrl?: string;
  webhookUsername?: string; // Username for webhook Basic Auth
  webhookPassword?: string; // Password for webhook Basic Auth
  // MongoDB settings
  mongoUrl?: string;
  mongoUsername?: string;
  mongoPassword?: string;
  mongoDatabaseName?: string; // Default: 'social_media_drafts'
}

// MongoDB sync status types
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface MongoSyncState {
  status: SyncStatus;
  lastSyncedAt?: number;
  errorMessage?: string;
}

// MongoDB API response types
export interface MongoSyncResponse {
  success: boolean;
  message: string;
  timestamp: number;
  counts?: {
    posts: number;
    folders: number;
    activity: number;
  };
}

export interface MongoLoadResponse {
  success: boolean;
  data?: {
    posts: Post[];
    folders: Folder[];
    activity: ActivityItem[];
    settings: Partial<AppSettings>;
  };
  message: string;
  timestamp: number;
}

export interface MongoHealthResponse {
  connected: boolean;
  database: string | null;
  collections: string[];
  message: string;
}

// Legacy types for migration
export type LegacyDraftStatus = 'draft' | 'ready' | 'posted';

export interface LegacyDraft {
  id: string;
  platform: Platform;
  content: string;
  tags: string[];
  status: LegacyDraftStatus;
  createdAt: number;
  updatedAt: number;
  scheduledDate?: number;
  mediaIds?: string[];
  assigneeId?: string;
}

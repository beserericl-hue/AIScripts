'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Post, Folder, ActivityItem, AppSettings, FilterOptions, Platform, PostStatus, LegacyDraft, MongoSyncState, MongoSyncResponse, MongoLoadResponse } from './types';
import { STORAGE_KEYS, DEFAULT_PLATFORMS, FOLDER_COLORS } from './constants';

// Debounce utility
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

// Check if MongoDB is configured
const isMongoConfigured = (settings: AppSettings): boolean => {
  return Boolean(settings.mongoUrl && settings.mongoUrl.trim().length > 0);
};

// Debounced sync function holder
let debouncedSync: (() => void) | null = null;

interface AppState {
  // Data
  posts: Post[];
  folders: Folder[];
  activity: ActivityItem[];
  settings: AppSettings;

  // UI State
  filters: FilterOptions;

  // MongoDB Sync State
  mongoSync: MongoSyncState;

  // Post Actions
  addPost: (post: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>) => Post;
  updatePost: (id: string, updates: Partial<Post>) => void;
  deletePost: (id: string) => void;
  getPost: (id: string) => Post | undefined;

  // Folder Actions
  addFolder: (name: string) => Folder;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;

  // Activity Actions
  addActivity: (type: ActivityItem['type'], postId: string, postTitle: string) => void;
  clearActivity: () => void;

  // Settings Actions
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Filter Actions
  setFilters: (filters: FilterOptions) => void;
  clearFilters: () => void;

  // Data Management
  exportData: () => string;
  importData: (jsonData: string) => boolean;
  resetAll: () => void;

  // Migration
  migrateFromLegacy: () => void;

  // MongoDB Actions
  syncToMongo: () => Promise<void>;
  loadFromMongo: () => Promise<boolean>;
  testMongoConnection: () => Promise<{ connected: boolean; message: string }>;
  setMongoSyncStatus: (status: MongoSyncState) => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const getPostTitle = (post: Post): string => {
  const platforms = post.platforms;
  for (const platform of platforms) {
    const content = post.content[platform];
    if (content) {
      return content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }
  }
  return 'Untitled';
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      // Initialize debounced sync function
      const triggerDebouncedSync = () => {
        const state = get();
        if (isMongoConfigured(state.settings)) {
          if (!debouncedSync) {
            debouncedSync = debounce(() => get().syncToMongo(), 2000);
          }
          debouncedSync();
        }
      };

      return {
      // Initial State
      posts: [],
      folders: [],
      activity: [],
      settings: {
        defaultPlatforms: DEFAULT_PLATFORMS,
      },
      filters: {},
      mongoSync: {
        status: 'idle',
      },

      // Post Actions
      addPost: (postData) => {
        const newPost: Post = {
          ...postData,
          id: generateId(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ posts: [...state.posts, newPost] }));
        get().addActivity('created', newPost.id, getPostTitle(newPost));
        triggerDebouncedSync();
        return newPost;
      },

      updatePost: (id, updates) => {
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === id
              ? { ...post, ...updates, updatedAt: Date.now() }
              : post
          ),
        }));
        const post = get().posts.find((p) => p.id === id);
        if (post) {
          if (updates.status === 'published') {
            get().addActivity('published', id, getPostTitle(post));
          } else if (updates.scheduledDate) {
            get().addActivity('scheduled', id, getPostTitle(post));
          } else {
            get().addActivity('edited', id, getPostTitle(post));
          }
        }
        triggerDebouncedSync();
      },

      deletePost: (id) => {
        const post = get().posts.find((p) => p.id === id);
        if (post) {
          get().addActivity('deleted', id, getPostTitle(post));
        }
        set((state) => ({
          posts: state.posts.filter((post) => post.id !== id),
        }));
        triggerDebouncedSync();
      },

      getPost: (id) => {
        return get().posts.find((post) => post.id === id);
      },

      // Folder Actions
      addFolder: (name) => {
        const usedColors = get().folders.map((f) => f.color);
        const availableColors = FOLDER_COLORS.filter((c) => !usedColors.includes(c));
        const color = availableColors[0] || FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];

        const newFolder: Folder = {
          id: generateId(),
          name,
          color,
          createdAt: Date.now(),
        };
        set((state) => ({ folders: [...state.folders, newFolder] }));
        triggerDebouncedSync();
        return newFolder;
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === id ? { ...folder, ...updates } : folder
          ),
        }));
        triggerDebouncedSync();
      },

      deleteFolder: (id) => {
        // Remove folder reference from posts
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
          posts: state.posts.map((post) =>
            post.folderId === id ? { ...post, folderId: undefined } : post
          ),
        }));
        triggerDebouncedSync();
      },

      // Activity Actions
      addActivity: (type, postId, postTitle) => {
        const newActivity: ActivityItem = {
          id: generateId(),
          type,
          postId,
          postTitle,
          timestamp: Date.now(),
        };
        set((state) => ({
          activity: [newActivity, ...state.activity].slice(0, 50), // Keep last 50
        }));
      },

      clearActivity: () => {
        set({ activity: [] });
        triggerDebouncedSync();
      },

      // Settings Actions
      updateSettings: (settings) => {
        set((state) => ({
          settings: { ...state.settings, ...settings },
        }));
        triggerDebouncedSync();
      },

      // Filter Actions
      setFilters: (filters) => {
        set({ filters });
      },

      clearFilters: () => {
        set({ filters: {} });
      },

      // Data Management
      exportData: () => {
        const { posts, folders, settings, activity } = get();
        // Exclude MongoDB credentials from export
        const exportSettings = { ...settings };
        delete exportSettings.mongoUrl;
        delete exportSettings.mongoUsername;
        delete exportSettings.mongoPassword;
        delete exportSettings.mongoDatabaseName;
        return JSON.stringify({ posts, folders, settings: exportSettings, activity }, null, 2);
      },

      importData: (jsonData) => {
        try {
          const data = JSON.parse(jsonData);
          if (data.posts && Array.isArray(data.posts)) {
            const currentSettings = get().settings;
            set({
              posts: data.posts,
              folders: data.folders || [],
              settings: {
                ...data.settings,
                defaultPlatforms: data.settings?.defaultPlatforms || DEFAULT_PLATFORMS,
                // Preserve MongoDB settings
                mongoUrl: currentSettings.mongoUrl,
                mongoUsername: currentSettings.mongoUsername,
                mongoPassword: currentSettings.mongoPassword,
                mongoDatabaseName: currentSettings.mongoDatabaseName,
              },
              activity: data.activity || [],
            });
            triggerDebouncedSync();
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      resetAll: () => {
        const currentSettings = get().settings;
        set({
          posts: [],
          folders: [],
          activity: [],
          settings: {
            defaultPlatforms: DEFAULT_PLATFORMS,
            // Preserve MongoDB settings
            mongoUrl: currentSettings.mongoUrl,
            mongoUsername: currentSettings.mongoUsername,
            mongoPassword: currentSettings.mongoPassword,
            mongoDatabaseName: currentSettings.mongoDatabaseName,
          },
          filters: {},
        });
        // Also clear legacy storage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.legacyDrafts);
        }
        triggerDebouncedSync();
      },

      // Migration from legacy format
      migrateFromLegacy: () => {
        if (typeof window === 'undefined') return;

        const legacyData = localStorage.getItem(STORAGE_KEYS.legacyDrafts);
        if (!legacyData) return;

        try {
          const legacyDrafts: LegacyDraft[] = JSON.parse(legacyData);
          if (!Array.isArray(legacyDrafts) || legacyDrafts.length === 0) return;

          // Only migrate if we don't have posts yet
          if (get().posts.length > 0) return;

          const migratedPosts: Post[] = legacyDrafts.map((draft) => {
            // Map old status to new status
            let newStatus: PostStatus = 'draft';
            if (draft.status === 'posted') {
              newStatus = 'published';
            } else if (draft.status === 'ready') {
              newStatus = 'ready';
            } else if (draft.status === 'draft') {
              newStatus = 'draft';
            }

            return {
              id: draft.id,
              platforms: [draft.platform],
              content: {
                [draft.platform]: draft.content,
              },
              tags: draft.tags,
              status: newStatus,
              scheduledDate: draft.scheduledDate,
              createdAt: draft.createdAt,
              updatedAt: draft.updatedAt,
            };
          });

          set({ posts: migratedPosts });

          // Clear legacy data after migration
          localStorage.removeItem(STORAGE_KEYS.legacyDrafts);
        } catch (e) {
          console.error('Migration failed:', e);
        }
      },

      // MongoDB Actions
      setMongoSyncStatus: (syncState) => {
        set({ mongoSync: syncState });
      },

      syncToMongo: async () => {
        const state = get();

        // Don't sync if MongoDB is not configured
        if (!isMongoConfigured(state.settings)) {
          return;
        }

        // Don't sync if already syncing
        if (state.mongoSync.status === 'syncing') {
          return;
        }

        set({ mongoSync: { status: 'syncing' } });

        try {
          const response = await fetch('/api/db/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mongoUrl: state.settings.mongoUrl,
              mongoUsername: state.settings.mongoUsername,
              mongoPassword: state.settings.mongoPassword,
              mongoDatabaseName: state.settings.mongoDatabaseName || 'social_media_drafts',
              data: {
                posts: state.posts,
                folders: state.folders,
                activity: state.activity,
                settings: state.settings,
              },
            }),
          });

          const result: MongoSyncResponse = await response.json();

          if (result.success) {
            set({
              mongoSync: {
                status: 'success',
                lastSyncedAt: result.timestamp,
              },
            });
            // Reset to idle after 3 seconds
            setTimeout(() => {
              const currentState = get();
              if (currentState.mongoSync.status === 'success') {
                set({ mongoSync: { ...currentState.mongoSync, status: 'idle' } });
              }
            }, 3000);
          } else {
            set({
              mongoSync: {
                status: 'error',
                errorMessage: result.message,
              },
            });
          }
        } catch (error) {
          set({
            mongoSync: {
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Network error',
            },
          });
        }
      },

      loadFromMongo: async () => {
        const state = get();

        // Don't load if MongoDB is not configured
        if (!isMongoConfigured(state.settings)) {
          return false;
        }

        set({ mongoSync: { status: 'syncing' } });

        try {
          const params = new URLSearchParams({
            mongoUrl: state.settings.mongoUrl!,
            ...(state.settings.mongoUsername && { mongoUsername: state.settings.mongoUsername }),
            ...(state.settings.mongoPassword && { mongoPassword: state.settings.mongoPassword }),
            mongoDatabaseName: state.settings.mongoDatabaseName || 'social_media_drafts',
          });

          const response = await fetch(`/api/db/sync?${params}`);
          const result: MongoLoadResponse = await response.json();

          if (result.success && result.data) {
            // Preserve current MongoDB settings
            const currentSettings = state.settings;

            set({
              posts: result.data.posts,
              folders: result.data.folders,
              activity: result.data.activity,
              settings: {
                ...result.data.settings,
                defaultPlatforms: result.data.settings.defaultPlatforms || DEFAULT_PLATFORMS,
                mongoUrl: currentSettings.mongoUrl,
                mongoUsername: currentSettings.mongoUsername,
                mongoPassword: currentSettings.mongoPassword,
                mongoDatabaseName: currentSettings.mongoDatabaseName,
              },
              mongoSync: { status: 'success', lastSyncedAt: result.timestamp },
            });

            setTimeout(() => {
              const currentState = get();
              if (currentState.mongoSync.status === 'success') {
                set({ mongoSync: { ...currentState.mongoSync, status: 'idle' } });
              }
            }, 3000);

            return true;
          } else {
            set({ mongoSync: { status: 'error', errorMessage: result.message } });
            return false;
          }
        } catch (error) {
          set({
            mongoSync: {
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Network error',
            },
          });
          return false;
        }
      },

      testMongoConnection: async () => {
        const state = get();

        if (!state.settings.mongoUrl) {
          return { connected: false, message: 'MongoDB URL not configured' };
        }

        try {
          const params = new URLSearchParams({
            mongoUrl: state.settings.mongoUrl,
            ...(state.settings.mongoUsername && { mongoUsername: state.settings.mongoUsername }),
            ...(state.settings.mongoPassword && { mongoPassword: state.settings.mongoPassword }),
            mongoDatabaseName: state.settings.mongoDatabaseName || 'social_media_drafts',
          });

          const response = await fetch(`/api/db/health?${params}`);
          const result = await response.json();

          return { connected: result.connected, message: result.message };
        } catch (error) {
          return {
            connected: false,
            message: error instanceof Error ? error.message : 'Network error',
          };
        }
      },
    };
    },
    {
      name: STORAGE_KEYS.posts,
      partialize: (state) => ({
        posts: state.posts,
        folders: state.folders,
        activity: state.activity,
        settings: state.settings,
      }),
    }
  )
);

// Helper hooks for filtered data
export const useFilteredPosts = () => {
  const { posts, filters } = useAppStore();

  return posts.filter((post) => {
    if (filters.platform && filters.platform !== 'all') {
      if (!post.platforms.includes(filters.platform)) return false;
    }
    if (filters.status && filters.status !== 'all') {
      if (post.status !== filters.status) return false;
    }
    if (filters.folderId) {
      if (post.folderId !== filters.folderId) return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      if (!filters.tags.some((tag) => post.tags.includes(tag))) return false;
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const hasMatch = Object.values(post.content).some(
        (content) => content?.toLowerCase().includes(query)
      );
      if (!hasMatch && !post.tags.some((tag) => tag.toLowerCase().includes(query))) {
        return false;
      }
    }
    return true;
  });
};

export const useUpcomingPosts = (days: number = 7) => {
  const { posts } = useAppStore();
  const now = Date.now();
  const future = now + days * 24 * 60 * 60 * 1000;

  return posts
    .filter((post) => post.scheduledDate && post.scheduledDate >= now && post.scheduledDate <= future)
    .sort((a, b) => (a.scheduledDate || 0) - (b.scheduledDate || 0));
};

export const usePostStats = () => {
  const { posts } = useAppStore();

  return {
    idea: posts.filter((p) => p.status === 'idea').length,
    draft: posts.filter((p) => p.status === 'draft').length,
    ready: posts.filter((p) => p.status === 'ready').length,
    published: posts.filter((p) => p.status === 'published').length,
    total: posts.length,
  };
};

export const useAllTags = () => {
  const { posts } = useAppStore();
  const tagSet = new Set<string>();
  posts.forEach((post) => post.tags.forEach((tag) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
};

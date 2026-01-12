'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Post, Folder, ActivityItem, AppSettings, FilterOptions, Platform, PostStatus, LegacyDraft } from './types';
import { STORAGE_KEYS, DEFAULT_PLATFORMS, FOLDER_COLORS } from './constants';

interface AppState {
  // Data
  posts: Post[];
  folders: Folder[];
  activity: ActivityItem[];
  settings: AppSettings;

  // UI State
  filters: FilterOptions;

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
    (set, get) => ({
      // Initial State
      posts: [],
      folders: [],
      activity: [],
      settings: {
        defaultPlatforms: DEFAULT_PLATFORMS,
      },
      filters: {},

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
      },

      deletePost: (id) => {
        const post = get().posts.find((p) => p.id === id);
        if (post) {
          get().addActivity('deleted', id, getPostTitle(post));
        }
        set((state) => ({
          posts: state.posts.filter((post) => post.id !== id),
        }));
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
        return newFolder;
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === id ? { ...folder, ...updates } : folder
          ),
        }));
      },

      deleteFolder: (id) => {
        // Remove folder reference from posts
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
          posts: state.posts.map((post) =>
            post.folderId === id ? { ...post, folderId: undefined } : post
          ),
        }));
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
      },

      // Settings Actions
      updateSettings: (settings) => {
        set((state) => ({
          settings: { ...state.settings, ...settings },
        }));
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
        return JSON.stringify({ posts, folders, settings, activity }, null, 2);
      },

      importData: (jsonData) => {
        try {
          const data = JSON.parse(jsonData);
          if (data.posts && Array.isArray(data.posts)) {
            set({
              posts: data.posts,
              folders: data.folders || [],
              settings: data.settings || { defaultPlatforms: DEFAULT_PLATFORMS },
              activity: data.activity || [],
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      resetAll: () => {
        set({
          posts: [],
          folders: [],
          activity: [],
          settings: { defaultPlatforms: DEFAULT_PLATFORMS },
          filters: {},
        });
        // Also clear legacy storage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.legacyDrafts);
        }
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
    }),
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

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, FileText, Sparkles } from 'lucide-react';
import { useAppStore, useFilteredPosts, useAllTags } from '@/lib/store';
import { Platform, PostStatus } from '@/lib/types';
import { PLATFORM_LABELS, STATUS_LABELS } from '@/lib/constants';
import PostCard from '@/components/PostCard';
import PostList from '@/components/PostList';
import ViewToggle from '@/components/ViewToggle';

export default function DraftsPage() {
  const router = useRouter();
  const { filters, setFilters, deletePost } = useAppStore();
  const filteredPosts = useFilteredPosts();
  const allTags = useAllTags();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery || '');

  // Sort posts by most recently updated
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [filteredPosts]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilters({ ...filters, searchQuery: query || undefined });
  };

  const handlePlatformChange = (platform: Platform | 'all') => {
    setFilters({ ...filters, platform: platform === 'all' ? undefined : platform });
  };

  const handleStatusChange = (status: PostStatus | 'all') => {
    setFilters({ ...filters, status: status === 'all' ? undefined : status });
  };

  const handleTagChange = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    setFilters({ ...filters, tags: newTags.length > 0 ? newTags : undefined });
  };

  const handleFolderSelect = (folderId?: string) => {
    setFilters({ ...filters, folderId });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      deletePost(id);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/post/${id}`);
  };

  return (
    <div className="text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Drafts</h1>
          <p className="text-[#737373]">
            {sortedPosts.length} {sortedPosts.length === 1 ? 'post' : 'posts'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/post/new?ai=true')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1a1a] border border-[#333333] text-[#D4AF37] rounded-md hover:bg-[#262626] hover:border-[#D4AF37] transition-all font-medium"
          >
            <Sparkles className="w-4 h-4" />
            AI Generate
          </button>
          <button
            onClick={() => router.push('/post/new')}
            className="flex items-center gap-2 px-5 py-2.5 btn-gold rounded-md transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>
      </div>

      <div className="flex gap-6">

          {/* Main Content */}
          <div className="flex-1">
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search posts..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Filters Row */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Platform Filter */}
                <select
                  value={filters.platform || 'all'}
                  onChange={(e) => handlePlatformChange(e.target.value as Platform | 'all')}
                  className="px-3 py-2 bg-[#111111] border border-[#262626] rounded-lg text-[#A3A3A3] focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="all">All Platforms</option>
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filters.status || 'all'}
                  onChange={(e) => handleStatusChange(e.target.value as PostStatus | 'all')}
                  className="px-3 py-2 bg-[#111111] border border-[#262626] rounded-lg text-[#A3A3A3] focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>

                {/* Tags Dropdown */}
                {allTags.length > 0 && (
                  <div className="relative group">
                    <button className="px-3 py-2 bg-[#111111] border border-[#262626] rounded-lg text-[#A3A3A3] hover:border-[#D4AF37] transition-colors">
                      Tags {(filters.tags?.length || 0) > 0 && `(${filters.tags?.length})`}
                    </button>
                    <div className="absolute left-0 top-full mt-1 w-48 bg-[#111111] border border-[#262626] rounded-lg shadow-lg py-2 z-10 hidden group-hover:block">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleTagChange(tag)}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-[#1a1a1a] transition-colors ${
                            filters.tags?.includes(tag)
                              ? 'text-[#D4AF37]'
                              : 'text-[#737373]'
                          }`}
                        >
                          {filters.tags?.includes(tag) ? '✓ ' : ''}{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1" />

                {/* View Toggle */}
                <ViewToggle view={view} onChange={setView} />
              </div>
            </div>

            {/* Posts */}
            {sortedPosts.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#111111] rounded-full mb-4">
                  <FileText className="w-8 h-8 text-[#525252]" />
                </div>
                <h3 className="text-lg font-medium text-[#737373] mb-1">
                  No posts found
                </h3>
                <p className="text-[#525252] mb-6">
                  {filters.searchQuery || filters.platform || filters.status || filters.tags?.length
                    ? 'Try adjusting your filters'
                    : 'Create your first post to get started'}
                </p>
                {!filters.searchQuery && !filters.platform && !filters.status && (
                  <button
                    onClick={() => router.push('/post/new')}
                    className="px-4 py-2 btn-gold rounded-lg transition-colors"
                  >
                    Create Post
                  </button>
                )}
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onEdit={() => handleEdit(post.id)}
                    onDelete={() => handleDelete(post.id)}
                  />
                ))}
              </div>
            ) : (
              <PostList
                posts={sortedPosts}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
      </div>
    </div>
  );
}

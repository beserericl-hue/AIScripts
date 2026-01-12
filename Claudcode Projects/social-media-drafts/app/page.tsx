'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Send, CheckCircle, XCircle, Loader2, FileText, Clock, Calendar, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore, usePostStats } from '@/lib/store';
import StatsCard from '@/components/StatsCard';
import UpcomingPosts from '@/components/UpcomingPosts';
import ActivityFeed from '@/components/ActivityFeed';
import { PostStatus, Post } from '@/lib/types';
import { PLATFORM_LABELS, STATUS_COLORS } from '@/lib/constants';

export default function DashboardPage() {
  const router = useRouter();
  const { migrateFromLegacy, setFilters, posts, settings, updatePost } = useAppStore();
  const stats = usePostStats();
  const [pushingPost, setPushingPost] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<{ postId: string; success: boolean; message: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ postId: string; x: number; y: number } | null>(null);

  // Run migration on first load
  useEffect(() => {
    migrateFromLegacy();
  }, [migrateFromLegacy]);

  const handleStatClick = (status: PostStatus) => {
    setFilters({ status });
    router.push('/drafts');
  };

  const handlePushToSocial = async (post: Post) => {
    if (!settings.webhookUrl) {
      setPushResult({ postId: post.id, success: false, message: 'Webhook URL not configured. Go to Settings to add it.' });
      setTimeout(() => setPushResult(null), 5000);
      return;
    }

    setPushingPost(post.id);
    setPushResult(null);

    try {
      const payload = {
        postId: post.id,
        platforms: post.platforms,
        content: post.content,
        mediaUrl: post.mediaUrl || null,
        mediaData: post.mediaData || null,
        mediaType: post.mediaType || null,
        tags: post.tags,
        scheduledDate: post.scheduledDate || null,
      };

      // Build headers with optional Basic Auth
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (settings.webhookUsername && settings.webhookPassword) {
        const credentials = btoa(`${settings.webhookUsername}:${settings.webhookPassword}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        updatePost(post.id, { status: 'published' });
        setPushResult({ postId: post.id, success: true, message: 'Successfully pushed to social media!' });
      } else {
        setPushResult({ postId: post.id, success: false, message: `Failed: ${response.statusText}` });
      }
    } catch (error) {
      setPushResult({ postId: post.id, success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setPushingPost(null);
      setTimeout(() => setPushResult(null), 5000);
    }
  };

  // Get ready posts for pushing (approved posts)
  const readyPosts = posts.filter((p) => p.status === 'ready');

  // Get draft posts
  const draftPosts = posts.filter((p) => p.status === 'draft');

  // Get scheduled posts (posts with scheduledDate that haven't been published)
  const scheduledPosts = posts
    .filter((p) => p.scheduledDate && p.status !== 'published')
    .sort((a, b) => (a.scheduledDate || 0) - (b.scheduledDate || 0));

  // Auto-post checker - check every minute for posts that should be posted
  useEffect(() => {
    const checkScheduledPosts = async () => {
      const now = Date.now();
      const postsToPublish = posts.filter(
        (p) => p.scheduledDate && p.scheduledDate <= now && p.status === 'ready'
      );

      for (const post of postsToPublish) {
        await handlePushToSocial(post);
      }
    };

    // Check immediately on load
    checkScheduledPosts();

    // Check every minute
    const interval = setInterval(checkScheduledPosts, 60000);
    return () => clearInterval(interval);
  }, [posts, settings]);

  // Handle context menu for scheduled posts
  const handleContextMenu = (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    setContextMenu({ postId, x: e.clientX, y: e.clientY });
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const getContentPreview = (post: Post): string => {
    for (const platform of post.platforms) {
      const content = post.content[platform];
      if (content) return content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }
    return 'Untitled';
  };

  return (
    <div className="text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-[#737373]">Overview of your content</p>
        </div>
        <button
          onClick={() => router.push('/post/new')}
          className="flex items-center gap-2 px-5 py-2.5 btn-gold rounded-md font-medium"
        >
          <Plus className="w-4 h-4" />
          Create New Post
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatsCard status="idea" count={stats.idea} onClick={() => handleStatClick('idea')} />
        <StatsCard status="draft" count={stats.draft} onClick={() => handleStatClick('draft')} />
        <StatsCard status="ready" count={stats.ready} onClick={() => handleStatClick('ready')} />
        <StatsCard status="published" count={stats.published} onClick={() => handleStatClick('published')} />
      </div>

      {/* Drafts Section */}
      {draftPosts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-xl font-semibold text-white">Drafts</h2>
            <span className="text-sm text-[#737373]">({draftPosts.length})</span>
          </div>
          <div className="bg-[#111111] border border-[#262626] rounded-lg overflow-hidden">
            {draftPosts.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between p-4 border-b border-[#262626] last:border-b-0 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[post.status] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate">{getContentPreview(post)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {post.platforms.map((platform) => (
                        <span key={platform} className="text-xs text-[#737373]">
                          {PLATFORM_LABELS[platform]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/post/${post.id}`)}
                  className="px-3 py-1.5 text-sm text-[#A3A3A3] hover:text-white border border-[#333333] rounded-md hover:border-[#D4AF37] transition-colors ml-4"
                >
                  Edit
                </button>
              </div>
            ))}
            {draftPosts.length > 5 && (
              <div className="p-3 text-center border-t border-[#262626]">
                <button
                  onClick={() => {
                    setFilters({ status: 'draft' });
                    router.push('/drafts');
                  }}
                  className="text-sm text-[#D4AF37] hover:underline"
                >
                  View all {draftPosts.length} drafts
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ready to Publish Section */}
      {readyPosts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-xl font-semibold text-white">Ready to Publish</h2>
            <span className="text-sm text-[#737373]">({readyPosts.length})</span>
          </div>
          <div className="bg-[#111111] border border-[#262626] rounded-lg overflow-hidden">
            {readyPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between p-4 border-b border-[#262626] last:border-b-0 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[post.status] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate">{getContentPreview(post)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {post.platforms.map((platform) => (
                        <span key={platform} className="text-xs text-[#737373]">
                          {PLATFORM_LABELS[platform]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  {pushResult && pushResult.postId === post.id && (
                    <div className={`flex items-center gap-1 text-sm ${pushResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {pushResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span className="max-w-[200px] truncate">{pushResult.message}</span>
                    </div>
                  )}
                  <button
                    onClick={() => router.push(`/post/${post.id}`)}
                    className="px-3 py-1.5 text-sm text-[#A3A3A3] hover:text-white border border-[#333333] rounded-md hover:border-[#D4AF37] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handlePushToSocial(post)}
                    disabled={pushingPost === post.id}
                    className="flex items-center gap-2 px-4 py-1.5 btn-gold rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {pushingPost === post.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Post Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Posts Section */}
      {scheduledPosts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-xl font-semibold text-white">Scheduled Posts</h2>
            <span className="text-sm text-[#737373]">({scheduledPosts.length})</span>
          </div>
          <div className="bg-[#111111] border border-[#262626] rounded-lg overflow-hidden">
            {scheduledPosts.map((post) => (
              <div
                key={post.id}
                onContextMenu={(e) => handleContextMenu(e, post.id)}
                className="flex items-center justify-between p-4 border-b border-[#262626] last:border-b-0 hover:bg-[#1a1a1a] transition-colors cursor-context-menu"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[post.status] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate">{getContentPreview(post)}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs text-[#D4AF37]">
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(post.scheduledDate!), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.platforms.map((platform) => (
                          <span key={platform} className="text-xs text-[#737373]">
                            {PLATFORM_LABELS[platform]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {pushResult && pushResult.postId === post.id && (
                    <div className={`flex items-center gap-1 text-sm ${pushResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {pushResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span className="max-w-[200px] truncate">{pushResult.message}</span>
                    </div>
                  )}
                  <button
                    onClick={() => router.push(`/post/${post.id}`)}
                    className="px-3 py-1.5 text-sm text-[#A3A3A3] hover:text-white border border-[#333333] rounded-md hover:border-[#D4AF37] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handlePushToSocial(post)}
                    disabled={pushingPost === post.id || post.status !== 'ready'}
                    className="flex items-center gap-2 px-4 py-1.5 btn-gold rounded-md text-sm font-medium disabled:opacity-50"
                    title={post.status !== 'ready' ? 'Post must be approved first' : 'Post Now'}
                  >
                    {pushingPost === post.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Post Now
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#525252] mt-2">
            Right-click on a post for quick actions. Approved posts will auto-post at their scheduled time.
          </p>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#1a1a1a] border border-[#333333] rounded-lg shadow-xl py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {(() => {
            const post = posts.find(p => p.id === contextMenu.postId);
            if (!post) return null;
            return (
              <>
                <button
                  onClick={() => {
                    router.push(`/post/${contextMenu.postId}`);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#262626] transition-colors"
                >
                  Edit Post
                </button>
                {post.status === 'ready' && (
                  <button
                    onClick={() => {
                      handlePushToSocial(post);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#D4AF37] hover:bg-[#262626] transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Post Now
                  </button>
                )}
                {post.status !== 'ready' && (
                  <button
                    onClick={() => {
                      updatePost(post.id, { status: 'ready' });
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-emerald-400 hover:bg-[#262626] transition-colors flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve for Posting
                  </button>
                )}
                <button
                  onClick={() => {
                    updatePost(contextMenu.postId, { scheduledDate: undefined });
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#262626] transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Remove Schedule
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingPosts />
        <ActivityFeed />
      </div>
    </div>
  );
}

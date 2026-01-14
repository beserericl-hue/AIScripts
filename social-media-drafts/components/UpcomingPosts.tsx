'use client';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Calendar, ChevronRight } from 'lucide-react';
import { useUpcomingPosts } from '@/lib/store';
import { PlatformContent } from '@/lib/types';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/constants';

export default function UpcomingPosts() {
  const router = useRouter();
  const upcomingPosts = useUpcomingPosts(7);

  const getPostPreview = (content: PlatformContent): string => {
    for (const text of Object.values(content)) {
      if (text) return text.substring(0, 50) + (text.length > 50 ? '...' : '');
    }
    return 'No content';
  };

  return (
    <div className="bg-[#111111] border border-[#262626] rounded-xl">
      <div className="p-4 border-b border-[#262626] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#D4AF37]" />
          <h2 className="font-medium text-white">Upcoming Posts</h2>
        </div>
        <span className="text-xs text-[#737373]">Next 7 days</span>
      </div>

      {upcomingPosts.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-[#737373] text-sm">No posts scheduled</p>
          <button
            onClick={() => router.push('/post/new')}
            className="mt-2 text-[#D4AF37] text-sm hover:text-[#F4D03F]"
          >
            Schedule your first post
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#262626]">
          {upcomingPosts.slice(0, 5).map((post) => (
            <button
              key={post.id}
              onClick={() => router.push(`/post/${post.id}`)}
              className="w-full p-4 text-left hover:bg-[#1a1a1a] transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[#737373]">
                    {format(new Date(post.scheduledDate!), 'MMM d, h:mm a')}
                  </span>
                  {post.platforms.map((platform) => (
                    <span
                      key={platform}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[platform]}20`,
                        color: PLATFORM_COLORS[platform],
                      }}
                    >
                      {PLATFORM_LABELS[platform]}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-[#A3A3A3] truncate">
                  {getPostPreview(post.content)}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#525252] shrink-0" />
            </button>
          ))}
        </div>
      )}

      {upcomingPosts.length > 5 && (
        <button
          onClick={() => router.push('/calendar')}
          className="w-full p-3 text-center text-sm text-[#D4AF37] hover:text-[#F4D03F] border-t border-[#262626]"
        >
          View all {upcomingPosts.length} scheduled posts
        </button>
      )}
    </div>
  );
}

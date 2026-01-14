'use client';

import { format } from 'date-fns';
import { Pencil, Trash2, Calendar, ChevronRight } from 'lucide-react';
import { Post } from '@/lib/types';
import { PLATFORM_LABELS, PLATFORM_COLORS, STATUS_LABELS, STATUS_BG_CLASSES } from '@/lib/constants';

interface PostListProps {
  posts: Post[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function PostList({ posts, onEdit, onDelete }: PostListProps) {
  const getContentPreview = (post: Post): string => {
    for (const platform of post.platforms) {
      const content = post.content[platform];
      if (content) return content.substring(0, 80) + (content.length > 80 ? '...' : '');
    }
    return 'No content yet...';
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
      {posts.map((post) => (
        <div
          key={post.id}
          className="p-4 hover:bg-neutral-800/50 transition-colors group flex items-center gap-4"
        >
          {/* Status Indicator */}
          <div
            className={`w-2 h-2 rounded-full shrink-0`}
            style={{
              backgroundColor:
                post.status === 'idea'
                  ? '#737373'
                  : post.status === 'draft'
                  ? '#D97706'
                  : post.status === 'ready'
                  ? '#10B981'
                  : '#3B82F6',
            }}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
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
              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BG_CLASSES[post.status]}`}>
                {STATUS_LABELS[post.status]}
              </span>
              {post.scheduledDate && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(post.scheduledDate), 'MMM d, h:mm a')}
                </span>
              )}
            </div>
            <p
              className="text-sm text-neutral-300 truncate cursor-pointer"
              onClick={() => onEdit(post.id)}
            >
              {getContentPreview(post)}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-neutral-600">
              <span>{format(new Date(post.updatedAt), 'MMM d, yyyy')}</span>
              {post.tags.length > 0 && (
                <span className="truncate">{post.tags.join(', ')}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(post.id)}
              className="p-2 text-neutral-500 hover:text-amber-500 transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(post.id)}
              className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <ChevronRight
            className="w-4 h-4 text-neutral-600 cursor-pointer"
            onClick={() => onEdit(post.id)}
          />
        </div>
      ))}
    </div>
  );
}

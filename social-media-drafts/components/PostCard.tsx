'use client';

import { format } from 'date-fns';
import { Pencil, Trash2, Calendar } from 'lucide-react';
import { Post } from '@/lib/types';
import { PLATFORM_LABELS, PLATFORM_COLORS, STATUS_LABELS, STATUS_BG_CLASSES } from '@/lib/constants';

interface PostCardProps {
  post: Post;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PostCard({ post, onEdit, onDelete }: PostCardProps) {
  const getContentPreview = (): string => {
    for (const platform of post.platforms) {
      const content = post.content[platform];
      if (content) return content;
    }
    return 'No content yet...';
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 hover:border-neutral-700 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {post.platforms.map((platform) => (
            <span
              key={platform}
              className="text-sm font-medium"
              style={{ color: PLATFORM_COLORS[platform] }}
            >
              {PLATFORM_LABELS[platform]}
            </span>
          ))}
          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BG_CLASSES[post.status]}`}>
            {STATUS_LABELS[post.status]}
          </span>
          {post.scheduledDate && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-900/30 text-amber-400">
              <Calendar className="w-3 h-3" />
              {format(new Date(post.scheduledDate), 'MMM d')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="text-neutral-500 hover:text-amber-500 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-neutral-500 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Preview */}
      <p
        className="text-neutral-300 text-sm mb-3 line-clamp-3 cursor-pointer"
        onClick={onEdit}
      >
        {getContentPreview()}
      </p>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Updated {format(new Date(post.updatedAt), 'MMM d, h:mm a')}</span>
        <span>
          {Object.values(post.content).reduce((acc, c) => acc + (c?.length || 0), 0)} chars
        </span>
      </div>
    </div>
  );
}

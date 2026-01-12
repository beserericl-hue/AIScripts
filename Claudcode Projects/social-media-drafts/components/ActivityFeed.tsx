'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Activity, PenLine, Send, Calendar, Trash2, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { ActivityItem } from '@/lib/types';

const activityIcons: Record<ActivityItem['type'], React.ReactNode> = {
  created: <Plus className="w-3.5 h-3.5" />,
  edited: <PenLine className="w-3.5 h-3.5" />,
  published: <Send className="w-3.5 h-3.5" />,
  scheduled: <Calendar className="w-3.5 h-3.5" />,
  deleted: <Trash2 className="w-3.5 h-3.5" />,
};

const activityLabels: Record<ActivityItem['type'], string> = {
  created: 'Created',
  edited: 'Edited',
  published: 'Published',
  scheduled: 'Scheduled',
  deleted: 'Deleted',
};

const activityColors: Record<ActivityItem['type'], string> = {
  created: 'text-emerald-400 bg-emerald-900/30',
  edited: 'text-[#D4AF37] bg-[#D4AF37]/20',
  published: 'text-blue-400 bg-blue-900/30',
  scheduled: 'text-purple-400 bg-purple-900/30',
  deleted: 'text-red-400 bg-red-900/30',
};

export default function ActivityFeed() {
  const router = useRouter();
  const { activity } = useAppStore();

  return (
    <div className="bg-[#111111] border border-[#262626] rounded-xl">
      <div className="p-4 border-b border-[#262626] flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#D4AF37]" />
        <h2 className="font-medium text-white">Recent Activity</h2>
      </div>

      {activity.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-[#737373] text-sm">No recent activity</p>
          <p className="text-[#525252] text-xs mt-1">
            Activity will appear here as you create and edit posts
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#262626]">
          {activity.slice(0, 10).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.type !== 'deleted') {
                  router.push(`/post/${item.postId}`);
                }
              }}
              disabled={item.type === 'deleted'}
              className="w-full p-4 text-left hover:bg-[#1a1a1a] transition-colors flex items-start gap-3 disabled:opacity-50 disabled:cursor-default"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${activityColors[item.type]}`}
              >
                {activityIcons[item.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#A3A3A3]">
                  <span className="text-[#737373]">{activityLabels[item.type]}</span>{' '}
                  <span className="truncate">&quot;{item.postTitle}&quot;</span>
                </p>
                <p className="text-xs text-[#525252] mt-0.5">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

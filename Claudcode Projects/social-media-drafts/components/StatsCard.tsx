'use client';

import { PostStatus } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';

interface StatsCardProps {
  status: PostStatus;
  count: number;
  onClick?: () => void;
}

export default function StatsCard({ status, count, onClick }: StatsCardProps) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-[#111111] border border-[#262626] rounded-xl hover:border-[#D4AF37]/50 transition-all text-left w-full group"
    >
      <div
        className="w-2 h-2 rounded-full mb-3"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      <p className="text-2xl font-semibold text-white mb-1 group-hover:text-[#D4AF37] transition-colors">{count}</p>
      <p className="text-sm text-[#737373]">{STATUS_LABELS[status]}</p>
    </button>
  );
}

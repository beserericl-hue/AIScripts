'use client';

import { LayoutGrid, List } from 'lucide-react';

interface ViewToggleProps {
  view: 'grid' | 'list';
  onChange: (view: 'grid' | 'list') => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1">
      <button
        onClick={() => onChange('grid')}
        className={`p-2 rounded transition-colors ${
          view === 'grid'
            ? 'bg-neutral-800 text-neutral-100'
            : 'text-neutral-500 hover:text-neutral-300'
        }`}
        title="Grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`p-2 rounded transition-colors ${
          view === 'list'
            ? 'bg-neutral-800 text-neutral-100'
            : 'text-neutral-500 hover:text-neutral-300'
        }`}
        title="List view"
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}

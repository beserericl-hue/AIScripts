'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Calendar, Settings, Plus, FolderPlus, Tag, X, Folder } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/drafts',
    label: 'Drafts',
    icon: FileText,
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: Calendar,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { folders, addFolder } = useAppStore();
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newTagName, setNewTagName] = useState('');

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim());
      setNewFolderName('');
      setShowFolderModal(false);
    }
  };

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      // Tags are created inline when adding to posts, but we can show a success message
      setNewTagName('');
      setShowTagModal(false);
    }
  };

  return (
    <>
      <aside className="w-56 bg-[#0a0a0a] border-r border-[#262626] h-full flex flex-col">
        {/* Navigation */}
        <nav className="flex-1 p-3 pt-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'text-[#A3A3A3] hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Folders Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Folders</span>
              <button
                onClick={() => setShowFolderModal(true)}
                className="p-1 text-[#737373] hover:text-[#D4AF37] transition-colors"
                title="Create folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
            {folders.length === 0 ? (
              <p className="px-3 text-xs text-[#525252]">No folders yet</p>
            ) : (
              <ul className="space-y-0.5">
                {folders.slice(0, 5).map((folder) => (
                  <li key={folder.id}>
                    <Link
                      href={`/drafts?folder=${folder.id}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#A3A3A3] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: folder.color }}
                      />
                      <span className="truncate">{folder.name}</span>
                    </Link>
                  </li>
                ))}
                {folders.length > 5 && (
                  <li className="px-3 text-xs text-[#525252]">+{folders.length - 5} more</li>
                )}
              </ul>
            )}
          </div>

          {/* Tags Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Tags</span>
              <button
                onClick={() => setShowTagModal(true)}
                className="p-1 text-[#737373] hover:text-[#D4AF37] transition-colors"
                title="Create tag"
              >
                <Tag className="w-4 h-4" />
              </button>
            </div>
            <p className="px-3 text-xs text-[#525252]">Add tags to posts</p>
          </div>
        </nav>

        {/* New Post Button */}
        <div className="p-3 border-t border-[#262626]">
          <Link
            href="/post/new"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 btn-gold rounded-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            New Post
          </Link>
        </div>
      </aside>

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-[#262626] rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="text-lg font-semibold text-white">New Folder</h2>
              </div>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-[#737373] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-4 py-2.5 input-dark rounded-lg mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowFolderModal(false);
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowFolderModal(false)}
                className="flex-1 px-4 py-2 border border-[#262626] text-[#A3A3A3] rounded-lg hover:bg-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 px-4 py-2 btn-gold rounded-lg disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Info Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-[#262626] rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="text-lg font-semibold text-white">Tags</h2>
              </div>
              <button
                onClick={() => setShowTagModal(false)}
                className="text-[#737373] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#A3A3A3] text-sm mb-4">
              Tags are created automatically when you add them to posts. Simply type a tag name in the post editor and press Enter.
            </p>
            <button
              onClick={() => setShowTagModal(false)}
              className="w-full px-4 py-2 btn-gold rounded-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

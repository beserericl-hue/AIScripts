'use client';

import { useState } from 'react';
import { Folder, FolderPlus, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Folder as FolderType } from '@/lib/types';

interface FolderPanelProps {
  selectedFolderId?: string;
  onFolderSelect: (folderId?: string) => void;
}

export default function FolderPanel({ selectedFolderId, onFolderSelect }: FolderPanelProps) {
  const { folders, posts, addFolder, updateFolder, deleteFolder } = useAppStore();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const handleEditFolder = () => {
    if (editingFolder && newFolderName.trim()) {
      updateFolder(editingFolder.id, { name: newFolderName.trim() });
      setEditingFolder(null);
      setNewFolderName('');
    }
  };

  const handleDeleteFolder = (id: string) => {
    if (confirm('Delete this folder? Posts will not be deleted.')) {
      deleteFolder(id);
      if (selectedFolderId === id) {
        onFolderSelect(undefined);
      }
    }
    setMenuOpenId(null);
  };

  const getPostCount = (folderId?: string) => {
    if (!folderId) return posts.length;
    return posts.filter((p) => p.folderId === folderId).length;
  };

  const startEdit = (folder: FolderType) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setMenuOpenId(null);
  };

  return (
    <div className="w-56 shrink-0">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg">
        <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-400">Folders</h3>
          <button
            onClick={() => setShowNewFolder(true)}
            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
            title="New folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2">
          {/* All Posts */}
          <button
            onClick={() => onFolderSelect(undefined)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
              !selectedFolderId
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-800/50'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span className="flex-1 text-sm">All Posts</span>
            <span className="text-xs text-neutral-600">{posts.length}</span>
          </button>

          {/* Folder List */}
          {folders.map((folder) => (
            <div key={folder.id} className="relative">
              <button
                onClick={() => onFolderSelect(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:bg-neutral-800/50'
                }`}
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: folder.color }}
                />
                <span className="flex-1 text-sm truncate">{folder.name}</span>
                <span className="text-xs text-neutral-600">
                  {getPostCount(folder.id)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === folder.id ? null : folder.id);
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:text-neutral-200"
                >
                  <MoreHorizontal className="w-3 h-3" />
                </button>
              </button>

              {/* Dropdown Menu */}
              {menuOpenId === folder.id && (
                <div className="absolute right-0 top-full z-10 mt-1 w-32 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg py-1">
                  <button
                    onClick={() => startEdit(folder)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
                  >
                    <Pencil className="w-3 h-3" />
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-neutral-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* New Folder Input */}
          {showNewFolder && (
            <div className="mt-2 p-2 bg-neutral-800 rounded-lg">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFolder();
                  if (e.key === 'Escape') {
                    setShowNewFolder(false);
                    setNewFolderName('');
                  }
                }}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderName('');
                  }}
                  className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFolder}
                  disabled={!newFolderName.trim()}
                  className="px-2 py-1 text-xs bg-amber-600 text-white rounded disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Edit Folder Input */}
          {editingFolder && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 w-80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-neutral-100">Rename Folder</h3>
                  <button
                    onClick={() => {
                      setEditingFolder(null);
                      setNewFolderName('');
                    }}
                    className="text-neutral-500 hover:text-neutral-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-neutral-600"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditFolder();
                    if (e.key === 'Escape') {
                      setEditingFolder(null);
                      setNewFolderName('');
                    }
                  }}
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setEditingFolder(null);
                      setNewFolderName('');
                    }}
                    className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditFolder}
                    disabled={!newFolderName.trim()}
                    className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

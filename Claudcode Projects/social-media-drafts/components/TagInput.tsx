'use client';

import { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const newTag = input.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-neutral-900 border border-neutral-800 rounded-lg focus-within:border-neutral-700">
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 text-neutral-300 text-sm rounded-md"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? "Add tags (press Enter)" : ""}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-neutral-200 placeholder:text-neutral-600"
      />
    </div>
  );
}

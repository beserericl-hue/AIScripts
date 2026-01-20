'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Wand2, Loader2, GripHorizontal } from 'lucide-react';
import { Platform } from '@/lib/types';
import { CHARACTER_LIMITS, PLATFORM_LABELS } from '@/lib/constants';
import { useAppStore } from '@/lib/store';

type Tone = 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational';

const DEFAULT_TEXTAREA_HEIGHT = 200;
const MIN_TEXTAREA_HEIGHT = 100;
const MAX_TEXTAREA_HEIGHT = 800;

interface PlatformEditorProps {
  platform: Platform;
  content: string;
  onChange: (content: string) => void;
  onOpenAIModal?: () => void;
}

export default function PlatformEditor({
  platform,
  content,
  onChange,
  onOpenAIModal,
}: PlatformEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showQuickGenerate, setShowQuickGenerate] = useState(false);
  const [quickIdea, setQuickIdea] = useState('');
  const [quickTone, setQuickTone] = useState<Tone>('casual');

  const { settings, updateSettings } = useAppStore();
  const [textareaHeight, setTextareaHeight] = useState(
    settings.editorTextareaHeight || DEFAULT_TEXTAREA_HEIGHT
  );
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Sync height with settings when they change (e.g., loaded from MongoDB)
  useEffect(() => {
    if (settings.editorTextareaHeight && settings.editorTextareaHeight !== textareaHeight) {
      setTextareaHeight(settings.editorTextareaHeight);
    }
  }, [settings.editorTextareaHeight]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startY.current = e.clientY;
    startHeight.current = textareaHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [textareaHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientY - startY.current;
      const newHeight = Math.min(
        MAX_TEXTAREA_HEIGHT,
        Math.max(MIN_TEXTAREA_HEIGHT, startHeight.current + delta)
      );
      setTextareaHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Persist the height to settings (which syncs to MongoDB)
        updateSettings({ editorTextareaHeight: textareaHeight });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [textareaHeight, updateSettings]);

  const limit = CHARACTER_LIMITS[platform];
  const charCount = content.length;
  const isOverLimit = charCount > limit;
  const percentage = Math.min((charCount / limit) * 100, 100);

  const getCounterColor = () => {
    if (isOverLimit) return 'text-red-400';
    if (percentage > 90) return 'text-[#D4AF37]';
    return 'text-[#525252]';
  };

  const handleQuickGenerate = async () => {
    if (!quickIdea.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: quickIdea,
          tone: quickTone,
          platform,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onChange(data.content);
        setShowQuickGenerate(false);
        setQuickIdea('');
      }
    } catch (err) {
      console.error('Failed to generate:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Write your ${PLATFORM_LABELS[platform]} post...`}
          className="flex-1 w-full p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] resize-none focus:outline-none focus:border-[#D4AF37]"
          style={{ height: `${textareaHeight}px` }}
        />

        {/* Wand button for quick AI generation */}
        <button
          onClick={() => setShowQuickGenerate(!showQuickGenerate)}
          className="absolute top-3 right-3 p-2 rounded-lg bg-[#1a1a1a] border border-[#262626] text-[#D4AF37] hover:bg-[#262626] hover:border-[#D4AF37] transition-all"
          title="AI Generate for this platform"
        >
          <Wand2 className="w-4 h-4" />
        </button>

        {/* Quick generate dropdown */}
        {showQuickGenerate && (
          <div className="absolute top-14 right-3 w-80 bg-[#111111] border border-[#262626] rounded-lg shadow-xl z-10 p-4">
            <div className="text-sm font-medium text-[#A3A3A3] mb-2">Quick Generate</div>
            <input
              type="text"
              value={quickIdea}
              onChange={(e) => setQuickIdea(e.target.value)}
              placeholder="Enter your idea..."
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] text-sm focus:outline-none focus:border-[#D4AF37] mb-3"
              onKeyDown={(e) => e.key === 'Enter' && handleQuickGenerate()}
            />
            <select
              value={quickTone}
              onChange={(e) => setQuickTone(e.target.value as Tone)}
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm focus:outline-none focus:border-[#D4AF37] mb-3"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="humorous">Humorous</option>
              <option value="inspirational">Inspirational</option>
              <option value="educational">Educational</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowQuickGenerate(false)}
                className="flex-1 px-3 py-2 text-[#737373] hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickGenerate}
                disabled={isGenerating || !quickIdea.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 btn-gold rounded-lg text-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Generate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="flex items-center justify-center h-4 cursor-ns-resize group hover:bg-[#1a1a1a] rounded-b-lg transition-colors -mt-1"
        title="Drag to resize"
      >
        <GripHorizontal className="w-4 h-4 text-[#525252] group-hover:text-[#D4AF37] transition-colors" />
      </div>

      {/* Character Counter */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          {/* Progress Bar */}
          <div className="w-32 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isOverLimit ? 'bg-red-500' : percentage > 90 ? 'bg-[#D4AF37]' : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <span className={`text-sm font-medium ${getCounterColor()}`}>
          {charCount.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

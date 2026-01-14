'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { Platform, PlatformContent } from '@/lib/types';
import { PLATFORM_LABELS } from '@/lib/constants';

type Tone = 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational';

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  platforms: Platform[];
  activePlatform: Platform;
  onGenerate: (content: PlatformContent) => void;
}

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-appropriate' },
  { value: 'casual', label: 'Casual', description: 'Friendly and conversational' },
  { value: 'humorous', label: 'Humorous', description: 'Witty and entertaining' },
  { value: 'inspirational', label: 'Inspirational', description: 'Motivating and uplifting' },
  { value: 'educational', label: 'Educational', description: 'Informative and instructive' },
];

export default function AIGenerateModal({
  isOpen,
  onClose,
  platforms,
  activePlatform,
  onGenerate,
}: AIGenerateModalProps) {
  const [idea, setIdea] = useState('');
  const [tone, setTone] = useState<Tone>('casual');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generateForAll, setGenerateForAll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('Please enter an idea for your post');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const targetPlatforms = generateForAll ? platforms : [activePlatform];
    const newContent: PlatformContent = {};

    try {
      for (const platform of targetPlatforms) {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea,
            tone,
            platform,
            additionalContext: additionalContext.trim() || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate content');
        }

        const data = await response.json();
        newContent[platform] = data.content;
      }

      onGenerate(newContent);
      onClose();

      // Reset form
      setIdea('');
      setTone('casual');
      setAdditionalContext('');
      setGenerateForAll(false);
    } catch (err) {
      setError('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#111111] border border-[#262626] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-lg font-semibold text-white">AI Generate Post</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#737373] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Idea Input */}
          <div>
            <label className="block text-sm font-medium text-[#A3A3A3] mb-2">
              What&apos;s your post idea? <span className="text-red-400">*</span>
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g., Announce our new product launch, Share tips about productivity..."
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] resize-none focus:outline-none focus:border-[#D4AF37] min-h-[100px]"
            />
          </div>

          {/* Tone Selection */}
          <div>
            <label className="block text-sm font-medium text-[#A3A3A3] mb-2">
              Tone
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  className={`px-3 py-2 rounded-lg text-left transition-all ${
                    tone === option.value
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#0a0a0a] border-[#262626] text-[#A3A3A3] hover:border-[#404040]'
                  } border`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs opacity-70">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Context */}
          <div>
            <label className="block text-sm font-medium text-[#A3A3A3] mb-2">
              Additional Context <span className="text-[#525252]">(optional)</span>
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any specific details, keywords, or requirements..."
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white placeholder-[#525252] resize-none focus:outline-none focus:border-[#D4AF37] min-h-[80px]"
            />
          </div>

          {/* Generate For Options */}
          {platforms.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-[#A3A3A3] mb-2">
                Generate for
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setGenerateForAll(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    !generateForAll
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#0a0a0a] border-[#262626] text-[#A3A3A3] hover:border-[#404040]'
                  } border`}
                >
                  {PLATFORM_LABELS[activePlatform]} only
                </button>
                <button
                  onClick={() => setGenerateForAll(true)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    generateForAll
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#0a0a0a] border-[#262626] text-[#A3A3A3] hover:border-[#404040]'
                  } border`}
                >
                  All {platforms.length} platforms
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#262626]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#A3A3A3] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !idea.trim()}
            className="flex items-center gap-2 px-5 py-2 btn-gold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

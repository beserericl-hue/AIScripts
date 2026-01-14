'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Calendar, Folder, Sparkles, Image, Video } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Platform, PostStatus, PlatformContent } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS, DEFAULT_PLATFORMS } from '@/lib/constants';
import PlatformTabs from '@/components/PlatformTabs';
import PlatformEditor from '@/components/PlatformEditor';
import TagInput from '@/components/TagInput';
import AIGenerateModal from '@/components/AIGenerateModal';
import ImageDropZone from '@/components/ImageDropZone';

function NewPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, folders, addPost } = useAppStore();

  // Get scheduled date from URL if coming from calendar
  const scheduledDateParam = searchParams.get('scheduledDate');

  // Form state
  const [platforms, setPlatforms] = useState<Platform[]>(
    settings.defaultPlatforms.length > 0 ? settings.defaultPlatforms : DEFAULT_PLATFORMS
  );
  const [activePlatform, setActivePlatform] = useState<Platform>(platforms[0]);
  const [content, setContent] = useState<PlatformContent>({});
  const [status, setStatus] = useState<PostStatus>('idea');
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | undefined>();
  const [scheduledDate, setScheduledDate] = useState<string>(
    scheduledDateParam
      ? new Date(parseInt(scheduledDateParam)).toISOString().slice(0, 16)
      : ''
  );
  const [mediaUrl, setMediaUrl] = useState<string>(''); // For video URLs
  const [mediaData, setMediaData] = useState<string | undefined>(); // For uploaded images (base64)
  const [isSaving, setIsSaving] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // Ensure active platform is in platforms list
  useEffect(() => {
    if (!platforms.includes(activePlatform) && platforms.length > 0) {
      setActivePlatform(platforms[0]);
    }
  }, [platforms, activePlatform]);

  const handlePlatformToggle = (platform: Platform) => {
    if (platforms.includes(platform)) {
      // Don't allow removing the last platform
      if (platforms.length === 1) return;
      setPlatforms(platforms.filter((p) => p !== platform));
    } else {
      setPlatforms([...platforms, platform]);
      setActivePlatform(platform);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent({ ...content, [activePlatform]: newContent });
  };

  const handleSave = async () => {
    setIsSaving(true);

    const post = addPost({
      platforms,
      content,
      status,
      tags,
      folderId,
      mediaUrl: mediaUrl.trim() || undefined,
      mediaData: mediaData,
      mediaType: mediaData ? 'image' : (mediaUrl.trim() ? 'video' : undefined),
      scheduledDate: scheduledDate ? new Date(scheduledDate).getTime() : undefined,
    });

    router.push(`/post/${post.id}`);
  };

  const hasContent = Object.values(content).some((c) => c && c.trim());

  const handleAIGenerate = (generatedContent: PlatformContent) => {
    setContent({ ...content, ...generatedContent });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-[#737373] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-white">New Post</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#262626] text-[#D4AF37] rounded-lg hover:bg-[#262626] hover:border-[#D4AF37] transition-all"
              title="AI Generate"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">AI Generate</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasContent}
              className="flex items-center gap-2 px-4 py-2 btn-gold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Post'}
            </button>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="bg-[#111111] border border-[#262626] rounded-lg overflow-hidden mb-6">
          <PlatformTabs
            platforms={platforms}
            activePlatform={activePlatform}
            onPlatformChange={setActivePlatform}
            onPlatformToggle={handlePlatformToggle}
          />

          {/* Editor */}
          <div className="p-4">
            <PlatformEditor
              platform={activePlatform}
              content={content[activePlatform] || ''}
              onChange={handleContentChange}
              onOpenAIModal={() => setShowAIModal(true)}
            />
          </div>
        </div>

        {/* Status Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#A3A3A3] mb-3">Status</label>
          <div className="flex gap-2">
            {(Object.keys(STATUS_LABELS) as PostStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === s
                    ? 'text-white'
                    : 'bg-[#111111] text-[#737373] hover:bg-[#1a1a1a]'
                }`}
                style={
                  status === s
                    ? { backgroundColor: STATUS_COLORS[s] }
                    : undefined
                }
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#A3A3A3] mb-3">
            <Calendar className="w-4 h-4 inline mr-2" />
            Schedule
          </label>
          <input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="px-4 py-2 bg-[#111111] border border-[#262626] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
          />
          {scheduledDate && (
            <button
              onClick={() => setScheduledDate('')}
              className="ml-3 text-sm text-[#737373] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Folder */}
        {folders.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#A3A3A3] mb-3">
              <Folder className="w-4 h-4 inline mr-2" />
              Folder
            </label>
            <select
              value={folderId || ''}
              onChange={(e) => setFolderId(e.target.value || undefined)}
              className="px-4 py-2 bg-[#111111] border border-[#262626] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Media Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#A3A3A3] mb-3">
            <Image className="w-4 h-4 inline mr-2" />
            Media
          </label>

          {/* Image Upload */}
          <div className="mb-4">
            <p className="text-xs text-[#737373] mb-2">Upload Image (PNG or JPG)</p>
            <ImageDropZone
              imageData={mediaData}
              onChange={setMediaData}
            />
          </div>

          {/* Video URL */}
          <div>
            <p className="text-xs text-[#737373] mb-2">Or enter video URL</p>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="w-full px-4 py-2 bg-[#111111] border border-[#262626] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#D4AF37]"
            />
            {mediaUrl && (
              <div className="mt-2 p-3 bg-[#1a1a1a] rounded-lg border border-[#262626]">
                <div className="flex items-center gap-2 text-sm text-[#A3A3A3]">
                  <Video className="w-4 h-4" />
                  <span className="truncate">{mediaUrl}</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-[#525252] mt-3">
            Media will be sent to the webhook when you post.
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-[#A3A3A3] mb-3">Tags</label>
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </div>

      {/* AI Generate Modal */}
      <AIGenerateModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        platforms={platforms}
        activePlatform={activePlatform}
        onGenerate={handleAIGenerate}
      />
    </div>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-[#737373]">Loading...</div>
      </div>
    }>
      <NewPostContent />
    </Suspense>
  );
}

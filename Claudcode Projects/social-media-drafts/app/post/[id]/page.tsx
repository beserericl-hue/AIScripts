'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Calendar, Folder, Trash2, Sparkles, Image, Video, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Platform, PostStatus, PlatformContent, Post } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import PlatformTabs from '@/components/PlatformTabs';
import PlatformEditor from '@/components/PlatformEditor';
import TagInput from '@/components/TagInput';
import AIGenerateModal from '@/components/AIGenerateModal';
import ImageDropZone from '@/components/ImageDropZone';

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  const { getPost, updatePost, deletePost, folders, settings } = useAppStore();

  // Form state
  const [platforms, setPlatforms] = useState<Platform[]>(['twitter']);
  const [activePlatform, setActivePlatform] = useState<Platform>('twitter');
  const [content, setContent] = useState<PlatformContent>({});
  const [status, setStatus] = useState<PostStatus>('idea');
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | undefined>();
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>(''); // For video URLs
  const [mediaData, setMediaData] = useState<string | undefined>(); // For uploaded images (base64)
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load post data
  useEffect(() => {
    const post = getPost(postId);
    if (post) {
      setPlatforms(post.platforms);
      setActivePlatform(post.platforms[0]);
      setContent(post.content);
      setStatus(post.status);
      setTags(post.tags);
      setFolderId(post.folderId);
      setMediaUrl(post.mediaUrl || '');
      setMediaData(post.mediaData);
      setScheduledDate(
        post.scheduledDate
          ? new Date(post.scheduledDate).toISOString().slice(0, 16)
          : ''
      );
    } else {
      setNotFound(true);
    }
  }, [postId, getPost]);

  // Ensure active platform is in platforms list
  useEffect(() => {
    if (!platforms.includes(activePlatform) && platforms.length > 0) {
      setActivePlatform(platforms[0]);
    }
  }, [platforms, activePlatform]);

  const handlePlatformToggle = (platform: Platform) => {
    setHasChanges(true);
    if (platforms.includes(platform)) {
      if (platforms.length === 1) return;
      setPlatforms(platforms.filter((p) => p !== platform));
    } else {
      setPlatforms([...platforms, platform]);
      setActivePlatform(platform);
    }
  };

  const handleContentChange = (newContent: string) => {
    setHasChanges(true);
    setContent({ ...content, [activePlatform]: newContent });
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    updatePost(postId, {
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

    setHasChanges(false);
    setIsSaving(false);
  }, [postId, platforms, content, status, tags, folderId, mediaUrl, mediaData, scheduledDate, updatePost]);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this post?')) {
      deletePost(postId);
      router.push('/drafts');
    }
  };

  // Auto-save
  useEffect(() => {
    if (!hasChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasChanges, handleSave]);

  const handleAIGenerate = (generatedContent: PlatformContent) => {
    setContent({ ...content, ...generatedContent });
    setHasChanges(true);
  };

  const handleApprove = () => {
    setStatus('ready');
    setHasChanges(true);
  };

  const handlePostNow = async () => {
    if (!settings.webhookUrl) {
      setPushResult({ success: false, message: 'Webhook URL not configured. Go to Settings to add it.' });
      setTimeout(() => setPushResult(null), 5000);
      return;
    }

    // Save any pending changes first
    if (hasChanges) {
      await handleSave();
    }

    setIsPushing(true);
    setPushResult(null);

    try {
      const payload = {
        postId,
        platforms,
        content,
        mediaUrl: mediaUrl.trim() || null,
        mediaData: mediaData || null,
        mediaType: mediaData ? 'image' : (mediaUrl.trim() ? 'video' : null),
        tags,
        scheduledDate: scheduledDate ? new Date(scheduledDate).getTime() : null,
      };

      // Build headers with optional Basic Auth
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (settings.webhookUsername && settings.webhookPassword) {
        const credentials = btoa(`${settings.webhookUsername}:${settings.webhookPassword}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        updatePost(postId, { status: 'published' });
        setStatus('published');
        setPushResult({ success: true, message: 'Successfully pushed to social media!' });
      } else {
        setPushResult({ success: false, message: `Failed: ${response.statusText}` });
      }
    } catch (error) {
      setPushResult({ success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsPushing(false);
      setTimeout(() => setPushResult(null), 5000);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-2">Post Not Found</h1>
          <p className="text-[#737373] mb-6">This post may have been deleted.</p>
          <button
            onClick={() => router.push('/drafts')}
            className="px-4 py-2 btn-gold rounded-lg transition-colors"
          >
            Back to Drafts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/drafts')}
              className="p-2 text-[#737373] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">Edit Post</h1>
              {hasChanges && (
                <p className="text-xs text-[#737373]">Unsaved changes</p>
              )}
              {!hasChanges && isSaving && (
                <p className="text-xs text-[#D4AF37]">Saving...</p>
              )}
              {!hasChanges && !isSaving && (
                <p className="text-xs text-emerald-500">Saved</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Push Result Message */}
            {pushResult && (
              <div className={`flex items-center gap-1 text-sm ${pushResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {pushResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span className="max-w-[200px] truncate">{pushResult.message}</span>
              </div>
            )}
            <button
              onClick={() => setShowAIModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#262626] text-[#D4AF37] rounded-lg hover:bg-[#262626] hover:border-[#D4AF37] transition-all"
              title="AI Generate"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">AI Generate</span>
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-[#737373] hover:text-red-500 transition-colors"
              title="Delete post"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 btn-gold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            {/* Approve for Posting button - only show if not ready or published */}
            {status !== 'ready' && status !== 'published' && (
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                Approve for Posting
              </button>
            )}
            {/* Post Now button - only show if ready */}
            {status === 'ready' && (
              <button
                onClick={handlePostNow}
                disabled={isPushing}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] hover:bg-[#C4A030] text-black rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {isPushing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Post Now
              </button>
            )}
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
                onClick={() => {
                  setStatus(s);
                  setHasChanges(true);
                }}
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
            onChange={(e) => {
              setScheduledDate(e.target.value);
              setHasChanges(true);
            }}
            className="px-4 py-2 bg-[#111111] border border-[#262626] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
          />
          {scheduledDate && (
            <button
              onClick={() => {
                setScheduledDate('');
                setHasChanges(true);
              }}
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
              onChange={(e) => {
                setFolderId(e.target.value || undefined);
                setHasChanges(true);
              }}
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
              onChange={(data) => {
                setMediaData(data);
                setHasChanges(true);
              }}
            />
          </div>

          {/* Video URL */}
          <div>
            <p className="text-xs text-[#737373] mb-2">Or enter video URL</p>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => {
                setMediaUrl(e.target.value);
                setHasChanges(true);
              }}
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
          <TagInput
            tags={tags}
            onChange={(newTags) => {
              setTags(newTags);
              setHasChanges(true);
            }}
          />
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

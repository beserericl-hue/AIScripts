'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, pointerWithin, DragOverlay } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus, GripVertical, Calendar as CalendarIcon, Grid3X3, List, Clock, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Post } from '@/lib/types';
import { PLATFORM_LABELS, STATUS_COLORS } from '@/lib/constants';

type CalendarView = 'month' | 'week' | 'day';

interface ContextMenuState {
  postId: string;
  x: number;
  y: number;
}

interface DraggablePostProps {
  post: Post;
  onEdit: () => void;
  onContextMenu: (e: React.MouseEvent, postId: string) => void;
}

function DraggablePost({ post, onEdit, onContextMenu }: DraggablePostProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
    data: { post },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 1000 : undefined,
      }
    : undefined;

  const getContentPreview = (): string => {
    for (const platform of post.platforms) {
      const content = post.content[platform];
      if (content) return content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }
    return 'Untitled';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-2 bg-[#1a1a1a] rounded-lg border border-[#262626] cursor-grab active:cursor-grabbing hover:border-[#D4AF37]/50 transition-all ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
      onContextMenu={(e) => onContextMenu(e, post.id)}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-[#525252] shrink-0" />
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLORS[post.status] }}
        />
        <span
          className="text-sm text-[#A3A3A3] truncate flex-1 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          {getContentPreview()}
        </span>
      </div>
      <div className="flex items-center gap-1 mt-1 ml-6">
        {post.platforms.slice(0, 2).map((platform) => (
          <span key={platform} className="text-xs text-[#525252]">
            {PLATFORM_LABELS[platform]}
          </span>
        ))}
      </div>
    </div>
  );
}

// Smaller version for calendar cells
function DraggablePostSmall({ post, onEdit, onContextMenu }: DraggablePostProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
    data: { post },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 1000 : undefined,
      }
    : undefined;

  const getContentPreview = (): string => {
    for (const platform of post.platforms) {
      const content = post.content[platform];
      if (content) return content.substring(0, 15) + (content.length > 15 ? '...' : '');
    }
    return 'Untitled';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`text-xs px-1.5 py-1 rounded bg-[#1a1a1a] flex items-center gap-1 cursor-grab active:cursor-grabbing hover:bg-[#262626] ${
        isDragging ? 'opacity-50' : ''
      }`}
      onContextMenu={(e) => onContextMenu(e, post.id)}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-3 h-3 text-[#525252] shrink-0" />
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: STATUS_COLORS[post.status] }}
      />
      <span
        className="truncate flex-1 text-[#A3A3A3] hover:text-white transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        {getContentPreview()}
      </span>
      {post.scheduledDate && (
        <span className="text-[#525252] shrink-0">
          {format(new Date(post.scheduledDate), 'h:mma')}
        </span>
      )}
    </div>
  );
}

interface DroppableDayProps {
  date: Date;
  posts: Post[];
  isCurrentMonth?: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onEditPost: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, postId: string) => void;
  view: CalendarView;
}

function DroppableDay({ date, posts, isCurrentMonth = true, isToday, isSelected, onSelect, onEditPost, onContextMenu, view }: DroppableDayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: date.toISOString(),
  });

  const maxPosts = view === 'month' ? 2 : view === 'week' ? 4 : 10;

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`p-2 rounded-lg border transition-all text-left flex flex-col cursor-pointer ${
        view === 'month' ? 'h-28' : view === 'week' ? 'h-40' : 'min-h-[400px]'
      } ${
        isSelected
          ? 'border-[#D4AF37] bg-[#D4AF37]/10'
          : isOver
          ? 'border-[#D4AF37] bg-[#D4AF37]/20 ring-2 ring-[#D4AF37]/50'
          : isCurrentMonth
          ? 'border-[#262626] bg-[#111111] hover:border-[#404040]'
          : 'border-[#1a1a1a] bg-[#0a0a0a]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-sm font-medium ${
            isToday
              ? 'w-6 h-6 bg-[#D4AF37] text-black rounded-full flex items-center justify-center'
              : isCurrentMonth
              ? 'text-[#737373]'
              : 'text-[#404040]'
          }`}
        >
          {format(date, view === 'day' ? 'EEEE, MMMM d' : 'd')}
        </span>
        {view !== 'month' && (
          <span className="text-xs text-[#525252]">{format(date, 'EEE')}</span>
        )}
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {posts.slice(0, maxPosts).map((post) => (
          <DraggablePostSmall
            key={post.id}
            post={post}
            onEdit={() => onEditPost(post.id)}
            onContextMenu={onContextMenu}
          />
        ))}
        {posts.length > maxPosts && (
          <div className="text-xs text-[#525252] px-1.5">+{posts.length - maxPosts} more</div>
        )}
      </div>
    </div>
  );
}

// Context Menu Component
function ContextMenu({ x, y, onDelete, onCancel }: { x: number; y: number; onDelete: () => void; onCancel: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#1a1a1a] border border-[#333333] rounded-lg shadow-xl py-1 z-[100] min-w-[150px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onDelete}
        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#262626] flex items-center gap-2 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Remove from Calendar
      </button>
      <button
        onClick={onCancel}
        className="w-full px-4 py-2 text-left text-sm text-[#A3A3A3] hover:bg-[#262626] flex items-center gap-2 transition-colors"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const { posts, updatePost } = useAppStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>('month');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Get calendar days based on view
  const calendarDays = useMemo(() => {
    if (view === 'day') {
      return [currentDate];
    }

    if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return eachDayOfInterval({ start, end });
    }

    // Month view
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    // Pad beginning with days from previous month
    const startDayOfWeek = start.getDay();
    const prevDays = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(d.getDate() - (i + 1));
      prevDays.push(d);
    }

    // Pad end with days from next month
    const endDayOfWeek = end.getDay();
    const nextDays = [];
    for (let i = 1; i <= 6 - endDayOfWeek; i++) {
      const d = new Date(end);
      d.setDate(d.getDate() + i);
      nextDays.push(d);
    }

    return [...prevDays, ...days, ...nextDays];
  }, [currentDate, view]);

  // Get posts for a specific day
  const getPostsForDay = (day: Date): Post[] => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    return posts.filter((post) => {
      if (!post.scheduledDate) return false;
      return post.scheduledDate >= dayStart.getTime() && post.scheduledDate <= dayEnd.getTime();
    }).sort((a, b) => (a.scheduledDate || 0) - (b.scheduledDate || 0));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setContextMenu(null); // Close context menu when dragging
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return; // Dropped outside - cancel the drag

    const postId = active.id as string;
    const targetDateStr = over.id as string;

    // Parse the target date
    const newDate = new Date(targetDateStr);
    if (isNaN(newDate.getTime())) return; // Invalid date

    // Get the post
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // If post already has a scheduled date, preserve the time
    if (post.scheduledDate) {
      const oldDate = new Date(post.scheduledDate);
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);
    } else {
      // For unscheduled posts, set to 9 AM by default
      newDate.setHours(9, 0, 0, 0);
    }

    updatePost(postId, { scheduledDate: newDate.getTime() });
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ postId, x: e.clientX, y: e.clientY });
  };

  const handleDeleteFromCalendar = () => {
    if (contextMenu) {
      // Remove the scheduled date (unschedule the post)
      updatePost(contextMenu.postId, { scheduledDate: undefined });
      setContextMenu(null);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    if (view === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1));
    }
  };

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get unscheduled posts for the sidebar
  const unscheduledPosts = useMemo(() => {
    return posts.filter((post) => !post.scheduledDate).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [posts]);

  // Get the active post for drag overlay
  const activePost = activeId ? posts.find(p => p.id === activeId) : null;

  // Get title based on view
  const getTitle = () => {
    if (view === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
      }
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

  return (
    <div className="text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Content Calendar
          </h1>
          <p className="text-[#737373]">
            Drag posts to schedule • Right-click to remove
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-[#111111] border border-[#262626] rounded-lg p-1">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
              view === 'month' ? 'bg-[#D4AF37] text-black' : 'text-[#737373] hover:text-white'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
              view === 'week' ? 'bg-[#D4AF37] text-black' : 'text-[#737373] hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
            Week
          </button>
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
              view === 'day' ? 'bg-[#D4AF37] text-black' : 'text-[#737373] hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Day
          </button>
        </div>
      </div>

      {/* Single DndContext wrapping everything */}
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-6">
          {/* Unscheduled Posts List */}
          <div className="w-64 shrink-0">
            <div className="bg-[#111111] border border-[#262626] rounded-lg p-4 sticky top-28">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-lg font-medium text-white">Unscheduled</h3>
              </div>
              <p className="text-xs text-[#525252] mb-4">Drag to calendar to schedule</p>

              {unscheduledPosts.length === 0 ? (
                <p className="text-[#737373] text-sm">All posts are scheduled!</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {unscheduledPosts.map((post) => (
                    <DraggablePost
                      key={post.id}
                      post={post}
                      onEdit={() => router.push(`/post/${post.id}`)}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1" ref={calendarRef}>
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-white">
                {getTitle()}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNavigate('today')}
                  className="px-3 py-1.5 text-sm text-[#737373] hover:text-[#D4AF37] transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => handleNavigate('prev')}
                  className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#737373] hover:text-[#D4AF37] transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleNavigate('next')}
                  className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#737373] hover:text-[#D4AF37] transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Day Names (for month and week view) */}
            {view !== 'day' && (
              <div className={`grid gap-1 mb-1 ${view === 'month' ? 'grid-cols-7' : 'grid-cols-7'}`}>
                {dayNames.map((day) => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-[#737373]">
                    {day}
                  </div>
                ))}
              </div>
            )}

            {/* Calendar Grid */}
            <div className={`grid gap-1 ${
              view === 'month' ? 'grid-cols-7' : view === 'week' ? 'grid-cols-7' : 'grid-cols-1'
            }`}>
              {calendarDays.map((day) => (
                <DroppableDay
                  key={day.toISOString()}
                  date={day}
                  posts={getPostsForDay(day)}
                  isCurrentMonth={view === 'month' ? isSameMonth(day, currentDate) : true}
                  isToday={isSameDay(day, today)}
                  isSelected={selectedDay ? isSameDay(day, selectedDay) : false}
                  onSelect={() => setSelectedDay(day)}
                  onEditPost={(id) => router.push(`/post/${id}`)}
                  onContextMenu={handleContextMenu}
                  view={view}
                />
              ))}
            </div>
          </div>

          {/* Selected Day Panel */}
          <div className="w-64 shrink-0">
            <div className="bg-[#111111] border border-[#262626] rounded-lg p-4 sticky top-28">
              {selectedDay ? (
                <>
                  <h3 className="text-lg font-medium text-white mb-4">
                    {format(selectedDay, 'EEE, MMM d')}
                  </h3>
                  {selectedDayPosts.length === 0 ? (
                    <p className="text-[#737373] text-sm">No posts scheduled</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayPosts.map((post) => (
                        <button
                          key={post.id}
                          onClick={() => router.push(`/post/${post.id}`)}
                          onContextMenu={(e) => handleContextMenu(e, post.id)}
                          className="w-full text-left p-3 bg-[#1a1a1a] rounded-lg hover:bg-[#262626] transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[post.status] }}
                            />
                            {post.scheduledDate && (
                              <span className="text-xs text-[#D4AF37] font-medium">
                                {format(new Date(post.scheduledDate), 'h:mm a')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#A3A3A3] line-clamp-2">
                            {Object.values(post.content).find((c) => c) || 'No content'}
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            {post.platforms.map((platform) => (
                              <span key={platform} className="text-xs text-[#525252]">
                                {PLATFORM_LABELS[platform]}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const scheduledDate = selectedDay.getTime();
                      router.push(`/post/new?scheduledDate=${scheduledDate}`);
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 border border-[#262626] text-[#D4AF37] rounded-lg hover:bg-[#1a1a1a] hover:border-[#D4AF37] transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add post
                  </button>
                </>
              ) : (
                <p className="text-[#737373] text-sm">Select a day to view posts</p>
              )}
            </div>
          </div>
        </div>

        {/* Drag Overlay - shows a preview while dragging */}
        <DragOverlay>
          {activePost ? (
            <div className="p-2 bg-[#D4AF37] text-black rounded-lg shadow-xl border-2 border-[#D4AF37] cursor-grabbing">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {Object.values(activePost.content).find(c => c)?.substring(0, 30) || 'Untitled'}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={handleDeleteFromCalendar}
          onCancel={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

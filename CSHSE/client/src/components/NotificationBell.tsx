import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// ---------------------------------------------------------------------------
// Notification pass — in-app notification bell.
//
// Lives in the Layout user-menu next to the HelpMenu. Polls the unread count
// every 30s; opening the dropdown loads the latest notifications. Clicking a
// notification marks it read and (if it has a link) navigates there.
//
// Split into a pure NotificationBellView (unit-tested) + a container that
// wires the queries/mutations.
// ---------------------------------------------------------------------------

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationBellViewProps {
  open: boolean;
  unreadCount: number;
  notifications: NotificationItem[];
  loading: boolean;
  onToggle: () => void;
  onClickNotification: (n: NotificationItem) => void;
  onMarkAllRead: () => void;
}

function _relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function NotificationBellView({
  open,
  unreadCount,
  notifications,
  loading,
  onToggle,
  onClickNotification,
  onMarkAllRead
}: NotificationBellViewProps): JSX.Element {
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <div className="relative">
      <button
        type="button"
        data-testid="notification-bell-trigger"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        title="Notifications"
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 && (
          <span
            data-testid="notification-bell-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none"
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          data-testid="notification-dropdown"
          role="menu"
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="notification-mark-all-read"
                onClick={onMarkAllRead}
                className="text-xs text-teal-600 hover:text-teal-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div data-testid="notification-loading" className="px-4 py-6 text-sm text-gray-400 text-center">
                Loading…
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div data-testid="notification-empty" className="px-4 py-6 text-sm text-gray-400 text-center">
                You're all caught up.
              </div>
            )}
            {!loading &&
              notifications.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  role="menuitem"
                  data-testid={`notification-item-${n._id}`}
                  onClick={() => onClickNotification(n)}
                  className={[
                    'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                    n.read ? 'opacity-60' : 'bg-teal-50/40'
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{n.title}</div>
                      <div className="text-xs text-gray-600 line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{_relativeTime(n.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export function NotificationBell(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Poll the unread count in the background so the badge stays fresh.
  const countQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const r = await api.get('/api/notifications/unread-count');
      return r.data as { unreadCount: number };
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });

  // Only load the list while the dropdown is open.
  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const r = await api.get('/api/notifications?limit=20');
      return r.data as NotificationListResponse;
    },
    enabled: open,
    refetchOnWindowFocus: false
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/api/notifications/${id}/read`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post('/api/notifications/read-all'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const onClickNotification = (n: NotificationItem) => {
    if (!n.read) markRead.mutate(n._id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={containerRef}>
      <NotificationBellView
        open={open}
        unreadCount={
          listQuery.data?.unreadCount ?? countQuery.data?.unreadCount ?? 0
        }
        notifications={listQuery.data?.notifications ?? []}
        loading={open && listQuery.isLoading}
        onToggle={() => setOpen((p) => !p)}
        onClickNotification={onClickNotification}
        onMarkAllRead={() => markAllRead.mutate()}
      />
    </div>
  );
}

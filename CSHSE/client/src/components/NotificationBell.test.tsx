/**
 * Notification pass — NotificationBellView unit tests.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBellView, NotificationItem } from './NotificationBell';

const handlers = {
  onToggle: vi.fn(),
  onClickNotification: vi.fn(),
  onMarkAllRead: vi.fn()
};

const sample: NotificationItem[] = [
  {
    _id: 'n1',
    type: 'dm.new_message',
    title: 'New message from Lead Linda',
    body: 'About 1.b: please clarify your score.',
    link: '/reader/abc',
    read: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'n2',
    type: 'board.cycle_reminder',
    title: 'Accreditation expiring',
    body: 'HS at Notif U expires soon.',
    read: true,
    createdAt: new Date().toISOString()
  }
];

describe('NotificationBellView', () => {
  it('renders the bell trigger; dropdown closed by default', () => {
    render(<NotificationBellView {...handlers} open={false} unreadCount={0} notifications={[]} loading={false} />);
    expect(screen.getByTestId('notification-bell-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();
  });

  it('shows the unread badge only when unreadCount > 0', () => {
    const { rerender } = render(
      <NotificationBellView {...handlers} open={false} unreadCount={0} notifications={[]} loading={false} />
    );
    expect(screen.queryByTestId('notification-bell-badge')).not.toBeInTheDocument();
    rerender(
      <NotificationBellView {...handlers} open={false} unreadCount={3} notifications={[]} loading={false} />
    );
    expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('3');
  });

  it('caps the badge at 99+', () => {
    render(<NotificationBellView {...handlers} open={false} unreadCount={250} notifications={[]} loading={false} />);
    expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('99+');
  });

  it('clicking the trigger fires onToggle', () => {
    const onToggle = vi.fn();
    render(
      <NotificationBellView {...handlers} onToggle={onToggle} open={false} unreadCount={0} notifications={[]} loading={false} />
    );
    fireEvent.click(screen.getByTestId('notification-bell-trigger'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders empty state when open with no notifications', () => {
    render(<NotificationBellView {...handlers} open unreadCount={0} notifications={[]} loading={false} />);
    expect(screen.getByTestId('notification-empty')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<NotificationBellView {...handlers} open unreadCount={0} notifications={[]} loading />);
    expect(screen.getByTestId('notification-loading')).toBeInTheDocument();
  });

  it('renders notification rows and fires onClickNotification', () => {
    const onClickNotification = vi.fn();
    render(
      <NotificationBellView
        {...handlers}
        onClickNotification={onClickNotification}
        open
        unreadCount={1}
        notifications={sample}
        loading={false}
      />
    );
    expect(screen.getByTestId('notification-item-n1')).toBeInTheDocument();
    expect(screen.getByTestId('notification-item-n2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('notification-item-n1'));
    expect(onClickNotification).toHaveBeenCalledWith(sample[0]);
  });

  it('shows Mark all read only when there are unread; fires handler', () => {
    const onMarkAllRead = vi.fn();
    const { rerender } = render(
      <NotificationBellView {...handlers} onMarkAllRead={onMarkAllRead} open unreadCount={0} notifications={sample} loading={false} />
    );
    expect(screen.queryByTestId('notification-mark-all-read')).not.toBeInTheDocument();
    rerender(
      <NotificationBellView {...handlers} onMarkAllRead={onMarkAllRead} open unreadCount={2} notifications={sample} loading={false} />
    );
    fireEvent.click(screen.getByTestId('notification-mark-all-read'));
    expect(onMarkAllRead).toHaveBeenCalled();
  });
});

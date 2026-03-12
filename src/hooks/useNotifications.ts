'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import type { Notification, NotificationPriority, NotificationType } from '@prisma/client';

interface UseNotificationsOptions {
  includeArchived?: boolean;
  onlyUnread?: boolean;
  types?: NotificationType[];
}

interface NotificationWithId extends Notification {
  id: string;
  priority: NotificationPriority;
  type: NotificationType;
}

interface NotificationsState {
  items: NotificationWithId[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  nextCursor: string | null;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { includeArchived = false, onlyUnread = false, types } = options;
  const { socket, isConnected, userId } = useSocket();
  
  const [state, setState] = useState<NotificationsState>({
    items: [],
    unreadCount: 0,
    loading: true,
    error: null,
    hasMore: false,
    nextCursor: null,
  });

  const isFetchingRef = useRef(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async (cursor?: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const params = new URLSearchParams();
      if (includeArchived) params.set('archived', 'true');
      if (onlyUnread) params.set('unread', 'true');
      if (types) params.set('types', types.join(','));
      if (cursor) params.set('cursor', cursor);

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        items: cursor ? [...prev.items, ...data.items] : data.items,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        loading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false,
      }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [includeArchived, onlyUnread, types]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread-count');
      if (!response.ok) throw new Error('Failed to fetch unread count');
      
      const data = await response.json();
      setState(prev => ({ ...prev, unreadCount: data.total }));
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-read', notificationId }),
      });

      if (!response.ok) throw new Error('Failed to mark as read');

      setState(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.id === notificationId
            ? { ...item, isRead: true, readAt: new Date() }
            : item
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));

      // Also update via socket
      socket?.emit('notification:mark-read', notificationId);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [socket]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-read' }),
      });

      if (!response.ok) throw new Error('Failed to mark all as read');

      setState(prev => ({
        ...prev,
        items: prev.items.map(item => ({
          ...item,
          isRead: true,
          readAt: item.isRead ? item.readAt : new Date(),
        })),
        unreadCount: 0,
      }));

      // Also update via socket
      socket?.emit('notification:mark-all-read');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [socket]);

  // Archive notification
  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', notificationId }),
      });

      if (!response.ok) throw new Error('Failed to archive notification');

      setState(prev => ({
        ...prev,
        items: includeArchived
          ? prev.items.map(item =>
              item.id === notificationId
                ? { ...item, isArchived: true, archivedAt: new Date() }
                : item
            )
          : prev.items.filter(item => item.id !== notificationId),
        unreadCount: prev.items.find(i => i.id === notificationId)?.isRead
          ? prev.unreadCount
          : Math.max(0, prev.unreadCount - 1),
      }));
    } catch (err) {
      console.error('Failed to archive notification:', err);
    }
  }, [includeArchived]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete notification');

      setState(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== notificationId),
        unreadCount: prev.items.find(i => i.id === notificationId)?.isRead
          ? prev.unreadCount
          : Math.max(0, prev.unreadCount - 1),
      }));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (state.nextCursor && !isFetchingRef.current) {
      fetchNotifications(state.nextCursor);
    }
  }, [state.nextCursor, fetchNotifications]);

  // Initial load
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Subscribe to notifications
    socket.emit('subscribe-notifications');

    // Handle new notification
    const handleNewNotification = (notification: NotificationWithId) => {
      console.log('[Notifications] New notification received:', notification);
      setState(prev => ({
        ...prev,
        items: [notification, ...prev.items],
        unreadCount: prev.unreadCount + 1,
      }));
    };

    // Handle unread count update
    const handleUnreadCount = ({ count }: { count: number }) => {
      setState(prev => ({ ...prev, unreadCount: count }));
    };

    // Handle push trigger (for mobile push)
    const handlePushTrigger = (payload: unknown) => {
      console.log('[Notifications] Push trigger received:', payload);
      // This triggers service worker notification
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(payload.title || 'Neue Benachrichtigung', {
            body: payload.body || '',
            icon: payload.icon,
            badge: payload.badge,
            tag: payload.tag,
            requireInteraction: payload.requireInteraction,
            actions: payload.actions,
            data: payload.data,
          });
        });
      }
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:unread-count', handleUnreadCount);
    socket.on('push:trigger', handlePushTrigger);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:unread-count', handleUnreadCount);
      socket.off('push:trigger', handlePushTrigger);
    };
  }, [socket, isConnected]);

  return {
    notifications: state.items,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    loadMore,
    refresh: () => fetchNotifications(),
  };
}
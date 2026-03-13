/**
 * useChatUnread - React Hook für ungelesene Chat-Nachrichten
 * 
 * Verwendung:
 * const { unreadCount, refresh } = useChatUnread();
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Socket } from 'socket.io-client';

interface UseChatUnreadReturn {
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useChatUnread(socket?: Socket | null): UseChatUnreadReturn {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.id) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/chat/rooms');
      if (response.ok) {
        const data = await response.json();
        const totalUnread = (data.rooms || []).reduce((sum: number, room: any) => sum + (room.unreadCount || 0), 0);
        setUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error('[ChatUnread] Error fetching unread count:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();

    // Poll for updates alle 30 Sekunden als Fallback
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Listen for socket updates
  useEffect(() => {
    if (!socket) return;

    const handleUnreadUpdate = (data: { roomId?: string; count?: number }) => {
      console.log('[ChatUnread] Received update:', data);
      fetchUnreadCount();
    };

    const handleUnreadCount = (data: { count: number }) => {
      console.log('[ChatUnread] Received count:', data.count);
      if (typeof data.count === 'number') {
        setUnreadCount(data.count);
      }
    };

    socket.on('chat:unread-update', handleUnreadUpdate);
    socket.on('chat:unread-count', handleUnreadCount);
    socket.on('new-message', handleUnreadUpdate);

    return () => {
      socket.off('chat:unread-update', handleUnreadUpdate);
      socket.off('chat:unread-count', handleUnreadCount);
      socket.off('new-message', handleUnreadUpdate);
    };
  }, [socket, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refresh: fetchUnreadCount,
  };
}

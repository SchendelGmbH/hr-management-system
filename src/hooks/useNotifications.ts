'use client';

import { useEffect, useCallback } from 'react';
import { useToastContext } from '@/components/providers/ToastProvider';
import { useSocket } from '@/hooks/useSocket';

interface ChatMessageData {
  roomId: string;
  message: {
    id: string;
    content: string;
    sender: {
      id: string;
      name: string;
    };
  };
}

export function useChatNotifications() {
  const { addToast } = useToastContext();
  const { isConnected, onMessage } = useSocket();

  const handleNewMessage = useCallback((data: ChatMessageData) => {
    console.log('[useChatNotifications] new-message event received:', data);
    
    // Prüfe ob wir im Chat sind
    const currentPath = window.location.pathname;
    const isInChat = currentPath.includes('/chat');
    
    if (isInChat) {
      console.log('[useChatNotifications] Skipping toast - user is in chat');
      return;
    }

    const message = data?.message;
    if (!message) {
      console.log('[useChatNotifications] No message data, skipping');
      return;
    }

    console.log('[useChatNotifications] Showing toast for message:', message.id);
    
    // Zeige Toast
    addToast({
      title: `${message.sender?.name || 'Neue Nachricht'}`,
      message: message.content?.length > 50 
        ? message.content.substring(0, 50) + '...' 
        : message.content || 'Neue Chat-Nachricht',
      type: 'info',
      duration: 8000,
    });
    
    console.log('[useChatNotifications] Toast added successfully');
  }, [addToast]);

  useEffect(() => {
    if (!isConnected) return;

    // Registriere Listener für neue Nachrichten
    const unsubscribe = onMessage(handleNewMessage);

    return unsubscribe;
  }, [isConnected, onMessage, handleNewMessage]);
}

// Kompatibilitäts-Export für NotificationBell
export function useNotifications() {
  const { addToast } = useToastContext();
  const { isConnected, onNotificationCount } = useSocket();
  
  return {
    notifications: [],
    unreadCount: 0,
    markAsRead: () => {},
    markAllAsRead: () => {},
    archiveNotification: () => {},
    deleteNotification: () => {},
    isLoading: false,
  };
}

// Hook für System-Benachrichtigungen
export function useSystemNotifications() {
  const { addToast } = useToastContext();
  const { isConnected, onNotificationCount } = useSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onNotificationCount((data: { count: number; title?: string; message?: string }) => {
      if (data.title) {
        addToast({
          title: data.title,
          message: data.message,
          type: 'info',
          duration: 6000,
        });
      }
    });

    return unsubscribe;
  }, [isConnected, onNotificationCount, addToast]);
}

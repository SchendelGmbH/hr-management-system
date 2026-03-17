'use client';

import { useEffect, useCallback } from 'react';
import { useToastContext } from '@/components/providers/ToastProvider';
import { useSocket } from '@/components/providers/SocketProvider';
import { useRouter } from 'next/navigation';

interface ChatMessageData {
  roomId: string;
  roomName?: string;
  roomType?: string;
  message: {
    id: string;
    content: string;
    sender: {
      id: string;
      username: string;
      employee?: {
        firstName?: string;
        lastName?: string;
      };
    };
  };
}

export function useChatNotifications() {
  const { addToast } = useToastContext();
  const { isConnected, onMessage } = useSocket();
  const router = useRouter();

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

    // Bestimme den Absendernamen
    const senderName = message.sender?.employee?.firstName 
      ? `${message.sender.employee.firstName} ${message.sender.employee.lastName || ''}`.trim()
      : message.sender?.username || 'Unbekannt';
    
    // Bestimme den Titel basierend auf Room-Typ
    const roomName = data.roomName || 'Chat';
    const isGroup = data.roomType === 'group';
    
    // Toast-Titel: Bei Gruppen "Gruppenname - Absender", bei Direktchat nur Absender
    const toastTitle = isGroup 
      ? `${roomName} - ${senderName}`
      : senderName;
    
    // Toast-Message: "Neue Chatnachricht: Inhalt"
    const messagePreview = message.content?.length > 40 
      ? message.content.substring(0, 40) + '...' 
      : message.content || '';
    
    console.log('[useChatNotifications] Showing toast for message:', message.id);
    
    // Zeige Toast mit Klick-Handler
    addToast({
      title: toastTitle,
      message: `Neue Chatnachricht: ${messagePreview}`,
      type: 'info',
      duration: 8000,
      onClick: () => {
        console.log('[useChatNotifications] Toast clicked, navigating to chat:', data.roomId);
        router.push(`/de/chat?room=${data.roomId}`);
      },
    });
    
    console.log('[useChatNotifications] Toast added successfully');
  }, [addToast, router]);

  useEffect(() => {
    if (!isConnected) return;

    console.log('[useChatNotifications] Registering listener...');
    const unsubscribe = onMessage(handleNewMessage);

    return () => {
      console.log('[useChatNotifications] Unregistering listener...');
      unsubscribe();
    };
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

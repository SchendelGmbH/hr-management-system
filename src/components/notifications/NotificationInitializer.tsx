'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useChatNotifications, useSystemNotifications } from '@/hooks/useNotifications';
import { useSocket } from '@/hooks/useSocket';

/**
 * NotificationInitializer - Aktiviert alle Benachrichtigungen
 * Diese Komponente rendert nichts, sondern initialisiert nur Hooks
 */
export function NotificationInitializer() {
  const { data: session } = useSession();
  const { isConnected, isAuthenticated, joinRoom } = useSocket();
  
  // Aktiviere Chat-Benachrichtigungen (Toast wenn nicht im Chat)
  useChatNotifications();
  
  // Aktiviere System-Benachrichtigungen
  useSystemNotifications();
  
  // Lade alle Rooms des Nutzers und joine sie automatisch
  // Damit wir new-message Events empfangen können
  useEffect(() => {
    if (!isConnected || !isAuthenticated || !session?.user?.id) return;
    
    // Lade alle Rooms des Nutzers
    fetch('/api/chat/rooms')
      .then(res => res.json())
      .then(data => {
        if (data.rooms && Array.isArray(data.rooms)) {
          data.rooms.forEach((room: any) => {
            console.log('[NotificationInitializer] Joining room:', room.id);
            joinRoom(room.id);
          });
        }
      })
      .catch(err => {
        console.error('[NotificationInitializer] Error loading rooms:', err);
      });
  }, [isConnected, isAuthenticated, session?.user?.id, joinRoom]);
  
  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useChatNotifications, useSystemNotifications } from '@/hooks/useNotifications';
import { useSocket } from '@/hooks/useSocket';

/**
 * NotificationInitializer - Aktiviert alle Benachrichtigungen
 * Diese Komponente rendert nichts, sondern initialisiert nur Hooks
 */
export function NotificationInitializer() {
  const { data: session } = useSession();
  const { isConnected, isAuthenticated, joinRoom, socket } = useSocket();
  const [hasJoinedRooms, setHasJoinedRooms] = useState(false);
  
  // Aktiviere Chat-Benachrichtigungen (Toast wenn nicht im Chat)
  useChatNotifications();
  
  // Aktiviere System-Benachrichtigungen
  useSystemNotifications();
  
  // Lade alle Rooms des Nutzers und joine sie automatisch
  // Wichtig: Bei jedem Reconnect neu ausführen!
  useEffect(() => {
    if (!isConnected || !isAuthenticated || !session?.user?.id) {
      setHasJoinedRooms(false);
      return;
    }
    
    // Vermeide doppeltes Joinen wenn bereits verbunden
    if (hasJoinedRooms) return;
    
    console.log('[NotificationInitializer] Socket ready, loading rooms...');
    
    // Lade alle Rooms des Nutzers
    fetch('/api/chat/rooms')
      .then(res => res.json())
      .then(data => {
        if (data.rooms && Array.isArray(data.rooms)) {
          console.log(`[NotificationInitializer] Joining ${data.rooms.length} rooms`);
          data.rooms.forEach((room: any) => {
            console.log('[NotificationInitializer] Joining room:', room.id);
            joinRoom(room.id);
          });
          setHasJoinedRooms(true);
        }
      })
      .catch(err => {
        console.error('[NotificationInitializer] Error loading rooms:', err);
      });
  }, [isConnected, isAuthenticated, session?.user?.id, joinRoom, hasJoinedRooms]);
  
  // Reset hasJoinedRooms wenn der Socket disconnected
  useEffect(() => {
    if (!isConnected) {
      setHasJoinedRooms(false);
    }
  }, [isConnected]);
  
  return null;
}

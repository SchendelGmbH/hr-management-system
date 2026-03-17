'use client';

import { useChatNotifications, useSystemNotifications } from '@/hooks/useNotifications';

/**
 * NotificationInitializer - Aktiviert alle Benachrichtigungen
 * Diese Komponente rendert nichts, sondern initialisiert nur Hooks
 */
export function NotificationInitializer() {
  // Aktiviere Chat-Benachrichtigungen (Toast wenn nicht im Chat)
  useChatNotifications();
  
  // Aktiviere System-Benachrichtigungen
  useSystemNotifications();
  
  return null;
}

/**
 * EventBus Initialisierung
 * 
 * Zentrale Initialisierung aller Event-Handler
 */

import { initializeChatEventHandlers } from './handlers/chatEvents';

let initialized = false;

export function initializeEventBus() {
  if (initialized) {
    console.log('[EventBus] Bereits initialisiert');
    return;
  }

  console.log('[EventBus] Initialisiere Event-Handler...');
  
  // Chat-Event Handler
  initializeChatEventHandlers();
  
  // Weitere Handler können hier hinzugefügt werden
  
  initialized = true;
  console.log('[EventBus] Initialisierung abgeschlossen');
}

// Auto-initialisieren beim Import (nur serverseitig)
if (typeof window === 'undefined') {
  initializeEventBus();
}
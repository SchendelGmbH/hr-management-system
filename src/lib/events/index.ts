/**
 * EventBus Initialisierung
 * 
 * Zentrale Initialisierung aller Event-Handler
 */

import { initializeChatEventHandlers } from './handlers/chatEvents';
import { initializeVertretungEventHandlers } from './handlers/vertretungEvents';
import { initializeWorkSiteEventHandlers } from './handlers/workSiteEvents';
import { initializeDocumentSignatureEventHandlers } from './handlers/documentSignatureEvents';

let initialized = false;

export function initializeEventBus() {
  if (initialized) {
    console.log('[EventBus] Bereits initialisiert');
    return;
  }

  console.log('[EventBus] Initialisiere Event-Handler...');
  
  // Chat-Event Handler (Willkommensnachrichten für neue Mitarbeiter)
  initializeChatEventHandlers();
  
  // Vertretungs-Event Handler
  initializeVertretungEventHandlers();
  
  // Baustellen-Event Handler (Auto-Chat, Check-in/out, Material)
  initializeWorkSiteEventHandlers();
  
  // Document Signature Handler (Signatur-Workflow im Chat)
  initializeDocumentSignatureEventHandlers();
  
  initialized = true;
  console.log('[EventBus] Initialisierung abgeschlossen');
}

// Auto-initialisieren beim Import (nur serverseitig)
if (typeof window === 'undefined') {
  initializeEventBus();
}
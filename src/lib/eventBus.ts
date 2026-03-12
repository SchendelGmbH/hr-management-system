/**
 * EventBus für Realtime-Kommunikation
 * Unterstützt Event-Emission und -Abonnement für verschiedene Module
 */

type EventCallback = (data: any) => void;

interface EventBus {
  subscribers: Map<string, Set<EventCallback>>;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: EventCallback) => () => void;
  off: (event: string, callback: EventCallback) => void;
}

// Globaler EventBus
const eventBus: EventBus = {
  subscribers: new Map(),

  emit(event: string, data: any) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
    
    // Log für Debug
    console.log(`[EventBus] Event emitted: ${event}`, data);
  },

  on(event: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  },

  off(event: string, callback: EventCallback) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  },
};

/**
 * Events für das Shift Swap System
 */
export const ShiftSwapEvents = {
  // Swap-Anfragen
  SWAP_CREATED: 'SHIFT_SWAP_CREATED',
  SWAP_UPDATED: 'SHIFT_SWAP_UPDATED',
  SWAP_RESPONSE_CREATED: 'SHIFT_SWAP_RESPONSE_CREATED',
  SWAP_APPROVED: 'SHIFT_SWAP_APPROVED',
  SWAP_REJECTED: 'SHIFT_SWAP_REJECTED',
  SWAP_COMPLETED: 'SHIFT_SWAP_COMPLETED',
  SWAP_CANCELLED: 'SHIFT_SWAP_CANCELLED',
  
  // Planänderungen
  SCHEDULE_CHANGED: 'SCHEDULE_CHANGED',
  
  // Benachrichtigungen
  NOTIFICATION_CREATED: 'NOTIFICATION_CREATED',
} as const;

export type ShiftSwapEventType = typeof ShiftSwapEvents[keyof typeof ShiftSwapEvents];

/**
 * Emitter für Shift Swap Events
 */
export function emitSwapEvent(
  event: ShiftSwapEventType,
  data: {
    swapId: string;
    requesterId: string;
    requestedId?: string | null;
    responderId?: string;
    message?: string;
    [key: string]: any;
  }
) {
  eventBus.emit(event, data);
}

/**
 * Abonniere Shift Swap Events
 */
export function onSwapEvent(
  event: ShiftSwapEventType,
  callback: (data: any) => void
): () => void {
  return eventBus.on(event, callback);
}

/**
 * Benachrichtigungs-Handler für Shift Swap Events
 * Erstellt automatisch Benachrichtigungen bei relevanten Events
 */
export function initializeSwapNotificationHandlers() {
  // Bei neuer Swap-Anfrage
  eventBus.on(ShiftSwapEvents.SWAP_CREATED, async (data) => {
    console.log('[Notification] Neue Tauschanfrage:', data);
    // Hier könnte DB-Logik für Benachrichtigungen stehen
  });

  // Bei Antwort auf Swap-Anfrage
  eventBus.on(ShiftSwapEvents.SWAP_RESPONSE_CREATED, (data) => {
    console.log('[Notification] Antwort auf Tauschanfrage:', data);
  });

  // Bei Genehmigung
  eventBus.on(ShiftSwapEvents.SWAP_APPROVED, (data) => {
    console.log('[Notification] Tausch genehmigt:', data);
  });

  // Bei Planänderung
  eventBus.on(ShiftSwapEvents.SCHEDULE_CHANGED, (data) => {
    console.log('[Notification] Plan wurde geändert:', data);
  });
}

/**
 * Allgemeine Event-Emission
 */
export function emitEvent(event: string, data: any) {
  eventBus.emit(event, data);
}

/**
 * Allgemeine Event-Abonnement
 */
export function onEvent(event: string, callback: EventCallback): () => void {
  return eventBus.on(event, callback);
}

// Initialisiere Benachrichtigungs-Handler
if (typeof window === 'undefined') {
  // Server-seitig initialisieren
  initializeSwapNotificationHandlers();
}

export default eventBus;

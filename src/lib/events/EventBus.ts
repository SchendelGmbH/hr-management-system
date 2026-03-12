/**
 * EventBus - Zentrales Event-System für modulare Kommunikation
 * 
 * Ermöglicht lose Kopplung zwischen Modulen durch Publish/Subscribe Pattern.
 * Core-Module und Feature-Module können Events emittieren und darauf hören.
 */

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

export interface EventPayload {
  [key: string]: unknown;
}

export interface Event {
  type: string;
  payload: EventPayload;
  timestamp: number;
  source?: string;
  priority: EventPriority;
}

export type EventHandler = (event: Event) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  type: string;
  handler: EventHandler;
  priority: EventPriority;
  once: boolean;
}

export interface EventBusConfig {
  asyncHandlers?: boolean;
  maxQueueSize?: number;
  logEvents?: boolean;
}

const PRIORITY_ORDER: Record<EventPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Singleton EventBus für die Anwendung
 */
class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private history: Event[] = [];
  private config: EventBusConfig;
  private eventQueue: Event[] = [];
  private processing = false;

  constructor(config: EventBusConfig = {}) {
    this.config = {
      asyncHandlers: true,
      maxQueueSize: 1000,
      logEvents: process.env.NODE_ENV === 'development',
      ...config,
    };
  }

  /**
   * Erstellt eine Subscription-ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Abonniert ein Event
   * @returns Unsubscribe-Funktion
   */
  subscribe(
    eventType: string,
    handler: EventHandler,
    options: { priority?: EventPriority; once?: boolean } = {}
  ): () => void {
    const { priority = 'normal', once = false } = options;
    
    const subscription: EventSubscription = {
      id: this.generateId(),
      type: eventType,
      handler,
      priority,
      once,
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    const handlers = this.subscriptions.get(eventType)!;
    handlers.push(subscription);
    
    // Sortiere nach Priorität
    handlers.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    if (this.config.logEvents) {
      console.log(`[EventBus] Subscribed to "${eventType}" (${priority})`);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, subscription.id);
  }

  /**
   * Abonniert ein Event einmalig
   */
  once(eventType: string, handler: EventHandler, priority?: EventPriority): () => void {
    return this.subscribe(eventType, handler, { priority, once: true });
  }

  /**
   * Entfernt eine Subscription
   */
  private unsubscribe(eventType: string, subscriptionId: string): void {
    const handlers = this.subscriptions.get(eventType);
    if (handlers) {
      const index = handlers.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    }
  }

  /**
   * Emittiert ein Event synchron
   */
  emit(eventType: string, payload: EventPayload = {}, source?: string): void {
    const event: Event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      source,
      priority: 'normal',
    };

    this.processEvent(event);
  }

  /**
   * Emittiert ein Event mit Priorität
   */
  emitWithPriority(
    eventType: string,
    payload: EventPayload = {},
    priority: EventPriority,
    source?: string
  ): void {
    const event: Event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      source,
      priority,
    };

    if (priority === 'critical' || priority === 'high') {
      this.processEvent(event);
    } else {
      this.queueEvent(event);
    }
  }

  /**
   * Fügt Event zur Queue hinzu
   */
  private queueEvent(event: Event): void {
    if (this.eventQueue.length >= (this.config.maxQueueSize || 1000)) {
      console.warn(`[EventBus] Queue limit reached, dropping oldest event`);
      this.eventQueue.shift();
    }
    this.eventQueue.push(event);
    this.processQueue();
  }

  /**
   * Verarbeitet die Event-Queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.processEventAsync(event);
    }
    
    this.processing = false;
  }

  /**
   * Verarbeitet ein Event synchron
   */
  private processEvent(event: Event): void {
    this.history.push(event);
    
    if (this.config.logEvents) {
      console.log(`[EventBus] Emit: ${event.type}`, event.payload);
    }

    const handlers = this.subscriptions.get(event.type);
    if (!handlers || handlers.length === 0) return;

    // Kopie für sichere Iteration
    const handlersCopy = [...handlers];
    
    for (const subscription of handlersCopy) {
      try {
        const result = subscription.handler(event);
        
        // Handle async handlers
        if (result instanceof Promise && !this.config.asyncHandlers) {
          result.catch(err => console.error(`[EventBus] Async handler error:`, err));
        }
        
        // Entferne One-Time Handler
        if (subscription.once) {
          this.unsubscribe(event.type, subscription.id);
        }
      } catch (error) {
        console.error(`[EventBus] Handler error for "${event.type}":`, error);
      }
    }
  }

  /**
   * Verarbeitet ein Event asynchron
   */
  private async processEventAsync(event: Event): Promise<void> {
    this.history.push(event);
    
    if (this.config.logEvents) {
      console.log(`[EventBus] Emit (async): ${event.type}`, event.payload);
    }

    const handlers = this.subscriptions.get(event.type);
    if (!handlers || handlers.length === 0) return;

    const handlersCopy = [...handlers];
    
    for (const subscription of handlersCopy) {
      try {
        await subscription.handler(event);
        
        if (subscription.once) {
          this.unsubscribe(event.type, subscription.id);
        }
      } catch (error) {
        console.error(`[EventBus] Handler error for "${event.type}":`, error);
      }
    }
  }

  /**
   * Gibt Event-History zurück
   */
  getHistory(eventType?: string, limit: number = 100): Event[] {
    let filtered = this.history;
    if (eventType) {
      filtered = filtered.filter(e => e.type === eventType);
    }
    return filtered.slice(-limit);
  }

  /**
   * Leert die Event-History
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Gibt alle aktiven Subscriptions zurück
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Entfernt alle Subscriptions für einen Event-Typ
   */
  unsubscribeAll(eventType: string): void {
    this.subscriptions.delete(eventType);
  }

  /**
   * Entfernt ALLE Subscriptions (z.B. beim Logout)
   */
  reset(): void {
    this.subscriptions.clear();
    this.history = [];
    this.eventQueue = [];
    this.processing = false;
  }
}

// Singleton-Instanz
export const eventBus = new EventBus();

// Convenience-Export für häufige Events
export const ModuleEvents = {
  // Module Lifecycle
  MODULE_LOADED: 'module:loaded',
  MODULE_UNLOADED: 'module:unloaded',
  MODULE_ENABLED: 'module:enabled',
  MODULE_DISABLED: 'module:disabled',
  MODULE_ERROR: 'module:error',
  
  // Auth/Permissions
  PERMISSION_CHANGED: 'permission:changed',
  ROLE_UPDATED: 'role:updated',
  
  // Tenant/License
  LICENSE_UPDATED: 'license:updated',
  LICENSE_EXPIRED: 'license:expired',
  TENANT_UPDATED: 'tenant:updated',
  
  // Data Events
  DATA_CHANGED: 'data:changed',
  SETTINGS_UPDATED: 'settings:updated',
  
  // System
  APP_INITIALIZED: 'app:initialized',
  APP_ERROR: 'app:error',
} as const;

export type ModuleEventType = typeof ModuleEvents[keyof typeof ModuleEvents];

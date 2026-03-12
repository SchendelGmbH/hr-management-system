'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

export interface QueuedMessage {
  id: string;
  roomId: string;
  content: string;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'sending' | 'failed' | 'sent';
  error?: string;
}

export interface OfflineMessage {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: string;
  isOptimistic?: boolean;
}

interface OfflineSyncState {
  isOnline: boolean;
  queue: QueuedMessage[];
  pendingCount: number;
  isSyncing: boolean;
}

const STORAGE_KEY = 'chat_offline_queue';
const MESSAGES_STORAGE_KEY = 'chat_offline_messages';
const MAX_RETRY_COUNT = 3;

export function useOfflineSync() {
  const { data: session } = useSession();
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    queue: [],
    pendingCount: 0,
    isSyncing: false,
  });
  
  const syncInProgress = useRef(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedQueue = localStorage.getItem(STORAGE_KEY);
      if (savedQueue) {
        const parsed = JSON.parse(savedQueue);
        setState(prev => ({
          ...prev,
          queue: parsed,
          pendingCount: parsed.filter((m: QueuedMessage) => m.status === 'pending').length,
        }));
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }, [state.queue]);

  // Monitor online status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      // Trigger sync when coming back online
      setTimeout(() => syncMessages(), 1000);
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Add message to queue
  const queueMessage = useCallback(async (roomId: string, content: string): Promise<string> => {
    const id = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: QueuedMessage = {
      id,
      roomId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    setState(prev => ({
      ...prev,
      queue: [...prev.queue, newMessage],
      pendingCount: prev.pendingCount + 1,
    }));

    return id;
  }, []);

  // Mark message as sent
  const markAsSent = useCallback((messageId: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter(m => m.id !== messageId),
      pendingCount: Math.max(0, prev.pendingCount - 1),
    }));
  }, []);

  // Mark message as failed
  const markAsFailed = useCallback((messageId: string, error: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.map(m => 
        m.id === messageId 
          ? { ...m, status: 'failed', error }
          : m
      ),
    }));
  }, []);

  // Retry failed message
  const retryMessage = useCallback(async (messageId: string): Promise<boolean> => {
    const message = state.queue.find(m => m.id === messageId);
    if (!message || message.retryCount >= MAX_RETRY_COUNT) return false;

    setState(prev => ({
      ...prev,
      queue: prev.queue.map(m => 
        m.id === messageId 
          ? { ...m, status: 'sending', retryCount: m.retryCount + 1 }
          : m
      ),
    }));

    // Attempt to send
    try {
      const response = await fetch(`/api/chat/rooms/${message.roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.content }),
      });

      if (response.ok) {
        markAsSent(messageId);
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      
      if (state.queue.find(m => m.id === messageId)?.retryCount! >= MAX_RETRY_COUNT - 1) {
        markAsFailed(messageId, errorMsg);
      } else {
        setState(prev => ({
          ...prev,
          queue: prev.queue.map(m => 
            m.id === messageId 
              ? { ...m, status: 'pending' }
              : m
          ),
        }));
      }
      return false;
    }
  }, [state.queue, markAsSent, markAsFailed]);

  // Sync all pending messages
  const syncMessages = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;
    
    const pendingMessages = state.queue.filter(m => m.status === 'pending');
    if (pendingMessages.length === 0) return;

    syncInProgress.current = true;
    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      // Process messages in parallel with a limit
      const batch = pendingMessages.slice(0, 5);
      await Promise.all(
        batch.map(m => retryMessage(m.id))
      );

      // Check for more pending messages
      setTimeout(() => {
        syncInProgress.current = false;
        setState(prev => ({ ...prev, isSyncing: false }));
        
        // Continue syncing if there are more pending messages
        const remaining = state.queue.filter(m => m.status === 'pending').length;
        if (remaining > 0) {
          syncMessages();
        }
      }, 1000);
    } catch (error) {
      syncInProgress.current = false;
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [state.queue, retryMessage]);

  // Clear all messages
  const clearQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: [],
      pendingCount: 0,
    }));
  }, []);

  // Remove specific message from queue
  const removeFromQueue = useCallback((messageId: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter(m => m.id !== messageId),
      pendingCount: Math.max(0, prev.pendingCount - 1),
    }));
  }, []);

  return {
    ...state,
    queueMessage,
    markAsSent,
    markAsFailed,
    retryMessage,
    syncMessages,
    clearQueue,
    removeFromQueue,
  };
}

// Save messages for offline viewing
export function saveMessagesForOffline(roomId: string, messages: OfflineMessage[]) {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${MESSAGES_STORAGE_KEY}_${roomId}`;
    const data = {
      messages,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save messages:', error);
  }
}

// Load messages for offline viewing
export function loadMessagesForOffline(roomId: string): OfflineMessage[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = `${MESSAGES_STORAGE_KEY}_${roomId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      // Only return if less than 7 days old
      if (Date.now() - data.savedAt < 7 * 24 * 60 * 60 * 1000) {
        return data.messages;
      }
    }
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
  return null;
}

// Clear offline messages
export function clearOfflineMessages(roomId?: string) {
  if (typeof window === 'undefined') return;
  
  try {
    if (roomId) {
      localStorage.removeItem(`${MESSAGES_STORAGE_KEY}_${roomId}`);
    } else {
      // Clear all chat messages
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(MESSAGES_STORAGE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Failed to clear messages:', error);
  }
}

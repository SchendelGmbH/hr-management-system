'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket';
import { ChatMessage, ChatRoom, ChatUser } from '@/types/chat';
import {
  initLocalDB,
  saveMessage,
  saveMessages,
  getMessagesByRoom,
  getPendingMessages,
  updateMessageSyncStatus,
  saveRoom,
  saveRooms,
  getAllRooms,
  getRoom,
  updateRoomUnreadCount,
  updateRoomLastMessage,
  addToSyncQueue,
  getSyncQueue,
  updateSyncQueueItem,
  removeFromSyncQueue,
  LocalMessage,
  LocalRoom,
  SyncQueueItem,
} from '@/lib/chat/localDb';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Message status type
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// Enhanced message type with status
export interface EnhancedMessage extends ChatMessage {
  status: MessageStatus;
  isOptimistic?: boolean;
  syncError?: string;
}

// Chat state
interface ChatState {
  rooms: EnhancedRoom[];
  messages: EnhancedMessage[];
  currentRoomId: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  hasMoreMessages: boolean;
  unreadCounts: Map<string, number>;
}

export interface EnhancedRoom extends ChatRoom {
  localUnreadCount: number;
  isMuted: boolean;
  lastSyncedAt?: number;
}

// Hook return type
interface UseChatReturn {
  // State
  rooms: EnhancedRoom[];
  messages: EnhancedMessage[];
  currentRoom: EnhancedRoom | null;
  isLoading: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  hasMoreMessages: boolean;
  
  // Actions
  selectRoom: (roomId: string) => Promise<void>;
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  markRoomAsRead: (roomId: string) => Promise<void>;
  
  // Typing
  sendTyping: (isTyping: boolean) => void;
  typingUsers: string[];
  
  // Sync
  syncNow: () => Promise<void>;
  pendingCount: number;
}

// Constants
const MESSAGES_PER_PAGE = 50;
const SYNC_INTERVAL = 5000; // 5 seconds
const TYPING_TIMEOUT = 3000;

export function useChat(): UseChatReturn {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  
  // Socket connection
  const { 
    socket, 
    isConnected, 
    isAuthenticated,
    joinRoom, 
    leaveRoom, 
    sendTyping: emitTyping,
    markRoomAsRead: emitMarkRoomAsRead,
    onMessage,
    onTyping,
    onRoomRead,
  } = useSocket();
  
  // State
  const [rooms, setRooms] = useState<EnhancedRoom[]>([]);
  const [messages, setMessages] = useState<EnhancedMessage[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Refs
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCursorRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  
  // Current room
  const currentRoom = useMemo(() => 
    rooms.find(r => r.id === currentRoomId) || null,
    [rooms, currentRoomId]
  );
  
  // ==================== INITIALIZATION ====================
  
  // Initialize local DB and load rooms
  useEffect(() => {
    if (!userId || isInitializedRef.current) return;
    
    const init = async () => {
      try {
        console.log('[Chat] Initializing...');
        setIsLoading(true);
        
        // Initialize IndexedDB
        await initLocalDB();
        
        // Load rooms from local DB first (for instant display)
        const localRooms = await getAllRooms();
        console.log('[Chat] Local rooms loaded:', localRooms.length);
        if (localRooms.length > 0) {
          setRooms(localRooms.map(transformLocalRoom));
        }
        
        // Fetch rooms from server
        console.log('[Chat] Fetching rooms from server...');
        await fetchRooms();
        
        isInitializedRef.current = true;
        console.log('[Chat] Initialization complete');
      } catch (error) {
        console.error('[Chat] Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
  }, [userId]);
  
  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // ==================== SYNC ====================
  
  // Auto-sync interval
  useEffect(() => {
    if (!isOnline || !isAuthenticated) return;
    
    syncIntervalRef.current = setInterval(() => {
      syncNow();
    }, SYNC_INTERVAL);
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, isAuthenticated]);
  
  // Sync pending messages and queue
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    
    setIsSyncing(true);
    
    try {
      // Sync pending messages
      const pendingMessages = await getPendingMessages(currentRoomId || undefined);
      
      for (const msg of pendingMessages) {
        await syncMessage(msg);
      }
      
      // Process sync queue
      const queue = await getSyncQueue('pending');
      setPendingCount(queue.length);
      
      for (const item of queue) {
        await processSyncQueueItem(item);
      }
      
      // Fetch latest from server
      if (currentRoomId) {
        await fetchLatestMessages(currentRoomId);
      }
      await fetchRooms();
      
    } catch (error) {
      console.error('[Chat] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, currentRoomId]);
  
  // Sync a single message
  const syncMessage = async (msg: LocalMessage) => {
    try {
      await updateMessageSyncStatus(msg.id, 'sending');
      
      const response = await axios.post(`/api/chat/rooms/${msg.roomId}/messages`, {
        content: msg.content,
        replyToId: msg.replyToId,
      });
      
      if (response.data.message) {
        await updateMessageSyncStatus(msg.id, 'synced', response.data.message.id);
        
        // Update local state
        setMessages(prev => prev.map(m => 
          m.id === msg.id 
            ? { ...m, status: 'sent', isOptimistic: false, id: response.data.message.id }
            : m
        ));
      }
    } catch (error) {
      console.error('[Chat] Failed to sync message:', error);
      await updateMessageSyncStatus(msg.id, 'failed');
      
      setMessages(prev => prev.map(m => 
        m.id === msg.id 
          ? { ...m, status: 'failed', syncError: 'Failed to send' }
          : m
      ));
    }
  };
  
  // Process sync queue item
  const processSyncQueueItem = async (item: SyncQueueItem) => {
    try {
      await updateSyncQueueItem(item.id, { status: 'processing' });
      
      switch (item.type) {
        case 'mark-read':
          await axios.post(`/api/chat/rooms/${item.roomId}/read`);
          break;
          
        case 'edit-message':
          await axios.patch(`/api/chat/messages/${item.payload.messageId}`, {
            content: item.payload.content,
          });
          break;
          
        case 'delete-message':
          await axios.delete(`/api/chat/messages/${item.payload.messageId}`);
          break;
      }
      
      await removeFromSyncQueue(item.id);
    } catch (error) {
      console.error('[Chat] Sync queue item failed:', error);
      await updateSyncQueueItem(item.id, { 
        status: 'failed',
        retryCount: item.retryCount + 1,
      });
    }
  };
  
  // ==================== ROOM OPERATIONS ====================
  
  // Track when rooms were marked as read locally
  const lastReadTimestamps = useRef<Map<string, number>>(new Map());
  
  // Fetch rooms from server
  const fetchRooms = async () => {
    try {
      console.log('[Chat] Fetching rooms from API...');
      const { data } = await axios.get('/api/chat/rooms');
      console.log('[Chat] API response:', data);
      
      const serverRooms = data.rooms || [];
      console.log('[Chat] Server rooms:', serverRooms.length);
      
      if (serverRooms.length === 0) {
        console.log('[Chat] No rooms from server');
        setRooms([]);
        return;
      }
      
      // Transform server rooms - merge with local state
      const now = Date.now();
      const transformedRooms = serverRooms.map((serverRoom: any) => {
        const roomId = serverRoom.id;
        const lastReadAt = lastReadTimestamps.current.get(roomId);
        const currentRoom = rooms.find(r => r.id === roomId);
        
        // If room was marked as read recently AND server shows 0,
        // keep local count (server might not have processed the read yet)
        if (lastReadAt && (now - lastReadAt) < 10000 && currentRoom) {
          // Only keep local count if server shows 0 (we just marked it as read)
          // If server shows higher count, use server's value (new messages arrived)
          if (serverRoom.unreadCount === 0 && currentRoom.unreadCount > 0) {
            return transformServerRoom({ ...serverRoom, unreadCount: currentRoom.unreadCount }, undefined);
          }
        }
        
        return transformServerRoom(serverRoom, undefined);
      });
      
      console.log('[Chat] Transformed rooms:', transformedRooms.length);
      setRooms(transformedRooms);
      
      // Save to local DB
      try {
        await saveRooms(transformedRooms.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          description: r.description,
          participants: r.participants.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            status: p.status,
            lastSeen: p.lastSeen ? new Date(p.lastSeen).getTime() : undefined,
          })),
          unreadCount: r.unreadCount,
          updatedAt: new Date(r.updatedAt).getTime(),
          isMuted: false,
          syncStatus: 'synced',
        })));
      } catch (dbError) {
        console.error('[Chat] Failed to save rooms to local DB:', dbError);
      }
      
    } catch (error) {
      console.error('[Chat] Failed to fetch rooms:', error);
    }
  };
  
  // Select room
  const selectRoom = useCallback(async (roomId: string) => {
    // Leave previous room
    if (currentRoomId) {
      leaveRoom(currentRoomId);
    }
    
    setCurrentRoomId(roomId);
    setMessages([]);
    setHasMoreMessages(true);
    messageCursorRef.current = null;
    
    // Join new room via socket
    if (isConnected && isAuthenticated) {
      joinRoom(roomId);
    }
    
    // Load messages from local DB first (instant)
    const localMessages = await getMessagesByRoom(roomId, { limit: MESSAGES_PER_PAGE });
    if (localMessages.length > 0) {
      setMessages(localMessages.map(transformLocalMessage));
      messageCursorRef.current = localMessages[localMessages.length - 1].timestamp;
    }
    
    // Mark as read immediately via Socket
    if (emitMarkRoomAsRead) {
      emitMarkRoomAsRead(roomId);
    }
    
    // Also update local DB
    await updateRoomUnreadCount(roomId, 0);
    setRooms(prev => prev.map(r => 
      r.id === roomId ? { ...r, unreadCount: 0, localUnreadCount: 0 } : r
    ));
    
    // Add to sync queue
    await addToSyncQueue({
      type: 'mark-read',
      roomId,
      payload: {},
      status: 'pending',
    });
    
    // Fetch from server
    await fetchMessages(roomId);
    
  }, [currentRoomId, isConnected, isAuthenticated, joinRoom, leaveRoom]);
  
  // Fetch messages from server
  const fetchMessages = async (roomId: string, before?: number) => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams();
      params.append('limit', String(MESSAGES_PER_PAGE));
      if (before) params.append('before', String(before));
      
      const { data } = await axios.get(`/api/chat/rooms/${roomId}/messages?${params}`);
      const serverMessages = data.messages || [];
      
      if (serverMessages.length < MESSAGES_PER_PAGE) {
        setHasMoreMessages(false);
      }
      
      // Transform and save to local DB
      const localMessages = serverMessages.map(transformServerMessage);
      await saveMessages(localMessages);
      
      // Update state - but preserve pending/optimistic messages
      if (!before) {
        // Initial load - merge with existing pending messages
        const allLocalMessages = await getMessagesByRoom(roomId, { limit: MESSAGES_PER_PAGE });
        const serverMessageIds = new Set(serverMessages.map((m: any) => m.id));
        
        setMessages(prev => {
          // Keep pending messages and recently sent messages (last 10 seconds)
          const now = Date.now();
          const recentMessages = prev.filter(m => 
            m.isOptimistic || 
            m.status === 'sending' || 
            m.status === 'failed' ||
            (m.status === 'sent' && (now - new Date(m.createdAt).getTime()) < 10000)
          );
          
          // Add server messages
          const newMessages = allLocalMessages.map(transformLocalMessage);
          
          // Merge: server messages + recent messages (avoid duplicates)
          const merged = [...newMessages];
          for (const recent of recentMessages) {
            // Check if this message is already in server messages (by content + sender + time)
            const exists = newMessages.some(m => 
              m.content === recent.content && 
              m.senderId === recent.senderId &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(recent.createdAt).getTime()) < 5000
            );
            if (!exists) {
              merged.push(recent);
            }
          }
          
          // Sort by timestamp
          return merged.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      }
      
    } catch (error) {
      console.error('[Chat] Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch latest messages
  const fetchLatestMessages = async (roomId: string) => {
    try {
      const { data } = await axios.get(`/api/chat/rooms/${roomId}/messages?limit=20`);
      const serverMessages = data.messages || [];
      
      const localMessages = serverMessages.map(transformServerMessage);
      await saveMessages(localMessages);
      
      // Update current messages if in this room - but preserve pending
      if (currentRoomId === roomId) {
        const allLocalMessages = await getMessagesByRoom(roomId, { limit: MESSAGES_PER_PAGE });
        
        setMessages(prev => {
          // Keep pending/optimistic messages and recently sent
          const now = Date.now();
          const recentMessages = prev.filter(m => 
            m.isOptimistic || 
            m.status === 'sending' || 
            m.status === 'failed' ||
            (m.status === 'sent' && (now - new Date(m.createdAt).getTime()) < 10000)
          );
          
          // Add server messages
          const newMessages = allLocalMessages.map(transformLocalMessage);
          
          // Merge
          const merged = [...newMessages];
          for (const recent of recentMessages) {
            const exists = newMessages.some(m => 
              m.content === recent.content && 
              m.senderId === recent.senderId &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(recent.createdAt).getTime()) < 5000
            );
            if (!exists) {
              merged.push(recent);
            }
          }
          
          return merged.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      }
    } catch (error) {
      console.error('[Chat] Failed to fetch latest messages:', error);
    }
  };
  
  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!currentRoomId || !hasMoreMessages || isLoading) return;
    
    const cursor = messageCursorRef.current;
    await fetchMessages(currentRoomId, cursor || undefined);
  }, [currentRoomId, hasMoreMessages, isLoading]);
  
  // Mark room as read
  const markRoomAsRead = useCallback(async (roomId: string) => {
    // Optimistic update - sofort auf 0 setzen
    await updateRoomUnreadCount(roomId, 0);
    setRooms(prev => prev.map(r => 
      r.id === roomId ? { ...r, unreadCount: 0, localUnreadCount: 0 } : r
    ));
    
    // Send via Socket for instant broadcast to all clients
    if (emitMarkRoomAsRead) {
      emitMarkRoomAsRead(roomId);
    }
    
    // Also queue for HTTP sync as backup
    await addToSyncQueue({
      type: 'mark-read',
      roomId,
      payload: {},
      status: 'pending',
    });
  }, [emitMarkRoomAsRead]);
  
  // ==================== MESSAGE OPERATIONS ====================
  
  // Send message (Optimistic UI)
  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!currentRoomId || !userId) return;
    
    const tempId = `temp-${uuidv4()}`;
    const timestamp = Date.now();
    
    // Create optimistic message
    const optimisticMessage: EnhancedMessage = {
      id: tempId,
      content,
      senderId: userId,
      sender: {
        id: userId,
        name: session?.user?.name || 'You',
        avatar: session?.user?.image || undefined,
        status: 'online',
      },
      roomId: currentRoomId,
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
      status: 'sending',
      isOptimistic: true,
      attachments: attachments?.map(file => ({
        id: `att-${uuidv4()}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
      })),
    };
    
    // Add to UI immediately (Optimistic)
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Save to local DB
    const localMessage: LocalMessage = {
      id: tempId,
      roomId: currentRoomId,
      content,
      senderId: userId,
      senderName: session?.user?.name || 'You',
      senderAvatar: session?.user?.image || undefined,
      timestamp,
      isDeleted: false,
      syncStatus: 'pending',
      attachments: optimisticMessage.attachments?.map(a => a.id),
    };
    
    await saveMessage(localMessage);
    
    // Update room's last message
    await updateRoomLastMessage(currentRoomId, localMessage);
    
    // Try to send immediately if online
    if (isOnline && isAuthenticated) {
      await syncMessage(localMessage);
    }
    
  }, [currentRoomId, userId, session, isOnline, isAuthenticated]);
  
  // Edit message
  const editMessage = useCallback(async (messageId: string, content: string) => {
    // Optimistic update
    setMessages(prev => prev.map(m => 
      m.id === messageId 
        ? { ...m, content, updatedAt: new Date(), isEdited: true }
        : m
    ));
    
    // Queue for sync
    await addToSyncQueue({
      type: 'edit-message',
      roomId: currentRoomId!,
      payload: { messageId, content },
      status: 'pending',
    });
    
    if (isOnline) {
      syncNow();
    }
  }, [currentRoomId, isOnline, syncNow]);
  
  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    // Optimistic update
    setMessages(prev => prev.filter(m => m.id !== messageId));
    
    // Queue for sync
    await addToSyncQueue({
      type: 'delete-message',
      roomId: currentRoomId!,
      payload: { messageId },
      status: 'pending',
    });
    
    if (isOnline) {
      syncNow();
    }
  }, [currentRoomId, isOnline, syncNow]);
  
  // Retry failed message
  const retryMessage = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Update status
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, status: 'sending', syncError: undefined } : m
    ));
    
    // Try to sync
    const localMessage = await getMessage(messageId);
    if (localMessage) {
      await syncMessage(localMessage);
    }
  }, [messages]);
  
  // ==================== SOCKET EVENTS ====================
  
  // Listen for new messages
  useEffect(() => {
    if (!onMessage) return;
    
    const unsubscribe = onMessage((data: { roomId: string; message: any }) => {
      if (data.roomId === currentRoomId) {
        // Add new message
        const newMessage = transformServerMessage(data.message);
        
        setMessages(prev => {
          // Check if already exists by ID
          if (prev.some(m => m.id === newMessage.id)) return prev;
          
          // Also check for duplicate by content + sender + timestamp (within 5 seconds)
          // This handles the case where optimistic message hasn't been updated with server ID yet
          const isDuplicate = prev.some(m => 
            m.content === newMessage.content && 
            m.senderId === newMessage.senderId &&
            Math.abs(m.timestamp - newMessage.timestamp) < 5000
          );
          
          if (isDuplicate) {
            // Replace the optimistic message with the server message
            return prev.map(m => 
              m.content === newMessage.content && 
              m.senderId === newMessage.senderId &&
              Math.abs(m.timestamp - newMessage.timestamp) < 5000
                ? { ...transformLocalMessage(newMessage), status: 'sent' as const, isOptimistic: false }
                : m
            );
          }
          
          return [...prev, transformLocalMessage(newMessage)];
        });
        
        // Save to local DB
        saveMessage(newMessage);
        
        // Mark as read if in current room
        if (document.visibilityState === 'visible') {
          markRoomAsRead(data.roomId);
        }
      } else {
        // Update unread count for other rooms
        setRooms(prev => prev.map(r => 
          r.id === data.roomId 
            ? { ...r, unreadCount: r.unreadCount + 1, localUnreadCount: r.localUnreadCount + 1 }
            : r
        ));
      }
    });
    
    return unsubscribe;
  }, [onMessage, currentRoomId, markRoomAsRead]);
  
  // Listen for room-read events (from server when any client marks as read)
  useEffect(() => {
    if (!onRoomRead) return;

    const unsubscribe = onRoomRead((data: { roomId: string; unreadCount: number }) => {
      // Update unread count immediately for this room
      setRooms(prev => prev.map(r =>
        r.id === data.roomId
          ? { ...r, unreadCount: data.unreadCount, localUnreadCount: data.unreadCount }
          : r
      ));
    });

    return unsubscribe;
  }, [onRoomRead]);

  // Listen for typing
  useEffect(() => {
    if (!onTyping) return;
    
    const unsubscribe = onTyping((data: { roomId: string; userId: string; isTyping: boolean }) => {
      if (data.roomId !== currentRoomId) return;
      
      setTypingUsers(prev => {
        if (data.isTyping) {
          if (prev.includes(data.userId)) return prev;
          return [...prev, data.userId];
        } else {
          return prev.filter(id => id !== data.userId);
        }
      });
      
      // Clear typing after timeout
      if (data.isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(id => id !== data.userId));
        }, TYPING_TIMEOUT);
      }
    });
    
    return unsubscribe;
  }, [onTyping, currentRoomId]);
  
  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!currentRoomId || !emitTyping) return;
    
    emitTyping(currentRoomId, isTyping);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Auto-clear typing after timeout
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(currentRoomId, false);
      }, TYPING_TIMEOUT);
    }
  }, [currentRoomId, emitTyping]);
  
  // ==================== TRANSFORMERS ====================
  
  function transformLocalMessage(msg: LocalMessage): EnhancedMessage {
    return {
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      sender: {
        id: msg.senderId,
        name: msg.senderName,
        avatar: msg.senderAvatar,
        status: 'online',
      },
      roomId: msg.roomId,
      createdAt: new Date(msg.timestamp),
      updatedAt: msg.editedAt ? new Date(msg.editedAt) : new Date(msg.timestamp),
      isEdited: !!msg.editedAt,
      status: msg.syncStatus === 'synced' ? 'sent' : 
              msg.syncStatus === 'sending' ? 'sending' : 
              msg.syncStatus === 'failed' ? 'failed' : 'sending',
      isOptimistic: msg.syncStatus !== 'synced',
      syncError: msg.syncStatus === 'failed' ? 'Failed to send' : undefined,
    };
  }
  
  function transformServerMessage(msg: any): LocalMessage {
    return {
      id: msg.id,
      roomId: msg.roomId,
      content: msg.content,
      senderId: msg.senderId,
      senderName: msg.sender?.employee 
        ? `${msg.sender.employee.firstName} ${msg.sender.employee.lastName}`
        : msg.sender?.username || 'Unknown',
      senderAvatar: msg.sender?.employee?.avatarUrl,
      timestamp: new Date(msg.sentAt).getTime(),
      editedAt: msg.editedAt ? new Date(msg.editedAt).getTime() : undefined,
      isDeleted: msg.isDeleted,
      syncStatus: 'synced',
      serverId: msg.id,
      replyToId: msg.replyToId,
    };
  }
  
  function transformLocalRoom(room: LocalRoom): EnhancedRoom {
    return {
      id: room.id,
      name: room.name,
      type: room.type,
      description: room.description,
      participants: room.participants.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        status: p.status,
        lastSeen: p.lastSeen ? new Date(p.lastSeen) : undefined,
      })),
      unreadCount: room.unreadCount,
      localUnreadCount: room.unreadCount,
      isMuted: room.isMuted,
      lastMessage: room.lastMessage ? transformLocalMessage(room.lastMessage) : undefined,
      createdAt: new Date(room.updatedAt),
      updatedAt: new Date(room.updatedAt),
      isPrivate: room.type === 'direct',
    };
  }
  
  function transformServerRoom(serverRoom: any, localRoom?: LocalRoom): EnhancedRoom {
    console.log('[Chat] Transforming room:', serverRoom.id, serverRoom.name);
    
    // Map members to participants
    const participants = serverRoom.members?.map((m: any) => {
      const name = m.user?.employee?.firstName && m.user?.employee?.lastName
        ? `${m.user.employee.firstName} ${m.user.employee.lastName}`
        : m.user?.username || 'Unknown';
      
      return {
        id: m.user?.id || m.userId,
        name: name,
        avatar: undefined, // avatarUrl not in schema
        status: 'offline' as const,
      };
    }) || [];
    
    // Transform last message
    let lastMessage = undefined;
    if (serverRoom.lastMessage) {
      const senderName = serverRoom.lastMessage.sender?.employee?.firstName && serverRoom.lastMessage.sender?.employee?.lastName
        ? `${serverRoom.lastMessage.sender.employee.firstName} ${serverRoom.lastMessage.sender.employee.lastName}`
        : serverRoom.lastMessage.sender?.username || 'Unknown';
      
      lastMessage = {
        id: serverRoom.lastMessage.id,
        content: serverRoom.lastMessage.content,
        senderId: serverRoom.lastMessage.senderId,
        sender: {
          id: serverRoom.lastMessage.senderId,
          name: senderName,
          avatar: undefined,
          status: 'offline',
        },
        roomId: serverRoom.id,
        createdAt: new Date(serverRoom.lastMessage.sentAt || serverRoom.lastMessage.createdAt),
        updatedAt: new Date(serverRoom.lastMessage.sentAt || serverRoom.lastMessage.createdAt),
        status: 'sent' as const,
      };
    }
    
    const roomType = serverRoom.type === 'DIRECT' ? 'direct' : 
                     serverRoom.type === 'GROUP' ? 'group' : 'channel';
    
    return {
      id: serverRoom.id,
      name: serverRoom.name || (roomType === 'direct' ? 'Direktchat' : 'Unbenannte Gruppe'),
      type: roomType,
      description: serverRoom.description,
      participants: participants,
      unreadCount: serverRoom.unreadCount || 0,
      localUnreadCount: serverRoom.unreadCount || 0,
      isMuted: false,
      lastMessage: lastMessage,
      createdAt: new Date(serverRoom.createdAt),
      updatedAt: new Date(serverRoom.updatedAt),
      isPrivate: roomType === 'direct',
    };
  }
  
  // ==================== RETURN ====================
  
  return {
    rooms,
    messages,
    currentRoom,
    isLoading,
    isSyncing,
    isOnline,
    hasMoreMessages,
    selectRoom,
    sendMessage,
    editMessage,
    deleteMessage,
    retryMessage,
    loadMoreMessages,
    markRoomAsRead,
    sendTyping,
    typingUsers,
    syncNow,
    pendingCount,
  };
}

// Helper to get message from local DB
async function getMessage(id: string): Promise<LocalMessage | undefined> {
  const { getMessage: getLocalMessage } = await import('@/lib/chat/localDb');
  return getLocalMessage(id);
}

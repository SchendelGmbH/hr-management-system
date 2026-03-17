/**
 * Local-First Chat Database using IndexedDB
 * Stores messages, rooms, and sync state locally for instant access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ChatMessage, ChatRoom } from '@/types/chat';

// Database configuration
const DB_NAME = 'hr-chat-db';
const DB_VERSION = 1;

// Database schema
interface ChatDBSchema extends DBSchema {
  messages: {
    key: string;
    value: LocalMessage;
    indexes: {
      'by-room': string;
      'by-timestamp': number;
      'by-sync-status': string;
    };
  };
  rooms: {
    key: string;
    value: LocalRoom;
    indexes: {
      'by-updated': number;
    };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      'by-status': string;
      'by-timestamp': number;
    };
  };
  attachments: {
    key: string;
    value: LocalAttachment;
    indexes: {
      'by-message': string;
    };
  };
}

// Local message type with sync metadata
export interface LocalMessage {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: number;
  editedAt?: number;
  isDeleted: boolean;
  syncStatus: 'synced' | 'pending' | 'sending' | 'failed';
  serverId?: string;
  replyToId?: string;
  attachments?: string[];
  reactions?: LocalReaction[];
}

export interface LocalReaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export interface LocalRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'channel';
  description?: string;
  participants: LocalParticipant[];
  lastMessage?: LocalMessage;
  unreadCount: number;
  updatedAt: number;
  isMuted: boolean;
  syncStatus: 'synced' | 'pending';
}

export interface LocalParticipant {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'send-message' | 'edit-message' | 'delete-message' | 'mark-read';
  roomId: string;
  payload: any;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  timestamp: number;
  retryCount: number;
  error?: string;
}

export interface LocalAttachment {
  id: string;
  messageId: string;
  name: string;
  type: 'image' | 'file' | 'document';
  mimeType: string;
  size: number;
  localUrl?: string;
  serverUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  syncStatus: 'local' | 'uploading' | 'synced' | 'failed';
}

// Database instance
let dbInstance: IDBPDatabase<ChatDBSchema> | null = null;

// Initialize database
export async function initLocalDB(): Promise<IDBPDatabase<ChatDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ChatDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Messages store
      const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
      messageStore.createIndex('by-room', 'roomId');
      messageStore.createIndex('by-timestamp', 'timestamp');
      messageStore.createIndex('by-sync-status', 'syncStatus');

      // Rooms store
      const roomStore = db.createObjectStore('rooms', { keyPath: 'id' });
      roomStore.createIndex('by-updated', 'updatedAt');

      // Sync queue store
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-status', 'status');
      syncStore.createIndex('by-timestamp', 'timestamp');

      // Attachments store
      const attachmentStore = db.createObjectStore('attachments', { keyPath: 'id' });
      attachmentStore.createIndex('by-message', 'messageId');
    },
  });

  return dbInstance;
}

// Close database connection
export async function closeLocalDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ==================== MESSAGE OPERATIONS ====================

export async function saveMessage(message: LocalMessage): Promise<void> {
  const db = await initLocalDB();
  await db.put('messages', message);
}

export async function saveMessages(messages: LocalMessage[]): Promise<void> {
  const db = await initLocalDB();
  const tx = db.transaction('messages', 'readwrite');
  await Promise.all(messages.map(msg => tx.store.put(msg)));
  await tx.done;
}

export async function getMessage(id: string): Promise<LocalMessage | undefined> {
  const db = await initLocalDB();
  return db.get('messages', id);
}

export async function getMessagesByRoom(
  roomId: string,
  options?: {
    limit?: number;
    before?: number;
    after?: number;
  }
): Promise<LocalMessage[]> {
  const db = await initLocalDB();
  const index = db.transaction('messages').store.index('by-room');
  
  let messages: LocalMessage[] = [];
  let cursor = await index.openCursor(roomId, 'prev');
  
  while (cursor) {
    const message = cursor.value;
    
    // Apply filters
    if (options?.before && message.timestamp >= options.before) {
      cursor = await cursor.continue();
      continue;
    }
    if (options?.after && message.timestamp <= options.after) {
      cursor = await cursor.continue();
      continue;
    }
    
    messages.push(message);
    
    if (options?.limit && messages.length >= options.limit) {
      break;
    }
    
    cursor = await cursor.continue();
  }
  
  return messages;
}

export async function getPendingMessages(roomId?: string): Promise<LocalMessage[]> {
  const db = await initLocalDB();
  const index = db.transaction('messages').store.index('by-sync-status');
  
  const messages: LocalMessage[] = [];
  let cursor = await index.openCursor('pending');
  
  while (cursor) {
    if (!roomId || cursor.value.roomId === roomId) {
      messages.push(cursor.value);
    }
    cursor = await cursor.continue();
  }
  
  return messages;
}

export async function updateMessageSyncStatus(
  id: string,
  status: LocalMessage['syncStatus'],
  serverId?: string
): Promise<void> {
  const db = await initLocalDB();
  const message = await db.get('messages', id);
  if (message) {
    message.syncStatus = status;
    if (serverId) message.serverId = serverId;
    await db.put('messages', message);
  }
}

export async function deleteMessageLocal(id: string): Promise<void> {
  const db = await initLocalDB();
  await db.delete('messages', id);
}

export async function clearMessagesByRoom(roomId: string): Promise<void> {
  const db = await initLocalDB();
  const messages = await getMessagesByRoom(roomId);
  const tx = db.transaction('messages', 'readwrite');
  await Promise.all(messages.map(msg => tx.store.delete(msg.id)));
  await tx.done;
}

// ==================== ROOM OPERATIONS ====================

export async function saveRoom(room: LocalRoom): Promise<void> {
  const db = await initLocalDB();
  await db.put('rooms', room);
}

export async function saveRooms(rooms: LocalRoom[]): Promise<void> {
  const db = await initLocalDB();
  const tx = db.transaction('rooms', 'readwrite');
  await Promise.all(rooms.map(room => tx.store.put(room)));
  await tx.done;
}

export async function getRoom(id: string): Promise<LocalRoom | undefined> {
  const db = await initLocalDB();
  return db.get('rooms', id);
}

export async function getAllRooms(): Promise<LocalRoom[]> {
  const db = await initLocalDB();
  const index = db.transaction('rooms').store.index('by-updated');
  return index.getAll();
}

export async function updateRoomUnreadCount(roomId: string, count: number): Promise<void> {
  const db = await initLocalDB();
  const room = await db.get('rooms', roomId);
  if (room) {
    room.unreadCount = count;
    room.updatedAt = Date.now();
    await db.put('rooms', room);
  }
}

export async function updateRoomLastMessage(roomId: string, message: LocalMessage): Promise<void> {
  const db = await initLocalDB();
  const room = await db.get('rooms', roomId);
  if (room) {
    room.lastMessage = message;
    room.updatedAt = message.timestamp;
    await db.put('rooms', room);
  }
}

export async function deleteRoomLocal(id: string): Promise<void> {
  const db = await initLocalDB();
  await db.delete('rooms', id);
  // Also clear messages
  await clearMessagesByRoom(id);
}

// ==================== SYNC QUEUE OPERATIONS ====================

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
  const db = await initLocalDB();
  const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const queueItem: SyncQueueItem = {
    ...item,
    id,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
  await db.put('syncQueue', queueItem);
  return id;
}

export async function getSyncQueue(status?: SyncQueueItem['status']): Promise<SyncQueueItem[]> {
  const db = await initLocalDB();
  
  if (status) {
    const index = db.transaction('syncQueue').store.index('by-status');
    return index.getAll(status);
  }
  
  return db.getAll('syncQueue');
}

export async function updateSyncQueueItem(
  id: string,
  updates: Partial<SyncQueueItem>
): Promise<void> {
  const db = await initLocalDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    Object.assign(item, updates);
    await db.put('syncQueue', item);
  }
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await initLocalDB();
  await db.delete('syncQueue', id);
}

export async function clearCompletedSyncItems(): Promise<void> {
  const db = await initLocalDB();
  const items = await getSyncQueue('completed');
  const tx = db.transaction('syncQueue', 'readwrite');
  await Promise.all(items.map(item => tx.store.delete(item.id)));
  await tx.done;
}

// ==================== ATTACHMENT OPERATIONS ====================

export async function saveAttachment(attachment: LocalAttachment): Promise<void> {
  const db = await initLocalDB();
  await db.put('attachments', attachment);
}

export async function getAttachmentsByMessage(messageId: string): Promise<LocalAttachment[]> {
  const db = await initLocalDB();
  const index = db.transaction('attachments').store.index('by-message');
  return index.getAll(messageId);
}

export async function updateAttachmentSyncStatus(
  id: string,
  status: LocalAttachment['syncStatus'],
  serverUrl?: string
): Promise<void> {
  const db = await initLocalDB();
  const attachment = await db.get('attachments', id);
  if (attachment) {
    attachment.syncStatus = status;
    if (serverUrl) attachment.serverUrl = serverUrl;
    await db.put('attachments', attachment);
  }
}

// ==================== UTILITY FUNCTIONS ====================

export async function getStorageStats(): Promise<{
  messages: number;
  rooms: number;
  syncQueue: number;
  attachments: number;
}> {
  const db = await initLocalDB();
  return {
    messages: await db.count('messages'),
    rooms: await db.count('rooms'),
    syncQueue: await db.count('syncQueue'),
    attachments: await db.count('attachments'),
  };
}

export async function clearAllLocalData(): Promise<void> {
  const db = await initLocalDB();
  await db.clear('messages');
  await db.clear('rooms');
  await db.clear('syncQueue');
  await db.clear('attachments');
}

// Export database for advanced usage
export { dbInstance as localDB };

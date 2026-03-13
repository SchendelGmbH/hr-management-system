export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  sender?: ChatUser;
  roomId: string;
  createdAt: Date;
  updatedAt?: Date;
  isEdited?: boolean;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  filePath?: string;
  mimeType?: string;
  type: 'image' | 'file' | 'document';
  size?: number;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  thumbnailUrl?: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  type: 'direct' | 'group' | 'channel';
  participants: ChatUser[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPrivate?: boolean;
  avatar?: string;
}

export interface TypingIndicator {
  roomId: string;
  userId: string;
  isTyping: boolean;
}

// ============================================================================
// MENTIONS
// ============================================================================

export interface ChatMention {
  id: string;
  messageId: string;
  userId: string;
  mentionedUserId: string;
  mentionedAt: Date;
  isRead: boolean;
  readAt?: Date;
  
  // Relations
  message?: ChatMessage;
  mentionedUser?: ChatUser;
}

export interface MentionNotification {
  id: string;
  userId: string;
  messageId: string;
  roomId: string;
  senderName: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
}

// ============================================================================
// MENTION HISTORY
// ============================================================================

export interface MentionHistoryItem {
  id: string;
  messageId: string;
  roomId: string;
  roomName: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  mentionedAt: Date;
  isRead: boolean;
}

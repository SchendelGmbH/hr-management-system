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

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChatRoom as ChatRoomType, ChatMessage } from '@/types/chat';
import { 
  MoreVertical, 
  Phone, 
  Video, 
  Users, 
  ArrowLeft,
  Loader2,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ChatRoomProps {
  room: ChatRoomType | null;
  messages: ChatMessage[];
  onSendMessage: (content: string, attachments?: File[]) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onBack?: () => void;
  loading?: boolean;
  typingUsers?: string[];
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
}

export function ChatRoom({
  room,
  messages,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onTyping,
  onBack,
  loading = false,
  typingUsers = [],
  hasMoreMessages = false,
  onLoadMore,
}: ChatRoomProps) {
  const { data: session } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Scroll to bottom on new messages (but not if user scrolled up)
  useEffect(() => {
    if (!hasScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, hasScrolled]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 50;
      setHasScrolled(!isScrolledToBottom);
      
      // Load more when scrolled to top
      if (scrollTop === 0 && hasMoreMessages && onLoadMore) {
        onLoadMore();
      }
    }
  }, [hasMoreMessages, onLoadMore]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (onTyping) {
      onTyping(isTyping);
    }
  }, [onTyping]);

  // Group messages by date
  const groupMessagesByDate = useCallback((msgs: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    msgs.forEach((msg) => {
      const dateKey = format(new Date(msg.createdAt), 'yyyy-MM-dd', { locale: de });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    
    return groups;
  }, []);

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Heute';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Gestern';
    }
    return format(date, 'EEEE, d. MMMM', { locale: de });
  };

  const groupedMessages = groupMessagesByDate(messages);

  if (loading && !room) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <p className="mt-4 text-sm text-gray-500">Lade Chat...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-8">
        <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
          <Users className="h-8 w-8 text-primary-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          Chat
        </h3>
        <p className="mt-1 text-sm text-gray-500 max-w-md">
          Wähle einen Chat aus der Liste oder starte eine neue Unterhaltung.
        </p>
      </div>
    );
  }

  const otherParticipants = room.participants.filter(
    (p) => p.id !== session?.user?.id
  );
  const displayName = room.type === 'direct' 
    ? (otherParticipants[0]?.name || 'Unbekannt')
    : room.name;
  const isOnline = otherParticipants.some(p => p.status === 'online');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Back button (mobile) */}
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden -ml-2 rounded-full p-2 text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          
          {/* Avatar */}
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
              {room.avatar ? (
                <img src={room.avatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : room.type === 'direct' ? (
                <User className="h-5 w-5 text-primary-600" />
              ) : (
                <Users className="h-5 w-5 text-primary-600" />
              )}
            </div>
            {room.type === 'direct' && isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success-500" />
            )}
          </div>
          
          {/* Info */}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {displayName}
            </h2>
            <p className="text-xs text-gray-500">
              {typingUsers.length > 0 ? (
                <span className="text-primary-600">
                  {typingUsers.join(', ')} schreibt{typingUsers.length > 1 ? 'en' : ''}...
                </span>
              ) : room.type === 'direct' ? (
                isOnline ? 'Online' : `Zuletzt gesehen ${otherParticipants[0]?.lastSeen ? format(new Date(otherParticipants[0].lastSeen), 'HH:mm', { locale: de }) : '-'}`
              ) : (
                `${room.participants.length} Teilnehmer`
              )}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button className="hidden rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <Phone className="h-5 w-5" />
          </button>
          <button className="hidden rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <Video className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4">
        {/* Load More */}
        {hasMoreMessages && (
          <div className="mb-4 text-center">
            <button
              onClick={onLoadMore}
              className="text-xs text-primary-600 hover:underline"
            >
              Ältere Nachrichten laden
            </button>
          </div>
        )}
        
        {/* Messages by Date */}
        {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
          <div key={dateKey}>
            {/* Date Divider */}
            <div className="flex items-center justify-center my-4">
              <div className="flex-1 border-t border-gray-200" />
              <span className="mx-4 px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-500">
                {formatDateLabel(dateKey)}
              </span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
            
            {/* Messages */}
            <div className="space-y-1">
              {dateMessages.map((message, index) => {
                const prevMessage = dateMessages[index - 1];
                const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;
                
                return (
                  <div key={message.id} className="group/message">
                    <MessageBubble
                      message={message}
                      showAvatar={showAvatar}
                      onEdit={onEditMessage}
                      onDelete={onDeleteMessage}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-500">
              Noch keine Nachrichten.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Schreib die erste Nachricht!
            </p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={onSendMessage}
        onTyping={handleTyping}
        disabled={loading}
        placeholder={`Nachricht an ${displayName}...`}
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { MessageInputMobile } from './MessageInputMobile';
import { SmartReplies } from './ai-features/SmartReplies';
import { ConnectionStatus } from './OfflineIndicator';
import { MentionNotifications } from './MentionNotifications';
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
import { clsx } from 'clsx';

interface ChatRoomProps {
  room: ChatRoomType | null;
  messages: ChatMessage[];
  onSendMessage: (content: string, attachments?: File[]) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onBack?: () => void;
  onStartVideoCall?: () => void;
  onStartAudioCall?: () => void;
  onCommand?: (command: string, args: string[]) => void;
  onSignatureClick?: (requestId: string) => void;
  loading?: boolean;
  typingUsers?: string[];
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
  isOffline?: boolean;
}

export function ChatRoom({
  room,
  messages,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onTyping,
  onBack,
  onStartVideoCall,
  onStartAudioCall,
  onCommand,
  onSignatureClick,
  loading = false,
  typingUsers = [],
  hasMoreMessages = false,
  onLoadMore,
  isOffline = false,
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
      <div className="flex flex-col h-full items-center justify-center bg-white dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Lade Chat...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-8 bg-white dark:bg-gray-900">
        <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center dark:bg-primary-900/30">
          <Users className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          Chat
        </h3>
        <p className="mt-1 text-sm text-gray-500 max-w-md dark:text-gray-400">
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header - Mobile-optimized */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {/* Back button (mobile) */}
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden -ml-2 rounded-full p-2.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          
          {/* Avatar */}
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center dark:bg-primary-900/30">
              {room.avatar ? (
                <img src={room.avatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : room.type === 'direct' ? (
                <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              ) : (
                <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              )}
            </div>
            {room.type === 'direct' && isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-800" />
            )}
          </div>
          
          {/* Info */}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate dark:text-white">
              {displayName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {typingUsers.length > 0 ? (
                <span className="text-primary-600 dark:text-primary-400">
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
        
        {/* Actions - Touch-optimized */}
        <div className="flex items-center gap-0.5">
          <ConnectionStatus isOnline={!isOffline} />
          <MentionNotifications />
          <button 
            onClick={onStartAudioCall}
            disabled={isOffline}
            className={clsx(
              'rounded-full p-2.5 transition-colors touch-manipulation min-h-[44px] min-w-[44px]',
              isOffline 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-primary-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-primary-400'
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Audioanruf"
          >
            <Phone className="h-5 w-5" strokeWidth={isOffline ? 1.5 : 2} />
          </button>
          <button 
            onClick={onStartVideoCall}
            disabled={isOffline}
            className={clsx(
              'rounded-full p-2.5 transition-colors touch-manipulation min-h-[44px] min-w-[44px]',
              isOffline 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-primary-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-primary-400'
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Videoanruf"
          >
            <Video className="h-5 w-5" strokeWidth={isOffline ? 1.5 : 2} />
          </button>
          <button 
            className="rounded-full p-2.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 touch-manipulation min-h-[44px] min-w-[44px]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 dark:bg-gray-900 lg:px-6 lg:py-6"
      >
        {/* Load More */}
        {hasMoreMessages && (
          <div className="mb-4 text-center">
            <button
              onClick={onLoadMore}
              className="text-xs text-primary-600 hover:underline dark:text-primary-400"
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
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
              <span className="mx-4 px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {formatDateLabel(dateKey)}
              </span>
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            </div>
            
            {/* Messages */}
            <div className="space-y-1 lg:space-y-2">
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
                      onSignatureClick={onSignatureClick}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Noch keine Nachrichten.
            </p>
            <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
              Schreib die erste Nachricht!
            </p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Smart Replies */}
      {room && !loading && messages.length > 0 && (
        <SmartReplies
          roomId={room.id}
          onSelectReply={(reply) => onSendMessage(reply)}
          disabled={loading}
        />
      )}

      {/* Input - Desktop */}
      <div className="hidden lg:block">
        <MessageInput
          roomId={room.id}
          onSend={onSendMessage}
          onTyping={handleTyping}
          onCommand={onCommand}
          disabled={loading}
          placeholder={`Nachricht an ${displayName}...`}
        />
      </div>

      {/* Input - Mobile */}
      <div className="lg:hidden">
        <MessageInputMobile
          roomId={room.id}
          onSend={onSendMessage}
          onTyping={handleTyping}
          onCommand={onCommand}
          disabled={loading}
          placeholder={`Nachricht...`}
          isOffline={isOffline}
        />
      </div>
    </div>
  );
}

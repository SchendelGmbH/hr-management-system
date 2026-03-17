'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useChat, EnhancedMessage } from '@/hooks/useChat';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { MessageInput } from '@/components/chat/MessageInput';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { Loader2, AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import axios from 'axios';

// Message status indicator component
function MessageStatus({ status, error }: { status: string; error?: string }) {
  if (error) {
    return (
      <span className="flex items-center gap-1 text-red-500 text-xs" title={error}>
        <AlertCircle className="h-3 w-3" />
        <span>Fehler</span>
      </span>
    );
  }
  
  switch (status) {
    case 'sending':
      return (
        <span className="flex items-center gap-1 text-gray-400 text-xs">
          <Clock className="h-3 w-3 animate-pulse" />
          <span>Senden...</span>
        </span>
      );
    case 'sent':
      return <Check className="h-3 w-3 text-gray-400" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-gray-400" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    default:
      return null;
  }
}

// Main Chat View Component
export function ChatViewV2() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  
  // Use the new useChat hook
  const {
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
    sendTyping,
    typingUsers,
    pendingCount,
  } = useChat();
  
  // Local state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollToBottomRef = useRef<HTMLDivElement>(null);
  
  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });
  
  const virtualItems = virtualizer.getVirtualItems();
  
  // Handle send message
  const handleSendMessage = useCallback(async (content: string, attachments?: File[]) => {
    await sendMessage(content, attachments);
    
    // Scroll to bottom after sending
    setTimeout(() => {
      scrollToBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [sendMessage]);
  
  // Handle typing
  const handleTyping = useCallback(() => {
    sendTyping(true);
  }, [sendTyping]);
  
  // Handle create direct chat
  const handleCreateDirectChat = useCallback(async (userId: string) => {
    try {
      const response = await axios.post('/api/chat/users', { userId });
      if (response.data.room) {
        await selectRoom(response.data.room.id);
      }
    } catch (error) {
      console.error('Failed to create direct chat:', error);
      alert('Fehler beim Erstellen des Chats');
    }
  }, [selectRoom]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && scrollToBottomRef.current) {
      scrollToBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);
  
  // Load more messages when scrolling to top
  const handleScroll = useCallback(() => {
    const scrollTop = parentRef.current?.scrollTop;
    if (scrollTop === 0 && hasMoreMessages && !isLoading) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, isLoading, loadMoreMessages]);
  
  // Render message
  const renderMessage = (message: EnhancedMessage, index: number) => {
    const isOwn = message.senderId === userId;
    const isLastInGroup = index === messages.length - 1 || 
      messages[index + 1]?.senderId !== message.senderId;
    
    return (
      <div
        key={message.id}
        className={clsx(
          'flex gap-3 px-4 py-2',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        {/* Avatar */}
        {!isOwn && isLastInGroup ? (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-xs font-medium text-primary-700">
              {message.sender?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        ) : (
          <div className="flex-shrink-0 w-8" />
        )}
        
        {/* Message */}
        <div className={clsx(
          'flex flex-col max-w-[70%]',
          isOwn ? 'items-end' : 'items-start'
        )}>
          {/* Message bubble */}
          <div className={clsx(
            'px-4 py-2 rounded-2xl max-w-full break-words',
            isOwn 
              ? 'bg-primary-600 text-white rounded-br-sm' 
              : 'bg-gray-100 text-gray-900 rounded-bl-sm dark:bg-gray-800 dark:text-gray-100',
            message.isOptimistic && 'opacity-70'
          )}>
            {/* Sender name for group chats */}
            {!isOwn && currentRoom?.type !== 'direct' && (
              <div className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                {message.sender?.name}
              </div>
            )}
            
            {/* Content */}
            <div className="text-sm whitespace-pre-wrap">
              {message.content}
            </div>
            
            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map((att) => (
                  <div 
                    key={att.id}
                    className="flex items-center gap-2 text-xs bg-black/10 rounded px-2 py-1"
                  >
                    <span>📎 {att.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Status */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">
              {format(new Date(message.createdAt), 'HH:mm')}
            </span>
            {isOwn && (
              <MessageStatus 
                status={message.status} 
                error={message.syncError} 
              />
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Typing indicator
  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <span className="text-sm text-gray-500">
          {typingUsers.length === 1 
            ? 'Jemand tippt...' 
            : `${typingUsers.length} Personen tippen...`}
        </span>
      </div>
    );
  };
  
  // Debug: Log rooms state
  useEffect(() => {
    console.log('[ChatViewV2] Rooms state:', rooms.length, rooms);
  }, [rooms]);

  // Sidebar component
  const sidebar = (
    <ChatSidebar
      rooms={rooms}
      currentRoom={currentRoom}
      onSelectRoom={(room) => {
        selectRoom(room.id);
        setShowMobileSidebar(false);
      }}
      onCreateDirectChat={handleCreateDirectChat}
      loading={isLoading}
    />
  );
  
  // Empty state
  if (!currentRoom) {
    return (
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 hidden lg:block">
          {sidebar}
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Willkommen im Chat
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Wähle einen Chat aus der Liste aus
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-full">
      {/* Desktop Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 hidden lg:block">
        {sidebar}
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <span className="sr-only">Zurück</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {currentRoom.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentRoom.participants.length} Teilnehmer
                {!isOnline && ' • Offline'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isSyncing && (
              <div className="flex items-center gap-1 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Sync...</span>
              </div>
            )}
            {pendingCount > 0 && (
              <span className="text-sm text-orange-500">
                {pendingCount} ausstehend
              </span>
            )}
          </div>
        </div>
        
        {/* Messages */}
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
        >
          {/* Load more button */}
          {hasMoreMessages && (
            <div className="py-2 text-center">
              <button
                onClick={loadMoreMessages}
                disabled={isLoading}
                className="text-sm text-primary-600 hover:underline disabled:opacity-50"
              >
                {isLoading ? 'Laden...' : 'Ältere Nachrichten laden'}
              </button>
            </div>
          )}
          
          {/* Virtual list */}
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const message = messages[virtualItem.index];
              if (!message) return null;
              
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {renderMessage(message, virtualItem.index)}
                </div>
              );
            })}
          </div>
          
          {/* Typing indicator */}
          {renderTypingIndicator()}
          
          {/* Scroll anchor */}
          <div ref={scrollToBottomRef} />
        </div>
        
        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <MessageInput
            onSend={handleSendMessage}
            onTyping={handleTyping}
            disabled={!isOnline && pendingCount > 5}
            placeholder={isOnline ? 'Nachricht schreiben...' : 'Offline - Nachricht wird gespeichert'}
          />
        </div>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
          <div className="absolute inset-0 bg-black/20" />
        </div>
      )}
    </div>
  );
}

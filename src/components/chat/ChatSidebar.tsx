'use client';

import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Bell,
  MessageCircle,
  Users,
  User
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { ChatRoom } from '@/types/chat';

interface ChatSidebarProps {
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  onSelectRoom: (room: ChatRoom) => void;
  onCreateDirectChat?: (userId: string) => void;
  onCreateGroupChat?: () => void;
  loading?: boolean;
}

export function ChatSidebar({
  rooms,
  currentRoom,
  onSelectRoom,
  onCreateGroupChat,
  loading = false,
}: ChatSidebarProps) {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'channel'>('all');

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.participants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filter === 'all' || room.type === filter;
    
    return matchesSearch && matchesFilter;
  });

  const formatLastMessageTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const isToday = messageDate.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(messageDate, 'HH:mm', { locale: de });
    }
    return format(messageDate, 'dd.MM.', { locale: de });
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Chat</h1>
          <div className="flex items-center gap-1">
            {onCreateGroupChat && (
              <button
                onClick={onCreateGroupChat}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
                title="Neuer Chat"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
            <button className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Chats suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>
        
        {/* Filter */}
        <div className="flex items-center gap-1 mt-3">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
          >
            Alle
          </button>
          <button
            onClick={() => setFilter('direct')}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              filter === 'direct'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
          >
            Direkt
          </button>
          <button
            onClick={() => setFilter('group')}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              filter === 'group'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
          >
            Gruppen
          </button>
        </div>
      </div>
      
      {/* Room List */}
      <div className="flex-1 overflow-y-auto">
        {loading && rooms.length === 0 ? (
          <div className="p-4 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto"
            />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="h-10 w-10 text-gray-300 mx-auto mb-2 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Keine Chats gefunden' : 'Noch keine Chats'}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-2 text-xs text-primary-600 hover:underline dark:text-primary-400"
              >
                Alle anzeigen
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredRooms.map((room) => {
              const otherParticipants = room.participants.filter(
                (p) => p.id !== session?.user?.id
              );
              const displayName = room.type === 'direct'
                ? (otherParticipants[0]?.name || 'Unbekannt')
                : room.name;
              const isOnline = otherParticipants.some(p => p.status === 'online');
              const isActive = currentRoom?.id === room.id;
              const displayAvatar = room.type === 'direct' 
                ? otherParticipants[0]?.avatar 
                : undefined;
              
              return (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room)}
                  className={clsx(
                    'w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left dark:hover:bg-gray-800',
                    isActive && 'bg-primary-50 hover:bg-primary-50 dark:bg-primary-900/20 dark:hover:bg-primary-900/30'
                  )}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={clsx(
                      'h-10 w-10 rounded-full flex items-center justify-center overflow-hidden',
                      isActive ? 'bg-primary-200 dark:bg-primary-800' : 'bg-gray-100 dark:bg-gray-700'
                    )}>
                      {displayAvatar ? (
                        <img 
                          src={displayAvatar} 
                          alt={displayName} 
                          className="h-full w-full object-cover" 
                        />
                      ) : room.type === 'direct' ? (
                        <User className={clsx(
                          'h-5 w-5',
                          isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'
                        )} />
                      ) : (
                        <Users className={clsx(
                          'h-5 w-5',
                          isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'
                        )} />
                      )}
                    </div>
                    {room.type === 'direct' && isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-800" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={clsx(
                        'font-medium text-sm truncate',
                        isActive ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {displayName}
                      </span>
                      {room.lastMessage && (
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2 dark:text-gray-500">
                          {formatLastMessageTime(room.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={clsx(
                        'text-sm truncate pr-2',
                        isActive ? 'text-primary-700 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400',
                        room.unreadCount > 0 && 'font-medium text-gray-900 dark:text-gray-200'
                      )}>
                        {room.lastMessage ? (
                          <>
                            {room.lastMessage.sender?.id === session?.user?.id && 'Du: '}
                            {room.lastMessage.content}
                          </>
                        ) : 'Noch keine Nachrichten'}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary-600 text-white text-xs font-medium">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

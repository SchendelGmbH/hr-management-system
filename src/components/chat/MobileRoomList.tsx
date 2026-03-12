'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, User, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { ChatRoom } from '@/types/chat';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface MobileRoomListProps {
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  onSelectRoom: (room: ChatRoom) => void;
  onCreateDirectChat?: (userId: string) => void;
  loading?: boolean;
}

export function MobileRoomList({
  rooms,
  currentRoom,
  onSelectRoom,
  onCreateDirectChat,
  loading = false,
}: MobileRoomListProps) {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'direct' | 'group'>('all');

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.participants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesFilter = activeFilter === 'all' || room.type === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [rooms, searchQuery, activeFilter]);

  const formatLastMessageTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const isToday = messageDate.toDateString() === now.toDateString();
    const isYesterday = messageDate.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString();
    
    if (isToday) return format(messageDate, 'HH:mm', { locale: de });
    if (isYesterday) return 'Gestern';
    return format(messageDate, 'dd.MM.', { locale: de });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Search Bar - Touch-optimiert */}
      <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Chats suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border-0 bg-gray-100 text-base text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        {/* Filter Chips - Touch-optimiert */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
          {(['all', 'direct', 'group'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={clsx(
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[40px]',
                activeFilter === filter
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              )}
            >
              {filter === 'all' ? 'Alle' : filter === 'direct' ? 'Direkt' : 'Gruppen'}
            </button>
          ))}
        </div>
      </div>

      {/* Room List - Touch-optimiert */}
      <div className="flex-1 overflow-y-auto">
        {loading && rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-3 border-primary-600 border-t-transparent rounded-full" />
            <p className="mt-3 text-sm text-gray-500">Chats werden geladen...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 dark:bg-gray-800">
              {searchQuery ? (
                <Search className="h-8 w-8 text-gray-400" />
              ) : (
                <User className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Keine Chats gefunden' : 'Noch keine Chats'}
            </p>
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-3 text-primary-600 text-sm font-medium"
            >
              {activeFilter !== 'all' ? 'Alle anzeigen' : 'Chat starten'}
            </button>
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
                    'w-full flex items-center gap-4 p-4 transition-colors text-left',
                    'active:bg-gray-100 dark:active:bg-gray-800',
                    isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-white dark:bg-gray-900',
                    'min-h-[80px]'
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* Avatar - Größer für Touch */}
                  <div className="relative flex-shrink-0">
                    <div className={clsx(
                      'h-14 w-14 rounded-full flex items-center justify-center overflow-hidden',
                      isActive ? 'bg-primary-200 dark:bg-primary-800' : 'bg-gray-100 dark:bg-gray-800'
                    )}>
                      {displayAvatar ? (
                        <img 
                          src={displayAvatar} 
                          alt={displayName} 
                          className="h-full w-full object-cover" 
                        />
                      ) : room.type === 'direct' ? (
                        <User className={clsx(
                          'h-7 w-7',
                          isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'
                        )} />
                      ) : (
                        <Users className={clsx(
                          'h-7 w-7',
                          isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'
                        )} />
                      )}
                    </div>
                    {room.type === 'direct' && isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-success-500 dark:border-gray-900" />
                    )}
                  </div>

                  {/* Info - Größere Touch-Ziele */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx(
                        'font-semibold text-base truncate',
                        isActive ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-white'
                      )}>
                        {displayName}
                      </span>
                      {room.lastMessage && (
                        <span className="text-xs text-gray-400 flex-shrink-0 dark:text-gray-500">
                          {formatLastMessageTime(room.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className={clsx(
                        'text-sm truncate pr-2 max-w-[200px]',
                        isActive ? 'text-primary-700 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400',
                        room.unreadCount > 0 && 'font-semibold text-gray-900 dark:text-white'
                      )}>
                        {room.lastMessage ? (
                          <>
                            {room.lastMessage.sender?.id === session?.user?.id && (
                              <span className="text-gray-400">Du: </span>
                            )}
                            {room.lastMessage.content}
                          </>
                        ) : (
                          <span className="text-gray-400 italic">Noch keine Nachrichten</span>
                        )}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary-600 text-white text-xs font-bold">
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

      {/* Floating Action Button - Touch-optimiert */}
      <button
        className="absolute bottom-20 right-4 h-14 w-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{
          boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.39)',
        }}
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
}

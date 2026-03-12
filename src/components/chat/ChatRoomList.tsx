'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { MessageSquare, Plus, Users } from 'lucide-react';

interface Room {
  id: string;
  name: string | null;
  type: string;
  unreadCount: number;
  lastMessage?: {
    content: string;
    sentAt: string;
  };
  members: {
    user: {
      id: string;
      username: string;
      employee?: {
        firstName: string;
        lastName: string;
      };
    };
  }[];
}

interface ChatRoomListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId?: string;
}

export function ChatRoomList({ onSelectRoom, selectedRoomId }: ChatRoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { onMessage } = useSocket();

  useEffect(() => {
    loadRooms();
  }, []);

  // Update unread counts when new messages arrive
  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.id === data.roomId
            ? {
                ...room,
                unreadCount: room.id === selectedRoomId ? 0 : room.unreadCount + 1,
                lastMessage: {
                  content: data.message.content,
                  sentAt: data.message.sentAt,
                },
              }
            : room
        )
      );
    });
    return unsubscribe;
  }, [onMessage, selectedRoomId]);

  const loadRooms = async () => {
    try {
      const response = await fetch('/api/chat/rooms');
      const data = await response.json();
      setRooms(data.rooms);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoomName = (room: Room) => {
    if (room.name) return room.name;
    
    // For direct chats, show other member's name
    if (room.type === 'DIRECT') {
      const otherMember = room.members.find(
        (m) => m.user.id !== 'current-user-id'
      );
      if (otherMember) {
        const { firstName, lastName } = otherMember.user.employee || {};
        return firstName && lastName ? `${firstName} ${lastName}` : otherMember.user.username;
      }
    }
    
    return 'Unnamed Chat';
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'DIRECT':
        return <MessageSquare className="w-4 h-4" />;
      case 'GROUP':
        return <Users className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const formatLastMessageTime = (date: string) => {
    const now = new Date();
    const msgDate = new Date(date);
    const diffMs = now.getTime() - msgDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'jetzt';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return msgDate.toLocaleDateString('de-DE');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-white border-r flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Chats</h2>
        <button className="p-2 hover:bg-gray-100 rounded-lg" title="Neuen Chat starten">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Noch keine Chats vorhanden.</p>
            <p className="text-sm mt-1">Starte einen neuen Chat! 👋</p>
          </div>
        ) : (
          <div className="divide-y">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                  selectedRoomId === room.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  {getRoomIcon(room.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">
                      {getRoomName(room)}
                    </span>
                    {room.lastMessage && (
                      <span className="text-xs text-gray-400">
                        {formatLastMessageTime(room.lastMessage.sentAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-sm text-gray-500 truncate pr-2">
                      {room.lastMessage?.content || 'Keine Nachrichten'}
                    </p>
                    {room.unreadCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full min-w-[20px] text-center">
                        {room.unreadCount > 99 ? '99+' : room.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useSession } from 'next-auth/react';
import { Send, Trash, Smile, Reply } from 'lucide-react';

interface ChatRoom {
  id: string;
  name: string | null;
  type: 'DIRECT' | 'GROUP' | 'DEPARTMENT' | 'SYSTEM';
  unreadCount: number;
  lastMessage?: {
    content: string;
    sentAt: string;
    sender?: {
      id: string;
      username: string;
      employee?: { firstName: string; lastName: string; };
    };
  };
}

interface ChatMessage {
  id: string;
  content: string;
  sentAt: string;
  isSystem: boolean;
  isDeleted: boolean;
  sender?: {
    id: string;
    username: string;
    employee?: { firstName: string; lastName: string; avatarUrl?: string };
  };
  reactions: Array<{
    emoji: string;
    user: { id: string; username: string };
  }>;
}

export default function ChatModule() {
  const { data: session } = useSession();
  const { isConnected, joinRoom, onMessage, sendTyping } = useSocket();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load rooms
  useEffect(() => {
    fetch('/api/chat/rooms')
      .then((res) => res.json())
      .then((data) => setRooms(data.rooms || []))
      .catch(console.error);
  }, []);

  // Load messages when room selected
  useEffect(() => {
    if (selectedRoom) {
      setIsLoading(true);
      fetch(`/api/chat/rooms/${selectedRoom.id}/messages`)
        .then((res) => res.json())
        .then((data) => {
          setMessages(data.messages || []);
          setIsLoading(false);
          // Join socket room
          joinRoom(selectedRoom.id);
        })
        .catch(console.error);
    }
  }, [selectedRoom, joinRoom]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onMessage((event) => {
      if (event.roomId === selectedRoom?.id) {
        setMessages((prev) => [event.message, ...prev]);
      }
    });
    return unsubscribe;
  }, [onMessage, selectedRoom]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!selectedRoom || !newMessage.trim()) return;

    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoom.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });
      
      if (res.ok) {
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await fetch(`/api/chat/messages/${messageId}`, { method: 'DELETE' });
      setMessages((prev) =
003e prev.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Room List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold">Chat</h1>
          <div className="text-xs text-gray-500 mt-1">
            {isConnected ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedRoom?.id === room.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium truncate">
                  {room.name || 'Unbenannter Chat'}
                </span>
                {room.unreadCount > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {room.unreadCount}
                  </span>
                )}
              </div>
              {room.lastMessage && (
                <div className="text-sm text-gray-500 truncate mt-1">
                  {room.lastMessage.sender?.employee?.firstName || room.lastMessage.sender?.username}: {room.lastMessage.content}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="font-semibold">{selectedRoom.name || 'Chat'}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="text-center text-gray-500">Lädt...</div>
              ) : (
                [...messages].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender?.id === session?.user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        msg.isSystem
                          ? 'bg-gray-100 text-gray-600 text-sm text-center w-full max-w-none'
                          : msg.sender?.id === session?.user?.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      {!msg.isSystem && msg.sender?.id !== session?.user?.id && (
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          {msg.sender?.employee?.firstName || msg.sender?.username}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      
                      <div className={`text-xs mt-1 ${
                        msg.sender?.id === session?.user?.id ? 'text-blue-100' : 'text-gray-400'
                      }`}>
                        {formatTime(msg.sentAt)}
                      </div>

                      {/* Reactions */}
                      {msg.reactions.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {Object.entries(
                            msg.reactions.reduce(<(,
                              emoji
                            )> => {
                              acc[emoji] = (acc[emoji] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>
                          )).map(([emoji, count]) => (
                            <span key={emoji} className="text-sm bg-white/50 px-1 rounded">
                              {emoji} {count}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {msg.sender?.id === session?.user?.id && !msg.isSystem && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded"
                        >
                          <Trash className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    sendTyping(selectedRoom.id, e.target.value.length > 0);
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder="Nachricht schreiben..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Wähle einen Chat aus der Liste
          </div>
        )}
      </div>
    </div>
  );
}
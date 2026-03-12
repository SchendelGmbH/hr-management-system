'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  ChatLayout, 
  ChatRoom, 
  ChatSidebar 
} from '@/components/chat';
import { ChatRoom as ChatRoomType, ChatMessage, ChatUser } from '@/types/chat';
import { useSocket } from '@/hooks/useSocket';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

// API-Funktionen
const fetchRooms = async (): Promise<ChatRoomType[]> => {
  const { data } = await axios.get('/api/chat/rooms');
  return data;
};

const fetchMessages = async (roomId: string): Promise<ChatMessage[]> => {
  const { data } = await axios.get(`/api/chat/rooms/${roomId}/messages`);
  return data;
};

const createRoom = async (roomData: { 
  name: string; 
  type: 'direct' | 'group'; 
  participantIds: string[] 
}): Promise<ChatRoomType> => {
  const { data } = await axios.post('/api/chat/rooms', roomData);
  return data;
};

const sendMessageApi = async ({ 
  roomId, 
  content, 
  attachments 
}: { 
  roomId: string; 
  content: string; 
  attachments?: File[] 
}): Promise<ChatMessage> => {
  const formData = new FormData();
  formData.append('content', content);
  attachments?.forEach((file) => formData.append('attachments', file));
  
  const { data } = await axios.post(`/api/chat/rooms/${roomId}/messages`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

const editMessageApi = async ({ 
  messageId, 
  content 
}: { 
  messageId: string; 
  content: string 
}): Promise<ChatMessage> => {
  const { data } = await axios.patch(`/api/chat/messages/${messageId}`, { content });
  return data;
};

const deleteMessageApi = async (messageId: string): Promise<void> => {
  await axios.delete(`/api/chat/messages/${messageId}`);
};

export function ChatView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());

  // Socket.IO
  const { 
    isConnected, 
    joinRoom, 
    leaveRoom, 
    sendTyping, 
    onMessage, 
    onTyping 
  } = useSocket();

  // Queries
  const { 
    data: rooms = [], 
    isLoading: roomsLoading 
  } = useQuery({
    queryKey: ['chat', 'rooms'],
    queryFn: fetchRooms,
    enabled: !!session?.user?.id,
  });

  const currentRoom = rooms.find(r => r.id === currentRoomId) || null;

  const { 
    data: messages = [], 
    isLoading: messagesLoading 
  } = useQuery({
    queryKey: ['chat', 'messages', currentRoomId],
    queryFn: () => fetchMessages(currentRoomId!),
    enabled: !!currentRoomId && !!session?.user?.id,
  });

  // Mutations
  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
      toast.success('Chat erstellt');
    },
    onError: () => {
      toast.error('Fehler beim Erstellen des Chats');
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendMessageApi,
    onSuccess: (newMessage) => {
      queryClient.setQueryData(
        ['chat', 'messages', currentRoomId],
        (old: ChatMessage[] = []) => [...old, newMessage]
      );
    },
    onError: () => {
      toast.error('Fehler beim Senden der Nachricht');
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: editMessageApi,
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData(
        ['chat', 'messages', currentRoomId],
        (old: ChatMessage[] = []) =>
          old.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
      );
    },
    onError: () => {
      toast.error('Fehler beim Bearbeiten der Nachricht');
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: deleteMessageApi,
    onSuccess: (_, messageId) => {
      queryClient.setQueryData(
        ['chat', 'messages', currentRoomId],
        (old: ChatMessage[] = []) => old.filter((msg) => msg.id !== messageId)
      );
    },
    onError: () => {
      toast.error('Fehler beim Löschen der Nachricht');
    },
  });

  // Socket-Effekte
  useEffect(() => {
    if (!currentRoomId || !isConnected) return;

    joinRoom(currentRoomId);

    const unsubscribeMessage = onMessage((message: ChatMessage) => {
      if (message.roomId === currentRoomId) {
        queryClient.setQueryData(
          ['chat', 'messages', currentRoomId],
          (old: ChatMessage[] = []) => {
            // Verhindere Duplikate
            if (old.some((m) => m.id === message.id)) return old;
            return [...old, message];
          }
        );
      }
    });

    const unsubscribeTyping = onTyping((data) => {
      if (data.roomId === currentRoomId) {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(currentRoomId) || [];
          
          if (data.isTyping) {
            if (!current.includes(data.userId)) {
              newMap.set(currentRoomId, [...current, data.userId]);
            }
          } else {
            newMap.set(currentRoomId, current.filter((id) => id !== data.userId));
          }
          
          return newMap;
        });
      }
    });

    return () => {
      leaveRoom(currentRoomId);
      unsubscribeMessage();
      unsubscribeTyping();
    };
  }, [currentRoomId, isConnected, joinRoom, leaveRoom, onMessage, onTyping, queryClient]);

  // Handler
  const handleSelectRoom = useCallback((room: ChatRoomType) => {
    setCurrentRoomId(room.id);
  }, []);

  const handleSendMessage = useCallback(
    (content: string, attachments?: File[]) => {
      if (!currentRoomId) return;
      sendMessageMutation.mutate({ roomId: currentRoomId, content, attachments });
    },
    [currentRoomId, sendMessageMutation]
  );

  const handleEditMessage = useCallback(
    (messageId: string, content: string) => {
      editMessageMutation.mutate({ messageId, content });
    },
    [editMessageMutation]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (confirm('Nachricht wirklich löschen?')) {
        deleteMessageMutation.mutate(messageId);
      }
    },
    [deleteMessageMutation]
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!currentRoomId) return;
      sendTyping(currentRoomId, isTyping);
    },
    [currentRoomId, sendTyping]
  );

  const handleCreateDirectChat = useCallback(
    (userId: string) => {
      const existingRoom = rooms.find(
        (r) => r.type === 'direct' && r.participants.some((p) => p.id === userId)
      );
      
      if (existingRoom) {
        setCurrentRoomId(existingRoom.id);
      } else {
        createRoomMutation.mutate({
          name: 'Direktnachricht',
          type: 'direct',
          participantIds: [userId],
        });
      }
    },
    [rooms, createRoomMutation]
  );

  const currentTypingUsers = currentRoomId
    ? typingUsers.get(currentRoomId) || []
    : [];

  return (
    <div className="h-full flex flex-col">
      <ChatLayout
        sidebar={
          <ChatSidebar
            rooms={rooms}
            currentRoom={currentRoom}
            onSelectRoom={handleSelectRoom}
            onCreateDirectChat={handleCreateDirectChat}
            loading={roomsLoading}
          />
        }
      >
        <ChatRoom
          room={currentRoom}
          messages={messages}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onTyping={handleTyping}
          loading={messagesLoading}
          typingUsers={currentTypingUsers}
        />
      </ChatLayout>
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { 
  ChatLayout, 
  ChatRoom, 
  ChatSidebar,
  MobileChatLayout,
  OfflineIndicator,
  MentionNotifications
} from '@/components/chat';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { ChatRoom as ChatRoomType, ChatMessage, ChatUser } from '@/types/chat';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { VideoCallModal } from '@/components/video-call';
import { VideoCallParticipant } from '@/types/videoCall';
import { SignatureModal } from '@/components/chat/SignatureModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// API Response Types
interface ApiRoom {
  id: string;
  name: string | null;
  type: 'DIRECT' | 'GROUP' | 'DEPARTMENT';
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: ApiMember[];
  messages: ApiMessage[];
  unreadCount: number;
  lastMessage?: ApiMessage;
}

interface ApiMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isMuted: boolean;
  lastReadAt: string | null;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    } | null;
  };
}

interface ApiMessage {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  sentAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  replyToId: string | null;
  sender: {
    id: string;
    username: string;
    employee?: {
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    } | null;
  };
  reactions?: Array<{
    id: string;
    emoji: string;
    userId: string;
    user: {
      id: string;
      username: string;
    };
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  replyTo?: {
    id: string;
    content: string;
    sender: {
      id: string;
      username: string;
    };
  } | null;
}

// API Functions
const fetchRooms = async (): Promise<ApiRoom[]> => {
  const { data } = await axios.get('/api/chat/rooms');
  return data.rooms || [];
};

const fetchMessages = async (roomId: string): Promise<ApiMessage[]> => {
  const { data } = await axios.get(`/api/chat/rooms/${roomId}/messages`);
  // Return in chronological order (API returns newest first)
  return (data.messages || []).reverse();
};

const createRoom = async (roomData: { 
  name?: string; 
  type: 'DIRECT' | 'GROUP'; 
  memberIds: string[] 
}): Promise<ApiRoom> => {
  const { data } = await axios.post('/api/chat/rooms', roomData);
  return data.room;
};

const sendMessageApi = async ({ 
  roomId, 
  content, 
  replyToId,
  attachments
}: { 
  roomId: string; 
  content: string; 
  replyToId?: string;
  attachments?: Array<{
    name: string;
    size: number;
    type: 'image' | 'file';
    mimeType: string;
    url: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
  }>;
}): Promise<ApiMessage> => {
  const { data } = await axios.post(`/api/chat/rooms/${roomId}/messages`, { 
    content, 
    replyToId,
    attachments
  });
  return data.message;
};

const editMessageApi = async ({ 
  messageId, 
  content 
}: { 
  messageId: string; 
  content: string 
}): Promise<ApiMessage> => {
  const { data } = await axios.patch(`/api/chat/messages/${messageId}`, { content });
  return data.message;
};

const deleteMessageApi = async (messageId: string): Promise<void> => {
  await axios.delete(`/api/chat/messages/${messageId}`);
};

// Transform Functions
const transformApiUser = (apiUser: ApiMember['user']): ChatUser => ({
  id: apiUser.id,
  name: apiUser.employee 
    ? `${apiUser.employee.firstName} ${apiUser.employee.lastName}`
    : apiUser.username,
  avatar: apiUser.employee?.avatarUrl || undefined,
  status: 'offline',
  lastSeen: undefined,
});

const transformApiMessage = (apiMsg: ApiMessage): ChatMessage => ({
  id: apiMsg.id,
  content: apiMsg.content,
  senderId: apiMsg.senderId,
  sender: {
    id: apiMsg.sender.id,
    name: apiMsg.sender.employee
      ? `${apiMsg.sender.employee.firstName} ${apiMsg.sender.employee.lastName}`
      : apiMsg.sender.username,
    avatar: apiMsg.sender.employee?.avatarUrl || undefined,
    status: 'offline',
  },
  roomId: apiMsg.roomId,
  createdAt: new Date(apiMsg.sentAt),
  updatedAt: apiMsg.editedAt ? new Date(apiMsg.editedAt) : undefined,
  isEdited: !!apiMsg.editedAt,
  attachments: apiMsg.attachments?.map(att => ({
    id: att.id,
    name: att.name,
    url: att.url,
    filePath: att.url,
    mimeType: att.type,
    type: att.type.startsWith('image/') ? 'image' : att.type.includes('pdf') ? 'document' : 'file',
    size: att.size,
    width: (att as any).width,
    height: (att as any).height,
    thumbnailPath: (att as any).thumbnailPath,
    thumbnailUrl: (att as any).thumbnailPath,
  })),
});

const transformApiRoom = (apiRoom: ApiRoom): ChatRoomType => ({
  id: apiRoom.id,
  name: apiRoom.name || apiRoom.members
    .filter(m => m.userId !== apiRoom.createdBy)
    .map(m => m.user.employee 
      ? `${m.user.employee.firstName} ${m.user.employee.lastName}`
      : m.user.username
    )
    .join(', ') || 'Unbekannt',
  description: apiRoom.description || undefined,
  type: apiRoom.type === 'DIRECT' ? 'direct' : apiRoom.type === 'GROUP' ? 'group' : 'channel',
  participants: apiRoom.members.map(m => transformApiUser(m.user)),
  lastMessage: apiRoom.lastMessage ? transformApiMessage(apiRoom.lastMessage) : undefined,
  unreadCount: apiRoom.unreadCount || 0,
  createdAt: new Date(apiRoom.createdAt),
  updatedAt: new Date(apiRoom.updatedAt),
  isPrivate: apiRoom.type === 'DIRECT',
});

export function ChatView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [activeSignatureRequestId, setActiveSignatureRequestId] = useState<string | null>(null);

  // Offline Sync Hook
  const {
    isOnline,
    queue,
    pendingCount,
    isSyncing,
    queueMessage,
    markAsSent,
    retryMessage,
    syncMessages,
    removeFromQueue,
  } = useOfflineSync();

  // Socket.IO
  const { 
    isConnected, 
    isAuthenticated,
    joinRoom, 
    leaveRoom, 
    sendTyping, 
    onMessage, 
    onTyping 
  } = useSocket();

  // WebRTC Video Call
  const {
    callState,
    localStream,
    isScreenSharing,
    isMuted,
    isVideoEnabled,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTC();

  // Queries
  const { 
    data: apiRooms = [], 
    isLoading: roomsLoading 
  } = useQuery({
    queryKey: ['chat', 'rooms'],
    queryFn: fetchRooms,
    enabled: !!session?.user?.id,
  });

  const rooms = useMemo(() => apiRooms.map(transformApiRoom), [apiRooms]);
  const currentRoom = rooms.find(r => r.id === currentRoomId) || null;

  const { 
    data: apiMessages = [], 
    isLoading: messagesLoading 
  } = useQuery({
    queryKey: ['chat', 'messages', currentRoomId],
    queryFn: () => fetchMessages(currentRoomId!),
    enabled: !!currentRoomId && !!session?.user?.id,
  });

  const messages = useMemo(() => apiMessages.map(transformApiMessage), [apiMessages]);

  // Mutations
  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (newRoom) => {
      queryClient.setQueryData(['chat', 'rooms'], (old: ApiRoom[] = []) => [newRoom, ...old]);
      console.log('Chat erstellt');
    },
    onError: () => {
      console.error('Fehler beim Erstellen des Chats');
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendMessageApi,
    onSuccess: (newMessage) => {
      queryClient.setQueryData(
        ['chat', 'messages', currentRoomId],
        (old: ApiMessage[] = []) => [...old, newMessage]
      );
    },
    onError: () => {
      console.error('Fehler beim Senden der Nachricht');
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: editMessageApi,
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData(
        ['chat', 'messages', currentRoomId],
        (old: ApiMessage[] = []) =>
          old.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
      );
    },
    onError: () => {
      console.error('Fehler beim Bearbeiten der Nachricht');
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: deleteMessageApi,
    onSuccess: (_, messageId) => {
      queryClient.setQueryData(
        ['chat', 'messages', currentRoomId],
        (old: ApiMessage[] = []) => old.filter((msg) => msg.id !== messageId)
      );
    },
    onError: () => {
      console.error('Fehler beim Löschen der Nachricht');
    },
  });

  // Socket-Effects
  useEffect(() => {
    if (!currentRoomId || !isConnected || !isAuthenticated) return;

    joinRoom(currentRoomId);

    const unsubscribeMessage = onMessage((data: { roomId: string; message: ApiMessage }) => {
      if (data.roomId === currentRoomId) {
        queryClient.setQueryData(
          ['chat', 'messages', currentRoomId],
          (old: ApiMessage[] = []) => {
            if (old.some((m) => m.id === data.message.id)) return old;
            return [...old, data.message];
          }
        );
      }
    });

    const unsubscribeTyping = onTyping((data: { roomId: string; userId: string; isTyping: boolean }) => {
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
  }, [currentRoomId, isConnected, isAuthenticated, joinRoom, leaveRoom, onMessage, onTyping, queryClient]);

  // Handler
  const handleSelectRoom = useCallback((room: ChatRoomType) => {
    setCurrentRoomId(room.id);
  }, []);

  // Video Call Handlers
  const handleStartVideoCall = useCallback(async () => {
    if (!currentRoom) return;
    
    const participants: VideoCallParticipant[] = currentRoom.participants
      .filter(p => p.id !== session?.user?.id)
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      }));
      
    if (participants.length === 0) {
      console.error('No participants available for call');
      return;
    }
    
    setShowVideoCall(true);
    
    try {
      await initiateCall(currentRoom.id, 'video', participants);
    } catch (error) {
      console.error('Failed to start video call:', error);
    }
  }, [currentRoom, session?.user?.id, initiateCall]);

  const handleStartAudioCall = useCallback(async () => {
    if (!currentRoom) return;
    
    const participants: VideoCallParticipant[] = currentRoom.participants
      .filter(p => p.id !== session?.user?.id)
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      }));
      
    if (participants.length === 0) {
      console.error('No participants available for call');
      return;
    }
    
    setShowVideoCall(true);
    
    try {
      await initiateCall(currentRoom.id, 'audio', participants);
    } catch (error) {
      console.error('Failed to start audio call:', error);
    }
  }, [currentRoom, session?.user?.id, initiateCall]);

  const handleAcceptCall = useCallback(() => {
    setShowVideoCall(true);
    acceptCall({});
  }, [acceptCall]);

  const handleDeclineCall = useCallback(() => {
    declineCall(callState?.callId || '');
    setShowVideoCall(false);
  }, [declineCall, callState?.callId]);

  const handleEndCall = useCallback(() => {
    endCall();
    setShowVideoCall(false);
  }, [endCall]);

  // Command Handler
  const handleCommand = useCallback((command: string, args: string[]) => {
    switch (command) {
      case 'call':
      case 'video':
        handleStartVideoCall();
        break;
      case 'audio':
        handleStartAudioCall();
        break;
      default:
        console.log('Unknown command:', command);
    }
  }, [handleStartVideoCall, handleStartAudioCall]);

  // Signature Modal Handler
  const handleOpenSignature = useCallback((requestId: string) => {
    setActiveSignatureRequestId(requestId);
    setShowSignatureModal(true);
  }, []);

  const handleCloseSignature = useCallback(() => {
    setShowSignatureModal(false);
    setActiveSignatureRequestId(null);
  }, []);

  const handleSignatureCompleted = useCallback(() => {
    // Refresh queries after successful signature
    if (currentRoomId) {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', currentRoomId] });
    }
    handleCloseSignature();
  }, [currentRoomId, queryClient, handleCloseSignature]);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: Array<{
      name: string;
      size: number;
      type: 'image' | 'file';
      mimeType: string;
      url: string;
      thumbnailUrl?: string;
      width?: number;
      height?: number;
    }>) => {
      if (!currentRoomId) return;
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

      // Check for /summarize command
      if (content.trim().startsWith('/summarize')) {
        try {
          const response = await fetch('/api/ai/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: currentRoomId }),
          });
          
          const result = await response.json();
          
          if (result.summary) {
            sendMessageMutation.mutate({ 
              roomId: currentRoomId, 
              content: `📋 **Zusammenfassung** (${result.messageCount} Nachrichten):\n\n${result.summary}` 
            });
            return;
          } else if (result.error) {
            sendMessageMutation.mutate({ 
              roomId: currentRoomId, 
              content: `⚠️ Fehler: ${result.error}` 
            });
            return;
          }
        } catch (error) {
          console.error('Error processing summarize command:', error);
          sendMessageMutation.mutate({ 
            roomId: currentRoomId, 
            content: '⚠️ Zusammenfassung konnte nicht erstellt werden.' 
          });
          return;
        }
      }

      // Check for /task command
      if (content.trim().startsWith('/task')) {
        try {
          const response = await fetch('/api/chat/commands/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: content, roomId: currentRoomId }),
          });
          
          const result = await response.json();
          
          if (result.success) {
            sendMessageMutation.mutate({ 
              roomId: currentRoomId, 
              content: result.message 
            });
            return;
          } else if (result.error) {
            sendMessageMutation.mutate({ 
              roomId: currentRoomId, 
              content: `⚠️ ${result.error}${result.help ? `\n${result.help}` : ''}` 
            });
            return;
          }
        } catch (error) {
          console.error('Error processing task command:', error);
        }
      }

      // Check if online - if offline, queue message (without attachments)
      if (!isOnline) {
        if (attachments && attachments.length > 0) {
          // Can't queue messages with attachments offline
          console.error('Cannot queue messages with attachments');
          return;
        }
        await queueMessage(currentRoomId, content.trim());
        const optimisticMessage = {
          id: `optimistic-${Date.now()}`,
          content: content.trim(),
          senderId: session?.user?.id || 'unknown',
          sender: {
            id: session?.user?.id || 'unknown',
            name: session?.user?.name || 'Du',
            avatar: session?.user?.image || undefined,
            status: 'online' as const,
          },
          roomId: currentRoomId,
          createdAt: new Date(),
          isOptimistic: true,
          attachments: [],
        };
        queryClient.setQueryData(
          ['chat', 'messages', currentRoomId],
          (old: any[] = []) => [...old, optimisticMessage]
        );
        return;
      }

      sendMessageMutation.mutate({ 
        roomId: currentRoomId, 
        content: content.trim(),
        attachments 
      });
    },
    [currentRoomId, sendMessageMutation, isOnline, queueMessage, session?.user?.id, session?.user?.name, session?.user?.image, queryClient]
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
      const existingRoom = apiRooms.find(
        (r) => r.type === 'DIRECT' && r.members.some((m) => m.userId === userId)
      );
      
      if (existingRoom) {
        setCurrentRoomId(existingRoom.id);
      } else {
        createRoomMutation.mutate({
          type: 'DIRECT',
          memberIds: [userId],
        });
      }
    },
    [apiRooms, createRoomMutation]
  );

  const currentTypingUsers = currentRoomId
    ? (typingUsers.get(currentRoomId) || [])
        .filter(id => id !== session?.user?.id)
        .map(id => {
          const member = apiRooms
            .find(r => r.id === currentRoomId)?.members
            .find(m => m.userId === id);
          return member?.user.employee 
            ? `${member.user.employee.firstName} ${member.user.employee.lastName}`
            : member?.user.username || 'Unbekannt';
        })
    : [];

  return (
    <div className="h-full flex flex-col">
      {/* Offline Status Indicator */}
      <OfflineIndicator
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSync={syncMessages}
        queue={queue}
        onRetryMessage={retryMessage}
        onRemoveMessage={removeFromQueue}
      />

      {/* Mobile-Optimized Chat Layout */}
      <MobileChatLayout
        sidebar={
          <ChatSidebar
            rooms={rooms}
            currentRoom={currentRoom}
            onSelectRoom={handleSelectRoom}
            onCreateDirectChat={handleCreateDirectChat}
            loading={roomsLoading}
          />
        }
        rooms={rooms}
        currentRoom={currentRoom}
        onSelectRoom={handleSelectRoom}
        onCreateDirectChat={handleCreateDirectChat}
        loading={roomsLoading}
      >
        <ChatRoom
          room={currentRoom}
          messages={messages}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onTyping={handleTyping}
          onStartVideoCall={handleStartVideoCall}
          onStartAudioCall={handleStartAudioCall}
          onCommand={handleCommand}
          onSignatureClick={handleOpenSignature}
          loading={messagesLoading}
          typingUsers={currentTypingUsers}
          isOffline={!isOnline}
        />
      </MobileChatLayout>

      {/* Video Call Modal */}
      <VideoCallModal
        callState={callState}
        localStream={localStream}
        isScreenSharing={isScreenSharing}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onEnd={handleEndCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
      />

      {/* Signature Modal */}
      <SignatureModal
        requestId={activeSignatureRequestId || ''}
        isOpen={showSignatureModal}
        onClose={handleCloseSignature}
        onSigned={handleSignatureCompleted}
      />
    </div>
  );
}

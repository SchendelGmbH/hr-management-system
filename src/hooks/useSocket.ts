'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export function useSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Initialize socket with correct path
    const socket = io(SOCKET_URL, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
      
      // Authenticate
      socket.emit('authenticate', { userId: session.user.id });
    });

    socket.on('authenticated', () => {
      console.log('[Socket] Authenticated');
      setIsAuthenticated(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [session?.user?.id]);

  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-room', roomId);
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', roomId);
    }
  }, []);

  const sendMessage = useCallback((roomId: string, message: any) => {
    if (socketRef.current) {
      socketRef.current.emit('send-message', { roomId, message });
    }
  }, []);

  const onMessage = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) {
      console.log('[useSocket] Cannot register new-message listener - socket not available');
      return () => {};
    }
    
    console.log('[useSocket] Registering new-message listener');
    const wrappedCallback = (data: any) => {
      console.log('[useSocket] Received new-message event:', data);
      callback(data);
    };
    socketRef.current.on('new-message', wrappedCallback);
    
    return () => {
      console.log('[useSocket] Unregistering new-message listener');
      socketRef.current?.off('new-message', wrappedCallback);
    };
  }, []);

  const onTyping = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('typing', callback);
    return () => {
      socketRef.current?.off('typing', callback);
    };
  }, []);

  const emitTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current && session?.user?.id) {
      socketRef.current.emit('typing', { roomId, userId: session.user.id, isTyping });
    }
  }, [session?.user?.id]);

  const onNotificationCount = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('notification-count', callback);
    return () => {
      socketRef.current?.off('notification-count', callback);
    };
  }, []);

  const onChatUnreadCount = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('chat-unread-count', callback);
    return () => {
      socketRef.current?.off('chat-unread-count', callback);
    };
  }, []);

  return {
    isConnected,
    isAuthenticated,
    joinRoom,
    leaveRoom,
    sendMessage,
    onMessage,
    onTyping,
    emitTyping,
    onNotificationCount,
    onChatUnreadCount,
  };
}

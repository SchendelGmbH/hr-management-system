/**
 * useSocket - React Hook für Socket.IO Realtime-Verbindung
 * 
 * Verwendung:
 * const { socket, isConnected, joinRoom, sendTyping } = useSocket();
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendTyping: (roomId: string, isTyping: boolean) => void;
  onMessage: (callback: (message: any) => void) => () => void;
  onTyping: (callback: (data: { roomId: string; userId: string; isTyping: boolean }) => void) => () => void;
}

export function useSocket(): UseSocketReturn {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    // Initialize socket connection
    const socket = io({
      path: '/api/socket',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
      
      // Authenticate
      socket.emit('authenticate', session.user.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('authenticated', (data: { success: boolean; error?: string }) => {
      if (data.success) {
        console.log('[Socket] Authenticated');
        setIsAuthenticated(true);
      } else {
        console.error('[Socket] Authentication failed:', data.error);
      }
    });

    socket.on('error', (error: any) => {
      console.error('[Socket] Error:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.user?.id]);

  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current && isAuthenticated) {
      socketRef.current.emit('join-room', roomId);
    }
  }, [isAuthenticated]);

  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', roomId);
    }
  }, []);

  const sendTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current && isAuthenticated) {
      socketRef.current.emit('typing', { roomId, isTyping });
    }
  }, [isAuthenticated]);

  const onMessage = useCallback((callback: (message: any) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on('new-message', callback);
    return () => {
      socket.off('new-message', callback);
    };
  }, []);

  const onTyping = useCallback((callback: (data: { roomId: string; userId: string; isTyping: boolean }) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on('user-typing', callback);
    return () => {
      socket.off('user-typing', callback);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isAuthenticated,
    joinRoom,
    leaveRoom,
    sendTyping,
    onMessage,
    onTyping,
  };
}
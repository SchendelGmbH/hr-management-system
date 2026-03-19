'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  onMessage: (callback: (data: any) => void) => () => void;
  onTyping: (callback: (data: any) => void) => () => void;
  emitTyping: (roomId: string, isTyping: boolean) => void;
  onNotificationCount: (callback: (data: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const messageListenersRef = useRef<Set<(data: any) => void>>(new Set());
  const typingListenersRef = useRef<Set<(data: any) => void>>(new Set());
  const notificationListenersRef = useRef<Set<(data: any) => void>>(new Set());

  // Initialize socket
  useEffect(() => {
    if (!session?.user?.id) return;

    console.log('[SocketProvider] Initializing socket...');
    
    const socket = io(SOCKET_URL, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SocketProvider] Connected');
      setIsConnected(true);
      socket.emit('authenticate', { userId: session.user.id });
    });

    socket.on('authenticated', () => {
      console.log('[SocketProvider] Authenticated');
      setIsAuthenticated(true);
      
      // Re-join all previously joined rooms
      const roomsToJoin = Array.from(joinedRoomsRef.current);
      console.log(`[SocketProvider] Re-joining ${roomsToJoin.length} rooms:`, roomsToJoin);
      roomsToJoin.forEach(roomId => {
        socket.emit('join-room', roomId);
        console.log(`[SocketProvider] Re-joined room: ${roomId}`);
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[SocketProvider] Disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[SocketProvider] Connection error:', error.message);
      setIsConnected(false);
    });

    // Handle incoming events and forward to listeners
    socket.on('new-message', (data) => {
      console.log('[SocketProvider] Received new-message:', data);
      messageListenersRef.current.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('[SocketProvider] Error in message listener:', err);
        }
      });
    });

    socket.on('typing', (data) => {
      typingListenersRef.current.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('[SocketProvider] Error in typing listener:', err);
        }
      });
    });

    socket.on('notification-count', (data) => {
      notificationListenersRef.current.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('[SocketProvider] Error in notification listener:', err);
        }
      });
    });

    return () => {
      console.log('[SocketProvider] Cleaning up socket...');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.user?.id]);

  const joinRoom = useCallback((roomId: string) => {
    console.log(`[SocketProvider] joinRoom called: ${roomId}`);
    joinedRoomsRef.current.add(roomId);
    
    if (socketRef.current && isAuthenticated) {
      socketRef.current.emit('join-room', roomId);
      console.log(`[SocketProvider] Joined room: ${roomId}`);
    } else {
      console.log(`[SocketProvider] Queueing room join: ${roomId} (socket not ready)`);
    }
  }, [isAuthenticated]);

  const leaveRoom = useCallback((roomId: string) => {
    console.log(`[SocketProvider] leaveRoom called: ${roomId}`);
    joinedRoomsRef.current.delete(roomId);
    
    if (socketRef.current && isAuthenticated) {
      socketRef.current.emit('leave-room', roomId);
    }
  }, [isAuthenticated]);

  const onMessage = useCallback((callback: (data: any) => void) => {
    console.log('[SocketProvider] Adding message listener');
    messageListenersRef.current.add(callback);
    
    return () => {
      console.log('[SocketProvider] Removing message listener');
      messageListenersRef.current.delete(callback);
    };
  }, []);

  const onTyping = useCallback((callback: (data: any) => void) => {
    typingListenersRef.current.add(callback);
    
    return () => {
      typingListenersRef.current.delete(callback);
    };
  }, []);

  const emitTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current && session?.user?.id) {
      socketRef.current.emit('typing', { roomId, userId: session.user.id, isTyping });
    }
  }, [session?.user?.id]);

  const onNotificationCount = useCallback((callback: (data: any) => void) => {
    notificationListenersRef.current.add(callback);
    
    return () => {
      notificationListenersRef.current.delete(callback);
    };
  }, []);

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    isAuthenticated,
    joinRoom,
    leaveRoom,
    onMessage,
    onTyping,
    emitTyping,
    onNotificationCount,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

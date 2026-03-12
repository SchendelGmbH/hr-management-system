/**
 * useSocketSwap - Socket.IO Hook für Realtime Shift-Swap Updates
 * Verbindet sich automatisch und subscribed zu Swap-Events
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface SwapEventData {
  swapId: string;
  status: string;
  requesterId: string;
  requestedId?: string | null;
  responderId?: string;
  message?: string;
}

export function useSocketSwap(
  employeeId: string | null | undefined,
  callbacks?: {
    onSwapCreated?: (data: SwapEventData) => void;
    onSwapUpdated?: (data: SwapEventData) => void;
    onSwapCompleted?: (data: SwapEventData) => void;
    onScheduleChanged?: (data: any) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
  }
) {
  const socketRef = useRef<Socket | null>(null);
  const { data: session, status } = useSession();

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (employeeId) {
        socketRef.current.emit('unsubscribe-swaps', employeeId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [employeeId]);

  useEffect(() => {
    // Warte auf Auth
    if (status === 'loading' || !session?.user?.id) {
      return;
    }

    // Nur verbinden wenn employeeId vorhanden
    if (!employeeId) {
      return;
    }

    // Socket initialisieren
    const socket = io(process.env.NEXTAUTH_URL || '', {
      path: '/api/socket',
      auth: {
        token: session.user.id,
      },
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      
      // Authenticate
      socket.emit('authenticate', session.user.id);
      
      // Subscribe to swap updates
      socket.emit('subscribe-swaps', employeeId);
      
      callbacks?.onConnect?.();
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      callbacks?.onDisconnect?.();
    });

    socket.on('authenticated', (response) => {
      if (response.success) {
        console.log('[Socket] Authenticated successfully');
      } else {
        console.error('[Socket] Authentication failed:', response.error);
      }
    });

    // Swap event handlers
    socket.on('swap-created', (data) => {
      console.log('[Socket] Swap created:', data);
      callbacks?.onSwapCreated?.(data);
    });

    socket.on('swap-request', (data) => {
      console.log('[Socket] Swap request received:', data);
      callbacks?.onSwapCreated?.(data);
    });

    socket.on('swap-updated', (data) => {
      console.log('[Socket] Swap updated:', data);
      callbacks?.onSwapUpdated?.(data);
    });

    socket.on('swap-completed', (data) => {
      console.log('[Socket] Swap completed:', data);
      callbacks?.onSwapCompleted?.(data);
    });

    socket.on('schedule-changed', (data) => {
      console.log('[Socket] Schedule changed:', data);
      callbacks?.onScheduleChanged?.(data);
    });

    // Cleanup
    return () => {
      disconnect();
    };
  }, [employeeId, session?.user?.id, status, callbacks, disconnect]);

  const emitTyping = useCallback((roomId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { roomId, isTyping });
  }, []);

  return {
    socket: socketRef.current,
    disconnect,
    emitTyping,
    isConnected: !!socketRef.current?.connected,
  };
}

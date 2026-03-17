import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

// Globaler Socket.IO Server
declare global {
  var io: SocketIOServer | undefined;
  var broadcastChatUnreadCount: ((userId: string) => Promise<void>) | undefined;
}

export function getSocketIO(): SocketIOServer | null {
  return global.io || null;
}

export function emitToRoom(roomId: string, event: string, data: unknown) {
  const io = getSocketIO();
  if (io) {
    io.to(`room:${roomId}`).emit(event, data);
  }
}

/**
 * Broadcast updated chat unread count to a specific user via Socket.IO
 */
async function broadcastChatUnreadCount(userId: string): Promise<void> {
  const io = getSocketIO();
  if (!io) return;

  try {
    // Get all rooms the user is a member of
    const memberships = await prisma.chatMember.findMany({
      where: { userId },
      select: { roomId: true, lastReadAt: true },
    });

    let totalUnread = 0;

    // Calculate unread count for each room
    for (const membership of memberships) {
      const unreadCount = await prisma.chatMessage.count({
        where: {
          roomId: membership.roomId,
          sentAt: membership.lastReadAt ? { gt: membership.lastReadAt } : undefined,
          senderId: { not: userId },
        },
      });
      totalUnread += unreadCount;
    }

    // Emit to user's personal room
    io.to(`user:${userId}`).emit('chat:unread-count', { count: totalUnread });
    console.log(`[Socket.IO] Broadcast chat unread count to user ${userId}: ${totalUnread}`);
  } catch (error) {
    console.error('[Socket.IO] Error broadcasting chat unread count:', error);
  }
}

// Socket.IO initialisieren - wird beim ersten API-Call gestartet
let ioInitialized = false;

async function initSocketIO() {
  if (ioInitialized || global.io) return;
  
  // @ts-ignore - Next.js internals
  const { createServer } = await import('http');
  
  // Wir erstellen einen Socket.IO Server, der auf dem Next.js Server läuft
  // Dafür brauchen wir Zugriff auf den HTTP Server
  const io = new SocketIOServer({
    path: '/api/socket',
    cors: {
      origin: '*', // In Produktion anpassen!
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  global.io = io;
  global.broadcastChatUnreadCount = broadcastChatUnreadCount;
  ioInitialized = true;

  // Listen for chat message events to broadcast unread counts
  eventBus.on('CHAT_MESSAGE_CREATED', async (data: { roomId: string; message: any; senderId: string; memberIds: string[] }) => {
    console.log('[Socket.IO] CHAT_MESSAGE_CREATED event received:', data.roomId);
    
    // Broadcast updated unread count to all room members except sender
    for (const memberId of data.memberIds) {
      if (memberId !== data.senderId) {
        await broadcastChatUnreadCount(memberId);
      }
    }
  });

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    socket.on('authenticate', async (userId: string) => {
      socket.data.userId = userId;
      socket.join(`user:${userId}`);
      console.log(`[Socket.IO] User ${userId} authenticated`);
      socket.emit('authenticated', { success: true });
    });

    socket.on('join-room', async (roomId: string) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      try {
        const membership = await prisma.chatMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }

        socket.join(`room:${roomId}`);
        
        await prisma.chatMember.update({
          where: { roomId_userId: { roomId, userId } },
          data: { lastReadAt: new Date() },
        });

        socket.emit('joined-room', { roomId });
      } catch (error) {
        console.error('[Socket.IO] Join room error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      socket.emit('left-room', { roomId });
    });

    socket.on('typing', ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      socket.to(`room:${roomId}`).emit('user-typing', {
        roomId,
        userId,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });
  });

  console.log('[Socket.IO] Server initialized');
}

// GET /api/socket - Initialisiert Socket.IO
export async function GET() {
  await initSocketIO();
  
  return NextResponse.json({ 
    status: 'Socket.IO initialized',
    path: '/api/socket'
  });
}

// POST /api/socket - Für Socket.IO Polling
export async function POST() {
  await initSocketIO();
  
  return NextResponse.json({ 
    status: 'Socket.IO initialized',
    path: '/api/socket'
  });
}

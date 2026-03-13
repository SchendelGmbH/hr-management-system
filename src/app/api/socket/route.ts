import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';
import { onEvent } from '@/lib/eventBus';
import { emitUnreadCount } from '@/lib/notifications';

// Globaler Socket.IO Server (wird nur einmal initialisiert)
declare global {
  var io: SocketIOServer | undefined;
  var socketServerInitialized: boolean | undefined;
}

// Exportiere io für externe Verwendung
export function getSocketIO(): SocketIOServer | null {
  return global.io || null;
}

export function emitToRoom(roomId: string, event: string, data: unknown) {
  const io = getSocketIO();
  if (io) {
    io.to(`room:${roomId}`).emit(event, data);
  }
}

// Video Call Signaling Handlers
const activeCalls = new Map<string, Set<string>>();

function setupVideoCallHandlers(io: SocketIOServer) {
  io.on('connection', (socket) => {
    socket.on('call-started', (data: {
      callId: string;
      roomId: string;
      initiatorId: string;
      participants: { id: string; name: string; avatar?: string }[];
      callType: 'video' | 'audio';
      timestamp: Date;
    }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      if (!activeCalls.has(data.roomId)) {
        activeCalls.set(data.roomId, new Set());
      }
      activeCalls.get(data.roomId)?.add(userId);

      data.participants.forEach((participant) => {
        socket.to(`user:${participant.id}`).emit('call-started', {
          ...data,
          participants: data.participants.filter(p => p.id !== participant.id).concat([{
            id: userId,
            name: 'Calling...',
          }]),
        });
      });
    });

    socket.on('call-accepted', (data: { callId: string; userId: string; timestamp: Date }) => {
      const roomId = data.callId.split('-').slice(0, 2).join('-');
      activeCalls.get(roomId)?.add(data.userId);
      socket.to(`room:${roomId}`).emit('call-accepted', data);
    });

    socket.on('signaling', (message: {
      type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended' | 'call-declined' | 'screen-share' | 'mute-state' | 'participant-joined' | 'participant-left';
      callId: string;
      roomId: string;
      senderId: string;
      targetId?: string;
      payload?: any;
      timestamp: Date;
    }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const msg = { ...message, senderId: userId };

      switch (message.type) {
        case 'call-ended':
          activeCalls.get(message.roomId)?.delete(userId);
          if (activeCalls.get(message.roomId)?.size === 0) {
            activeCalls.delete(message.roomId);
          }
          socket.to(`room:${message.roomId}`).emit('signaling', msg);
          break;
        
        case 'call-declined':
          socket.to(`room:${message.roomId}`).emit('signaling', msg);
          break;
        
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          if (message.targetId) {
            socket.to(`user:${message.targetId}`).emit('signaling', msg);
          }
          break;
        
        case 'screen-share':
        case 'mute-state':
        case 'participant-joined':
        case 'participant-left':
          socket.to(`room:${message.roomId}`).emit('signaling', msg);
          break;
      }
    });

    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (userId) {
        activeCalls.forEach((participants, roomId) => {
          if (participants.has(userId)) {
            participants.delete(userId);
            io.to(`room:${roomId}`).emit('signaling', {
              type: 'participant-left',
              roomId,
              senderId: userId,
              timestamp: new Date(),
            });
            if (participants.size === 0) {
              activeCalls.delete(roomId);
            }
          }
        });
      }
    });
  });
}

// Initialisiere Socket.IO Server
function initializeSocketServer() {
  if (global.socketServerInitialized || global.io) {
    return global.io;
  }

  console.log('[Socket.IO] Initializing server...');

  // Socket.IO Server auf separatem Port
  const { createServer } = require('http');
  const httpServer = createServer();
  const port = process.env.SOCKET_PORT ? parseInt(process.env.SOCKET_PORT) : 3002;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  global.io = io;
  global.socketServerInitialized = true;

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    socket.on('authenticate', async (token: string) => {
      try {
        const userId = token;
        socket.data.userId = userId;
        socket.join(`user:${userId}`);
        
        console.log(`[Socket.IO] User ${userId} authenticated`);
        socket.emit('authenticated', { success: true });
      } catch (error) {
        console.error('[Socket.IO] Authentication failed:', error);
        socket.emit('authenticated', { success: false, error: 'Auth failed' });
      }
    });

    socket.on('join-room', async (roomId: string) => {
      try {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const membership = await prisma.chatMember.findUnique({
          where: {
            roomId_userId: { roomId, userId },
          },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }

        socket.join(`room:${roomId}`);
        
        await prisma.chatMember.update({
          where: {
            roomId_userId: { roomId, userId },
          },
          data: { lastReadAt: new Date() },
        });

        socket.emit('joined-room', { roomId });
      } catch (error) {
        console.error('[Socket.IO] Join room failed:', error);
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

    socket.on('subscribe-swaps', (employeeId: string) => {
      socket.join(`swaps:${employeeId}`);
    });

    socket.on('unsubscribe-swaps', (employeeId: string) => {
      socket.leave(`swaps:${employeeId}`);
    });

    socket.on('subscribe-chat', (roomId: string) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }
      socket.join(`room:${roomId}`);
    });

    socket.on('unsubscribe-chat', (roomId: string) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on('subscribe-notifications', async () => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      socket.join(`user:${userId}`);

      const notificationCount = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
          isArchived: false,
        },
      });
      
      const chatUnreadCount = await getChatUnreadCount(userId);
      
      socket.emit('notification:unread-count', { count: notificationCount });
      socket.emit('chat:unread-count', { count: chatUnreadCount });
    });

    socket.on('notification:mark-read', async (notificationId: string) => {
      const userId = socket.data.userId;
      if (!userId) return;

      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true, readAt: new Date() },
      });

      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
          isArchived: false,
        },
      });
      socket.emit('notification:unread-count', { count });
    });

    socket.on('notification:mark-all-read', async () => {
      const userId = socket.data.userId;
      if (!userId) return;

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });

      socket.emit('notification:unread-count', { count: 0 });
      socket.emit('notification:all-read', { success: true });
    });

    socket.on('notification:get-unread-count', async () => {
      const userId = socket.data.userId;
      if (!userId) return;

      const notificationCount = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
          isArchived: false,
        },
      });
      
      const chatUnreadCount = await getChatUnreadCount(userId);
      
      socket.emit('notification:unread-count', { count: notificationCount });
      socket.emit('chat:unread-count', { count: chatUnreadCount });
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });
  });

  async function getChatUnreadCount(userId: string): Promise<number> {
    try {
      const memberships = await prisma.chatMember.findMany({
        where: { userId },
        include: {
          room: {
            include: {
              messages: {
                where: {
                  senderId: { not: userId },
                },
                orderBy: { sentAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      let totalUnread = 0;
      for (const membership of memberships) {
        const lastMessage = membership.room.messages[0];
        if (lastMessage && (!membership.lastReadAt || lastMessage.sentAt > membership.lastReadAt)) {
          const unreadCount = await prisma.chatMessage.count({
            where: {
              roomId: membership.roomId,
              senderId: { not: userId },
              sentAt: { gt: membership.lastReadAt || new Date(0) },
            },
          });
          totalUnread += unreadCount;
        }
      }
      return totalUnread;
    } catch (error) {
      console.error('[Socket.IO] Error getting chat unread count:', error);
      return 0;
    }
  }

  // Event listeners
  onEvent('SHIFT_SWAP_CREATED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`swaps:${data.requesterId}`).emit('swap-created', data);
      if (data.requestedId) {
        io.to(`swaps:${data.requestedId}`).emit('swap-request', data);
      }
    }
  });

  onEvent('SHIFT_SWAP_UPDATED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`swaps:${data.requesterId}`).emit('swap-updated', data);
      if (data.requestedId) {
        io.to(`swaps:${data.requestedId}`).emit('swap-updated', data);
      }
    }
  });

  onEvent('SHIFT_SWAP_COMPLETED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`swaps:${data.requesterId}`).emit('swap-completed', data);
      if (data.responderId) {
        io.to(`swaps:${data.responderId}`).emit('swap-completed', data);
      }
    }
  });

  onEvent('SCHEDULE_CHANGED', (data) => {
    const io = getSocketIO();
    if (io) {
      data.affectedEmployees?.forEach((employeeId: string) => {
        io.to(`swaps:${employeeId}`).emit('schedule-changed', data);
      });
    }
  });

  onEvent('TASK_ASSIGNED', (data) => {
    const io = getSocketIO();
    if (io) {
      if (data.assigneeId) {
        io.to(`user:${data.assigneeId}`).emit('task-assigned', data);
      }
    }
  });

  onEvent('TASK_COMPLETED', (data) => {
    const io = getSocketIO();
    if (io) {
      if (data.createdById) {
        io.to(`user:${data.createdById}`).emit('task-completed', data);
      }
    }
  });

  onEvent('TASK_DUE_SOON', (data) => {
    const io = getSocketIO();
    if (io) {
      if (data.assigneeId) {
        io.to(`user:${data.assigneeId}`).emit('task-due-soon', data);
      }
    }
  });

  onEvent('TASK_OVERDUE', (data) => {
    const io = getSocketIO();
    if (io) {
      if (data.assigneeId) {
        io.to(`user:${data.assigneeId}`).emit('task-overdue', data);
      }
    }
  });

  onEvent('DOCUMENT_EXPIRING', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`user:${data.userId}`).emit('document-expiring', data);
    }
  });

  onEvent('DOCUMENT_EXPIRED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`user:${data.userId}`).emit('document-expired', data);
    }
  });

  onEvent('SIGNATURE_REQUESTED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`user:${data.userId}`).emit('signature-requested', data);
    }
  });

  onEvent('SIGNATURE_SIGNED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`user:${data.userId}`).emit('signature-signed', data);
    }
  });

  onEvent('SIGNATURE_APPROVED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`user:${data.userId}`).emit('signature-approved', data);
    }
  });

  onEvent('SIGNATURE_REJECTED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`user:${data.userId}`).emit('signature-rejected', data);
    }
  });

  onEvent('NOTIFICATION_CREATED', async (data) => {
    const io = getSocketIO();
    if (io && data.userId) {
      io.to(`user:${data.userId}`).emit('notification:new', data.notification);
      await emitUnreadCount(data.userId);
    }
  });

  onEvent('CHAT_MESSAGE_CREATED', (data) => {
    const io = getSocketIO();
    if (io) {
      io.to(`room:${data.roomId}`).emit('new-message', { roomId: data.roomId, message: data.message });
      
      data.memberIds?.forEach((userId: string) => {
        if (userId !== data.senderId) {
          io.to(`user:${userId}`).emit('chat:unread-update', { roomId: data.roomId });
        }
      });
    }
  });

  // Start server
  httpServer.listen(port, () => {
    console.log(`[Socket.IO] Server listening on port ${port}`);
  });

  setupVideoCallHandlers(io);
  
  return io;
}

// GET-Handler für Socket.IO Initialisierung
export async function GET() {
  if (!global.socketServerInitialized) {
    initializeSocketServer();
  }
  
  return NextResponse.json({ 
    status: 'Socket.IO server initialized',
    initialized: global.socketServerInitialized,
    port: process.env.SOCKET_PORT ? parseInt(process.env.SOCKET_PORT) : 3002
  });
}

// POST-Handler für Socket.IO Polling
export async function POST() {
  if (!global.socketServerInitialized) {
    initializeSocketServer();
  }
  
  return NextResponse.json({ 
    status: 'Socket.IO server initialized',
    initialized: global.socketServerInitialized,
    port: process.env.SOCKET_PORT ? parseInt(process.env.SOCKET_PORT) : 3002
  });
}

// Cleanup
process.on('SIGTERM', () => {
  if (global.io) {
    console.log('[Socket.IO] Closing server...');
    global.io.close();
    global.io = undefined;
    global.socketServerInitialized = false;
  }
});

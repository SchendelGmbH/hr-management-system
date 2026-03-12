import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';
import { onEvent, emitEvent as emitToEventBus } from '@/lib/eventBus';

export const config = {
  api: {
    bodyParser: false,
  },
};

let io: SocketIOServer | null = null;

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function emitToRoom(roomId: string, event: string, data: unknown) {
  if (io) {
    io.to(`room:${roomId}`).emit(event, data);
  }
}

export default function handler(req: any, res: any) {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  console.log('[Socket.IO] Initializing server...');
  
  io = new SocketIOServer(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  res.socket.server.io = io;

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    // Authenticate socket
    socket.on('authenticate', async (token: string) => {
      try {
        // Verify token and get user
        // Für dieses MVP: UserId direkt übernehmen
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

    // Join room
    socket.on('join-room', async (roomId: string) => {
      try {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Verify membership
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
        
        // Update lastReadAt
        await prisma.chatMember.update({
          where: {
            roomId_userId: { roomId, userId },
          },
          data: { lastReadAt: new Date() },
        });

        socket.emit('joined-room', { roomId });
        console.log(`[Socket.IO] User ${userId} joined room ${roomId}`);
      } catch (error) {
        console.error('[Socket.IO] Join room failed:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('leave-room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      socket.emit('left-room', { roomId });
    });

    // Typing indicator
    socket.on('typing', ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      socket.to(`room:${roomId}`).emit('user-typing', {
        roomId,
        userId,
        isTyping,
      });
    });

    // Join swap updates
    socket.on('subscribe-swaps', (employeeId: string) => {
      socket.join(`swaps:${employeeId}`);
      console.log(`[Socket.IO] User subscribed to swaps for employee ${employeeId}`);
    });

    // Unsubscribe from swap updates
    socket.on('unsubscribe-swaps', (employeeId: string) => {
      socket.leave(`swaps:${employeeId}`);
      console.log(`[Socket.IO] User unsubscribed from swaps for employee ${employeeId}`);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });
  });

  // Listen for swap events and emit to connected clients
  onEvent('SHIFT_SWAP_CREATED', (data) => {
    if (io) {
      // Notify requester
      io.to(`swaps:${data.requesterId}`).emit('swap-created', data);
      // Notify requested person if specific
      if (data.requestedId) {
        io.to(`swaps:${data.requestedId}`).emit('swap-request', data);
      }
    }
  });

  onEvent('SHIFT_SWAP_UPDATED', (data) => {
    if (io) {
      io.to(`swaps:${data.requesterId}`).emit('swap-updated', data);
      if (data.requestedId) {
        io.to(`swaps:${data.requestedId}`).emit('swap-updated', data);
      }
    }
  });

  onEvent('SHIFT_SWAP_COMPLETED', (data) => {
    if (io) {
      io.to(`swaps:${data.requesterId}`).emit('swap-completed', data);
      if (data.responderId) {
        io.to(`swaps:${data.responderId}`).emit('swap-completed', data);
      }
    }
  });

  onEvent('SCHEDULE_CHANGED', (data) => {
    if (io) {
      // Notify all affected employees
      data.affectedEmployees?.forEach((employeeId: string) => {
        io.to(`swaps:${employeeId}`).emit('schedule-changed', data);
      });
    }
  });

  // Task events
  onEvent('TASK_ASSIGNED', (data) => {
    if (io) {
      if (data.assigneeId) {
        io.to(`user:${data.assigneeId}`).emit('task-assigned', data);
      }
    }
  });

  onEvent('TASK_COMPLETED', (data) => {
    if (io) {
      if (data.createdById) {
        io.to(`user:${data.createdById}`).emit('task-completed', data);
      }
    }
  });

  onEvent('TASK_DUE_SOON', (data) => {
    if (io) {
      if (data.assigneeId) {
        io.to(`user:${data.assigneeId}`).emit('task-due-soon', data);
      }
    }
  });

  onEvent('TASK_OVERDUE', (data) => {
    if (io) {
      if (data.assigneeId) {
        io.to(`user:${data.assigneeId}`).emit('task-overdue', data);
      }
    }
  });

  console.log('[Socket.IO] Server initialized');
  
  // Setup video call handlers
  setupVideoCallHandlers(io);
  
  res.end();
}

// Video Call Signaling Handlers
// Store active calls: Map<roomId, Set<userId>>
const activeCalls = new Map<string, Set<string>>();

export function setupVideoCallHandlers(io: SocketIOServer) {
  io.on('connection', (socket) => {
    // Handle video call signaling
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

      // Track active call
      if (!activeCalls.has(data.roomId)) {
        activeCalls.set(data.roomId, new Set());
      }
      activeCalls.get(data.roomId)?.add(userId);

      // Notify all participants
      data.participants.forEach((participant) => {
        socket.to(`user:${participant.id}`).emit('call-started', {
          ...data,
          participants: data.participants.filter(p => p.id !== participant.id).concat([{
            id: userId,
            name: 'Calling...', // Will be resolved by client
          }]),
        });
      });
      
      console.log(`[Socket.IO] Call started: ${data.callId}, room: ${data.roomId}`);
    });

    socket.on('call-accepted', (data: { callId: string; userId: string; timestamp: Date }) => {
      const roomId = data.callId.split('-').slice(0, 2).join('-');
      activeCalls.get(roomId)?.add(data.userId);
      
      // Notify all participants
      socket.to(`room:${roomId}`).emit('call-accepted', data);
      console.log(`[Socket.IO] Call accepted: ${data.callId} by ${data.userId}`);
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

      // Ensure sender is set
      const msg = { ...message, senderId: userId };

      switch (message.type) {
        case 'call-ended':
          // Cleanup call
          activeCalls.get(message.roomId)?.delete(userId);
          if (activeCalls.get(message.roomId)?.size === 0) {
            activeCalls.delete(message.roomId);
          }
          // Broadcast to room
          socket.to(`room:${message.roomId}`).emit('signaling', msg);
          break;
        
        case 'call-declined':
          // Notify initiator
          socket.to(`room:${message.roomId}`).emit('signaling', msg);
          break;
        
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Targeted signaling
          if (message.targetId) {
            socket.to(`user:${message.targetId}`).emit('signaling', msg);
          }
          break;
        
        case 'screen-share':
        case 'mute-state':
        case 'participant-joined':
        case 'participant-left':
          // Broadcast to room
          socket.to(`room:${message.roomId}`).emit('signaling', msg);
          break;
      }

      console.log(`[Socket.IO] Signaling: ${message.type} from ${userId}`);
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (userId) {
        // Remove user from all active calls
        activeCalls.forEach((participants, roomId) => {
          if (participants.has(userId)) {
            participants.delete(userId);
            // Notify others
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
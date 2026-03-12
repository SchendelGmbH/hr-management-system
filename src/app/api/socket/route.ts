import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';

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

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });
  });

  console.log('[Socket.IO] Server initialized');
  res.end();
}
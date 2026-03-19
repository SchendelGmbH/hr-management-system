/**
 * Socket.IO Server Starter
 * Startet den Socket.IO Server auf Port 3000
 */

const { createServer } = require('http');
const { Server } = require('socket.io');

const port = process.env.SOCKET_PORT ? parseInt(process.env.SOCKET_PORT) : 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'http://srv1471808.tail4c3c89.ts.net:3000',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

console.log('[Socket.IO] Starting server...');

io.on('connection', (socket) => {
  console.log('[Socket.IO] Client connected:', socket.id);

  socket.on('authenticate', (userId) => {
    socket.data.userId = userId;
    socket.join(`user:${userId}`);
    console.log(`[Socket.IO] User ${userId} authenticated`);
    socket.emit('authenticated', { success: true });
  });

  socket.on('join-room', (roomId) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    socket.join(`room:${roomId}`);
    socket.emit('joined-room', { roomId });
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(`room:${roomId}`);
    socket.emit('left-room', { roomId });
  });

  socket.on('typing', ({ roomId, isTyping }) => {
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

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`[Socket.IO] Server listening on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log('[Socket.IO] Closing server...');
  io.close();
  process.exit(0);
});

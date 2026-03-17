const { createServer } = require('http');
const { Server } = require('socket.io');

const port = process.env.SOCKET_PORT || 3002;

// Create HTTP server
const httpServer = createServer();

// Socket.IO Server with CORS
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3001', 'http://srv1471808.tail4c3c89.ts.net:3001', 'https://srv1471808.tail4c3c89.ts.net:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store user socket mappings
const userSocketMap = new Map();

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);

  // Authenticate socket
  socket.on('authenticate', (data) => {
    if (data.userId) {
      socket.data.userId = data.userId;
      userSocketMap.set(data.userId, socket.id);
      console.log('[Socket] User authenticated:', data.userId);
      
      // Send initial counts
      socket.emit('notification-count', { count: 0 });
      socket.emit('chat-unread-count', { count: 0 });
    }
  });

  // Join room
  socket.on('join-room', (roomId) => {
    socket.join(`room:${roomId}`);
    console.log(`[Socket] ${socket.id} joined room:${roomId}`);
  });

  // Leave room
  socket.on('leave-room', (roomId) => {
    socket.leave(`room:${roomId}`);
    console.log(`[Socket] ${socket.id} left room:${roomId}`);
  });

  // Handle new message
  socket.on('send-message', (data) => {
    const { roomId, message } = data;
    // Broadcast to all in room except sender
    socket.to(`room:${roomId}`).emit('new-message', { roomId, message });
    console.log(`[Socket] Message sent to room:${roomId}`);
  });

  // Handle typing
  socket.on('typing', (data) => {
    const { roomId, userId, isTyping } = data;
    socket.to(`room:${roomId}`).emit('typing', { userId, isTyping });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socket.id);
    // Remove from userSocketMap
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  });
});

// Make io accessible globally for API routes
global.io = io;
global.userSocketMap = userSocketMap;

httpServer.listen(port, () => {
  console.log(`[Socket.IO] Server running on port ${port}`);
  console.log(`[Socket.IO] CORS enabled for: http://localhost:3001, http://srv1471808.tail4c3c89.ts.net:3001`);
});

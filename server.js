const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Global socket.io instance
let io = null;

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
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
        socket.emit('authenticated');
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
      socket.to(`room:${roomId}`).emit('new-message', { roomId, message });
      console.log(`[Socket] Message broadcast to room:${roomId}`);
    });

    // Handle typing
    socket.on('typing', (data) => {
      const { roomId, userId, isTyping } = data;
      socket.to(`room:${roomId}`).emit('typing', { userId, isTyping });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
    });
  });

  // Make io accessible globally (used by broadcast API route)
  global.io = io;
  global.userSocketMap = userSocketMap;
  global.getSocketIO = () => io;

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`[Socket.IO] Ready on ws://${hostname}:${port}/api/socket`);
  });
});

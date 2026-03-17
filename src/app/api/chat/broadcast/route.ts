import { NextRequest, NextResponse } from 'next/server';

// POST /api/chat/broadcast - Interner Endpunkt für Socket.IO Broadcast
export async function POST(request: NextRequest) {
  try {
    const { roomId, message, senderId } = await request.json();
    
    console.log(`[Broadcast API] Received broadcast request for room ${roomId}`);
    
    // Get global io instance
    const io = (global as any).io;
    
    if (!io) {
      console.log('[Broadcast API] global.io not available');
      return NextResponse.json({ error: 'Socket.IO not available' }, { status: 503 });
    }
    
    console.log('[Broadcast API] global.io is available');
    
    // Get all sockets in the room
    const roomName = `room:${roomId}`;
    console.log(`[Broadcast API] Looking for sockets in ${roomName}`);
    
    const roomSockets = await io.in(roomName).fetchSockets();
    console.log(`[Broadcast API] Found ${roomSockets.length} sockets in room ${roomId}`);
    
    // Log all connected sockets
    const allSockets = await io.fetchSockets();
    console.log(`[Broadcast API] Total connected sockets: ${allSockets.length}`);
    
    let sentCount = 0;
    let skippedCount = 0;
    
    for (const socket of roomSockets) {
      const socketUserId = socket.data?.userId;
      console.log(`[Broadcast API] Processing socket ${socket.id} with userId ${socketUserId}`);
      
      // Skip sender's socket
      if (socketUserId === senderId) {
        console.log(`[Broadcast API] Skipping sender's socket ${socket.id}`);
        skippedCount++;
        continue;
      }
      
      console.log(`[Broadcast API] Emitting new-message to socket ${socket.id}`);
      socket.emit('new-message', { roomId, message });
      sentCount++;
    }
    
    console.log(`[Broadcast API] Broadcast complete: ${sentCount} sent, ${skippedCount} skipped`);
    
    return NextResponse.json({ success: true, sent: sentCount, skipped: skippedCount });
  } catch (error) {
    console.error('[Broadcast API] Broadcast error:', error);
    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 });
  }
}

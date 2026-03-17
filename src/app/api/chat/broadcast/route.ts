import { NextRequest, NextResponse } from 'next/server';

// POST /api/chat/broadcast - Interner Endpunkt für Socket.IO Broadcast
export async function POST(request: NextRequest) {
  try {
    const { roomId, message, senderId } = await request.json();
    
    // Get global io instance
    const io = (global as any).io;
    
    if (!io) {
      console.log('[Socket] global.io not available');
      return NextResponse.json({ error: 'Socket.IO not available' }, { status: 503 });
    }
    
    // Get all sockets in the room
    const roomSockets = await io.in(`room:${roomId}`).fetchSockets();
    console.log(`[Socket] Broadcasting to ${roomSockets.length} sockets in room ${roomId}`);
    
    let sentCount = 0;
    let skippedCount = 0;
    
    for (const socket of roomSockets) {
      const socketUserId = socket.data?.userId;
      
      // Skip sender's socket
      if (socketUserId === senderId) {
        skippedCount++;
        continue;
      }
      
      socket.emit('new-message', { roomId, message });
      sentCount++;
    }
    
    console.log(`[Socket] Broadcast complete: ${sentCount} sent, ${skippedCount} skipped`);
    
    return NextResponse.json({ success: true, sent: sentCount, skipped: skippedCount });
  } catch (error) {
    console.error('[Socket] Broadcast error:', error);
    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 });
  }
}

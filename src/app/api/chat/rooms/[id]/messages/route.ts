import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';
import { extractMentions, createMentions } from '@/lib/chat/mentions';

// GET /api/chat/rooms/[id]/messages - Get messages for a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    // Check if user is a member
    const membership = await prisma.chatMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId: id,
        isDeleted: false,
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { sentAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        attachments: true,
        mentions: {
          where: {
            mentionedUserId: session.user.id
          },
          select: {
            mentionedUserId: true,
            isRead: true
          }
        }
      },
    });

    // Update lastReadAt
    await prisma.chatMember.update({
      where: {
        roomId_userId: {
          roomId: id,
          userId: session.user.id,
        },
      },
      data: { lastReadAt: new Date() },
    });

    // Mark all mentions read for current user in this room
    await prisma.chatMention.updateMany({
      where: {
        message: {
          roomId: id
        },
        mentionedUserId: session.user.id,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return NextResponse.json({
      messages,
      nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/rooms/[id]/messages - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { content, replyToId, attachments } = body;

    // Content is required unless there are attachments
    if ((!content || typeof content !== 'string' || content.trim().length === 0) && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: 'Content or attachments are required' }, { status: 400 });
    }

    // Check if user is a member
    const membership = await prisma.chatMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership || membership.isMuted) {
      return NextResponse.json({ error: 'Forbidden or muted' }, { status: 403 });
    }

    // Create message
    const messageData: any = {
      roomId: id,
      senderId: session.user.id,
      content: content?.trim() || '',
      replyToId,
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      messageData.attachments = {
        create: attachments.map((att: any) => ({
          fileName: att.name,
          filePath: att.url,
          mimeType: att.mimeType || 'application/octet-stream',
          fileSize: att.size || 0,
          width: att.width || null,
          height: att.height || null,
          thumbnailPath: att.thumbnailUrl || null,
        })),
      };
    }

    const message = await prisma.chatMessage.create({
      data: messageData,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        attachments: true,
      },
    });

    // Update room's updatedAt
    await prisma.chatRoom.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Get room members for unread count updates (needed before socket broadcast)
    const roomMembers = await prisma.chatMember.findMany({
      where: { roomId: id },
      select: { userId: true },
    });

    // Emit real-time event via Socket.IO (if available)
    try {
      const { getSocketIO } = await import('@/app/api/socket/route');
      const io = getSocketIO();
      if (io) {
        // Get all sockets in the room
        const roomSockets = await io.in(`room:${id}`).fetchSockets();
        console.log(`[Socket] Broadcasting message ${message.id} to ${roomSockets.length} sockets in room ${id}`);
        console.log(`[Socket] Sender userId: ${session.user.id}`);
        
        let sentCount = 0;
        let skippedCount = 0;
        
        for (const socket of roomSockets) {
          const socketUserId = socket.data?.userId;
          console.log(`[Socket] Socket ${socket.id} has userId: ${socketUserId}`);
          
          // Skip sender's socket - compare with the sender's userId
          if (socketUserId === session.user.id) {
            console.log(`[Socket] Skipping sender's socket ${socket.id}`);
            skippedCount++;
            continue;
          }
          
          socket.emit('new-message', { roomId: id, message });
          sentCount++;
        }
        
        console.log(`[Socket] Message broadcast: ${sentCount} sent, ${skippedCount} skipped (sender)`);
        
        // Broadcast updated unread count to all room members (except sender)
        if (typeof global !== 'undefined' && (global as any).broadcastChatUnreadCount) {
          for (const member of roomMembers) {
            if (member.userId !== session.user.id) {
              await (global as any).broadcastChatUnreadCount(member.userId);
            }
          }
        }
      }
    } catch (e) {
      console.error('[Socket] Error broadcasting message:', e);
    }

    // Emit EventBus event for Socket.IO handler to broadcast
    eventBus.emit('CHAT_MESSAGE_CREATED', {
      roomId: id,
      message,
      senderId: session.user.id,
      memberIds: roomMembers.map(m => m.userId),
    });

    // Process mentions if any
    if (content) {
      try {
        const mentions = await extractMentions(content);
        if (mentions.length > 0) {
          await createMentions(message.id, session.user.id, mentions);
        }
      } catch (mentionError) {
        console.error('Error processing mentions:', mentionError);
        // Don't fail the message send if mentions fail
      }
    }

    // Emit EventBus event für Chat-Befehle (/material, /checkin, etc.)
    eventBus.emit('chat.message.received', {
      roomId: id,
      messageId: message.id,
      senderId: session.user.id,
      content: message.content,
      timestamp: message.sentAt.toISOString(),
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
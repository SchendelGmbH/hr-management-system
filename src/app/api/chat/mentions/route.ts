import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/chat/mentions - Get user's mention history
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = parseInt(searchParams.get('skip') || '0');
  const includeRead = searchParams.get('includeRead') === 'true';

  try {
    const where = {
      mentionedUserId: session.user.id,
      ...(includeRead ? {} : { isRead: false }),
    };

    const mentions = await prisma.chatMention.findMany({
      where,
      take: limit,
      skip,
      orderBy: { mentionedAt: 'desc' },
      include: {
        message: {
          select: {
            id: true,
            content: true,
            sentAt: true,
            roomId: true,
            room: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        },
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
      },
    });

    // Format response
    const formattedMentions = mentions.map((mention) => ({
      id: mention.id,
      messageId: mention.messageId,
      roomId: mention.message.roomId,
      roomName: mention.message.room?.name || 'Unbekannter Raum',
      roomType: mention.message.room?.type,
      senderId: mention.senderId,
      senderName: mention.sender.employee
        ? `${mention.sender.employee.firstName} ${mention.sender.employee.lastName}`
        : mention.sender.username,
      content: mention.message.content,
      mentionedAt: mention.mentionedAt,
      isRead: mention.isRead,
      readAt: mention.readAt,
    }));

    const total = await prisma.chatMention.count({
      where: { mentionedUserId: session.user.id },
    });

    const unreadCount = await prisma.chatMention.count({
      where: { mentionedUserId: session.user.id, isRead: false },
    });

    return NextResponse.json({
      mentions: formattedMentions,
      total,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching mentions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/chat/mentions - Mark mentions as read
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mentionIds, markAll } = body;

    if (markAll) {
      // Mark all mentions as read
      await prisma.chatMention.updateMany({
        where: {
          mentionedUserId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } else if (mentionIds && mentionIds.length > 0) {
      // Mark specific mentions as read
      await prisma.chatMention.updateMany({
        where: {
          id: { in: mentionIds },
          mentionedUserId: session.user.id,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking mentions as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/chat/mentions - Delete mentions (archive them)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mentionIds } = body;

    if (mentionIds && mentionIds.length > 0) {
      await prisma.chatMention.deleteMany({
        where: {
          id: { in: mentionIds },
          mentionedUserId: session.user.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting mentions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

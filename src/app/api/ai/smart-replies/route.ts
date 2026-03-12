import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateSmartReplies } from '@/lib/ai/client';

// POST /api/ai/smart-replies - Generate smart reply suggestions
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    // Verify user is member of the room
    const membership = await prisma.chatMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    // Get room info
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: {
                employee: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get recent messages (last 10)
    const recentMessages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        isDeleted: false,
        senderId: { not: session.user.id }, // Only messages from others
      },
      orderBy: { sentAt: 'desc' },
      take: 10,
      include: {
        sender: {
          select: {
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

    // Reverse to get chronological order
    recentMessages.reverse();

    // Extract participant names
    const participantNames = room.members
      .filter((m) => m.userId !== session.user.id)
      .map((m) =>
        m.user.employee
          ? `${m.user.employee.firstName} ${m.user.employee.lastName}`
          : 'Unbekannt'
      );

    // Format messages for AI
    const formattedMessages = recentMessages.map((msg) => ({
      content: msg.content,
      sender: msg.sender?.employee
        ? `${msg.sender.employee.firstName} ${msg.sender.employee.lastName}`
        : msg.sender?.username || 'Unbekannt',
    }));

    // Generate smart replies
    const replies = await generateSmartReplies(formattedMessages, {
      roomType: room.type,
      participantNames,
    });

    return NextResponse.json({
      replies,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating smart replies:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate smart replies',
        replies: ['Verstanden!', 'Alles klar!', 'Ich melde mich.'],
      },
      { status: 500 }
    );
  }
}

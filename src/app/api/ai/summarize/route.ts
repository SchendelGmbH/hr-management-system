import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateSummary } from '@/lib/ai/client';

// POST /api/ai/summarize - Summarize chat messages
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roomId, messageIds } = body;

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

    // Fetch messages to summarize
    let messages;
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      // Summarize specific messages
      messages = await prisma.chatMessage.findMany({
        where: {
          id: { in: messageIds },
          roomId,
          isDeleted: false,
        },
        orderBy: { sentAt: 'asc' },
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
    } else {
      // Summarize last 50 messages
      messages = await prisma.chatMessage.findMany({
        where: {
          roomId,
          isDeleted: false,
        },
        orderBy: { sentAt: 'desc' },
        take: 50,
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
      messages.reverse();
    }

    if (messages.length === 0) {
      return NextResponse.json({ summary: 'Keine Nachrichten zum Zusammenfassen.' });
    }

    // Format messages for AI
    const formattedMessages = messages.map((msg) => ({
      content: msg.content,
      sender: msg.sender.employee
        ? `${msg.sender.employee.firstName} ${msg.sender.employee.lastName}`
        : msg.sender.username,
    }));

    // Generate summary
    const summary = await generateSummary(formattedMessages);

    return NextResponse.json({ 
      summary, 
      messageCount: messages.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ 
      error: 'Failed to generate summary',
      summary: 'Zusammenfassung konnte nicht erstellt werden. Bitte versuche es später nochmal.',
    }, { status: 500 });
  }
}

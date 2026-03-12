/**
 * Chat Module API Documentation
 * 
 * REST Endpunkte für Chat-Funktionalität
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST /api/chat/messages/[id]/reactions - Add reaction
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
    const { emoji } = body;

    if (!emoji) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 });
    }

    // Get message to find room
    const message = await prisma.chatMessage.findUnique({
      where: { id },
      include: { room: { include: { members: true } } },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user is room member
    const membership = message.room.members.find((m) => m.userId === session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    // Add or update reaction
    const reaction = await prisma.chatReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId: id,
          userId: session.user.id,
          emoji,
        },
      },
      update: {}, // Already exists, do nothing
      create: {
        messageId: id,
        userId: session.user.id,
        emoji,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ reaction }, { status: 201 });
  } catch (error) {
    console.error('Error adding reaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/chat/messages/[id]/reactions - Remove reaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const emoji = searchParams.get('emoji');

  if (!emoji) {
    return NextResponse.json({ error: 'Emoji is required' }, { status: 400 });
  }

  try {
    await prisma.chatReaction.delete({
      where: {
        messageId_userId_emoji: {
          messageId: id,
          userId: session.user.id,
          emoji,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
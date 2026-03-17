import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST /api/chat/rooms/[id]/read - Mark all messages in a room as read
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

    // Update lastReadAt timestamp
    await prisma.chatMember.update({
      where: {
        roomId_userId: {
          roomId: id,
          userId: session.user.id,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking room as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

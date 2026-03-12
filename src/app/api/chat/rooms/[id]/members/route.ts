import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// GET /api/chat/rooms/[id]/members - Get room members
export async function GET(
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
    const userMembership = await prisma.chatMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: session.user.id,
        },
      },
    });

    if (!userMembership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    const members = await prisma.chatMember.findMany({
      where: { roomId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
                position: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching room members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/rooms/[id]/members - Add member to room
const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['MEMBER', 'ADMIN']).default('MEMBER'),
});

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
    const { userId, role } = addMemberSchema.parse(body);

    // Check if current user can add members
    const membership = await prisma.chatMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user is already a member
    const existingMember = await prisma.chatMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    const newMember = await prisma.chatMember.create({
      data: {
        roomId: id,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Add system message about new member
    await prisma.chatMessage.create({
      data: {
        roomId: id,
        senderId: null,
        content: `${newMember.user.employee?.firstName || newMember.user.username} ist dem Chat beigetreten`,
        isSystem: true,
      },
    });

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error adding member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/chat/users - Search users for chat (independent of rooms)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    // Search users - exclude current user
    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        isActive: true,
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          {
            employee: {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      take: limit,
      orderBy: [
        { employee: { lastName: 'asc' } },
        { username: 'asc' },
      ],
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });

    // Transform to response format
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.employee 
        ? `${user.employee.firstName} ${user.employee.lastName}`
        : user.username,
      avatarUrl: null, // avatarUrl not in schema
      department: user.employee?.department?.name,
      position: user.employee?.position,
      employeeId: user.employee?.id,
    }));

    return NextResponse.json({
      users: formattedUsers,
      count: formattedUsers.length,
    });
  } catch (error) {
    console.error('[Chat/Users] Error searching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/users/ensure-room - Ensure direct chat room exists
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Check if direct room already exists
    const existingRoom = await prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: session.user.id } } },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
    });

    if (existingRoom) {
      return NextResponse.json({ room: existingRoom });
    }

    // Get other user details
    const otherUser = await prisma.user.findUnique({
      where: { id: userId },
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
    });

    if (!otherUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create new direct room
    const roomName = otherUser.employee
      ? `${otherUser.employee.firstName} ${otherUser.employee.lastName}`
      : otherUser.username;

    const newRoom = await prisma.chatRoom.create({
      data: {
        name: roomName,
        type: 'DIRECT',
        createdBy: session.user.id,
        members: {
          create: [
            { userId: session.user.id, role: 'MEMBER' },
            { userId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ room: newRoom }, { status: 201 });
  } catch (error) {
    console.error('[Chat/Users] Error creating room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

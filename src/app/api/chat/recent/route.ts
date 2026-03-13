import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/chat/recent - Get recent rooms and contacts
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get recent rooms (last visited/active)
    const recentRooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
            lastReadAt: { not: null },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        members: {
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
        },
        messages: {
          take: 1,
          orderBy: { sentAt: 'desc' },
          select: {
            content: true,
            sentAt: true,
          },
        },
      },
    });

    // Get recent contacts (users with whom I have direct chats)
    const directChats = await prisma.chatRoom.findMany({
      where: {
        type: 'DIRECT',
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        members: {
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
                    department: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      take: 10,
    });

    // Extract other users from direct chats
    const recentContacts = directChats
      .flatMap(room => room.members)
      .filter(member => member.userId !== session.user.id)
      .map(member => member.user)
      .filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      )
      .slice(0, 5);

    return NextResponse.json({
      recentRooms,
      recentContacts,
    });
  } catch (error) {
    console.error('Error fetching recent chat data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

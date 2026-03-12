import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { eventBus } from '@/lib/events/EventBus';

// GET /api/chat/rooms - List user's chat rooms
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as any;
  const search = searchParams.get('search') || '';

  try {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
        ...(type && { type }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
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
        messages: {
          take: 1,
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
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Add unread count for each room
    const roomsWithUnread = await Promise.all(
      rooms.map(async (room) => {
        const membership = room.members.find((m) => m.userId === session.user.id);
        const lastReadAt = membership?.lastReadAt;
        
        let unreadCount = 0;
        if (lastReadAt) {
          unreadCount = await prisma.chatMessage.count({
            where: {
              roomId: room.id,
              sentAt: { gt: lastReadAt },
              senderId: { not: session.user.id },
            },
          });
        } else {
          unreadCount = room._count.messages;
        }

        return {
          ...room,
          unreadCount,
          lastMessage: room.messages[0] || null,
        };
      })
    );

    return NextResponse.json({ rooms: roomsWithUnread });
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/rooms - Create a new chat room
const createRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['DIRECT', 'GROUP', 'DEPARTMENT']),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createRoomSchema.parse(body);

    // Ensure creator is in members
    const allMemberIds = [...new Set([...data.memberIds, session.user.id])];

    // For DIRECT chats, check if a room already exists between these two users
    if (data.type === 'DIRECT' && allMemberIds.length === 2) {
      const existingRoom = await prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: allMemberIds[0] } } },
            { members: { some: { userId: allMemberIds[1] } } },
          ],
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
                      
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (existingRoom) {
        return NextResponse.json({ room: existingRoom }, { status: 200 });
      }
    }

    // Create room with members
    const room = await prisma.chatRoom.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
        createdBy: session.user.id,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            role: userId === session.user.id ? 'OWNER' : 'MEMBER',
          })),
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
                    
                  },
                },
              },
            },
          },
        },
      },
    });

    // Emit event for new room
    eventBus.emit('chat.room.created', {
      roomId: room.id,
      type: room.type,
      memberIds: allMemberIds,
      createdBy: session.user.id,
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error creating chat room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
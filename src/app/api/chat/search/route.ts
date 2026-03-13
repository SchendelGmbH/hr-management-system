import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().optional(),
  roomId: z.string().optional(),
  senderId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().default(20),
  cursor: z.string().optional(),
});

// GET /api/chat/search - Search messages and rooms
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const params = searchSchema.parse({
      query: searchParams.get('query') || undefined,
      roomId: searchParams.get('roomId') || undefined,
      senderId: searchParams.get('senderId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      limit: searchParams.get('limit') || 20,
      cursor: searchParams.get('cursor') || undefined,
    });

    // Get user's room IDs for access control
    const userRooms = await prisma.chatMember.findMany({
      where: { userId: session.user.id },
      select: { roomId: true },
    });
    const userRoomIds = userRooms.map(r => r.roomId);

    if (userRoomIds.length === 0) {
      return NextResponse.json({ 
        messages: [], 
        rooms: [],
        users: [],
        nextCursor: null 
      });
    }

    // Build search conditions for messages
    const messageWhere: any = {
      roomId: params.roomId ? params.roomId : { in: userRoomIds },
      isDeleted: false,
    };

    if (params.query) {
      messageWhere.content = {
        contains: params.query,
        mode: 'insensitive',
      };
    }

    if (params.senderId) {
      messageWhere.senderId = params.senderId;
    }

    if (params.dateFrom || params.dateTo) {
      messageWhere.sentAt = {};
      if (params.dateFrom) {
        messageWhere.sentAt.gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        messageWhere.sentAt.lte = new Date(params.dateTo);
      }
    }

    // Search messages
    const messages = await prisma.chatMessage.findMany({
      where: messageWhere,
      take: params.limit,
      ...(params.cursor && {
        skip: 1,
        cursor: { id: params.cursor },
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
                avatarUrl: true,
              },
            },
          },
        },
        room: {
          select: {
            id: true,
            name: true,
            type: true,
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

    // Calculate next cursor
    const nextCursor = messages.length === params.limit 
      ? messages[messages.length - 1].id 
      : null;

    // Get recent rooms for quick access (top 10)
    const recentRooms = await prisma.chatRoom.findMany({
      where: {
        id: { in: userRoomIds },
        ...(params.query && {
          OR: [
            { name: { contains: params.query, mode: 'insensitive' } },
            { description: { contains: params.query, mode: 'insensitive' } },
          ],
        }),
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
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

    // Get users for mention/completion (if query is short or no filters)
    let users: any[] = [];
    if (!params.roomId && params.query && params.query.length >= 2) {
      users = await prisma.user.findMany({
        where: {
          id: { not: session.user.id },
          OR: [
            { username: { contains: params.query, mode: 'insensitive' } },
            { email: { contains: params.query, mode: 'insensitive' } },
            {
              employee: {
                OR: [
                  { firstName: { contains: params.query, mode: 'insensitive' } },
                  { lastName: { contains: params.query, mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
        take: 10,
        select: {
          id: true,
          username: true,
          email: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    }

    return NextResponse.json({
      messages,
      rooms: recentRooms,
      users,
      nextCursor,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error searching chat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

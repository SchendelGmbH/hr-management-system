import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/notifications/unread-count - Get unread notification count
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        isArchived: false,
      },
    });

    // Get count by type for detailed breakdown
    const countsByType = await prisma.notification.groupBy({
      by: ['type'],
      where: {
        userId: session.user.id,
        isRead: false,
        isArchived: false,
      },
      _count: {
        type: true,
      },
    });

    const typeCounts = countsByType.reduce((acc, item) => {
      acc[item.type] = item._count.type;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      total: count,
      byType: typeCounts,
    });
  } catch (error) {
    console.error('[Notifications/UnreadCount] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
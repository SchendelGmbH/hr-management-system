import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'notifications', 'view');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

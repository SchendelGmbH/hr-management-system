import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const authResult = await requirePermission(request, 'notifications', 'edit');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

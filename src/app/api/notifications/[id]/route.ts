import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'notifications', 'edit');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    const { isRead } = await request.json();
    const { id } = await params;

    const notification = await prisma.notification.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        isRead,
      },
    });

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

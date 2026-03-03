import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const vacation = await prisma.vacation.findUnique({ where: { id } });
    if (!vacation) {
      return NextResponse.json({ error: 'Urlaub nicht gefunden' }, { status: 404 });
    }

    await prisma.vacation.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Vacation',
        entityId: id,
        oldValues: JSON.stringify({ id, employeeId: vacation.employeeId }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting vacation:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

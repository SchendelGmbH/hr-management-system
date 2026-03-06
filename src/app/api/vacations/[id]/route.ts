import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { startDate, endDate } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate und endDate sind erforderlich' }, { status: 400 });
  }
  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ error: 'Enddatum muss nach dem Anfangsdatum liegen' }, { status: 400 });
  }

  try {
    const vacation = await prisma.vacation.findUnique({ where: { id } });
    if (!vacation) {
      return NextResponse.json({ error: 'Urlaub nicht gefunden' }, { status: 404 });
    }

    const updated = await prisma.vacation.update({
      where: { id },
      data: { startDate: new Date(startDate), endDate: new Date(endDate) },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Vacation',
        entityId: id,
        oldValues: JSON.stringify({ startDate: vacation.startDate, endDate: vacation.endDate }),
        newValues: JSON.stringify({ startDate, endDate }),
      },
    });

    return NextResponse.json({ vacation: updated });
  } catch (err) {
    console.error('Error updating vacation:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

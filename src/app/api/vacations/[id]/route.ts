import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'vacations', 'edit');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;
  const body = await request.json();
  const { startDate, endDate } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate und endDate sind erforderlich' }, { status: 400 });
  }
  // K2: Mass-Assignment-Schutz – validiere dass beide Dates gültige ISO-Dates sind
  const parsedStart = new Date(startDate);
  const parsedEnd = new Date(endDate);
  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datumsformat' }, { status: 400 });
  }
  if (parsedEnd < parsedStart) {
    return NextResponse.json({ error: 'Enddatum muss nach dem Anfangsdatum liegen' }, { status: 400 });
  }

  try {
    const vacation = await prisma.vacation.findUnique({ where: { id } });
    if (!vacation) {
      return NextResponse.json({ error: 'Urlaub nicht gefunden' }, { status: 404 });
    }

    if (vacation.employeeId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.vacation.update({
      where: { id },
      data: { startDate: parsedStart, endDate: parsedEnd },
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'vacations', 'delete');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  try {
    const vacation = await prisma.vacation.findUnique({ where: { id } });
    if (!vacation) {
      return NextResponse.json({ error: 'Urlaub nicht gefunden' }, { status: 404 });
    }

    if (vacation.employeeId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

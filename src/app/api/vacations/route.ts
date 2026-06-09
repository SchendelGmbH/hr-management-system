import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const vacationSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  vacationType: z.enum(['VACATION', 'SICK', 'SPECIAL', 'SCHOOL', 'SCHOOL_BLOCK']),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(_request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    // Non-admin darf nur eigene Urlaube sehen
    if (session.user.role !== 'ADMIN') {
      where.employeeId = session.user.id;
    }

    const vacations = await prisma.vacation.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ vacations });
  } catch (error) {
    console.error('Error fetching vacations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const data = vacationSchema.parse(body);

    // IDOR-Schutz: Nur ADMIN darf Urlaub für andere Mitarbeiter anlegen
    if (session.user.role !== 'ADMIN' && data.employeeId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (end < start) {
      return NextResponse.json({ error: 'Enddatum muss nach dem Startdatum liegen' }, { status: 400 });
    }

    const vacation = await prisma.vacation.create({
      data: {
        employeeId: data.employeeId,
        startDate: start,
        endDate: end,
        vacationType: data.vacationType,
        notes: data.notes || null,
        createdBy: session.user.id,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Vacation',
        entityId: vacation.id,
        newValues: JSON.stringify({
          employee: `${vacation.employee.firstName} ${vacation.employee.lastName}`,
          startDate: data.startDate,
          endDate: data.endDate,
          type: data.vacationType,
        }),
      },
    });

    return NextResponse.json({ vacation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: error.errors }, { status: 400 });
    }
    console.error('Error creating vacation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, isAdminFromSession } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const vacationSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Format: YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Format: YYYY-MM-DD'),
  vacationType: z.enum(['VACATION', 'SICK', 'SPECIAL', 'SCHOOL', 'SCHOOL_BLOCK']),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  // view Permission = alle sehen, aber Non-Admin filtert eigene Daten
  const authResult = await requirePermission(request, 'vacations', 'view');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    // Non-admin darf nur eigene Urlaube sehen (ADMIN hat automatic write → alles)
    if (!isAdminFromSession(session)) {
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
  const authResult = await requirePermission(request, 'vacations', 'request');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    const body = await request.json();
    const data = vacationSchema.parse(body);

    // IDOR-Schutz: Nur ADMIN darf Urlaub für andere Mitarbeiter anlegen
    if (!isAdminFromSession(session) && data.employeeId !== session.user.id) {
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

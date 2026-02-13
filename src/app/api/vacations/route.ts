import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const vacations = await prisma.vacation.findMany({
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
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { employeeId, startDate, endDate, vacationType, notes } = body;

    if (!employeeId || !startDate || !endDate || !vacationType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const vacation = await prisma.vacation.create({
      data: {
        employeeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        vacationType,
        notes: notes || null,
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
          startDate,
          endDate,
          type: vacationType,
        }),
      },
    });

    return NextResponse.json({ vacation });
  } catch (error) {
    console.error('Error creating vacation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/swaps/request
 * Erstellt eine neue Tauschanfrage
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const {
      requesterShiftId,
      requesterDate,
      requesterSiteId,
      requesterStartTime,
      requesterEndTime,
      requestedEmployeeId,
      requestedShiftId,
      note,
      expiresAt,
    } = body;

    // Validierung
    if (!requesterShiftId || !requesterDate || !requesterSiteId) {
      return NextResponse.json(
        { error: 'Pflichtfelder fehlen' },
        { status: 400 }
      );
    }

    const assignment = await prisma.dailyPlanAssignment.findUnique({
      where: { id: requesterShiftId },
      include: { employee: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Schicht nicht gefunden' },
        { status: 404 }
      );
    }

    // Prüfe auf existierende Anfragen
    const existingRequest = await prisma.shiftSwap.findFirst({
      where: {
        requesterShiftId,
        requesterDate: new Date(requesterDate),
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Es existiert bereits eine ausstehende Anfrage für diese Schicht' },
        { status: 409 }
      );
    }

    // Erstelle die Swap-Anfrage
    const swapRequest = await prisma.shiftSwap.create({
      data: {
        requesterId: assignment.employeeId,
        requesterShiftId,
        requesterDate: new Date(requesterDate),
        requesterSiteId,
        requesterStartTime: requesterStartTime || '06:00',
        requesterEndTime: requesterEndTime || '16:00',
        requestedEmployeeId: requestedEmployeeId || null,
        requestedShiftId: requestedShiftId || null,
        note: note || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: 'PENDING',
      },
      include: {
        requester: {
          include: {
            department: true,
          },
        },
        requested: {
          include: {
            department: true,
          },
        },
        requesterShift: {
          include: {
            site: {
              include: {
                plan: true,
                workSite: true,
              },
            },
          },
        },
      },
    });

    // Revalidate
    revalidatePath('/swaps');

    return NextResponse.json({
      success: true,
      data: swapRequest,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating swap request:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/swaps/request
 * Holt alle Swap-Anfragen für einen Mitarbeiter
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const type = searchParams.get('type'); // 'sent' | 'received'

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Mitarbeiter-ID ist erforderlich' },
        { status: 400 }
      );
    }

    const where: any = {};

    if (type === 'sent') {
      where.requesterId = employeeId;
    } else if (type === 'received') {
      where.requestedEmployeeId = employeeId;
    } else {
      // Alle Anfragen, bei denen der Mitarbeiter beteiligt ist
      where.OR = [
        { requesterId: employeeId },
        { requestedEmployeeId: employeeId },
      ];
    }

    if (status) {
      where.status = status;
    }

    const swaps = await prisma.shiftSwap.findMany({
      where,
      include: {
        requester: {
          include: {
            department: true,
          },
        },
        requested: {
          include: {
            department: true,
          },
        },
        requesterShift: {
          include: {
            site: {
              include: {
                plan: true,
                workSite: true,
              },
            },
          },
        },
        responses: {
          include: {
            responder: {
              include: {
                department: true,
              },
            },
            responderShift: {
              include: {
                site: {
                  include: {
                    plan: true,
                    workSite: true,
                  },
                },
              },
            },
          },
        },
        approvedByUser: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: swaps,
    });
  } catch (error) {
    console.error('Error fetching swap requests:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/swaps/search
 * Sucht nach verfügbaren Tauschpartnern für eine bestimmte Schicht
 * 
 * Query Params:
 * - date: ISO Datum (z.B. 2024-03-15)
 * - employeeId: ID des Mitarbeiters, der tauschen möchte
 * - excludeOwn: boolean - eigene Schichten ausschließen
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employeeId');
    const excludeOwn = searchParams.get('excludeOwn') === 'true';

    if (!date || !employeeId) {
      return NextResponse.json(
        { error: 'Datum und Mitarbeiter-ID sind erforderlich' },
        { status: 400 }
      );
    }

    const searchDate = new Date(date);
    const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

    // Hole die Schicht des anfragenden Mitarbeiters
    const myAssignments = await prisma.dailyPlanAssignment.findMany({
      where: {
        employeeId,
        site: {
          plan: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
      },
      include: {
        site: {
          include: {
            plan: true,
            workSite: true,
          },
        },
        employee: true,
      },
    });

    if (myAssignments.length === 0) {
      return NextResponse.json(
        { error: 'Keine Schicht an diesem Tag gefunden' },
        { status: 404 }
      );
    }

    const myShift = myAssignments[0];

    // Suche nach möglichen Tauschpartnern
    const availableEmployees = await prisma.dailyPlanAssignment.findMany({
      where: {
        employeeId: excludeOwn ? { not: employeeId } : undefined,
        site: {
          plan: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
      },
      include: {
        site: {
          include: {
            plan: true,
            workSite: true,
          },
        },
        employee: {
          include: {
            department: true,
          },
        },
      },
    });

    // Prüfe existierende Swap-Anfragen für diesen Tag
    const existingSwaps = await prisma.shiftSwap.findMany({
      where: {
        OR: [
          { requesterId: employeeId, requesterDate: { gte: startOfDay, lte: endOfDay } },
          { requestedEmployeeId: employeeId, requesterDate: { gte: startOfDay, lte: endOfDay } },
        ],
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    // Bereite Antwort vor
    const response = {
      myShift,
      availablePartners: availableEmployees.map(assignment => {
        const existingRequest = existingSwaps.find(
          s => s.requestedEmployeeId === assignment.employeeId ||
               (s.requestedEmployeeId === employeeId && s.requesterId === assignment.employeeId)
        );

        return {
          assignment,
          canSwap: !existingRequest,
          existingSwapId: existingRequest?.id || null,
        };
      }),
      statistics: {
        total: availableEmployees.length,
        available: availableEmployees.length - existingSwaps.length,
        pendingRequests: existingSwaps.filter(s => s.status === 'PENDING').length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error searching shift swaps:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calendar/shifts
 * Lädt Schichten aus der Tagesplanung für den Kalender
 * Inklusive Swap-Button-Fähigkeit
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const employeeId = searchParams.get('employeeId');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Start- und Enddatum erforderlich' },
        { status: 400 }
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Lade Pläne im Zeitraum
    const plans = await prisma.dailyPlan.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        sites: {
          include: {
            assignments: {
              include: {
                employee: {
                  include: {
                    department: {
                      select: { name: true },
                    },
                  },
                },
                swapRequestsAsRequester: {
                  where: {
                    status: { in: ['PENDING', 'APPROVED'] },
                  },
                  select: {
                    id: true,
                    status: true,
                    requestedEmployeeId: true,
                  },
                },
              },
            },
            workSite: true,
          },
        },
      },
    });

    // Bestehende Swap-Anfragen laden
    const existingSwaps = await prisma.shiftSwap.findMany({
      where: {
        requesterDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: {
        id: true,
        requesterShiftId: true,
        status: true,
      },
    });

    const activeSwapIds = new Set(existingSwaps.map(s => s.requesterShiftId));

    // Transformiere zu Kalender-Events
    const shiftEvents = [];

    for (const plan of plans) {
      for (const site of plan.sites) {
        for (const assignment of site.assignments) {
          // Filtere nach Mitarbeiter falls angegeben
          if (employeeId && assignment.employeeId !== employeeId) {
            continue;
          }

          const hasActiveSwap = activeSwapIds.has(assignment.id) ||
            assignment.swapRequestsAsRequester.length > 0;

          shiftEvents.push({
            id: `shift-${assignment.id}`,
            assignmentId: assignment.id,
            employeeId: assignment.employeeId,
            title: `${site.name} - ${assignment.employee.firstName} ${assignment.employee.lastName}`,
            start: plan.date.toISOString().split('T')[0] + 'T' + (site.startTime || '06:00'),
            end: plan.date.toISOString().split('T')[0] + 'T' + (site.endTime || '16:00'),
            backgroundColor: hasActiveSwap ? '#FBBF24' : '#10B981',
            borderColor: hasActiveSwap ? '#F59E0B' : '#059669',
            textColor: '#ffffff',
            type: 'SHIFT',
            extendedProps: {
              isShift: true,
              assignmentId: assignment.id,
              employeeId: assignment.employeeId,
              employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
              department: assignment.employee.department?.name,
              siteId: site.id,
              siteName: site.name,
              location: site.location,
              startTime: site.startTime || '06:00',
              endTime: site.endTime || '16:00',
              workSiteName: site.workSite?.name,
              hasActiveSwap,
              swapStatus: hasActiveSwap ? 'PENDING' : null,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      events: shiftEvents,
      count: shiftEvents.length,
    });
  } catch (error) {
    console.error('Error fetching calendar shifts:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

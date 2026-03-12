import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { emitEvent, emitSwapEvent, ShiftSwapEvents } from '@/lib/eventBus';
import { notifySwapApproved, notifySwapCompleted } from '@/lib/notifications';

/**
 * POST /api/swaps/approve
 * Genehmigt oder lehnt eine Tauschanfrage ab
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { swapId, responseId, action, note } = body;

    if (!swapId || !action) {
      return NextResponse.json(
        { error: 'Swap-ID und Aktion sind erforderlich' },
        { status: 400 }
      );
    }

    if (!['APPROVE', 'REJECT', 'CANCEL'].includes(action)) {
      return NextResponse.json(
        { error: 'Ungültige Aktion' },
        { status: 400 }
      );
    }

    const swap = await prisma.shiftSwap.findUnique({
      where: { id: swapId },
      include: {
        requester: true,
        requested: true,
        requesterShift: true,
        responses: {
          include: {
            responder: true,
            responderShift: true,
          },
        },
      },
    });

    if (!swap) {
      return NextResponse.json(
        { error: 'Tauschanfrage nicht gefunden' },
        { status: 404 }
      );
    }

    // Bestimme den Status basierend auf der Aktion
    let newStatus: string;
    let shouldExecuteSwap = false;

    switch (action) {
      case 'APPROVE':
        if (responseId) {
          // Genehmigung einer bestimmten Antwort
          const response = swap.responses.find(r => r.id === responseId);
          if (!response) {
            return NextResponse.json(
              { error: 'Antwort nicht gefunden' },
              { status: 404 }
            );
          }

          // Aktualisiere die Antwort
          await prisma.swapResponse.update({
            where: { id: responseId },
            data: {
              status: 'APPROVED',
              approvedBy: user.id,
              approvedAt: new Date(),
            },
          });

          // Lehnen andere Antworten ab
          await prisma.swapResponse.updateMany({
            where: {
              swapRequestId: swapId,
              id: { not: responseId },
              status: 'PENDING',
            },
            data: { status: 'REJECTED' },
          });

          newStatus = 'COMPLETED';
          shouldExecuteSwap = true;
        } else {
          // Direkte Genehmigung der Hauptanfrage
          newStatus = 'APPROVED';
        }
        break;

      case 'REJECT':
        newStatus = 'REJECTED';
        if (responseId) {
          await prisma.swapResponse.update({
            where: { id: responseId },
            data: { status: 'REJECTED' },
          });
        }
        break;

      case 'CANCEL':
        newStatus = 'CANCELLED';
        break;

      default:
        newStatus = swap.status;
    }

    // Aktualisiere die Hauptanfrage
    const updatedSwap = await prisma.shiftSwap.update({
      where: { id: swapId },
      data: {
        status: newStatus as any,
        approvedBy: action === 'APPROVE' ? user.id : swap.approvedBy,
        approvedAt: action === 'APPROVE' ? new Date() : swap.approvedAt,
        approvalNote: note || swap.approvalNote,
      },
      include: {
        requester: true,
        requested: true,
        requesterShift: {
          include: {
            site: {
              include: {
                plan: true,
              },
            },
          },
        },
        responses: {
          include: {
            responder: true,
            responderShift: true,
          },
        },
      },
    });

    // Führe den Tausch durch, falls genehmigt
    if (shouldExecuteSwap && responseId) {
      const approvedResponse = swap.responses.find(r => r.id === responseId);
      if (approvedResponse) {
        await executeShiftSwap(swap, approvedResponse);
      }
    }

    // Emit Event für Realtime-Updates
    emitSwapEvent(ShiftSwapEvents.SWAP_UPDATED, {
      swapId: swap.id,
      status: newStatus,
      requesterId: swap.requesterId,
      requestedId: swap.requestedEmployeeId,
    });

    // Benachrichtigungen
    if (action === 'APPROVE' || action === 'REJECT') {
      // Benachrichtige den Anfragenden
      await notifySwapApproved(
        user.username,
        swap.requesterId,
        swap.id,
        swap.requesterDate,
        action === 'APPROVE'
      );

      if (action === 'APPROVE') {
        // Emit completed event
        emitSwapEvent(ShiftSwapEvents.SWAP_COMPLETED, {
          swapId: swap.id,
          requesterId: swap.requesterId,
          requestedId: swap.requestedEmployeeId,
        });
      }
    }

    // Revalidate
    revalidatePath('/swaps');
    revalidatePath('/calendar');
    revalidatePath('/my-schedule');

    return NextResponse.json({
      success: true,
      data: updatedSwap,
      message: action === 'APPROVE' 
        ? 'Tauschanfrage genehmigt' 
        : action === 'REJECT'
        ? 'Tauschanfrage abgelehnt'
        : 'Tauschanfrage storniert',
    });
  } catch (error) {
    console.error('Error processing swap approval:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * Führt den eigentlichen Schichtwechsel durch
 */
async function executeShiftSwap(swap: any, response: any) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Aktualisiere die Zuordnung des Anfragenden
      await tx.dailyPlanAssignment.update({
        where: { id: swap.requesterShiftId },
        data: {
          siteId: response.responderSiteId,
          note: `Getauscht mit ${response.responder.firstName} ${response.responder.lastName}`,
        },
      });

      // 2. Aktualisiere die Zuordnung des Responders
      await tx.dailyPlanAssignment.update({
        where: { id: response.responderShiftId },
        data: {
          siteId: swap.requesterSiteId,
          note: `Getauscht mit ${swap.requester.firstName} ${swap.requester.lastName}`,
        },
      });

      // 3. Erstelle Audit-Log-Eintrag
      await tx.auditLog.create({
        data: {
          userId: swap.approvedBy || 'system',
          action: 'SHIFT_SWAP_EXECUTED',
          entityType: 'ShiftSwap',
          entityId: swap.id,
          newValues: {
            requesterId: swap.requesterId,
            responderId: response.responderId,
            requesterShiftId: swap.requesterShiftId,
            responderShiftId: response.responderShiftId,
          },
        },
      });
    });

    // Emit Event für Planänderung
    emitEvent('SCHEDULE_CHANGED', {
      date: swap.requesterDate,
      affectedEmployees: [swap.requesterId, response.responderId],
      swapId: swap.id,
    });

    // Benachrichtige beide Parteien
    await notifySwapCompleted(
      swap.id,
      [swap.requesterId, response.responderId],
      swap.requesterDate
    );

    console.log('Shift swap executed successfully:', swap.id);
  } catch (error) {
    console.error('Error executing shift swap:', error);
    throw error;
  }
}

/**
 * POST /api/swaps/approve
 * Erstellt eine Antwort auf eine Tauschanfrage (bietet eigene Schicht an)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { swapId, responderShiftId, responderDate, responderSiteId } = body;

    if (!swapId || !responderShiftId || !responderDate || !responderSiteId) {
      return NextResponse.json(
        { error: 'Pflichtfelder fehlen' },
        { status: 400 }
      );
    }

    const swap = await prisma.shiftSwap.findUnique({
      where: { id: swapId },
    });

    if (!swap) {
      return NextResponse.json(
        { error: 'Tauschanfrage nicht gefunden' },
        { status: 404 }
      );
    }

    if (swap.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Tauschanfrage ist nicht mehr ausstehend' },
        { status: 400 }
      );
    }

    const responderAssignment = await prisma.dailyPlanAssignment.findUnique({
      where: { id: responderShiftId },
      include: { employee: true },
    });

    if (!responderAssignment) {
      return NextResponse.json(
        { error: 'Schicht nicht gefunden' },
        { status: 404 }
      );
    }

    const response = await prisma.swapResponse.create({
      data: {
        swapRequestId: swapId,
        responderId: responderAssignment.employeeId,
        responderShiftId,
        responderDate: new Date(responderDate),
        responderSiteId,
        status: 'PENDING',
      },
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
    });

    // Emit Event
    emitEvent('SHIFT_SWAP_RESPONSE_CREATED', {
      swapId: swap.id,
      responseId: response.id,
      responderId: responderAssignment.employeeId,
      requesterId: swap.requesterId,
    });

    return NextResponse.json({
      success: true,
      data: response,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating swap response:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

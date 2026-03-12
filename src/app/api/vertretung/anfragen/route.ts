import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/events/EventBus';
import { z } from 'zod';

/**
 * POST /api/vertretung/anfragen
 * 
 * Sendet eine Vertretungsanfrage an einen Mitarbeiter
 * - Erstellt eine Notification
 * - Sendet Chat-Nachricht falls Chat existiert
 * - Trägt in Audit-Log ein
 */

const anfrageSchema = z.object({
  vertretungsMitarbeiterId: z.string().min(1),
  krankerMitarbeiterId: z.string().min(1),
  startDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nachricht: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = anfrageSchema.parse(body);

    // Hole beide Mitarbeiter
    const [vertretung, kranker] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: data.vertretungsMitarbeiterId },
        include: { user: true, department: true },
      }),
      prisma.employee.findUnique({
        where: { id: data.krankerMitarbeiterId },
        include: { department: true },
      }),
    ]);

    if (!vertretung || !kranker) {
      return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
    }

    if (!vertretung.user) {
      return NextResponse.json({ error: 'Vertretung hat kein Portal-Zugang' }, { status: 400 });
    }

    // Prüfe ob Vertretung verfügbar ist (nicht im Urlaub/Krank)
    const startDate = new Date(data.startDatum);
    const endDate = new Date(data.endDatum);
    endDate.setHours(23, 59, 59, 999);

    const urlaub = await prisma.vacation.findFirst({
      where: {
        employeeId: data.vertretungsMitarbeiterId,
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
    });

    if (urlaub) {
      return NextResponse.json({ 
        error: 'Mitarbeiter ist in diesem Zeitraum nicht verfügbar',
        reason: urlaub.vacationType === 'SICK' ? 'krank' : 'im Urlaub'
      }, { status: 400 });
    }

    // Erstelle Anfrage-Record
    const anfrage = await prisma.$transaction(async (tx) => {
      // Erstelle Notification für den Vertretungs-Mitarbeiter
      const notification = await tx.notification.create({
        data: {
          userId: vertretung.user!.id,
          type: 'UPCOMING_VACATION', // Wir verwenden einen existierenden Typ
          title: '🚑 Vertretungsanfrage',
          message: `Du wurdest als Vertretung für ${kranker.firstName} ${kranker.lastName} vom ${new Date(data.startDatum).toLocaleDateString('de-DE')} bis ${new Date(data.endDatum).toLocaleDateString('de-DE')} angefragt.`,
          relatedEntityType: 'VertretungsAnfrage',
          relatedEntityId: `${data.vertretungsMitarbeiterId}-${data.krankerMitarbeiterId}`,
        },
      });

      // Audit-Log
      const auditLog = await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          entityType: 'VertretungsAnfrage',
          entityId: notification.id,
          newValues: JSON.stringify({
            von: session.user.id,
            anVertretung: data.vertretungsMitarbeiterId,
            fuerKranken: data.krankerMitarbeiterId,
            zeitraum: `${data.startDatum} - ${data.endDatum}`,
            nachricht: data.nachricht,
          }),
        },
      });

      return { notification, auditLog };
    });

    // Suche oder erstelle Direkt-Chat mit dem Vertretungs-Mitarbeiter
    const chatRoom = await findeOderErstelleAnfrageChat(
      session.user.id,
      vertretung.user.id,
      vertretung,
      kranker,
      data
    );

    // Emit Event
    eventBus.emit('vertretung.anfrage.gesendet', {
      anfrageId: anfrage.notification.id,
      vonUserId: session.user.id,
      anUserId: vertretung.user.id,
      vertretungsMitarbeiterId: data.vertretungsMitarbeiterId,
      krankerMitarbeiterId: data.krankerMitarbeiterId,
      chatRoomId: chatRoom?.id,
    });

    return NextResponse.json({
      success: true,
      anfrageId: anfrage.notification.id,
      chatRoomId: chatRoom?.id,
      message: `Anfrage an ${vertretung.firstName} ${vertretung.lastName} wurde gesendet`,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: error.errors }, { status: 400 });
    }
    console.error('Error sending replacement request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function findeOderErstelleAnfrageChat(
  vonUserId: string,
  anUserId: string,
  vertretung: { firstName: string; lastName: string; employeeNumber: string },
  kranker: { firstName: string; lastName: string; employeeNumber: string },
  data: { startDatum: string; endDatum: string; nachricht?: string }
) {
  try {
    // Prüfe ob bereits ein Direkt-Chat existiert
    let room = await prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: vonUserId } } },
          { members: { some: { userId: anUserId } } },
        ],
      },
    });

    // Wenn nicht existiert, erstelle neuen Direkt-Chat
    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          type: 'DIRECT',
          name: null, // Direkt-Chat hat keinen Namen
          members: {
            create: [
              { userId: vonUserId, role: 'MEMBER' },
              { userId: anUserId, role: 'MEMBER' },
            ],
          },
        },
      });
    }

    // Sende Anfrage-Nachricht
    const anfrageText = `🚑 **Vertretungsanfrage**

Hallo ${vertretung.firstName},

du wurdest als Vertretung für **${kranker.firstName} ${kranker.lastName}** (${kranker.employeeNumber}) angefragt.

**Zeitraum:** ${new Date(data.startDatum).toLocaleDateString('de-DE')} - ${new Date(data.endDatum).toLocaleDateString('de-DE')}

${data.nachricht ? `**Nachricht:** ${data.nachricht}\n\n` : ''}_Bitte antworte zeitnah ob du verfügbar bist._`;

    await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: vonUserId,
        content: anfrageText,
      },
    });

    return room;
  } catch (error) {
    console.error('[VertretungAnfrage] Fehler beim Chat erstellen:', error);
    return null;
  }
}

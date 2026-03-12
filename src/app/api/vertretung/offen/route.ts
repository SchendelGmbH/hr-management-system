import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/vertretung/offen
 * 
 * Gibt alle aktuellen Vertretungsanfragen/Chats zurück
 * Für HR-Dashboard - alle offenen Vertretungen sehen
 */

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Finde alle Vertretungs-Chat-Räume (SICK_LEAVE related)
    const vertretungsRaeume = await prisma.chatRoom.findMany({
      where: {
        type: 'SYSTEM',
        relatedEntityType: 'SICK_LEAVE',
      },
      include: {
        members: {
          include: {
            user: {
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 5,
          select: {
            id: true,
            content: true,
            sentAt: true,
            isSystem: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Extrahiere die Krankmeldung-Informationen aus den related Entities
    const enrichedRaeume = await Promise.all(
      vertretungsRaeume.map(async (raum) => {
        // Finde die Urlaubs-Eintrag für diesen Raum
        const vacation = await prisma.vacation.findUnique({
          where: { id: raum.relatedEntityId || '' },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                department: {
                  select: { name: true },
                },
              },
            },
          },
        });

        // Parse den Zeitraum aus dem Raum-Namen oder Description
        const datumMatch = raum.description?.match(/(\d{2}\.\d{2}\.\d{4}).*?(\d{2}\.\d{2}\.\d{4})/);
        const [startDatum, endDatum] = datumMatch 
          ? [datumMatch[1], datumMatch[2]] 
          : [null, null];

        return {
          id: raum.id,
          name: raum.name,
          description: raum.description,
          createdAt: raum.createdAt,
          messageCount: raum._count.messages,
          latestMessage: raum.messages[0] || null,
          krankerMitarbeiter: vacation?.employee || null,
          startDatum,
          endDatum,
          isActive: vacation ? new Date(vacation.endDate) >= new Date() : false,
          members: raum.members.map(m => ({
            userId: m.userId,
            role: m.role,
            employee: m.user?.employee || null,
          })),
        };
      })
    );

    // Filtere: Aktive (noch laufende) zuerst
    const aktive = enrichedRaeume.filter(r => r.isActive);
    const vergangene = enrichedRaeume.filter(r => !r.isActive);

    return NextResponse.json({
      offeneVertretungen: [...aktive, ...vergangene],
      meta: {
        total: enrichedRaeume.length,
        active: aktive.length,
        past: vergangene.length,
      },
    });

  } catch (error) {
    console.error('Error fetching offene Vertretungen:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

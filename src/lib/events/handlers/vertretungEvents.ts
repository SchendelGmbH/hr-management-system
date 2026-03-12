/**
 * VertretungEventHandler - Automatische Vertretungsvorschläge bei Krankmeldung
 * 
 * Subscribed: vacation.created (type: SICK) -> Erstellt automatisch Chat-Vorschläge
 */

import { eventBus } from '../EventBus';
import prisma from '@/lib/prisma';

const VERTRETUNG_ROOM_PREFIX = 'Vertretung 🚑';

export function initializeVertretungEventHandlers() {
  console.log('[VertretungEvents] Initialisiere Event-Handler...');

  // Subscribe zur Krankmeldung
  eventBus.subscribe(
    'vacation.created',
    async (event) => {
      const { vacationId, employeeId, vacationType, startDate, endDate, createdBy } = event.payload;
      
      // Nur bei Krankmeldungen (SICK)
      if (vacationType !== 'SICK') {
        return;
      }

      console.log('[VertretungEvents] Krankmeldung empfangen:', { employeeId, startDate, endDate });

      try {
        await handleSickLeave(vacationId, employeeId, startDate, endDate, createdBy);
      } catch (error) {
        console.error('[VertretungEvents] Fehler beim Verarbeiten der Krankmeldung:', error);
      }
    },
    { priority: 'high' }
  );

  console.log('[VertretungEvents] Event-Handler registriert');
}

async function handleSickLeave(
  vacationId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
  createdBy: string
) {
  // Hole den kranken Mitarbeiter
  const krankerMitarbeiter = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: true,
      department: true,
    },
  });

  if (!krankerMitarbeiter) {
    console.log('[VertretungEvents] Mitarbeiter nicht gefunden');
    return;
  }

  // Finde Admin/HR User für den Chat
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    take: 3,
    select: { id: true },
  });

  if (adminUsers.length === 0) {
    console.log('[VertretungEvents] Keine Admin-User gefunden');
    return;
  }

  // Prüfe ob bereits ein Vertretungs-Chat existiert
  const existingRoom = await prisma.chatRoom.findFirst({
    where: {
      type: 'SYSTEM',
      relatedEntityType: 'SICK_LEAVE',
      relatedEntityId: vacationId,
    },
  });

  if (existingRoom) {
    console.log('[VertretungEvents] Vertretungs-Chat existiert bereits');
    return;
  }

  // Hole Vertretungsvorschläge via interner API-Logik
  const vorschlaege = await findeVertretungsVorschlaege(employeeId, startDate, endDate);

  if (vorschlaege.length === 0) {
    // Erstelle trotzdem Chat, aber mit Hinweis dass keine Vorschläge gefunden wurden
    await erstelleVertretungsChatOhneVorschlaege(
      vacationId,
      krankerMitarbeiter,
      adminUsers.map(u => u.id),
      startDate,
      endDate
    );
    return;
  }

  // Erstelle Chat mit Vorschlägen
  await erstelleVertretungsChat(
    vacationId,
    krankerMitarbeiter,
    adminUsers.map(u => u.id),
    vorschlaege,
    startDate,
    endDate
  );
}

async function findeVertretungsVorschlaege(krankerMitarbeiterId: string, startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Hole den kranken Mitarbeiter mit Einsatzplanung
  const krankerMitarbeiter = await prisma.employee.findUnique({
    where: { id: krankerMitarbeiterId },
    include: {
      department: true,
      qualifications: { include: { type: true } },
      planAssignments: {
        where: {
          site: {
            plan: { date: { gte: start, lte: end } },
          },
        },
        include: { site: { include: { workSite: true } } },
      },
    },
  });

  if (!krankerMitarbeiter) return [];

  const geplanteBaustellenIds = krankerMitarbeiter.planAssignments
    .map(pa => pa.site.workSiteId)
    .filter((id): id is string => !!id);

  const krankerQualificationTypeIds = krankerMitarbeiter.qualifications.map(q => q.typeId);

  // Finde potenzielle Vertretungen
  const alleMitarbeiter = await prisma.employee.findMany({
    where: {
      id: { not: krankerMitarbeiterId },
      isActive: true,
    },
    include: {
      department: true,
      user: true,
      qualifications: { include: { type: true } },
      vacations: {
        where: {
          AND: [
            { startDate: { lte: end } },
            { endDate: { gte: start } },
          ],
        },
      },
      planAssignments: {
        where: {
          site: { plan: { date: { gte: start, lte: end } } },
        },
        include: { site: { include: { workSite: true } } },
      },
    },
  });

  const vorschlaege = alleMitarbeiter
    .map(mitarbeiter => {
      let score = 0;
      const gruende: string[] = [];

      // Überspringe wenn im Urlaub/Krank
      if (mitarbeiter.vacations.length > 0) return null;

      // Gleiche Abteilung
      if (mitarbeiter.departmentId === krankerMitarbeiter.departmentId) {
        score += 20;
        gruende.push('Gleiche Abteilung');
      }

      // Gleiche Baustelle
      const istAufGleicherBaustelle = mitarbeiter.planAssignments.some(pa =>
        pa.site.workSiteId && geplanteBaustellenIds.includes(pa.site.workSiteId)
      );

      if (istAufGleicherBaustelle) {
        score += 30;
        gruende.push('Gleiche Baustelle');
      }

      // Qualifikationen
      const matchingQuals = mitarbeiter.qualifications.filter(q =>
        krankerQualificationTypeIds.includes(q.typeId)
      );

      if (matchingQuals.length > 0) {
        score += Math.min(matchingQuals.length * 25, 50);
        gruende.push(`${matchingQuals.length}x Qualifikation`);
      }

      // Hat Arbeitsplanung
      if (mitarbeiter.planAssignments.length > 0) {
        score += 10;
      }

      // Braucht mindestens 30 Punkte um als Vorschlag zu gelten
      if (score < 30) return null;

      return {
        employeeId: mitarbeiter.id,
        userId: mitarbeiter.user?.id,
        name: `${mitarbeiter.firstName} ${mitarbeiter.lastName}`,
        employeeNumber: mitarbeiter.employeeNumber,
        score: Math.min(score, 100),
        gruende,
        qualifications: mitarbeiter.qualifications.map(q => q.type.name),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return vorschlaege;
}

async function erstelleVertretungsChat(
  vacationId: string,
  krankerMitarbeiter: { id: string; firstName: string; lastName: string; employeeNumber: string; user: { id: string } | null },
  adminUserIds: string[],
  vorschlaege: Array<{
    employeeId: string;
    userId: string | undefined;
    name: string;
    employeeNumber: string;
    score: number;
    gruende: string[];
    qualifications: string[];
  }>,
  startDate: string,
  endDate: string
) {
  const memberData: Array<{ userId: string; role: 'OWNER' | 'MEMBER' }> = [
    ...adminUserIds.map(id => ({ userId: id, role: 'OWNER' as const })),
  ];

  // Füge vorgeschlagene Mitarbeiter als MEMBER hinzu (wenn sie User-Accounts haben)
  vorschlaege.forEach(v => {
    if (v.userId && !memberData.some(m => m.userId === v.userId)) {
      memberData.push({ userId: v.userId, role: 'MEMBER' });
    }
  });

  const room = await prisma.chatRoom.create({
    data: {
      name: `${VERTRETUNG_ROOM_PREFIX} - ${krankerMitarbeiter.firstName} ${krankerMitarbeiter.lastName}`,
      type: 'SYSTEM',
      isSystem: true,
      description: `Automatische Vertretungsvorschläge für ${krankerMitarbeiter.firstName} ${krankerMitarbeiter.lastName} (${new Date(startDate).toLocaleDateString('de-DE')} - ${new Date(endDate).toLocaleDateString('de-DE')})`,
      relatedEntityType: 'SICK_LEAVE',
      relatedEntityId: vacationId,
      members: {
        create: memberData,
      },
    },
  });

  // Willkommensnachricht
  await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: null, // System
      content: `🚑 **Krankmeldung eingegangen**

**Mitarbeiter:** ${krankerMitarbeiter.firstName} ${krankerMitarbeiter.lastName} (${krankerMitarbeiter.employeeNumber})
**Zeitraum:** ${new Date(startDate).toLocaleDateString('de-DE')} - ${new Date(endDate).toLocaleDateString('de-DE')}

Die folgenden Mitarbeiter wurden als potenzielle Vertretung vorgeschlagen:
${vorschlaege.map((v, i) => `${i + 1}. **${v.name}** (${v.employeeNumber}) - Score: ${v.score}%
   ✓ ${v.gruende.join(', ')}`).join('\n')}`,
      isSystem: true,
    },
  });

  // Sende Einzel-Nachrichten mit Aktions-Buttons (simuliert durch Links)
  let actionMessage = '**Schnellauswahl:**\n\n';
  vorschlaege.forEach((v, i) => {
    actionMessage += `[ANFRAGEN:${v.employeeId}] ${v.name} (${v.employeeNumber})\n`;
  });

  await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: null,
      content: actionMessage + '\n_Klicke auf "ANFRAGEN" um die Vertretung anzufragen. Der Mitarbeiter wird benachrichtigt._',
      isSystem: true,
    },
  });

  console.log(`[VertretungEvents] Vertretungs-Chat erstellt: ${room.id}`);

  // Emit Event für UI Updates
  eventBus.emit('vertretung.vorschlag.erstellt', {
    roomId: room.id,
    vacationId,
    krankerMitarbeiterId: krankerMitarbeiter.id,
    vorschlaegeCount: vorschlaege.length,
  });

  return room;
}

async function erstelleVertretungsChatOhneVorschlaege(
  vacationId: string,
  krankerMitarbeiter: { id: string; firstName: string; lastName: string; employeeNumber: string },
  adminUserIds: string[],
  startDate: string,
  endDate: string
) {
  const room = await prisma.chatRoom.create({
    data: {
      name: `${VERTRETUNG_ROOM_PREFIX} - ${krankerMitarbeiter.firstName} ${krankerMitarbeiter.lastName}`,
      type: 'SYSTEM',
      isSystem: true,
      description: `Krankmeldung ohne automatische Vorschläge`,
      relatedEntityType: 'SICK_LEAVE',
      relatedEntityId: vacationId,
      members: {
        create: adminUserIds.map(id => ({ userId: id, role: 'OWNER' })),
      },
    },
  });

  await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: null,
      content: `🚑 **Krankmeldung eingegangen**

**Mitarbeiter:** ${krankerMitarbeiter.firstName} ${krankerMitarbeiter.lastName} (${krankerMitarbeiter.employeeNumber})
**Zeitraum:** ${new Date(startDate).toLocaleDateString('de-DE')} - ${new Date(endDate).toLocaleDateString('de-DE')}

⚠️ **Keine automatischen Vertretungsvorschläge gefunden.**

Bitte manuell eine Vertretung suchen und zuweisen.`,
      isSystem: true,
    },
  });

  console.log(`[VertretungEvents] Vertretungs-Chat ohne Vorschläge erstellt: ${room.id}`);
  return room;
}

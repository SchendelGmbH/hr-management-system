/**
 * WorkSiteEventHandler - Automatischer Baustellen-Chat
 * 
 * Features:
 * - baustelle.created -> Auto-Chatroom erstellen
 * - baustelle.assigned -> Mitarbeiter zum Chat hinzufügen
 * - /material <menge> <name> -> Material-Anfrage
 * - /checkin -> Check-in per Chat
 * - /checkout -> Check-out per Chat
 */

import { eventBus } from '../EventBus';
import prisma from '@/lib/prisma';

const WELCOME_MESSAGE_TEMPLATE = `🏗️ Willkommen auf der Baustelle!

Hier könnt ihr euch abstimmen, Material anfragen und Check-in/out machen.

**Verfügbare Befehle:**
• \`/material <Menge> <Bezeichnung>\` - Material anfragen
  Beispiel: \`/material 50 Ziegel\`
• \`/checkin\` - Baustellen-Check-in
• \`/checkout\` - Baustellen-Check-out
• \`/status\` - Zeigt wer aktuell eingecheckt ist

Viel Erfolg! 💪`;

export function initializeWorkSiteEventHandlers() {
  console.log('[WorkSiteEvents] Initialisiere Event-Handler...');

  // 1. Bei Baustellen-Anlage: Auto-Chatroom erstellen
  eventBus.subscribe(
    'baustelle.created',
    async (event) => {
      console.log('[WorkSiteEvents] baustelle.created empfangen:', event.payload);
      
      const { workSiteId, name, location, createdBy } = event.payload;
      
      if (!workSiteId) {
        console.error('[WorkSiteEvents] Keine workSiteId im Event');
        return;
      }

      try {
        await createWorkSiteChatRoom(workSiteId, name, location, createdBy);
        console.log(`[WorkSiteEvents] Baustellen-Chat für "${name}" erstellt`);
      } catch (error) {
        console.error('[WorkSiteEvents] Fehler beim Erstellen des Baustellen-Chats:', error);
      }
    },
    { priority: 'normal' }
  );

  // 2. Bei Einsatzplanung: Mitarbeiter zum Chat hinzufügen
  eventBus.subscribe(
    'baustelle.assigned',
    async (event) => {
      console.log('[WorkSiteEvents] baustelle.assigned empfangen:', event.payload);
      
      const { workSiteId, employeeId, employeeName, assignmentId, planDate } = event.payload;
      
      if (!workSiteId || !employeeId) {
        console.error('[WorkSiteEvents] Fehlende workSiteId oder employeeId im Event');
        return;
      }

      try {
        await addEmployeeToWorkSiteChat(workSiteId, employeeId, employeeName, planDate);
        console.log(`[WorkSiteEvents] Mitarbeiter ${employeeName || employeeId} zu Chat hinzugefügt`);
      } catch (error) {
        console.error('[WorkSiteEvents] Fehler beim Hinzufügen zum Chat:', error);
      }
    },
    { priority: 'normal' }
  );

  // 3. Chat-Befehle verarbeiten
  eventBus.subscribe(
    'chat.message.received',
    async (event) => {
      const { roomId, senderId, content, messageId } = event.payload;
      
      if (!content || !content.startsWith('/')) {
        return; // Kein Befehl
      }

      try {
        await handleChatCommand(roomId, senderId, content, messageId);
      } catch (error) {
        console.error('[WorkSiteEvents] Fehler bei Chat-Befehl:', error);
      }
    },
    { priority: 'high' }
  );

  console.log('[WorkSiteEvents] Event-Handler registriert');
}

/**
 * Erstellt einen Chat-Raum für eine Baustelle
 */
async function createWorkSiteChatRoom(
  workSiteId: string,
  name: string,
  location: string | null,
  createdBy?: string
) {
  // Prüfe ob bereits ein Chat für diese Baustelle existiert
  const existingRoom = await prisma.chatRoom.findFirst({
    where: {
      type: 'WORKSITE',
      relatedEntityType: 'WorkSite',
      relatedEntityId: workSiteId,
    },
  });

  if (existingRoom) {
    console.log('[WorkSiteEvents] Baustellen-Chat existiert bereits');
    return existingRoom;
  }

  // Erstelle Chat-Raum
  const roomName = `🏗️ ${name}${location ? ` - ${location}` : ''}`;
  const room = await prisma.chatRoom.create({
    data: {
      name: roomName,
      type: 'WORKSITE',
      isSystem: true,
      description: `Baustellen-Chat für ${name}`,
      relatedEntityType: 'WorkSite',
      relatedEntityId: workSiteId,
      createdBy: createdBy || null,
    },
  });

  // Sende Willkommensnachricht
  await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: null, // System message
      content: WELCOME_MESSAGE_TEMPLATE,
      isSystem: true,
    },
  });

  // Emit Event
  eventBus.emit('baustelle.chat.created', {
    roomId: room.id,
    workSiteId,
    name,
  });

  return room;
}

/**
 * Fügt einen Mitarbeiter dem Baustellen-Chat hinzu
 */
async function addEmployeeToWorkSiteChat(
  workSiteId: string,
  employeeId: string,
  employeeName?: string,
  planDate?: string
) {
  // Finde den Baustellen-Chat
  const chatRoom = await prisma.chatRoom.findFirst({
    where: {
      relatedEntityType: 'WorkSite',
      relatedEntityId: workSiteId,
      type: 'WORKSITE',
    },
  });

  if (!chatRoom) {
    console.log('[WorkSiteEvents] Kein Chat für diese Baustelle gefunden');
    return;
  }

  // Finde den User des Mitarbeiters
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });

  if (!employee?.user) {
    console.log(`[WorkSiteEvents] Mitarbeiter ${employeeId} hat kein User-Account`);
    return;
  }

  const userId = employee.user.id;

  // Prüfe ob User bereits Mitglied ist
  const existingMembership = await prisma.chatMember.findUnique({
    where: {
      roomId_userId: {
        roomId: chatRoom.id,
        userId: userId,
      },
    },
  });

  if (existingMembership) {
    console.log(`[WorkSiteEvents] User ist bereits Mitglied im Chat`);
    return;
  }

  // Füge User als Mitglied hinzu
  await prisma.chatMember.create({
    data: {
      roomId: chatRoom.id,
      userId: userId,
      role: 'MEMBER',
    },
  });

  // Sende Join-Nachricht
  const displayName = employeeName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Mitarbeiter';
  const dateText = planDate ? ` für den ${new Date(planDate).toLocaleDateString('de-DE')}` : '';
  
  await prisma.chatMessage.create({
    data: {
      roomId: chatRoom.id,
      senderId: null, // System
      content: `👋 ${displayName} wurde der Baustelle zugewiesen${dateText} und ist diesem Chat beigetreten.`,
      isSystem: true,
    },
  });

  // Emit Event
  eventBus.emit('baustelle.chat.member.added', {
    roomId: chatRoom.id,
    workSiteId,
    employeeId,
    userId,
  });
}

/**
 * Verarbeitet Chat-Befehle
 */
async function handleChatCommand(
  roomId: string,
  senderId: string,
  content: string,
  messageId: string
) {
  const [command, ...args] = content.trim().split(/\s+/);
  const lowerCommand = command.toLowerCase();

  // Prüfe ob dies ein Baustellen-Chat ist
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      members: {
        where: { userId: senderId },
      },
    },
  });

  if (!room || room.type !== 'WORKSITE') {
    return; // Kein Baustellen-Chat, ignoriere Befehle
  }

  // Hole Sender-Info
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    include: { employee: true },
  });

  const senderName = sender?.employee 
    ? `${sender.employee.firstName || ''} ${sender.employee.lastName || ''}`.trim() 
    : sender?.username || 'Unbekannt';

  switch (lowerCommand) {
    case '/material':
      await handleMaterialRequest(roomId, senderId, senderName, args);
      break;
    case '/checkin':
      await handleCheckIn(roomId, senderId, senderName, room.relatedEntityId);
      break;
    case '/checkout':
      await handleCheckOut(roomId, senderId, senderName);
      break;
    case '/status':
      await handleStatus(roomId, senderId, room.relatedEntityId);
      break;
  }
}

/**
 * Verarbeitet Material-Anfragen (/material 50 Ziegel)
 */
async function handleMaterialRequest(
  roomId: string,
  senderId: string,
  senderName: string,
  args: string[]
) {
  if (args.length < 2) {
    await sendSystemMessage(roomId, 
      `⚠️ @${senderName} Bitte gib Menge UND Material an.\nBeispiel: /material 50 Ziegel`
    );
    return;
  }

  const amount = args[0];
  const material = args.slice(1).join(' ');

  // Validiere Menge
  if (!/^\d+$/.test(amount) || parseInt(amount) <= 0) {
    await sendSystemMessage(roomId, 
      `⚠️ @${senderName} "${amount}" ist keine gültige Menge. Bitte gib eine Zahl an.`
    );
    return;
  }

  // Erstelle Material-Anfrage-Nachricht
  const materialRequest = await prisma.chatMessage.create({
    data: {
      roomId,
      senderId,
      content: `📦 **Material-Anfrage**\n${amount}x ${material}\nVon: ${senderName}`,
      isSystem: false,
    },
  });

  // Sende Bestätigung
  await sendSystemMessage(roomId, 
    `✅ Material-Anfrage von @${senderName} wurde erfasst: ${amount}x ${material}\n\n⏳ Warte auf Bestätigung...`
  );

  // Emit Event für externe Handlers (z.B. für E-Mail-Benachrichtigungen)
  eventBus.emit('baustelle.material.requested', {
    roomId,
    messageId: materialRequest.id,
    senderId,
    senderName,
    amount: parseInt(amount),
    material,
    requestedAt: new Date().toISOString(),
  });
}

/**
 * Verarbeitet Check-in (/checkin)
 */
async function handleCheckIn(
  roomId: string,
  senderId: string,
  senderName: string,
  workSiteId?: string | null
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Prüfe ob bereits eingecheckt
  const existingCheckIn = await prisma.workSiteCheckIn.findFirst({
    where: {
      userId: senderId,
      workSiteId: workSiteId || undefined,
      date: today,
      checkedOutAt: null,
    },
  });

  if (existingCheckIn) {
    await sendSystemMessage(roomId, 
      `ℹ️ @${senderName} Du bist bereits eingecheckt seit ${existingCheckIn.checkedInAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.`
    );
    return;
  }

  // Erstelle Check-in
  const checkIn = await prisma.workSiteCheckIn.create({
    data: {
      userId: senderId,
      workSiteId: workSiteId || null,
      date: today,
      checkedInAt: new Date(),
    },
  });

  // Sende Bestätigung
  const time = checkIn.checkedInAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  await sendSystemMessage(roomId, 
    `✅ @${senderName} hat sich um **${time}** eingecheckt. 🎉`
  );

  // Emit Event
  eventBus.emit('baustelle.checkin', {
    roomId,
    checkInId: checkIn.id,
    userId: senderId,
    userName: senderName,
    workSiteId,
    timestamp: checkIn.checkedInAt.toISOString(),
  });
}

/**
 * Verarbeitet Check-out (/checkout)
 */
async function handleCheckOut(
  roomId: string,
  senderId: string,
  senderName: string
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Finde offenen Check-in
  const openCheckIn = await prisma.workSiteCheckIn.findFirst({
    where: {
      userId: senderId,
      checkedOutAt: null,
    },
    orderBy: { checkedInAt: 'desc' },
  });

  if (!openCheckIn) {
    await sendSystemMessage(roomId, 
      `⚠️ @${senderName} Du bist aktuell an keiner Baustelle eingecheckt.`
    );
    return;
  }

  // Update Check-out
  const checkOutTime = new Date();
  const updatedCheckIn = await prisma.workSiteCheckIn.update({
    where: { id: openCheckIn.id },
    data: { checkedOutAt: checkOutTime },
  });

  // Berechne Arbeitszeit
  const checkInTime = new Date(updatedCheckIn.checkedInAt);
  const durationMs = checkOutTime.getTime() - checkInTime.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  // Sende Bestätigung
  const timeOut = checkOutTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  await sendSystemMessage(roomId, 
    `👋 @${senderName} hat sich um **${timeOut}** ausgecheckt.\n⏱️ Arbeitszeit: ${durationHours}h ${durationMinutes}min`
  );

  // Emit Event
  eventBus.emit('baustelle.checkout', {
    roomId,
    checkInId: openCheckIn.id,
    userId: senderId,
    userName: senderName,
    workSiteId: openCheckIn.workSiteId,
    timestamp: checkOutTime.toISOString(),
    durationMinutes: Math.floor(durationMs / (1000 * 60)),
  });
}

/**
 * Zeigt den aktuellen Status (/status)
 */
async function handleStatus(
  roomId: string,
  senderId: string,
  workSiteId?: string | null
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Finde alle eingecheckten User
  const checkedInUsers = await prisma.workSiteCheckIn.findMany({
    where: {
      workSiteId: workSiteId || undefined,
      date: today,
      checkedOutAt: null,
    },
    include: {
      user: {
        include: {
          employee: true,
        },
      },
    },
    orderBy: { checkedInAt: 'asc' },
  });

  if (checkedInUsers.length === 0) {
    await sendSystemMessage(roomId, `📋 Aktuell ist niemand auf der Baustelle eingecheckt.`);
    return;
  }

  // Erstelle Status-Liste
  const userList = checkedInUsers.map((checkIn, index) => {
    const name = checkIn.user.employee 
      ? `${checkIn.user.employee.firstName || ''} ${checkIn.user.employee.lastName || ''}`.trim()
      : checkIn.user.username;
    const time = new Date(checkIn.checkedInAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `${index + 1}. ${name} (seit ${time})`;
  }).join('\n');

  await sendSystemMessage(roomId, 
    `📋 **Aktuell eingecheckt** (${checkedInUsers.length}):\n\n${userList}`
  );
}

/**
 * Hilfsfunktion: Sendet eine System-Nachricht
 */
async function sendSystemMessage(roomId: string, content: string) {
  return prisma.chatMessage.create({
    data: {
      roomId,
      senderId: null,
      content,
      isSystem: true,
    },
  });
}
/**
 * ChatEventHandler - Automatischer Willkommenschat für neue Mitarbeiter
 * 
 * subscribed: hr.employee.created -> Erstellt automatischen Welcome-Chat
 */

import { eventBus } from '../EventBus';
import prisma from '@/lib/prisma';

const WELCOME_ROOM_NAME = 'Willkommen 👋';
const WELCOME_MESSAGE = `Willkommen im Team! 🎉

Hier hast du einen direkten Kanal, um jederzeit Fragen zu stellen oder dich mit HR auszutauschen.

Falls du Hilfe bei:
• Arbeitskleidung (Bekleidungsbudget)
• Urlaub beantragen
• Dokumenten einreichen
• Qualifikationen hinterlegen

...benötigst, einfach hier schreiben!

Dein HR-Team`;

export function initializeChatEventHandlers() {
  console.log('[ChatEvents] Initialisiere Event-Handler...');

  // Subscribe to new employee creation
  eventBus.subscribe(
    'hr.employee.created',
    async (event) => {
      console.log('[ChatEvents] hr.employee.created empfangen:', event.payload);
      
      const { employeeId, employeeNumber, firstName, lastName, email } = event.payload;
      
      if (!employeeId) {
        console.error('[ChatEvents] Keine employeeId im Event');
        return;
      }

      try {
        await createWelcomeChat(employeeId, firstName, lastName, email);
        console.log(`[ChatEvents] Willkommenschat für ${firstName} ${lastName} erstellt`);
      } catch (error) {
        console.error('[ChatEvents] Fehler beim Erstellen des Willkommenschat:', error);
      }
    },
    { priority: 'normal' }
  );

  console.log('[ChatEvents] Event-Handler registriert');
}

async function createWelcomeChat(
  employeeId: string,
  firstName: string | null,
  lastName: string | null,
  email: string | null
) {
  // Find or create system user for HR (erster Admin-User)
  const hrUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    take: 1,
    select: { id: true },
  });

  const hrUserId = hrUsers[0]?.id;
  
  // Get employee's user account
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });

  if (!employee?.user) {
    console.log('[ChatEvents] Mitarbeiter hat noch kein User-Account, überspringe...');
    return;
  }

  const employeeUserId = employee.user.id;

  // Check if welcome room already exists for this employee
  const existingRoom = await prisma.chatRoom.findFirst({
    where: {
      type: 'SYSTEM',
      relatedEntityType: 'Employee',
      relatedEntityId: employeeId,
    },
  });

  if (existingRoom) {
    console.log('[ChatEvents] Willkommenschat existiert bereits');
    return;
  }

  // Create welcome chat room
  const room = await prisma.chatRoom.create({
    data: {
      name: WELCOME_ROOM_NAME,
      type: 'SYSTEM',
      isSystem: true,
      description: `Willkommenschat für ${firstName || ''} ${lastName || ''}`,
      relatedEntityType: 'Employee',
      relatedEntityId: employeeId,
      members: {
        create: [
          { userId: employeeUserId, role: 'MEMBER' },
          ...(hrUserId && hrUserId !== employeeUserId ? [{ userId: hrUserId, role: 'OWNER' }] : []),
        ],
      },
    },
  });

  // Send welcome message
  await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: null, // System message
      content: WELCOME_MESSAGE,
      isSystem: true,
    },
  });

  // Also send personalized welcome
  const displayName = firstName || lastName || 'neue:r Mitarbeiter:in';
  await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: hrUserId,
      content: `Hallo ${displayName}! Schön, dass du da bist. Bei Fragen melde dich einfach hier ❤️`,
    },
  });

  // Emit event forrealtime notification
  eventBus.emit('chat.welcome.sent', {
    roomId: room.id,
    employeeId,
    employeeUserId,
  });

  return room;
}
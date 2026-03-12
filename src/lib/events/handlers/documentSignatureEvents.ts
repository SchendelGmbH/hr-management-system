/**
 * DocumentSignatureEventHandler - Dokumenten-Signatur Workflow
 * 
 * Features:
 * - /sign <dokument.pdf> [@user] - Signatur-Anfrage im Chat
 * - Workflow: Anfrage → Genehmigung → Signatur
 * - PDF-Vorschau im Chat
 * - Benachrichtigungen bei Status-Änderungen
 */

import { eventBus } from '../EventBus';
import prisma from '@/lib/prisma';

export function initializeDocumentSignatureEventHandlers() {
  console.log('[DocumentSignatureEvents] Initialisiere Event-Handler...');

  // Chat-Befehl /sign verarbeiten
  eventBus.subscribe(
    'chat.message.received',
    async (event) => {
      const payload = event.payload as { 
        roomId: string; 
        senderId: string; 
        content: string; 
        messageId: string 
      };
      const { roomId, senderId, content } = payload;
      
      if (!content || !content.trim().toLowerCase().startsWith('/sign')) {
        return; // Kein Signatur-Befehl
      }

      try {
        await handleSignCommand(roomId, senderId, content, payload.messageId);
      } catch (error) {
        console.error('[DocumentSignatureEvents] Fehler bei /sign Befehl:', error);
      }
    },
    { priority: 'high' }
  );

  // Signatur-Workflow Events
  eventBus.subscribe(
    'document.signature.requested',
    async (event) => {
      const payload = event.payload as { 
        requestId: string; 
        roomId?: string | null; 
      };
      const { requestId, roomId } = payload;
      console.log(`[DocumentSignatureEvents] Signatur-Anfrage erstellt: ${requestId}`);
      
      // Sende Benachrichtigung an Empfänger (roomId wird verwendet)
      if (roomId) {
        console.log(`[DocumentSignatureEvents] Anfrage im Raum: ${roomId}`);
      }
      await notifySignatureRequested(requestId);
    },
    { priority: 'normal' }
  );

  eventBus.subscribe(
    'document.signature.approved',
    async (event) => {
      const payload = event.payload as { requestId: string };
      console.log(`[DocumentSignatureEvents] Anfrage genehmigt: ${payload.requestId}`);
      await notifySignatureApproved(payload.requestId);
    },
    { priority: 'normal' }
  );

  eventBus.subscribe(
    'document.signature.signed',
    async (event) => {
      const payload = event.payload as { 
        requestId: string; 
        signatureId: string 
      };
      console.log(`[DocumentSignatureEvents] Dokument signiert: ${payload.requestId}`);
      await notifySigned(payload.requestId, payload.signatureId);
    },
    { priority: 'normal' }
  );

  console.log('[DocumentSignatureEvents] Event-Handler registriert');
}

/**
 * Verarbeitet /sign Chat-Befehl
 * Format: /sign <Dateiname.pdf> [@Benutzer]
 */
async function handleSignCommand(
  roomId: string,
  senderId: string,
  content: string,
  _messageId: string
) {
  // Parse Befehl
  const args = content.trim().split(/\s+/);
  
  if (args.length < 2) {
    await sendSystemMessage(roomId, 
      `⚠️ **Falsche Syntax**
\`/sign <Dateiname.pdf> [@Benutzer]\`
Beispiel: \`/sign Vertrag.pdf @max\``
    );
    return;
  }

  const fileName = args[1];
  const mentions = content.match(/@(\w+)/g);
  const mentionedUsernames = mentions ? mentions.map(m => m.substring(1)) : [];

  // Finde Dokument anhand des Namens
  const document = await prisma.document.findFirst({
    where: {
      fileName: fileName,
      isContainer: false,
    },
    include: {
      employee: true,
      parent: true,
    },
  });

  if (!document) {
    await sendSystemMessage(roomId, 
      `⚠️ Dokument "${fileName}" nicht gefunden. Bitte überprüfe den Dateinamen.`
    );
    return;
  }

  // Hole Sender-Info
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    include: { employee: true },
  });

  const senderName = sender?.employee 
    ? `${sender.employee.firstName || ''} ${sender.employee.lastName || ''}`.trim() 
    : sender?.username || 'Unbekannt';

  // Bestimme Empfänger (erwähnte User oder Dokumenten-Besitzer)
  let recipients: { id: string; name: string }[] = [];
  
  if (mentionedUsernames.length > 0) {
    // Suche erwähnte Users
    const mentionedUsers = await prisma.user.findMany({
      where: {
        OR: mentionedUsernames.map(username => ({
          username: { equals: username, mode: 'insensitive' },
        })),
      },
      include: { employee: true },
    });
    
    recipients = mentionedUsers.map(u => ({
      id: u.id,
      name: u.employee 
        ? `${u.employee.firstName} ${u.employee.lastName}`
        : u.username,
    }));
  }

  // Wenn niemand erwähnt wurde, verwende Dokumenten-Besitzer
  if (recipients.length === 0 && document.employee) {
    const ownerUser = await prisma.user.findFirst({
      where: { employee: { id: document.employee.id } },
    });
    
    if (ownerUser) {
      recipients.push({
        id: ownerUser.id,
        name: `${document.employee.firstName} ${document.employee.lastName}`,
      });
    }
  }

  if (recipients.length === 0) {
    await sendSystemMessage(roomId, 
      `⚠️ Kein Empfänger gefunden. Bitte erwähne einen User: \`/sign ${fileName} @benutzername\``
    );
    return;
  }

  // Erstelle Signatur-Anfrage
  const signatureRequest = await prisma.documentSignatureRequest.create({
    data: {
      documentId: document.id,
      title: `Signatur-Anfrage: ${fileName}`,
      message: `${senderName} bittet um Unterschrift für "${fileName}"`,
      createdById: senderId,
      roomId: roomId,
      status: 'PENDING',
    },
  });

  // Füge Empfänger als Teilnehmer hinzu
  for (const recipient of recipients) {
    await prisma.documentSignatureParticipant.create({
      data: {
        requestId: signatureRequest.id,
        userId: recipient.id,
        role: 'SIGNER',
      },
    });

    // Erstelle Benachrichtigung
    await prisma.notification.create({
      data: {
        userId: recipient.id,
        type: 'SIGNATURE_REQUESTED',
        title: 'Signatur-Anfrage',
        message: `${senderName} bittet dich um Unterschrift für "${fileName}"`,
        relatedEntityType: 'DocumentSignatureRequest',
        relatedEntityId: signatureRequest.id,
      },
    });
  }

  // Sende Bestätigung im Chat
  const recipientNames = recipients.map(r => `@${r.name}`).join(', ');
  await sendSystemMessage(roomId, 
    `✅ **Signatur-Anfrage erstellt**

📄 ${fileName}
👤 An: ${recipientNames}
👋 Von: ${senderName}

⏳ Warten auf Genehmigung...`
  );

  // Sende Event
  eventBus.emit('document.signature.requested', {
    requestId: signatureRequest.id,
    documentId: document.id,
    roomId,
    senderId,
    recipients: recipients.map(r => r.id),
  });
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

/**
 * Benachrichtigung bei neuer Signatur-Anfrage
 */
async function notifySignatureRequested(requestId: string) {
  const request = await prisma.documentSignatureRequest.findUnique({
    where: { id: requestId },
    include: {
      document: {
        include: { employee: true },
      },
      participants: true,
    },
  });

  if (!request) return;

  // Finde Chat-Raum für Status-Update
  const roomId = request.roomId;
  if (!roomId) return;

  // Nur anzeigen, wenn noch keine Genehmigung erforderlich
  // (Workflow könnte erweitert werden um Approver)
}

/**
 * Benachrichtigung bei Genehmigung
 */
async function notifySignatureApproved(requestId: string) {
  const request = await prisma.documentSignatureRequest.findUnique({
    where: { id: requestId },
    include: {
      createdBy: { include: { employee: true } },
      document: true,
      participants: {
        where: { role: 'SIGNER' },
        include: { user: { include: { employee: true } } },
      },
    },
  });

  if (!request || !request.roomId) return;

  // Creator-Info für zukünftige Erweiterungen
  // const creatorName = request.createdBy.employee
  //   ? `${request.createdBy.employee.firstName} ${request.createdBy.employee.lastName}`
  //   : request.createdBy.username;

  const signerNames = request.participants
    .map(p => p.user.employee 
      ? `${p.user.employee.firstName} ${p.user.employee.lastName}` 
      : p.user.username
    )
    .join(', ');

  await sendSystemMessage(request.roomId, 
    `✅ **Signatur-Anfrage genehmigt**\n\n📄 ${request.document.fileName || 'Dokument'}\n✍️ Warte auf Unterschrift von: ${signerNames}\n\n[Zur Signatur](/sign/${requestId})`
  );
}

/**
 * Benachrichtigung bei erfolgreicher Unterschrift
 */
async function notifySigned(requestId: string, _signatureId: string) {
  const request = await prisma.documentSignatureRequest.findUnique({
    where: { id: requestId },
    include: {
      createdBy: { include: { employee: true } },
      document: true,
      signatures: {
        include: { signer: { include: { employee: true } } },
      },
    },
  });

  if (!request || !request.roomId) return;

  const signer = request.signatures[0]?.signer;
  const signerName = signer?.employee
    ? `${signer.employee.firstName} ${signer.employee.lastName}`
    : signer?.username || 'Unbekannt';

  await sendSystemMessage(request.roomId, 
    `🎉 **Dokument signiert!**

📄 ${request.document.fileName || 'Dokument'}
✍️ Unterzeichnet von: ${signerName}
⏰ Am: ${new Date().toLocaleString('de-DE')}

✅ Der Workflow ist abgeschlossen.`
  );
}

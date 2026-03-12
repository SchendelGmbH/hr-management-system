/**
 * Notification System für Shift Swap Events
 * Erstellt automatisch Benachrichtigungen bei relevanten Swap-Aktionen
 */

import { prisma } from './prisma';
import { emitEvent } from './eventBus';

interface NotificationData {
  type: 'SHIFT_SWAP' | 'SHIFT_SWAP_RESPONSE' | 'SHIFT_SWAP_APPROVED' | 'SHIFT_SWAP_COMPLETED';
  title: string;
  message: string;
  recipientId: string;
  relatedEntityType: string;
  relatedEntityId: string;
  link?: string;
}

/**
 * Erstellt eine neue Benachrichtigung
 */
export async function createNotification(data: NotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.recipientId,
        type: data.type as any,
        title: data.title,
        message: data.message,
        isRead: false,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
      },
    });

    // Emit event für Realtime-Updates
    emitEvent('NOTIFICATION_CREATED', {
      notificationId: notification.id,
      recipientId: data.recipientId,
      type: data.type,
    });

    return notification;
  } catch (error) {
    console.error('[Notification] Failed to create notification:', error);
    throw error;
  }
}

/**
 * Benachrichtigung bei neuer Swap-Anfrage
 */
export async function notifySwapRequested(
  requesterName: string,
  requestedId: string,
  swapId: string,
  date: Date
) {
  await createNotification({
    type: 'SHIFT_SWAP',
    title: 'Neue Tauschanfrage',
    message: `${requesterName} möchte am ${formatDate(date)} mit Ihnen tauschen.`,
    recipientId: requestedId,
    relatedEntityType: 'ShiftSwap',
    relatedEntityId: swapId,
    link: '/swaps',
  });
}

/**
 * Benachrichtigung bei neuer Swap-Antwort
 */
export async function notifySwapResponse(
  responderName: string,
  requesterId: string,
  swapId: string,
  date: Date
) {
  await createNotification({
    type: 'SHIFT_SWAP_RESPONSE',
    title: 'Antwort auf Tauschanfrage',
    message: `${responderName} hat auf Ihre Tauschanfrage vom ${formatDate(date)} geantwortet.`,
    recipientId: requesterId,
    relatedEntityType: 'ShiftSwap',
    relatedEntityId: swapId,
    link: '/swaps',
  });
}

/**
 * Benachrichtigung bei Genehmigung
 */
export async function notifySwapApproved(
  approverName: string | null,
  recipientId: string,
  swapId: string,
  date: Date,
  isApproved: boolean
) {
  await createNotification({
    type: 'SHIFT_SWAP_APPROVED',
    title: isApproved ? 'Tausch genehmigt' : 'Tausch abgelehnt',
    message: isApproved
      ? `Ihr Tausch vom ${formatDate(date)} wurde${approverName ? ` von ${approverName}` : ''} genehmigt.`
      : `Ihr Tausch vom ${formatDate(date)} wurde${approverName ? ` von ${approverName}` : ''} abgelehnt.`,
    recipientId,
    relatedEntityType: 'ShiftSwap',
    relatedEntityId: swapId,
    link: '/swaps',
  });
}

/**
 * Benachrichtigung bei abgeschlossenem Tausch
 */
export async function notifySwapCompleted(
  swapId: string,
  affectedEmployeeIds: string[],
  date: Date
) {
  for (const employeeId of affectedEmployeeIds) {
    await createNotification({
      type: 'SHIFT_SWAP_COMPLETED',
      title: 'Schichttausch abgeschlossen',
      message: `Ihr Schichttausch vom ${formatDate(date)} wurde ausgeführt. Ihre Schichtänderung ist jetzt wirksam.`,
      recipientId: employeeId,
      relatedEntityType: 'ShiftSwap',
      relatedEntityId: swapId,
      link: '/my-schedule',
    });
  }
}

/**
 * Formatiert ein Datum für Benachrichtigungen
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Lädt ungelesene Benachrichtigungen für einen User
 */
export async function getUnreadNotifications(userId: string, limit: number = 10) {
  return prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Markiert Benachrichtigungen als gelesen
 */
export async function markNotificationsAsRead(notificationIds: string[]) {
  return prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

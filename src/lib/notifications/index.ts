/**
 * Extended Notification System
 * Provides: Real-time socket notifications, push notifications, settings, and history
 */

import { prisma } from '@/lib/prisma';
import { getSocketIO } from '@/app/api/socket/route';
import type { NotificationType, NotificationPriority } from '@prisma/client';

// Re-export types
export type { NotificationType, NotificationPriority };

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionUrl?: string;
  imageUrl?: string;
  expiresAt?: Date;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
  data?: Record<string, unknown>;
}

// ==========================================
// Core Notification Service
// ==========================================

/**
 * Create and send a notification to a user
 * This handles in-app, socket, and push notifications based on user preferences
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const {
    userId,
    type,
    title,
    message,
    priority = 'NORMAL',
    relatedEntityType,
    relatedEntityId,
    actionUrl,
    imageUrl,
    expiresAt,
  } = payload;

  // Get user notification settings
  const settings = await getUserNotificationSettings(userId);
  const typeSettings = settings?.typeSettings.find(s => s.notificationType === type);

  // Check if this notification type is muted
  if (typeSettings?.muted || (typeSettings?.mutedUntil && typeSettings.mutedUntil > new Date())) {
    console.log(`[Notification] Type ${type} is muted for user ${userId}`);
    return;
  }

  // Check do-not-disturb
  const isDNDActive = await checkDoNotDisturb(settings);
  const effectivePriority = typeSettings?.priority || priority;

  // Determine delivery channels
  const channels: ('IN_APP' | 'PUSH' | 'EMAIL')[] = ['IN_APP'];
  
  if (!isDNDActive || effectivePriority === 'URGENT') {
    // Push notifications (respect user settings)
    if (settings?.pushEnabled !== false && typeSettings?.pushEnabled !== false) {
      channels.push('PUSH');
    }
    
    // Email notifications
    if (settings?.emailEnabled && typeSettings?.emailEnabled) {
      channels.push('EMAIL');
    }
  }

  // Create notification in database (always)
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      priority: effectivePriority,
      relatedEntityType,
      relatedEntityId,
      actionUrl,
      imageUrl,
      expiresAt,
      deliveredVia: channels,
    },
  });

  // Send real-time socket notification
  if (channels.includes('IN_APP')) {
    sendSocketNotification(userId, {
      ...notification,
      priority: notification.priority as NotificationPriority,
    });
  }

  // Send push notification
  if (channels.includes('PUSH')) {
    await sendPushNotification(userId, {
      title,
      body: message,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: notification.id,
      requireInteraction: effectivePriority === 'URGENT',
      data: {
        notificationId: notification.id,
        type,
        actionUrl,
        relatedEntityType,
        relatedEntityId,
      },
    });
  }

  // Send email notification
  if (channels.includes('EMAIL')) {
    // TODO: Implement email notification service
    console.log(`[Notification] Email notification queued for ${userId}`);
  }
}

/**
 * Send real-time notification via Socket.IO
 */
function sendSocketNotification(
  userId: string,
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
    actionUrl?: string | null;
    imageUrl?: string | null;
    isRead: boolean;
    createdAt: Date;
  }
): void {
  const io = getSocketIO();
  if (!io) {
    console.warn('[Notification] Socket.IO not initialized');
    return;
  }

  io.to(`user:${userId}`).emit('notification:new', {
    ...notification,
    createdAt: notification.createdAt.toISOString(),
  });

  // Also emit unread count update
  emitUnreadCount(userId);
}

/**
 * Emit unread notification count to user
 */
export async function emitUnreadCount(userId: string): Promise<void> {
  const io = getSocketIO();
  if (!io) return;

  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
      isArchived: false,
    },
  });

  io.to(`user:${userId}`).emit('notification:unread-count', { count });
}

/**
 * Send push notification to all active user devices
 */
async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId,
      isActive: true,
    },
  });

  if (subscriptions.length === 0) {
    console.log(`[Push] No active subscriptions for user ${userId}`);
    return;
  }

  // Web Push configuration would go here
  // For now, we'll emit to socket which can trigger service worker push
  const io = getSocketIO();
  if (io) {
    io.to(`user:${userId}`).emit('push:trigger', payload);
  }

  // Real Web Push implementation would use web-push library
  // This requires VAPID keys configured in environment
  console.log(`[Push] Notification sent to ${subscriptions.length} devices for user ${userId}`);
}

/**
 * Get notification settings for a user (create if not exists)
 */
export async function getUserNotificationSettings(userId: string) {
  let settings = await prisma.notificationSettings.findUnique({
    where: { userId },
    include: { typeSettings: true },
  });

  if (!settings) {
    // Create default settings
    settings = await prisma.notificationSettings.create({
      data: {
        userId,
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        doNotDisturb: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        soundEnabled: true,
        vibrationEnabled: true,
        hideContentInLockScreen: false,
        batchNotifications: false,
        batchIntervalMinutes: 30,
        timezone: 'Europe/Berlin',
      },
      include: { typeSettings: true },
    });
  }

  return settings;
}

/**
 * Check if do-not-disturb is currently active
 */
async function checkDoNotDisturb(settings: { 
  doNotDisturb: boolean; 
  doNotDisturbStart?: string | null; 
  doNotDisturbEnd?: string | null;
  timezone: string;
} | null): Promise<boolean> {
  if (!settings || !settings.doNotDisturb) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const startParts = settings.doNotDisturbStart?.split(':').map(Number) || [22, 0];
  const endParts = settings.doNotDisturbEnd?.split(':').map(Number) || [7, 0];
  
  const startMinutes = startParts[0] * 60 + startParts[1];
  const endMinutes = endParts[0] * 60 + endParts[1];

  if (startMinutes < endMinutes) {
    // Same day range (e.g., 9:00 - 17:00)
    return currentTime >= startMinutes && currentTime <= endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 7:00)
    return currentTime >= startMinutes || currentTime <= endMinutes;
  }
}

// ==========================================
// Batch Notifications
// ==========================================

interface BatchedNotification {
  userId: string;
  title: string;
  count: number;
  notifications: NotificationPayload[];
}

const batchedNotifications = new Map<string, BatchedNotification>();

/**
 * Queue a notification for batching
 */
export function queueBatchedNotification(payload: NotificationPayload): void {
  const settings = getUserNotificationSettings(payload.userId);
  
  settings.then(s => {
    if (!s?.batchNotifications) {
      // Send immediately if batching is disabled
      sendNotification(payload);
      return;
    }

    const key = payload.userId;
    const existing = batchedNotifications.get(key);
    
    if (existing) {
      existing.count++;
      existing.notifications.push(payload);
      existing.title = `${existing.count} neue Benachrichtigungen`;
    } else {
      batchedNotifications.set(key, {
        userId: payload.userId,
        title: '1 neue Benachrichtigung',
        count: 1,
        notifications: [payload],
      });

      // Schedule batch send
      setTimeout(() => {
        sendBatchedNotification(key);
      }, (s.batchIntervalMinutes || 30) * 60 * 1000);
    }
  });
}

/**
 * Send batched notification
 */
async function sendBatchedNotification(key: string): Promise<void> {
  const batch = batchedNotifications.get(key);
  if (!batch || batch.count === 0) return;

  batchedNotifications.delete(key);

  await sendNotification({
    userId: batch.userId,
    type: 'TASK_ASSIGNED', // Using as generic notification type
    title: batch.title,
    message: `${batch.count} neue Benachrichtigungen erhalten`,
    priority: 'NORMAL',
  });
}

// ==========================================
// Push Subscription Management
// ==========================================

/**
 * Register a push subscription for a user
 */
export async function registerPushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceType?: 'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP';
    deviceName?: string;
    platform?: string;
    appVersion?: string;
    timezone?: string;
    language?: string;
  }
): Promise<string> {
  // Generate device ID from endpoint hash
  const deviceId = await hashEndpoint(subscription.endpoint);

  await prisma.pushSubscription.upsert({
    where: { deviceId },
    create: {
      userId,
      deviceId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      deviceType: subscription.deviceType || 'WEB',
      deviceName: subscription.deviceName || 'Unknown Device',
      platform: subscription.platform || 'Web',
      appVersion: subscription.appVersion,
      timezone: subscription.timezone || 'Europe/Berlin',
      language: subscription.language || 'de',
      isActive: true,
      lastUsedAt: new Date(),
    },
    update: {
      userId, // In case device was transferred
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      deviceName: subscription.deviceName || 'Unknown Device',
      appVersion: subscription.appVersion,
      isActive: true,
      lastUsedAt: new Date(),
    },
  });

  return deviceId;
}

/**
 * Unregister a push subscription
 */
export async function unregisterPushSubscription(deviceId: string): Promise<void> {
  await prisma.pushSubscription.updateMany({
    where: { deviceId },
    data: { isActive: false },
  });
}

/**
 * Hash endpoint for device ID
 */
async function hashEndpoint(endpoint: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(endpoint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ==========================================
// Notification Actions
// ==========================================

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });

  await emitUnreadCount(userId);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  await emitUnreadCount(userId);
}

/**
 * Archive a notification
 */
export async function archiveNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isArchived: true, archivedAt: new Date() },
  });

  await emitUnreadCount(userId);
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });

  await emitUnreadCount(userId);
}

/**
 * Get notification history with pagination
 */
export async function getNotificationHistory(
  userId: string,
  options: {
    includeArchived?: boolean;
    onlyUnread?: boolean;
    limit?: number;
    cursor?: string;
    types?: NotificationType[];
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const {
    includeArchived = false,
    onlyUnread = false,
    limit = 50,
    cursor,
    types,
    startDate,
    endDate,
  } = options;

  const where: any = { userId };

  if (!includeArchived) {
    where.isArchived = false;
  }

  if (onlyUnread) {
    where.isRead = false;
  }

  if (types?.length) {
    where.type = { in: types };
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  if (cursor) {
    where.createdAt = { ...where.createdAt, lt: cursor };
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore 
    ? items[items.length - 1]?.createdAt.toISOString() 
    : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

// ==========================================
// Scheduled Cleanup
// ==========================================

/**
 * Clean up old notifications (run periodically via cron)
 */
export async function cleanupOldNotifications(): Promise<{
  deleted: number;
  archived: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Archive notifications older than 30 days
  const archiveResult = await prisma.notification.updateMany({
    where: {
      isArchived: false,
      isRead: true,
      createdAt: { lt: thirtyDaysAgo },
    },
    data: { isArchived: true, archivedAt: new Date() },
  });

  // Delete archived notifications older than 90 days
  const deleteResult = await prisma.notification.deleteMany({
    where: {
      isArchived: true,
      archivedAt: { lt: ninetyDaysAgo },
    },
  });

  return {
    archived: archiveResult.count,
    deleted: deleteResult.count,
  };
}

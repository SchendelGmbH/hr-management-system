import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserNotificationSettings } from '@/lib/notifications';
import type { NotificationType, NotificationPriority } from '@prisma/client';

const VALID_NOTIFICATION_TYPES: NotificationType[] = [
  'DOCUMENT_EXPIRING',
  'DOCUMENT_EXPIRED',
  'LOW_BUDGET',
  'UPCOMING_VACATION',
  'QUALIFICATION_EXPIRING',
  'SHIFT_SWAP',
  'SHIFT_SWAP_RESPONSE',
  'SHIFT_SWAP_APPROVED',
  'SHIFT_SWAP_COMPLETED',
  'TASK_ASSIGNED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'TASK_COMPLETED',
  'SIGNATURE_REQUESTED',
  'SIGNATURE_APPROVED',
  'SIGNATURE_SIGNED',
  'SIGNATURE_REJECTED',
];

// GET /api/notifications/settings - Get user's notification settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getUserNotificationSettings(session.user.id);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Notifications/Settings] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

// PUT /api/notifications/settings - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    // Ensure settings exist
    await getUserNotificationSettings(userId);

    // Update main settings
    const {
      pushEnabled,
      emailEnabled,
      smsEnabled,
      doNotDisturb,
      doNotDisturbStart,
      doNotDisturbEnd,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      batchNotifications,
      batchIntervalMinutes,
      soundEnabled,
      vibrationEnabled,
      hideContentInLockScreen,
      timezone,
      typeSettings,
    } = body;

    // Update global settings
    await prisma.notificationSettings.update({
      where: { userId },
      data: {
        ...(typeof pushEnabled === 'boolean' && { pushEnabled }),
        ...(typeof emailEnabled === 'boolean' && { emailEnabled }),
        ...(typeof smsEnabled === 'boolean' && { smsEnabled }),
        ...(typeof doNotDisturb === 'boolean' && { doNotDisturb }),
        ...(doNotDisturbStart !== undefined && { doNotDisturbStart }),
        ...(doNotDisturbEnd !== undefined && { doNotDisturbEnd }),
        ...(typeof quietHoursEnabled === 'boolean' && { quietHoursEnabled }),
        ...(quietHoursStart !== undefined && { quietHoursStart }),
        ...(quietHoursEnd !== undefined && { quietHoursEnd }),
        ...(typeof batchNotifications === 'boolean' && { batchNotifications }),
        ...(batchIntervalMinutes !== undefined && { batchIntervalMinutes }),
        ...(typeof soundEnabled === 'boolean' && { soundEnabled }),
        ...(typeof vibrationEnabled === 'boolean' && { vibrationEnabled }),
        ...(typeof hideContentInLockScreen === 'boolean' && { hideContentInLockScreen }),
        ...(timezone !== undefined && { timezone }),
      },
    });

    // Update type-specific settings if provided
    if (typeSettings && Array.isArray(typeSettings)) {
      for (const typeSetting of typeSettings) {
        const {
          notificationType,
          inAppEnabled,
          pushEnabled: typePushEnabled,
          emailEnabled: typeEmailEnabled,
          smsEnabled: typeSmsEnabled,
          priority,
          muted,
          mutedUntil,
        } = typeSetting;

        if (!VALID_NOTIFICATION_TYPES.includes(notificationType)) {
          continue;
        }

        await prisma.notificationTypeSettings.upsert({
          where: {
            settingsId_notificationType: {
              settingsId: (await prisma.notificationSettings.findFirst({
                where: { userId },
              }))?.id || '',
              notificationType,
            },
          },
          create: {
            settingsId: (await prisma.notificationSettings.findFirst({
              where: { userId },
            }))?.id || '',
            notificationType,
            inAppEnabled,
            pushEnabled: typePushEnabled,
            emailEnabled: typeEmailEnabled,
            smsEnabled: typeSmsEnabled,
            priority: priority as NotificationPriority | undefined,
            muted,
            mutedUntil: mutedUntil ? new Date(mutedUntil) : null,
          },
          update: {
            ...(typeof inAppEnabled === 'boolean' && { inAppEnabled }),
            ...(typeof typePushEnabled === 'boolean' && { pushEnabled: typePushEnabled }),
            ...(typeof typeEmailEnabled === 'boolean' && { emailEnabled: typeEmailEnabled }),
            ...(typeof typeSmsEnabled === 'boolean' && { smsEnabled: typeSmsEnabled }),
            ...(priority !== undefined && { priority: priority as NotificationPriority }),
            ...(typeof muted === 'boolean' && { muted }),
            ...(mutedUntil !== undefined && { mutedUntil: mutedUntil ? new Date(mutedUntil) : null }),
          },
        });
      }
    }

    // Fetch updated settings
    const updatedSettings = await getUserNotificationSettings(userId);
    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('[Notifications/Settings] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}

// POST /api/notifications/settings - Create or initialize settings
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getUserNotificationSettings(session.user.id);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Notifications/Settings] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize notification settings' },
      { status: 500 }
    );
  }
}
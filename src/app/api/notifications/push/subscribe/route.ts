import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registerPushSubscription, unregisterPushSubscription } from '@/lib/notifications';

// POST /api/notifications/push/subscribe - Register push subscription
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, deviceInfo } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    const deviceId = await registerPushSubscription(session.user.id, {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      deviceType: deviceInfo?.deviceType || 'WEB',
      deviceName: deviceInfo?.deviceName || 'Unknown Device',
      platform: deviceInfo?.platform || 'Web',
      appVersion: deviceInfo?.appVersion,
      timezone: deviceInfo?.timezone,
      language: deviceInfo?.language,
    });

    return NextResponse.json({ success: true, deviceId });
  } catch (error) {
    console.error('[Notifications/Push] Subscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to register push subscription' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/push/subscribe - Unregister push subscription
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (deviceId) {
      await unregisterPushSubscription(deviceId);
    } else {
      // Unregister all devices for this user
      await prisma.pushSubscription.updateMany({
        where: { userId: session.user.id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications/Push] Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to unregister push subscription' },
      { status: 500 }
    );
  }
}
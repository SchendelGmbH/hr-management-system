import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  getNotificationHistory, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  archiveNotification,
  deleteNotification,
  getUserNotificationSettings,
} from '@/lib/notifications';
import type { NotificationType } from '@/lib/notifications';

// GET /api/notifications - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('archived') === 'true';
    const onlyUnread = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const cursor = searchParams.get('cursor') || undefined;
    const typesParam = searchParams.get('types');
    const types = typesParam ? typesParam.split(',') as NotificationType[] : undefined;

    const result = await getNotificationHistory(session.user.id, {
      includeArchived,
      onlyUnread,
      limit,
      cursor,
      types,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Notifications] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notificationId } = body;

    switch (action) {
      case 'mark-read':
        if (notificationId) {
          await markNotificationAsRead(notificationId, session.user.id);
        } else {
          await markAllNotificationsAsRead(session.user.id);
        }
        break;

      case 'archive':
        if (notificationId) {
          await archiveNotification(notificationId, session.user.id);
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID required' },
        { status: 400 }
      );
    }

    await deleteNotification(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
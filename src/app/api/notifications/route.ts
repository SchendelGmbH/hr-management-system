import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/notifications - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const onlyUnread = searchParams.get('unread') === 'true';

    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE "userId" = $1 
       ${onlyUnread ? 'AND "isRead" = false' : ''}
       ORDER BY "createdAt" DESC 
       LIMIT $2`,
      [session.user.id, limit]
    );

    return NextResponse.json({ notifications: result.rows });
  } catch (error) {
    console.error('[API] Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, markAll } = await request.json();

    if (markAll) {
      await pool.query(
        'UPDATE notifications SET "isRead" = true WHERE "userId" = $1',
        [session.user.id]
      );
    } else if (id) {
      await pool.query(
        'UPDATE notifications SET "isRead" = true WHERE id = $1 AND "userId" = $2',
        [id, session.user.id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
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

    if (id) {
      await pool.query(
        'DELETE FROM notifications WHERE id = $1 AND "userId" = $2',
        [id, session.user.id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting notification:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}

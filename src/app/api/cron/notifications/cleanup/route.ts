import { NextResponse } from 'next/server';
import { cleanupOldNotifications } from '@/lib/notifications';

/**
 * Cron job for cleaning up old notifications
 * Run: 0 2 * * * (daily at 2 AM)
 * 
 * This endpoint should be called by a cron service like:
 * - Vercel Cron
 * - GitHub Actions
 * - AWS Lambda
 * - Self-hosted cron
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await cleanupOldNotifications();

    return NextResponse.json({
      success: true,
      archived: result.archived,
      deleted: result.deleted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron/Notifications] Cleanup failed:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
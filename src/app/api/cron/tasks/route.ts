import { NextRequest, NextResponse } from 'next/server';
import { checkOverdueTasks } from '@/lib/taskNotifications';

/**
 * Cron endpoint for checking overdue tasks
 * Call with: GET /api/cron/tasks?token=CRON_SECRET_TOKEN
 * 
 * This should be configured to run once per day via external scheduler
 * (e.g., Vercel Cron, GitHub Actions, or similar)
 */
export async function GET(req: NextRequest) {
  // Verify cron token
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  
  if (token !== process.env.CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await checkOverdueTasks();
    return NextResponse.json({ success: true, message: 'Task notifications checked' });
  } catch (error) {
    console.error('Error checking task notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

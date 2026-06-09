import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const EXPIRY_DAYS = 30;

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'daily_plans', 'view');
  if (authResult.error) return authResult.error;

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - EXPIRY_DAYS);

    // Cleanup: delete stale work sites
    await prisma.workSite.deleteMany({
      where: { lastUsedAt: { lt: cutoff } },
    });

    const workSites = await prisma.workSite.findMany({
      orderBy: { lastUsedAt: 'desc' },
    });

    return NextResponse.json({ workSites });
  } catch (err) {
    console.error('Error fetching work sites:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

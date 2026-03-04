import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const group      = searchParams.get('group');      // INSTRUCTION | CERTIFICATE | TRAINING
  const status     = searchParams.get('status');     // valid | expiring | expired
  const employeeId = searchParams.get('employeeId');

  try {
    const now       = new Date();
    const in60Days  = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (group)      where.type = { group };

    const qualifications = await prisma.qualification.findMany({
      where,
      include: {
        type: true,
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeNumber: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
    });

    // Status filtering
    let filtered = qualifications;
    if (status === 'expired') {
      filtered = qualifications.filter((q) => q.expiresAt && q.expiresAt < now);
    } else if (status === 'expiring') {
      filtered = qualifications.filter(
        (q) => q.expiresAt && q.expiresAt >= now && q.expiresAt <= in60Days
      );
    } else if (status === 'valid') {
      filtered = qualifications.filter((q) => !q.expiresAt || q.expiresAt > in60Days);
    }

    const counts = {
      total:    qualifications.length,
      expiring: qualifications.filter((q) => q.expiresAt && q.expiresAt >= now && q.expiresAt <= in60Days).length,
      expired:  qualifications.filter((q) => q.expiresAt && q.expiresAt < now).length,
    };

    return NextResponse.json({ qualifications: filtered, counts });
  } catch (err) {
    console.error('Error fetching qualifications:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

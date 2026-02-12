import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const employeeId = searchParams.get('employeeId');
  const status = searchParams.get('status'); // all, valid, expiring, expired
  const tagId = searchParams.get('tagId'); // Filter by tag

  try {
    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    // Tag filter
    if (tagId) {
      where.tags = {
        some: {
          tagId: tagId,
        },
      };
    }

    // Status filter
    if (status === 'expired') {
      where.expirationDate = { lt: new Date() };
    } else if (status === 'expiring') {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      where.expirationDate = { gte: now, lte: in30Days };
    } else if (status === 'valid') {
      const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      where.expirationDate = { gt: in90Days };
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        documentType: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        expirationDate: 'asc',
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

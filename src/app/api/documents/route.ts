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
  const categoryId = searchParams.get('categoryId');
  const search = searchParams.get('search');

  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const where: any = {
      // Only containers (one entry per document group)
      isContainer: true,
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (categoryId) {
      where.categories = {
        some: { categoryId },
      };
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
        categories: { include: { category: true } },
        // Latest version for display (inkl. textContent für Volltextsuche)
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { categories: { include: { category: true } } },
        },
        _count: { select: { versions: true } },
      },
      orderBy: { expirationDate: 'asc' },
      take: 100,
    });

    // Apply status filter in-memory using container's effective dates
    let filteredDocuments = documents;
    if (status === 'expired') {
      filteredDocuments = documents.filter(
        (doc) => doc.expirationDate && doc.expirationDate < now
      );
    } else if (status === 'expiring') {
      filteredDocuments = documents.filter(
        (doc) => doc.expirationDate && doc.expirationDate >= now && doc.expirationDate <= in30Days
      );
    } else if (status === 'valid') {
      const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      filteredDocuments = documents.filter(
        (doc) => !doc.expirationDate || doc.expirationDate > in90Days
      );
    }

    // Volltextsuche: In-memory nach Titel (entschlüsselt) und Inhalt der neuesten Version
    if (search) {
      const q = search.toLowerCase();
      filteredDocuments = filteredDocuments.filter((doc) => {
        const titleMatch = (doc.title ?? '').toLowerCase().includes(q);
        const contentMatch = ((doc.versions[0] as any)?.textContent ?? '').toLowerCase().includes(q);
        return titleMatch || contentMatch;
      });
    }

    return NextResponse.json({ documents: filteredDocuments });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

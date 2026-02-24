import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getNextColor } from '@/lib/categoryColors';

// GET /api/documents/[id] - Alle Versionen eines Dokuments abrufen
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Alle Versionen laden: nur echte Versionen (keine Container)
    const versions = await prisma.document.findMany({
      where: {
        parentDocumentId: id,
        isContainer: false,
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        uploader: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        versionNumber: 'asc',
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/documents/[id] - Metadaten eines Dokuments (Container) aktualisieren
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, description, validFrom, expirationDate, notes, categories } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titel ist erforderlich' }, { status: 400 });
    }

    // Kategorien-IDs ermitteln (erstellen falls noch nicht vorhanden)
    const categoryNames: string[] = Array.isArray(categories) ? categories : [];
    const existingColors = (await prisma.category.findMany({ select: { color: true } }))
      .map((c) => c.color)
      .filter(Boolean) as string[];
    const categoryIds: string[] = [];
    for (const categoryName of categoryNames) {
      const trimmedName = categoryName.trim();
      if (!trimmedName) continue;
      let category = await prisma.category.findFirst({
        where: { name: { equals: trimmedName, mode: 'insensitive' } },
      });
      if (!category) {
        const color = getNextColor(existingColors);
        existingColors.push(color);
        category = await prisma.category.create({
          data: { name: trimmedName, color },
        });
      }
      categoryIds.push(category.id);
    }

    const parsedValidFrom = validFrom ? new Date(validFrom) : null;
    const parsedExpiration = expirationDate ? new Date(expirationDate) : null;

    const updateData = {
      title: title.trim(),
      description: description || null,
      validFrom: parsedValidFrom,
      expirationDate: parsedExpiration,
      notes: notes || null,
      categories: {
        deleteMany: {},
        create: categoryIds.map((categoryId) => ({ categoryId })),
      },
    };

    // Container aktualisieren
    await prisma.document.update({
      where: { id },
      data: updateData,
    });

    // Neueste Version ebenfalls aktualisieren
    const latestVersion = await prisma.document.findFirst({
      where: { parentDocumentId: id, isContainer: false },
      orderBy: { versionNumber: 'desc' },
    });

    if (latestVersion) {
      await prisma.document.update({
        where: { id: latestVersion.id },
        data: {
          title: title.trim(),
          description: description || null,
          validFrom: parsedValidFrom,
          expirationDate: parsedExpiration,
          notes: notes || null,
          categories: {
            deleteMany: {},
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Document',
        entityId: id,
        newValues: JSON.stringify({ title, validFrom, expirationDate, categories: categoryNames }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

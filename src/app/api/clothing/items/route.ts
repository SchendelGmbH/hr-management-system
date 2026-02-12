import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// GET /api/clothing/items - Alle Artikel abrufen
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const isActive = searchParams.get('isActive');

  try {
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const items = await prisma.clothingItem.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching clothing items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/clothing/items - Neuen Artikel erstellen
const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  basePrice: z.number().min(0, 'Price must be positive'),
  availableSizes: z.array(z.string()).min(1, 'At least one size is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  sku: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createItemSchema.parse(body);

    // Check if SKU already exists
    if (data.sku) {
      const existing = await prisma.clothingItem.findUnique({
        where: { sku: data.sku },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'SKU already exists', existingItem: existing },
          { status: 400 }
        );
      }
    }

    const item = await prisma.clothingItem.create({
      data: {
        name: data.name,
        description: data.description || null,
        category: data.category,
        basePrice: data.basePrice,
        availableSizes: data.availableSizes,
        imageUrl: data.imageUrl || null,
        sku: data.sku || null,
        isActive: true,
        syncedToWooCommerce: false,
      },
    });

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'ClothingItem',
        entityId: item.id,
        newValues: JSON.stringify({
          name: item.name,
          category: item.category,
          basePrice: item.basePrice,
          sku: item.sku,
        }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating clothing item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

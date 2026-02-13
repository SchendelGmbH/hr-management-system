import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// GET /api/clothing/items/[id] - Einzelnen Artikel abrufen
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
    const item = await prisma.clothingItem.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            order: {
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/clothing/items/[id] - Artikel bearbeiten
const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional(),
  basePrice: z.number().min(0).optional(),
  availableSizes: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional(),
  sku: z.string().optional().nullable(),
});

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
    const data = updateItemSchema.parse(body);

    const oldItem = await prisma.clothingItem.findUnique({ where: { id } });
    if (!oldItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if SKU already exists (and is not the same item)
    if (data.sku) {
      const existing = await prisma.clothingItem.findUnique({
        where: { sku: data.sku },
      });
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: 'SKU already exists', existingItem: existing },
          { status: 400 }
        );
      }
    }

    const item = await prisma.clothingItem.update({
      where: { id },
      data: {
        ...data,
        // Convert empty string to null for optional URL fields
        imageUrl: data.imageUrl === '' ? null : data.imageUrl,
      },
    });

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'ClothingItem',
        entityId: id,
        oldValues: JSON.stringify({
          name: oldItem.name,
          category: oldItem.category,
          basePrice: oldItem.basePrice,
          isActive: oldItem.isActive,
        }),
        newValues: JSON.stringify({
          name: item.name,
          category: item.category,
          basePrice: item.basePrice,
          isActive: item.isActive,
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
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/clothing/items/[id] - Artikel löschen
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Check if item is used in orders
    const orderCount = await prisma.clothingOrderItem.count({
      where: { clothingItemId: id },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete item that is used in orders',
          orderCount,
          suggestion: 'Set item to inactive instead',
        },
        { status: 400 }
      );
    }

    const item = await prisma.clothingItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await prisma.clothingItem.delete({ where: { id } });

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'ClothingItem',
        entityId: id,
        oldValues: JSON.stringify({
          name: item.name,
          category: item.category,
          sku: item.sku,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

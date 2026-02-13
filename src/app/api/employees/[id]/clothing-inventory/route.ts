import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    // Alle Bestellungen des Mitarbeiters mit Items laden
    const orders = await prisma.clothingOrder.findMany({
      where: {
        employeeId: id,
        status: { in: ['DELIVERED', 'ORDERED'] }, // Nur gelieferte oder bestellte
      },
      include: {
        items: {
          include: {
            clothingItem: true,
          },
        },
      },
    });

    // Gruppieren: clothingItemId + size → totalQuantity
    const inventoryMap = new Map<string, {
      clothingItemId: string;
      name: string;
      sku: string | null;
      category: string;
      size: string;
      totalQuantity: number;
      imageUrl: string | null;
    }>();

    for (const order of orders) {
      for (const item of order.items) {
        const key = `${item.clothingItemId}-${item.size}`;

        if (inventoryMap.has(key)) {
          // Menge addieren
          inventoryMap.get(key)!.totalQuantity += item.quantity;
        } else {
          // Neuer Eintrag
          inventoryMap.set(key, {
            clothingItemId: item.clothingItemId,
            name: item.clothingItem.name,
            sku: item.clothingItem.sku,
            category: item.clothingItem.category,
            size: item.size,
            totalQuantity: item.quantity,
            imageUrl: item.clothingItem.imageUrl,
          });
        }
      }
    }

    // Map zu Array konvertieren, sortiert nach Kategorie + Name
    const items = Array.from(inventoryMap.values()).sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching clothing inventory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getNextColor } from '@/lib/categoryColors';

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if category already exists (case-insensitive)
    const existingCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingCategory) {
      return NextResponse.json({ category: existingCategory });
    }

    // Wenn keine Farbe explizit angegeben, nächste freie Farbe aus Palette wählen
    let assignedColor = color;
    if (!assignedColor) {
      const usedColors = (await prisma.category.findMany({ select: { color: true } }))
        .map((c) => c.color)
        .filter(Boolean) as string[];
      assignedColor = getNextColor(usedColors);
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description || null,
        color: assignedColor,
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getNextColor } from '@/lib/categoryColors';

const categorySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

export async function GET(_request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

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
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const data = categorySchema.parse(body);

    // Check if category already exists (case-insensitive)
    const existingCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });

    if (existingCategory) {
      return NextResponse.json({ category: existingCategory });
    }

    // Wenn keine Farbe explizit angegeben, nächste freie Farbe aus Palette wählen
    let assignedColor = data.color;
    if (!assignedColor) {
      const usedColors = (await prisma.category.findMany({ select: { color: true } }))
        .map((c) => c.color)
        .filter(Boolean) as string[];
      assignedColor = getNextColor(usedColors);
    }

    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
        color: assignedColor,
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: error.errors }, { status: 400 });
    }
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

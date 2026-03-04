import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { plate: 'asc' },
    });
    return NextResponse.json({ vehicles });
  } catch (err) {
    console.error('Error fetching vehicles:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { plate, description } = await req.json();

    if (!plate || typeof plate !== 'string' || !plate.trim()) {
      return NextResponse.json({ error: 'Kennzeichen erforderlich' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: plate.trim().toUpperCase(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Kennzeichen bereits vorhanden' }, { status: 409 });
    }
    console.error('Error creating vehicle:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

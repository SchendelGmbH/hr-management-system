import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'vehicles', 'edit');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    const { id } = await params;
    const { plate, description } = await request.json();

    if (!plate || typeof plate !== 'string' || !plate.trim()) {
      return NextResponse.json({ error: 'Kennzeichen erforderlich' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: { plate: plate.trim(), description: description ?? null },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Vehicle',
        entityId: id,
        oldValues: {},
        newValues: JSON.stringify({ plate, description }),
      },
    });

    return NextResponse.json({ vehicle });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Fahrzeug nicht gefunden' }, { status: 404 });
    }
    console.error('Error updating vehicle:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'vehicles', 'delete');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    const { id } = await params;

    await prisma.vehicle.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Fahrzeug nicht gefunden' }, { status: 404 });
    }
    console.error('Error deleting vehicle:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;

    await prisma.vehicle.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Fahrzeug nicht gefunden' }, { status: 404 });
    }
    console.error('Error deleting vehicle:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

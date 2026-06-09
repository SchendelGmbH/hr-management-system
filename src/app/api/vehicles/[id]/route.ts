import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RBAC: Only ADMIN can delete vehicles
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

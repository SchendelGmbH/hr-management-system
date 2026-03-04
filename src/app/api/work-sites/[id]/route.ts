import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    await prisma.workSite.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting work site:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

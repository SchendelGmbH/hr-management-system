import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// DELETE /api/departments/[id]
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
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { employees: true } },
      },
    });

    if (!department) {
      return NextResponse.json({ error: 'Abteilung nicht gefunden' }, { status: 404 });
    }

    if (department._count.employees > 0) {
      return NextResponse.json(
        {
          error: `Abteilung kann nicht gelöscht werden, da ${department._count.employees} Mitarbeiter zugeordnet sind.`,
          employeeCount: department._count.employees,
        },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Department',
        entityId: id,
        oldValues: { name: department.name, description: department.description },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

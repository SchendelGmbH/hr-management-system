import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const departmentSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(_request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const departments = await prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: { select: { employees: true } },
      },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const data = departmentSchema.parse(body);

    const department = await prisma.department.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Department',
        entityId: department.id,
        newValues: JSON.stringify({ name: data.name, description: data.description }),
      },
    });

    return NextResponse.json({ department });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: error.errors }, { status: 400 });
    }
    console.error('Error creating department:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

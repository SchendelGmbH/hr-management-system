import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  recurringIntervalMonths: z.number().int().min(1).max(120).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const existing = await prisma.qualificationType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Typ nicht gefunden' }, { status: 404 });
    }

    // Duplicate name check if name is being changed
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.qualificationType.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          group: existing.group,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Ein Typ mit diesem Namen existiert bereits in dieser Gruppe' },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.qualificationType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.recurringIntervalMonths !== undefined && { recurringIntervalMonths: data.recurringIntervalMonths }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'QualificationType',
        entityId: id,
        newValues: JSON.stringify(data),
      },
    });

    return NextResponse.json({ type: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: err.errors }, { status: 400 });
    }
    console.error('Error updating qualification type:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const type = await prisma.qualificationType.findUnique({
      where: { id },
      include: { _count: { select: { qualifications: true } } },
    });
    if (!type) {
      return NextResponse.json({ error: 'Typ nicht gefunden' }, { status: 404 });
    }
    if (type._count.qualifications > 0) {
      return NextResponse.json(
        { error: `Typ kann nicht gelöscht werden – ${type._count.qualifications} Qualifikation(en) zugewiesen` },
        { status: 409 }
      );
    }

    await prisma.qualificationType.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'QualificationType',
        entityId: id,
        oldValues: JSON.stringify({ name: type.name, group: type.group }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting qualification type:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

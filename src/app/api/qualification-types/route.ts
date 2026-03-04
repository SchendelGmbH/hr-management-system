import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).max(100),
  group: z.enum(['INSTRUCTION', 'CERTIFICATE', 'TRAINING']),
  recurringIntervalMonths: z.number().int().min(1).max(120).nullable().optional(),
});

export async function GET(_request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const types = await prisma.qualificationType.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { qualifications: true } } },
    });

    // Group by QualificationGroup
    const grouped = {
      INSTRUCTION: types.filter((t) => t.group === 'INSTRUCTION'),
      CERTIFICATE: types.filter((t) => t.group === 'CERTIFICATE'),
      TRAINING:    types.filter((t) => t.group === 'TRAINING'),
    };

    return NextResponse.json({ types, grouped });
  } catch (err) {
    console.error('Error fetching qualification types:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    // Duplicate check (case-insensitive within same group)
    const existing = await prisma.qualificationType.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        group: data.group,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Ein Typ mit diesem Namen existiert bereits in dieser Gruppe' },
        { status: 409 }
      );
    }

    const type = await prisma.qualificationType.create({
      data: {
        name: data.name,
        group: data.group,
        recurringIntervalMonths: data.recurringIntervalMonths ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'QualificationType',
        entityId: type.id,
        newValues: JSON.stringify(data),
      },
    });

    return NextResponse.json({ type }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: err.errors }, { status: 400 });
    }
    console.error('Error creating qualification type:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

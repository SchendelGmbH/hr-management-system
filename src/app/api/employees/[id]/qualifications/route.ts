import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  typeId:    z.string().min(1),
  issuedAt:  z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  issuer:    z.string().max(200).optional().nullable(),
  certNumber:z.string().max(100).optional().nullable(),
  notes:     z.string().max(2000).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id: employeeId } = await params;

  try {
    const qualifications = await prisma.qualification.findMany({
      where: { employeeId },
      include: {
        type: true,
      },
      orderBy: [{ type: { group: 'asc' } }, { expiresAt: 'asc' }],
    });

    return NextResponse.json({ qualifications });
  } catch (err) {
    console.error('Error fetching qualifications:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: employeeId } = await params;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const type = await prisma.qualificationType.findUnique({ where: { id: data.typeId } });
    if (!type) {
      return NextResponse.json({ error: 'Qualifikationstyp nicht gefunden' }, { status: 404 });
    }

    let issuedAt   = data.issuedAt  ? new Date(data.issuedAt)  : null;
    let expiresAt  = data.expiresAt ? new Date(data.expiresAt) : null;

    // Auto-calculate expiresAt if type has recurringIntervalMonths and issuedAt is given
    if (!expiresAt && type.recurringIntervalMonths && issuedAt) {
      const d = new Date(issuedAt);
      d.setMonth(d.getMonth() + type.recurringIntervalMonths);
      expiresAt = d;
    }

    const qualification = await prisma.qualification.create({
      data: {
        employeeId,
        typeId: data.typeId,
        issuedAt,
        expiresAt,
        issuer:     data.issuer     ?? null,
        certNumber: data.certNumber ?? null,
        notes:      data.notes      ?? null,
        createdBy:  session.user.id,
      },
      include: { type: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Qualification',
        entityId: qualification.id,
        newValues: JSON.stringify({ employeeId, type: type.name, issuedAt, expiresAt }),
      },
    });

    return NextResponse.json({ qualification }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: err.errors }, { status: 400 });
    }
    console.error('Error creating qualification:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

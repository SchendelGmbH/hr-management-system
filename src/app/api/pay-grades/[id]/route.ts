import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const payGradeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  tariffWage: z.number().min(0).optional().nullable(),
});

// PUT /api/pay-grades/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const data = payGradeSchema.parse(body);

    const payGrade = await prisma.payGrade.update({ where: { id }, data });
    return NextResponse.json(payGrade);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error updating pay grade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/pay-grades/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const count = await prisma.employee.count({ where: { payGradeId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: `Diese Lohngruppe ist ${count} Mitarbeiter(n) zugeordnet und kann nicht gelöscht werden.` },
        { status: 409 }
      );
    }

    await prisma.payGrade.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pay grade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

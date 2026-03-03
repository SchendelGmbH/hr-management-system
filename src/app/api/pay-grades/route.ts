import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const payGradeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  tariffWage: z.number().min(0).optional().nullable(),
});

// GET /api/pay-grades
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const payGrades = await prisma.payGrade.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });

  return NextResponse.json({ payGrades });
}

// POST /api/pay-grades
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const data = payGradeSchema.parse(body);

    const payGrade = await prisma.payGrade.create({ data });
    return NextResponse.json(payGrade, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error creating pay grade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

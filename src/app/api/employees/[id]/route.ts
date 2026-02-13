import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// GET /api/employees/[id] - Get single employee
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        customFieldValues: {
          include: {
            fieldDefinition: true,
          },
        },
        employeeSize: true,
        documents: {
          include: {
            documentType: true,
            tags: {
              include: {
                tag: true,
              },
            },
          },
          orderBy: {
            uploadedAt: 'desc',
          },
        },
        clothingOrders: {
          include: {
            items: {
              include: {
                clothingItem: true,
              },
            },
          },
          orderBy: {
            orderDate: 'desc',
          },
        },
        vacations: {
          orderBy: {
            startDate: 'desc',
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/employees/[id] - Update employee
const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  clothingBudget: z.number().min(0).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateEmployeeSchema.parse(body);

    // Get old values for audit log
    const oldEmployee = await prisma.employee.findUnique({ where: { id } });
    if (!oldEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const updateData: any = {
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
    };

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Employee',
        entityId: employee.id,
        oldValues: oldEmployee,
        newValues: employee,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/employees/[id] - Delete employee
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
    // Get employee for audit log
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Delete employee (cascade will delete related records)
    await prisma.employee.delete({ where: { id } });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Employee',
        entityId: id,
        oldValues: employee,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

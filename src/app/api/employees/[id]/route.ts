import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { checkAndResetBudget, getCurrentBudgetPeriodStart } from '@/lib/budget';
import { z } from 'zod';

// GET /api/employees/[id] - Get single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'details');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        payGrade: true,
        customFieldValues: {
          include: {
            fieldDefinition: true,
          },
        },
        employeeSize: true,
        // Nur Container-Dokumente mit Versions-Info
        documents: {
          where: { isContainer: true },
          include: {
            categories: { include: { category: true } },
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              include: { categories: { include: { category: true } } },
            },
            _count: { select: { versions: true } },
          },
          orderBy: { uploadedAt: 'desc' },
          take: 50,
        },
        clothingOrders: {
          include: {
            items: { include: { clothingItem: true } },
          },
          orderBy: { orderDate: 'desc' },
          take: 30,
        },
        vacations: {
          orderBy: { startDate: 'desc' },
          take: 30,
        },
        _count: { select: { qualifications: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // IDOR-Schutz: Nur ADMIN oder der eigene Mitarbeiter darf die Daten sehen
    if (session.user.role !== 'ADMIN' && employee.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Auto-Reset des Budgets bei neuem Quartal — kein zweiter DB-Fetch nötig
    const wasReset = await checkAndResetBudget(employee);
    if (wasReset) {
      // Felder direkt im Objekt aktualisieren statt erneut zu laden
      (employee as any).remainingBudget = employee.clothingBudget;
      (employee as any).lastBudgetReset = getCurrentBudgetPeriodStart(employee.startDate!);
    }

    // PII-Maskierung: Non-ADMIN sieht nur unkritische Felder
    if (session.user.role !== 'ADMIN') {
      const maskedEmployee = {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeNumber: employee.employeeNumber,
        department: employee.department,
      };
      return NextResponse.json(maskedEmployee);
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/employees/[id] - Update employee
const emptyToNull = z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable());

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: emptyToNull,
  email: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().email().optional().nullable()
  ),
  phone: emptyToNull,
  departmentId: emptyToNull,
  position: emptyToNull,
  startDate: emptyToNull,
  clothingBudget: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0).optional()
  ),
  street: emptyToNull,
  zipCode: emptyToNull,
  city: emptyToNull,
  socialSecurityNumber: emptyToNull,
  taxId: emptyToNull,
  healthInsurance: emptyToNull,
  isFixedTerm: z.boolean().optional(),
  fixedTermEndDate: emptyToNull,
  probationEndDate: emptyToNull,
  hourlyWage: z.preprocess(
    (val) => (val === '' || val === null ? null : typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0).optional().nullable()
  ),
  payGradeId: emptyToNull,
  vacationDays: z.preprocess(
    (val) => (val === '' || val === null ? null : typeof val === 'string' ? parseInt(val) : val),
    z.number().int().min(0).optional().nullable()
  ),
  keyNumber: emptyToNull,
  chipNumber: emptyToNull,
  driversLicenseClass: emptyToNull,
  forkliftLicense: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'edit');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateEmployeeSchema.parse(body);

    // Get old values for audit log
    const oldEmployee = await prisma.employee.findUnique({ where: { id } });
    if (!oldEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Übertariflichen Zuschlag berechnen wenn Stundenlohn oder Lohngruppe geändert wurde
    let overtariffSupplement: number | null = null;
    const newHourlyWage = data.hourlyWage !== undefined ? data.hourlyWage : oldEmployee.hourlyWage;
    const newPayGradeId = data.payGradeId !== undefined ? data.payGradeId : oldEmployee.payGradeId;

    if (newHourlyWage != null && newPayGradeId) {
      const payGrade = await prisma.payGrade.findUnique({ where: { id: newPayGradeId } });
      if (payGrade?.tariffWage != null) {
        overtariffSupplement = Number(newHourlyWage) - Number(payGrade.tariffWage);
      }
    }

    const updateData: any = {
      ...data,
      overtariffSupplement,
      dateOfBirth: data.dateOfBirth !== undefined
        ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null)
        : undefined,
      startDate: data.startDate !== undefined
        ? (data.startDate ? new Date(data.startDate) : null)
        : undefined,
      fixedTermEndDate: data.fixedTermEndDate !== undefined
        ? (data.fixedTermEndDate ? new Date(data.fixedTermEndDate) : null)
        : undefined,
      probationEndDate: data.probationEndDate !== undefined
        ? (data.probationEndDate ? new Date(data.probationEndDate) : null)
        : undefined,
    };

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        payGrade: true,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'delete');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

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

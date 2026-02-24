import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkAndResetBudget } from '@/lib/budget';
import { z } from 'zod';

// GET /api/employees - List employees with pagination, search, and filters
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search') || '';
  const departmentId = searchParams.get('departmentId') || '';

  const skip = (page - 1) * limit;

  try {
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
        // email ist verschlüsselt und kann nicht direkt durchsucht werden
      ];
    }

    // Department filter
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          employeeNumber: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    // Auto-Reset des Budgets bei neuem Quartal (parallel statt sequentiell)
    const resetResults = await Promise.all(employees.map((emp) => checkAndResetBudget(emp)));
    const anyReset = resetResults.some(Boolean);

    // Zweites findMany nur wenn tatsächlich ein Reset stattfand
    const finalEmployees = anyReset
      ? await prisma.employee.findMany({
          where,
          include: { department: { select: { id: true, name: true } } },
          orderBy: { employeeNumber: 'asc' },
          skip,
          take: limit,
        })
      : employees;

    return NextResponse.json({
      employees: finalEmployees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/employees - Create new employee
const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  clothingBudget: z.number().min(0),
  // Adresse
  street: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  // Steuern & Sozialversicherung
  socialSecurityNumber: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  healthInsurance: z.string().optional().nullable(),
  // Vertrag & Vergütung
  isFixedTerm: z.boolean().optional(),
  fixedTermEndDate: z.string().optional().nullable(),
  hourlyWage: z.number().min(0).optional().nullable(),
  payGrade: z.string().optional().nullable(),
  vacationDays: z.number().int().min(0).optional().nullable(),
  // Zugang & Identifikation
  keyNumber: z.string().optional().nullable(),
  chipNumber: z.string().optional().nullable(),
  // Qualifikationen & Lizenzen
  driversLicenseClass: z.string().optional().nullable(),
  forkliftLicense: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createEmployeeSchema.parse(body);

    // Get the next employee number
    const lastEmployee = await prisma.employee.findFirst({
      orderBy: { employeeNumber: 'desc' },
      select: { employeeNumber: true },
    });

    let nextNumber = 1;
    if (lastEmployee?.employeeNumber) {
      const match = lastEmployee.employeeNumber.match(/EMP-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const employeeNumber = `EMP-${nextNumber.toString().padStart(5, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        employeeNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        email: data.email,
        phone: data.phone,
        departmentId: data.departmentId,
        position: data.position,
        startDate: data.startDate ? new Date(data.startDate) : null,
        clothingBudget: data.clothingBudget,
        remainingBudget: data.clothingBudget,
        lastBudgetReset: new Date(),
        // Adresse
        street: data.street,
        zipCode: data.zipCode,
        city: data.city,
        // Steuern & Sozialversicherung
        socialSecurityNumber: data.socialSecurityNumber,
        taxId: data.taxId,
        healthInsurance: data.healthInsurance,
        // Vertrag & Vergütung
        isFixedTerm: data.isFixedTerm ?? false,
        fixedTermEndDate: data.fixedTermEndDate ? new Date(data.fixedTermEndDate) : null,
        hourlyWage: data.hourlyWage,
        payGrade: data.payGrade,
        vacationDays: data.vacationDays,
        // Zugang & Identifikation
        keyNumber: data.keyNumber,
        chipNumber: data.chipNumber,
        // Qualifikationen & Lizenzen
        driversLicenseClass: data.driversLicenseClass ?? 'Nein',
        forkliftLicense: data.forkliftLicense ?? false,
      },
      include: {
        department: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Employee',
        entityId: employee.id,
        newValues: employee,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { NRW_HOLIDAYS, findLastWorkingDay, type WeekendMode } from '@/lib/holidays';

export const dynamic = 'force-dynamic';

function parseDate(dateStr: string): Date {
  // Parse YYYY-MM-DD as UTC midnight
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function prevDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

async function loadPlan(date: Date) {
  return prisma.dailyPlan.findUnique({
    where: { date },
    include: {
      sites: {
        orderBy: { sortOrder: 'asc' },
        include: {
          assignments: {
            include: {
              employee: {
                select: {
                  id: true, firstName: true, lastName: true,
                  employeeNumber: true, position: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { date: dateStr } = await params;

  try {
    const date = parseDate(dateStr);

    // Load planning settings
    const settingRows = await prisma.systemSetting.findMany({
      where: { key: { in: ['planning_auto_carry_over', 'planning_pool_departments', 'planning_weekend_mode'] } },
    });
    const settingMap = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
    const autoCarryOver = (settingMap.planning_auto_carry_over ?? 'true') !== 'false';
    const weekendMode = (settingMap.planning_weekend_mode ?? 'both') as WeekendMode;
    const poolDepartmentIds: string[] = settingMap.planning_pool_departments
      ? (JSON.parse(settingMap.planning_pool_departments) as string[])
      : [];

    // Feiertag-Check für den aktuellen Tag
    const currentDateStr = date.toISOString().split('T')[0];
    const holiday = NRW_HOLIDAYS.find((h) => h.date === currentDateStr);
    const isHoliday = !!holiday;
    const holidayName = holiday?.name ?? null;

    let plan = await loadPlan(date);
    let isTemplate = false;

    // If no plan for today → optionally use last working day as template
    if (!plan && autoCarryOver) {
      const lastWorkingDay = findLastWorkingDay(date, weekendMode);
      const templatePlan = await loadPlan(lastWorkingDay);
      if (templatePlan) {
        plan = templatePlan;
        isTemplate = true;
      }
    }

    // Get absences for this date
    const absences = await prisma.vacation.findMany({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
      },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeNumber: true, position: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    // Get active employees, optionally filtered by department
    const allEmployees = await prisma.employee.findMany({
      where: poolDepartmentIds.length > 0
        ? { departmentId: { in: poolDepartmentIds } }
        : undefined,
      select: {
        id: true, firstName: true, lastName: true,
        employeeNumber: true, position: true,
        department: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return NextResponse.json({
      plan: isTemplate ? null : plan,
      isTemplate,
      isHoliday,
      holidayName,
      sites: plan?.sites ?? [],
      absences,
      allEmployees,
    });
  } catch (err) {
    console.error('Error fetching daily plan:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { date: dateStr } = await params;

  try {
    const date = parseDate(dateStr);
    const body = await request.json();
    const { sites = [] } = body as {
      sites: Array<{
        name: string;
        location?: string;
        color?: string;
        vehiclePlates?: string[];
        startTime?: string;
        endTime?: string;
        sortOrder?: number;
        assignments?: Array<{ employeeId: string; note?: string }>;
      }>;
    };

    // Upsert the plan
    const plan = await prisma.dailyPlan.upsert({
      where: { date },
      create: { date, createdBy: session.user.id },
      update: { updatedAt: new Date() },
    });

    // Delete all existing sites (cascade deletes assignments)
    await prisma.dailyPlanSite.deleteMany({ where: { planId: plan.id } });

    // Re-create sites with assignments
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      const site = await prisma.dailyPlanSite.create({
        data: {
          planId: plan.id,
          name: s.name,
          location: s.location ?? null,
          color: s.color ?? null,
          vehiclePlates: s.vehiclePlates ?? [],
          startTime: s.startTime ?? '06:00',
          endTime: s.endTime ?? '16:00',
          sortOrder: s.sortOrder ?? i,
        },
      });

      if (s.assignments && s.assignments.length > 0) {
        await prisma.dailyPlanAssignment.createMany({
          data: s.assignments.map((a) => ({
            siteId: site.id,
            employeeId: a.employeeId,
            note: a.note ?? null,
          })),
          skipDuplicates: true,
        });
      }

      // Auto-upsert WorkSite (Stammbaustelle)
      await prisma.workSite.upsert({
        where: { name_location: { name: s.name, location: s.location ?? '' } },
        create: {
          name: s.name,
          location: s.location ?? null,
          color: s.color ?? null,
          defaultStartTime: s.startTime ?? '06:00',
          defaultEndTime: s.endTime ?? '16:00',
          defaultVehiclePlate: s.vehiclePlates?.[0] ?? null,
          lastUsedAt: new Date(),
        },
        update: {
          lastUsedAt: new Date(),
          defaultVehiclePlate: s.vehiclePlates?.[0] ?? null,
          defaultStartTime: s.startTime ?? '06:00',
          defaultEndTime: s.endTime ?? '16:00',
        },
      });
    }

    // Cleanup stale work sites (retention days from settings, default 30)
    const retentionRow = await prisma.systemSetting.findUnique({
      where: { key: 'planning_site_retention_days' },
    });
    const retentionDays = parseInt(retentionRow?.value ?? '30', 10) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    await prisma.workSite.deleteMany({ where: { lastUsedAt: { lt: cutoff } } });

    // Return updated plan
    const updated = await loadPlan(date);
    return NextResponse.json({ plan: updated, sites: updated?.sites ?? [] });
  } catch (err) {
    console.error('Error saving daily plan:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

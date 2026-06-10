import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isAdminFromSession } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { NRW_HOLIDAYS } from '@/lib/holidays';

export const dynamic = 'force-dynamic';

const MILESTONE_YEARS = new Set([1, 5, 10, 15, 20, 25, 30, 35, 40]);
const RANGE_START = new Date('2026-01-01');
const RANGE_END_YEAR = 2028;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Projects a reference date (birthday / start date) to a given year. */
function projectToYear(ref: Date, year: number): Date {
  const month = ref.getMonth();
  const day = ref.getDate();
  // Feb 29 in a non-leap year → use Feb 28
  const adjustedDay = month === 1 && day === 29 && !isLeapYear(year) ? 28 : day;
  return new Date(year, month, adjustedDay);
}

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'calendar', 'view');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    // ── 1. Vacations (gefiltert nach eigener ID für Non-Admin) ─────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vacationWhere: any = {};
    if (!isAdminFromSession(session)) {
      vacationWhere.employeeId = session.user.id;
    }
    const vacations = await prisma.vacation.findMany({
      where: vacationWhere,
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeNumber: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // ── 2. Documents with expiration date (gefiltert für Non-Admin) ─────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docWhere: any = { isContainer: true, expirationDate: { not: null } };
    if (!isAdminFromSession(session)) {
      docWhere.employeeId = session.user.id;
    }
    const documents = await prisma.document.findMany({
      where: docWhere,
      select: {
        id: true, title: true, expirationDate: true, notes: true,
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeNumber: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    // ── 3. All employees (for all date-based events – birthdays/anniversaries sind öffentlich)
    const employees = await prisma.employee.findMany({
      select: {
        id: true, firstName: true, lastName: true, employeeNumber: true,
        dateOfBirth: true, startDate: true,
        fixedTermEndDate: true, probationEndDate: true,
        department: { select: { name: true } },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = [];

    // ── Vacation events ───────────────────────────────────────────────────────
    for (const v of vacations) {
      events.push({
        id: `vacation-${v.id}`,
        type: v.vacationType,
        title: `${v.employee.firstName} ${v.employee.lastName}`,
        start: v.startDate.toISOString().split('T')[0],
        end: v.endDate.toISOString().split('T')[0],
        notes: v.notes ?? null,
        sourceId: v.id, sourceType: 'vacation',
        employee: v.employee,
      });
    }

    // ── Document expiry events ────────────────────────────────────────────────
    for (const doc of documents) {
      const dateStr = doc.expirationDate!.toISOString().split('T')[0];
      events.push({
        id: `doc-${doc.id}`,
        type: 'DOC_EXPIRY',
        title: `${doc.title}: ${doc.employee.firstName} ${doc.employee.lastName}`,
        start: dateStr, end: dateStr,
        notes: doc.notes ?? null,
        sourceId: doc.id, sourceType: 'document',
        employee: doc.employee,
        document: { id: doc.id, title: doc.title },
      });
    }

    // ── Employee date events ──────────────────────────────────────────────────
    for (const emp of employees) {
      const empInfo = {
        id: emp.id, firstName: emp.firstName, lastName: emp.lastName,
        employeeNumber: emp.employeeNumber, department: emp.department,
      };

      // Fixed-term contract end
      if (emp.fixedTermEndDate) {
        const ds = emp.fixedTermEndDate.toISOString().split('T')[0];
        events.push({
          id: `fixedterm-${emp.id}`, type: 'FIXED_TERM',
          title: `Befristung: ${emp.firstName} ${emp.lastName}`,
          start: ds, end: ds, notes: null,
          sourceId: emp.id, sourceType: 'employee', employee: empInfo,
        });
      }

      // Probation end
      if (emp.probationEndDate) {
        const ds = emp.probationEndDate.toISOString().split('T')[0];
        events.push({
          id: `probation-${emp.id}`, type: 'PROBATION',
          title: `Probezeit: ${emp.firstName} ${emp.lastName}`,
          start: ds, end: ds, notes: null,
          sourceId: emp.id, sourceType: 'employee', employee: empInfo,
        });
      }

      // First working day (only future/recent hires in range)
      if (emp.startDate) {
        const sd = new Date(emp.startDate);
        if (sd >= RANGE_START) {
          events.push({
            id: `firstday-${emp.id}`, type: 'FIRST_DAY',
            title: `Erster Tag: ${emp.firstName} ${emp.lastName}`,
            start: sd.toISOString().split('T')[0], end: sd.toISOString().split('T')[0],
            notes: null,
            sourceId: emp.id, sourceType: 'firstday', employee: empInfo,
          });
        }
      }

      // Birthdays – project to every year in range
      if (emp.dateOfBirth) {
        const bd = new Date(emp.dateOfBirth);
        for (let year = 2026; year <= RANGE_END_YEAR; year++) {
          const age = year - bd.getFullYear();
          if (age <= 0) continue;
          const projected = projectToYear(bd, year);
          if (projected < RANGE_START) continue;
          events.push({
            id: `birthday-${emp.id}-${year}`, type: 'BIRTHDAY',
            title: `Geburtstag: ${emp.firstName} ${emp.lastName} (${age})`,
            start: projected.toISOString().split('T')[0], end: projected.toISOString().split('T')[0],
            notes: null, yearsCount: age,
            sourceId: emp.id, sourceType: 'birthday', employee: empInfo,
          });
        }
      }

      // Work anniversaries – project to every year in range
      if (emp.startDate) {
        const sd = new Date(emp.startDate);
        for (let year = 2026; year <= RANGE_END_YEAR; year++) {
          const years = year - sd.getFullYear();
          if (years <= 0) continue;
          const projected = projectToYear(sd, year);
          if (projected < RANGE_START) continue;
          const isMilestone = MILESTONE_YEARS.has(years);
          const yearLabel = years === 1 ? 'Jahr' : 'Jahre';
          events.push({
            id: `anniversary-${emp.id}-${year}`,
            type: isMilestone ? 'ANNIVERSARY_MILESTONE' : 'ANNIVERSARY',
            title: `${isMilestone ? '★ ' : ''}${years} ${yearLabel}: ${emp.firstName} ${emp.lastName}`,
            start: projected.toISOString().split('T')[0], end: projected.toISOString().split('T')[0],
            notes: null, yearsCount: years,
            sourceId: emp.id, sourceType: 'anniversary', employee: empInfo,
          });
        }
      }
    }

    // ── Qualification expiry events (gefiltert für Non-Admin) ─────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qualWhere: any = { expiresAt: { not: null } };
    if (!isAdminFromSession(session)) {
      qualWhere.employeeId = session.user.id;
    }
    const qualifications = await prisma.qualification.findMany({
      where: qualWhere,
      select: {
        id: true, expiresAt: true,
        type: { select: { name: true, group: true } },
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeNumber: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    for (const q of qualifications) {
      const dateStr = q.expiresAt!.toISOString().split('T')[0];
      events.push({
        id: `qualification-${q.id}`,
        type: 'QUALIFICATION_EXPIRY',
        title: `${q.type.name}: ${q.employee.firstName} ${q.employee.lastName}`,
        start: dateStr, end: dateStr,
        notes: null,
        sourceId: q.id, sourceType: 'qualification',
        employee: q.employee,
      });
    }

    // ── NRW Holidays ─────────────────────────────────────────────────────────
    for (const h of NRW_HOLIDAYS) {
      events.push({
        id: `holiday-${h.date}`, type: 'HOLIDAY',
        title: h.name,
        start: h.date, end: h.date,
        notes: null,
        sourceId: h.date, sourceType: 'holiday',
      });
    }

    return NextResponse.json({ events });
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

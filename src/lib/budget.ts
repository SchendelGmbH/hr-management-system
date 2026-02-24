import prisma from '@/lib/prisma';

/**
 * Ermittelt den Anfang des Kalenderquartals für ein gegebenes Datum.
 * Q1: 01.01., Q2: 01.04., Q3: 01.07., Q4: 01.10.
 */
function getCalendarQuarterStart(date: Date): { month: number; day: number } {
  const month = date.getMonth(); // 0-11
  const quarterStartMonth = Math.floor(month / 3) * 3; // 0, 3, 6, 9
  return { month: quarterStartMonth, day: 1 };
}

/**
 * Berechnet den Start der aktuellen Budgetperiode.
 * Budget läuft jährlich, immer ab dem Anfang des Kalenderquartals,
 * in dem der Mitarbeiter eingetreten ist.
 *
 * Beispiel: Eintritt 15.05.2024 → Eintrittsquartal Q2 (April)
 *   - Periode 1: 01.04.2024 - 31.03.2025
 *   - Periode 2: 01.04.2025 - 31.03.2026
 */
export function getCurrentBudgetPeriodStart(startDate: Date): Date {
  const now = new Date();
  const start = new Date(startDate);

  // Kalenderquartal des Eintritts bestimmen (Monat 0,3,6,9)
  const { month: quarterMonth } = getCalendarQuarterStart(start);

  // Erster Periodenstart = Anfang des Eintrittsquartals im Eintrittsjahr
  let periodStart = new Date(start.getFullYear(), quarterMonth, 1);

  // Jährlich weiterzählen bis wir die aktuelle Periode finden
  while (true) {
    const nextPeriodStart = new Date(periodStart);
    nextPeriodStart.setFullYear(nextPeriodStart.getFullYear() + 1);

    if (nextPeriodStart > now) {
      // periodStart ist der aktuelle Periodenstart
      break;
    }
    periodStart = nextPeriodStart;
  }

  return periodStart;
}

/**
 * Berechnet das Ende der aktuellen Budgetperiode (= nächster Periodenstart - 1 Tag)
 */
export function getCurrentBudgetPeriodEnd(startDate: Date): Date {
  const periodStart = getCurrentBudgetPeriodStart(startDate);
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  periodEnd.setDate(periodEnd.getDate() - 1);
  return periodEnd;
}

/**
 * Prüft ob ein Budget-Reset nötig ist und führt ihn ggf. durch.
 * Reset passiert jährlich am Anfang des Eintrittsquartals.
 */
export async function checkAndResetBudget(employee: {
  id: string;
  startDate: Date | null;
  clothingBudget: any;
  remainingBudget: any;
  lastBudgetReset: Date | null;
}) {
  // Kein Eintrittsdatum = kein Budget-Reset
  if (!employee.startDate) return false;

  const periodStart = getCurrentBudgetPeriodStart(employee.startDate);

  // Prüfe ob ein Reset nötig ist:
  // - Noch nie zurückgesetzt (lastBudgetReset === null)
  // - Oder letzter Reset war vor dem aktuellen Periodenstart
  const needsReset =
    !employee.lastBudgetReset ||
    new Date(employee.lastBudgetReset) < periodStart;

  if (needsReset) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        remainingBudget: employee.clothingBudget,
        lastBudgetReset: periodStart,
      },
    });
    return true;
  }

  return false;
}

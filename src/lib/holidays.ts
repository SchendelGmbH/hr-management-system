// NRW Public Holidays 2026–2028
export const NRW_HOLIDAYS: { date: string; name: string }[] = [
  // 2026
  { date: '2026-01-01', name: 'Neujahr' },
  { date: '2026-04-03', name: 'Karfreitag' },
  { date: '2026-04-06', name: 'Ostermontag' },
  { date: '2026-05-01', name: 'Tag der Arbeit' },
  { date: '2026-05-14', name: 'Christi Himmelfahrt' },
  { date: '2026-05-25', name: 'Pfingstmontag' },
  { date: '2026-06-04', name: 'Fronleichnam' },
  { date: '2026-10-03', name: 'Tag der Deutschen Einheit' },
  { date: '2026-11-01', name: 'Allerheiligen' },
  { date: '2026-12-25', name: '1. Weihnachtstag' },
  { date: '2026-12-26', name: '2. Weihnachtstag' },
  // 2027
  { date: '2027-01-01', name: 'Neujahr' },
  { date: '2027-03-26', name: 'Karfreitag' },
  { date: '2027-03-29', name: 'Ostermontag' },
  { date: '2027-05-01', name: 'Tag der Arbeit' },
  { date: '2027-05-06', name: 'Christi Himmelfahrt' },
  { date: '2027-05-17', name: 'Pfingstmontag' },
  { date: '2027-05-27', name: 'Fronleichnam' },
  { date: '2027-10-03', name: 'Tag der Deutschen Einheit' },
  { date: '2027-11-01', name: 'Allerheiligen' },
  { date: '2027-12-25', name: '1. Weihnachtstag' },
  { date: '2027-12-26', name: '2. Weihnachtstag' },
  // 2028
  { date: '2028-01-01', name: 'Neujahr' },
  { date: '2028-04-14', name: 'Karfreitag' },
  { date: '2028-04-17', name: 'Ostermontag' },
  { date: '2028-05-01', name: 'Tag der Arbeit' },
  { date: '2028-05-25', name: 'Christi Himmelfahrt' },
  { date: '2028-06-05', name: 'Pfingstmontag' },
  { date: '2028-06-15', name: 'Fronleichnam' },
  { date: '2028-10-03', name: 'Tag der Deutschen Einheit' },
  { date: '2028-11-01', name: 'Allerheiligen' },
  { date: '2028-12-25', name: '1. Weihnachtstag' },
  { date: '2028-12-26', name: '2. Weihnachtstag' },
];

export type WeekendMode = 'none' | 'saturday' | 'both';

/** Returns true if this date should be skipped for carry-over purposes */
export function isSkippedDay(date: Date, weekendMode: WeekendMode): boolean {
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 6=Sat
  if (weekendMode === 'none' && (dayOfWeek === 0 || dayOfWeek === 6)) return true;
  if (weekendMode === 'saturday' && dayOfWeek === 0) return true;
  const dateStr = date.toISOString().split('T')[0];
  return NRW_HOLIDAYS.some((h) => h.date === dateStr);
}

/** Walk backwards from date to find the last non-skipped day */
export function findLastWorkingDay(date: Date, weekendMode: WeekendMode): Date {
  const d = new Date(date);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (isSkippedDay(d, weekendMode));
  return d;
}
